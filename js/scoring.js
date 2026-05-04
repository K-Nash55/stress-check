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
    supabase.from('scales_master').select('*')
  ]);
  var qRes = results[0];
  var sRes = results[1];
  if (qRes.error) throw new Error('questions_master取得失敗: ' + qRes.error.message);
  if (sRes.error) throw new Error('scales_master取得失敗: ' + sRes.error.message);
  _masterCache = { questions: qRes.data, scales: sRes.data };
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
    result[k] = Object.assign({}, sr, { dev: dev });
  }
  return result;
}

// ─────────────────────────────────────────
// 5. 高ストレス判定
// ─────────────────────────────────────────

/**
 * 高ストレス判定を行う
 * 偏差値は全て「高い＝良い状態」で統一
 * @param {Object} deviations calcAllDeviations()の返り値
 * @returns {string} 'high' | 'mid' | 'low'
 */
function getStressLevel(deviations) {
  // ストレス反応6スケール（高い=症状少ない=良い）
  var reactionItems = ['活気', 'イライラ感', '疲労感', '不安感', '抑うつ感', '身体愁訴'];
  var reactionSum = 0, reactionCount = 0;
  for (var i = 0; i < reactionItems.length; i++) {
    if (deviations[reactionItems[i]]) {
      reactionSum += deviations[reactionItems[i]].dev;
      reactionCount++;
    }
  }
  var reaction_avg = reactionCount > 0 ? reactionSum / reactionCount : 50;

  // ストレッサー8スケール（高い=低負担=良い）
  var stressorItems = [
    '仕事の量的負担', '仕事の質的負担', '身体的負担度',
    '職場での対人関係', '職場環境', '情緒的負担',
    '役割葛藤', 'ワーク・セルフ・バランス（ネガティブ）'
  ];
  var stressorSum = 0, stressorCount = 0;
  for (var j = 0; j < stressorItems.length; j++) {
    if (deviations[stressorItems[j]]) {
      stressorSum += deviations[stressorItems[j]].dev;
      stressorCount++;
    }
  }
  var stressor_avg = stressorCount > 0 ? stressorSum / stressorCount : 50;

  // リソース系スケール（高い=資源豊富=良い）
  var resourceItems = [
    '仕事のコントロール', '技能の活用度', '仕事の適性', '仕事の意義',
    '役割明確さ', '成長の機会', '新奇性', '予測可能性',
    'ワーク・セルフ・バランス（ポジティブ）',
    '上司からのサポート', '同僚からのサポート',
    '経済・地位報酬', '尊重報酬', '安定報酬',
    '上司のリーダーシップ', '上司の公正な態度',
    'ほめてもらえる職場', '失敗を認める職場', 'グループの有能感',
    '家族・友人からのサポート',
    '経営層との信頼関係', '変化への対応', '手続きの公正性', '個人の尊重',
    '公正な人事評価', '多様な労働者への対応', 'キャリア形成'
  ];
  var resourceSum = 0, resourceCount = 0;
  for (var k = 0; k < resourceItems.length; k++) {
    if (deviations[resourceItems[k]]) {
      resourceSum += deviations[resourceItems[k]].dev;
      resourceCount++;
    }
  }
  var resource_avg = resourceCount > 0 ? resourceSum / resourceCount : 50;

  // 判定（高い=良い方向で統一）
  if (reaction_avg <= 40)                              return 'high';
  if (reaction_avg <= 45 && stressor_avg >= 55)        return 'high';
  if (reaction_avg <= 45 && resource_avg <= 45)        return 'high';
  if (reaction_avg <= 50 || stressor_avg >= 55)        return 'mid';
  return 'low';
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
