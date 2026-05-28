/**
 * scoring.js
 * Supabaseマスターテーブルを参照する採点エンジン
 *
 * 設計原則:
 * - answersには生の選択肢番号(1〜4)が入っている
 * - 素点変換はcalcRawScore()がdirectionを見て行う
 * - 偏差値は全スケール共通で「高い＝良い状態」
 * - toStressDev()・活気の100-dev反転は廃止
 * - questions.jsへの依存なし
 *
 * 依存: js/supabase-client.js が先に読み込まれていること
 */

// ─────────────────────────────────────────
// 1. マスターデータ取得
// ─────────────────────────────────────────

var _masterCache = null;

/**
 * Supabaseからquestions_masterとscales_masterを取得してキャッシュする
 * アプリ起動時に1回だけ呼ぶ
 * @returns {Promise<{questions: Array, scales: Array}>}
 */
async function loadMaster() {
  if (_masterCache) return _masterCache;
  var results = await Promise.all([
    supabase.from('questions_master').select('*').order('q141', { ascending: true }),
    supabase.from('scales_master').select('*').order('scale_no', { ascending: true }),
    supabase.from('stress_judgment_rules').select('*').order('priority', { ascending: true })
  ]);
  var qRes = results[0];
  var sRes = results[1];
  var jRes = results[2];
  if (qRes.error) throw new Error('questions_master取得失敗: ' + qRes.error.message);
  if (sRes.error) throw new Error('scales_master取得失敗: ' + sRes.error.message);
  if (jRes.error) throw new Error('stress_judgment_rules取得失敗: ' + jRes.error.message);
  _masterCache = { questions: qRes.data, scales: sRes.data, judgmentRules: jRes.data };
  return _masterCache;
}

// ─────────────────────────────────────────
// 2. 素点変換
// ─────────────────────────────────────────

/**
 * 生の選択肢番号(1〜4)を素点に変換する
 * direction="1234": choiceIndexをそのまま返す（1→1, 2→2, 3→3, 4→4）
 * direction="4321": 5 - choiceIndexを返す（1→4, 2→3, 3→2, 4→1）
 * @param {number} choiceIndex 選択肢番号(1〜4)
 * @param {string} direction   "1234" | "4321"
 * @returns {number} 素点(1〜4)
 */
function calcRawScore(choiceIndex, direction) {
  return direction === '4321' ? 5 - choiceIndex : choiceIndex;
}

// ─────────────────────────────────────────
// 3. スケール集計
// ─────────────────────────────────────────

/**
 * 回答データからスケールごとの集計結果を返す
 * @param {Object} answers   { 問番号: 選択肢番号(1〜4), ... }
 * @param {Array}  questions loadMaster()で取得したquestions配列
 * @returns {Object} {
 *   "仕事の量的負担": {
 *     rawScores: [2, 3, 2],
 *     avg: 2.33,
 *     scaleName: "仕事の量的負担",
 *     fullScaleName: "01.   仕事の量的負担",
 *     category: "1.ストレッサー（仕事の負担）"
 *   }, ...
 * }
 */
function calcScaleResults(answers, questions) {
  var scaleMap = {};
  for (var i = 0; i < questions.length; i++) {
    var q = questions[i];
    var name = cleanScaleName(q.scale_name);
    if (!scaleMap[name]) {
      scaleMap[name] = {
        rawScores: [],
        scaleName: name,
        fullScaleName: q.scale_name,
        category: q.category
      };
    }
    var qNo = q.q141;
    var choice = answers[qNo] !== undefined ? answers[qNo] : answers[String(qNo)];
    if (choice != null) {
      scaleMap[name].rawScores.push(calcRawScore(choice, q.direction));
    }
  }
  for (var k in scaleMap) {
    var d = scaleMap[k];
    var sum = 0;
    for (var j = 0; j < d.rawScores.length; j++) sum += d.rawScores[j];
    d.avg = d.rawScores.length > 0 ? sum / d.rawScores.length : 0;
  }
  return scaleMap;
}

// ─────────────────────────────────────────
// 4. 偏差値計算
// ─────────────────────────────────────────

/**
 * 偏差値を計算する（全国平均=50、高い＝良い状態）
 * @param {number} myAvg  自分の平均点
 * @param {number} natAvg 全国平均
 * @param {number} sd     標準偏差
 * @returns {number} 偏差値（データなし時は50）
 */
function calcDeviation(myAvg, natAvg, sd) {
  if (!natAvg || !sd) return 50;
  return Math.round((50 + (myAvg - natAvg) / sd * 10) * 10) / 10;
}

/**
 * scaleResultsの全スケールに偏差値を付与して返す
 * @param {Object} scaleResults calcScaleResults()の返り値
 * @param {Array}  scales       loadMaster()で取得したscales配列
 * @returns {Object} devフィールドを追加したscaleResults
 * {
 *   "仕事の量的負担": {
 *     ...scaleResultsの内容,
 *     dev: 48.2
 *   }, ...
 * }
 */
function calcAllDeviations(scaleResults, scales) {
  var scaleIndex = {};
  for (var i = 0; i < scales.length; i++) {
    var sName = cleanScaleName(scales[i].scale_name);
    scaleIndex[sName] = scales[i];
  }
  var result = {};
  for (var k in scaleResults) {
    var sr = scaleResults[k];
    var sm = scaleIndex[k];
    var dev = sm
      ? calcDeviation(sr.avg, sm.scale_avg, sm.scale_sd)
      : calcDeviation(sr.avg, null, null);
    result[k] = Object.assign({}, sr, {
      dev: dev,
      displayDev: Math.round((100 - dev) * 10) / 10
    });
  }
  return result;
}

// ─────────────────────────────────────────
// 5. 高ストレス判定
// ─────────────────────────────────────────

/**
 * 領域A・B・Cの合計点数を計算する（PDFの方法1）
 * @param {Object} answers   { 問番号: 選択肢番号(1〜4), ... }
 * @param {Array}  questions loadMaster()で取得したquestions配列
 * @returns {Object} { A: number, B: number, C: number }
 */
function calcDomainScores(answers, questions) {
  // 逆転対象のq141番号（PDFより：領域Aの1〜7,11〜13,15と領域Bの活気1〜3）
  var reverseQ141 = [1, 2, 3, 4, 5, 6, 7, 11, 12, 13, 15, 20, 21, 22];

  var scores = { A: 0, B: 0, C: 0 };

  for (var i = 0; i < questions.length; i++) {
    var q = questions[i];
    if (!q.stress_domain) continue;

    var qNo = q.q141;
    var choice = answers[qNo] !== undefined ? answers[qNo] : answers[String(qNo)];
    if (choice == null) continue;

    var needsReverse = reverseQ141.indexOf(qNo) !== -1;
    var score = needsReverse ? 5 - choice : choice;

    scores[q.stress_domain] += score;
  }

  return scores;
}

/**
 * 高ストレス判定を行う（stress_judgment_rulesを参照）
 * @param {Object} answers       { 問番号: 選択肢番号(1〜4), ... }
 * @param {Array}  questions     loadMaster()で取得したquestions配列
 * @param {Array}  judgmentRules loadMaster()で取得したstress_judgment_rules配列
 * @returns {Object} {
 *   code: 'H1'〜'N3',
 *   label: '早急改善型'等,
 *   isHighStress: true/false,
 *   domainB: number,
 *   domainAC: number,
 *   advice: string,
 *   color: string,
 *   stress_reaction: string,
 *   environment: string
 * }
 */
function getStressLevel(answers, questions, judgmentRules) {
  var domain = calcDomainScores(answers, questions);
  var domainAC = domain.A + domain.C;

  // priorityの順番にルールを照合
  for (var i = 0; i < judgmentRules.length; i++) {
    var rule = judgmentRules[i];

    // 最後のルール（N3）は常に該当
    if (i === judgmentRules.length - 1) {
      return {
        code: rule.code,
        label: rule.label,
        isHighStress: rule.is_high_stress,
        domainB: domain.B,
        domainAC: domainAC,
        advice: rule.advice,
        color: rule.color,
        stress_reaction: rule.stress_reaction,
        environment: rule.environment
      };
    }

    if (domain.B >= rule.domain_b_min && domain.B <= rule.domain_b_max &&
        domainAC >= rule.domain_ac_min && domainAC <= rule.domain_ac_max) {
      return {
        code: rule.code,
        label: rule.label,
        isHighStress: rule.is_high_stress,
        domainB: domain.B,
        domainAC: domainAC,
        advice: rule.advice,
        color: rule.color,
        stress_reaction: rule.stress_reaction,
        environment: rule.environment
      };
    }
  }

  // フォールバック（通常はN3で捕捉される）
  return {
    code: 'N3',
    label: 'ポジティブ型',
    isHighStress: false,
    domainB: domain.B,
    domainAC: domainAC,
    advice: '',
    color: 'green',
    stress_reaction: '適切なストレス',
    environment: '標準環境'
  };
}

// ─────────────────────────────────────────
// 6. ユーティリティ
// ─────────────────────────────────────────

/**
 * 偏差値から信号機カラーを返す（高い＝良い方向、全スケール共通）
 * dev >= 45 → 'blue'（良好）
 * dev 40〜44 → 'yellow'（注意）
 * dev < 40  → 'red'（要注意）
 * @param {number} dev 偏差値
 * @returns {string} 'blue' | 'yellow' | 'red'
 */
function getDevColor(dev) {
  if (dev >= 45) return 'blue';
  if (dev >= 40) return 'yellow';
  return 'red';
}

/**
 * スケール名を正規化する
 * "01.   仕事の量的負担" → "仕事の量的負担"
 * "[家族・友人からのサポート]" → "家族・友人からのサポート"
 */
function cleanScaleName(k) {
  return k.replace(/^\d+[\.\-]?\s+/, '').trim()
          .replace(/^\[/, '').replace(/\]$/, '').replace(/※$/, '').trim();
}

/**
 * カテゴリでフィルタしたスケール一覧を返す
 * @param {Object} deviations calcAllDeviations()の返り値
 * @param {string} category   例: '1.ストレッサー（仕事の負担）'
 * @returns {Array} [{ scaleName, dev, avg, category }, ...]
 */
function scalesByCategory(deviations, category) {
  var out = [];
  for (var k in deviations) {
    var d = deviations[k];
    if (d.category !== category) continue;
    out.push({
      scaleName: d.scaleName,
      dev: d.dev,
      avg: d.avg,
      category: d.category
    });
  }
  return out;
}
