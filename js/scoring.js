/**
 * scoring.js
 * ストレスチェック採点ロジック 集約モジュール
 *
 * 【設計方針】
 * - QUESTIONS（questions.js）の direction フィールドは
 *   「高得点 = 良い状態」に全問統一済み（getScore()で変換済み）
 * - このファイルでは「高得点 = ストレス高い（不調）」方向に
 *   再統一してから偏差値・判定を行う
 * - 「活気」のみ例外：高得点=良いので反転が必要
 * - result.html / stress_check_group_analysis.html は
 *   このファイルの関数を呼ぶだけでよい
 *
 * 【依存】questions.js が先に読み込まれていること
 */

// ─────────────────────────────────────────
// 1. スケール集計（answers → scaleResults）
// ─────────────────────────────────────────

/**
 * 回答データからスケールごとの集計結果を返す
 * @param {Object} answers  { 設問番号(数値 or 文字列): スコア(1-4), ... }
 * @returns {Object} scaleResults
 *   {
 *     "01.   仕事の量的負担": {
 *       score: 合計点,
 *       avg: 平均点,
 *       maxScore: 最大点,
 *       questions: [question オブジェクト, ...],
 *       category: "1.ストレッサー（仕事の負担）"
 *     }, ...
 *   }
 */
function calcScaleResults(answers) {
  var scaleMap = {};
  for (var i = 0; i < QUESTIONS.length; i++) {
    var q = QUESTIONS[i];
    var key = q.scale.trim();
    if (!scaleMap[key]) {
      scaleMap[key] = { questions: [], category: q.category };
    }
    scaleMap[key].questions.push(q);
  }

  var scaleResults = {};
  for (var k in scaleMap) {
    var d = scaleMap[k];
    var tot = 0;
    for (var j = 0; j < d.questions.length; j++) {
      tot += (answers[d.questions[j].no] || answers[String(d.questions[j].no)] || 0);
    }
    scaleResults[k] = {
      score:     tot,
      avg:       tot / d.questions.length,
      maxScore:  d.questions.length * 4,
      questions: d.questions,
      category:  d.category
    };
  }
  return scaleResults;
}

// ─────────────────────────────────────────
// 2. 偏差値計算
// ─────────────────────────────────────────

/**
 * 偏差値を計算する（全国平均=50）
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
 * スケール名から偏差値を返す
 * @param {Object} scaleResults  calcScaleResults()の返り値
 * @param {string} scaleName     尺度名（番号なし・括弧なし）
 * @returns {number} 偏差値
 */
function getScaleDev(scaleResults, scaleName) {
  for (var k in scaleResults) {
    // "01.   仕事の量的負担" → "仕事の量的負担" に正規化して比較
    var clean = k.replace(/^\d+[\.\s\-]+/, '').trim()
                 .replace(/^\[/, '').replace(/\]$/, '').replace(/※$/, '').trim();
    if (clean === scaleName) {
      var sr = scaleResults[k];
      var q  = sr.questions[0];
      return calcDeviation(sr.avg, q ? q.avg : null, q ? q.sd : null);
    }
  }
  return 50; // データなし
}

/**
 * 「ストレス方向偏差値」を返す
 * 全スケールを「高いほど不調・ストレス高い」方向に統一
 *
 * 【活気のみ反転】
 *   活気は高得点=良いので、不調方向 = 100 - 偏差値
 *   他のストレス反応（イライラ・疲労等）は低得点=良いので反転不要
 *
 * @param {number} dev       偏差値（高得点=良い方向）
 * @param {string} scaleName スケール名
 * @returns {number} ストレス方向偏差値（高いほど不調）
 */
function toStressDev(dev, scaleName) {
  return scaleName === '活気' ? (100 - dev) : dev;
}

// ─────────────────────────────────────────
// 3. 高ストレス判定
// ─────────────────────────────────────────

/**
 * 高ストレス判定を行う
 * @param {Object} scaleResults  calcScaleResults()の返り値
 * @returns {string} 'high' | 'mid' | 'low'
 */
function getStressLevel(scaleResults) {

  // ① ストレッサー8項目の偏差値平均
  var stressorItems = [
    '仕事の量的負担', '仕事の質的負担', '身体的負担度',
    '職場での対人関係', '職場環境', '情緒的負担',
    '役割葛藤', 'ワーク・セルフ・バランス（ネガティブ）'
  ];
  var stressorSum = 0;
  for (var i = 0; i < stressorItems.length; i++) {
    stressorSum += getScaleDev(scaleResults, stressorItems[i]);
  }
  var stressor = stressorSum / stressorItems.length;

  // ② リソース（作業・部署・会社）偏差値平均
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
  var resourceSum = 0;
  for (var i = 0; i < resourceItems.length; i++) {
    resourceSum += getScaleDev(scaleResults, resourceItems[i]);
  }
  var resource = resourceSum / resourceItems.length;

  // ③ 精神的ストレス反応（活気は不調方向に反転）
  var mentalItems = ['活気', 'イライラ感', '疲労感', '不安感', '抑うつ感'];
  var mentalSum = 0;
  for (var i = 0; i < mentalItems.length; i++) {
    var d = getScaleDev(scaleResults, mentalItems[i]);
    mentalSum += toStressDev(d, mentalItems[i]);
  }
  var mental = mentalSum / mentalItems.length;

  // ③ 身体愁訴（高得点=症状なし=良いので不調方向に反転）
  var body = toStressDev(getScaleDev(scaleResults, '身体愁訴'), '身体愁訴');

  // ③ 総合反応スコア（精神5項目 + 身体愁訴の平均）
  var reaction = (mental + body) / 2;

  // ── 判定 ──
  // reaction・stressor は「高いほど不調・ストレス高い」方向
  // resource は「高いほど良い」方向（反転しない）
  if (reaction >= 60)                          return 'high';
  if (reaction >= 55 && stressor >= 55)        return 'high';
  if (reaction >= 55 && resource <= 45)        return 'high';
  if (reaction >= 50 || stressor >= 55)        return 'mid';
  return 'low';
}

// ─────────────────────────────────────────
// 4. ユーティリティ
// ─────────────────────────────────────────

/**
 * スケール名から表示用のクリーンな名前を返す
 * "01.   仕事の量的負担" → "仕事の量的負担"
 * "[家族・友人からのサポート]" → "家族・友人からのサポート"
 */
function cleanScaleName(k) {
  return k.replace(/^\d+[\.\-]?\s+/, '').trim()
          .replace(/^\[/, '').replace(/\]$/, '').replace(/※$/, '').trim();
}

/**
 * カテゴリでフィルタしたスケール一覧を返す
 * 各要素に偏差値（dev）を付与済み
 * @param {Object} scaleResults
 * @param {string} category  例: '1.ストレッサー（仕事の負担）'
 * @returns {Array} [{ key, name, dev, sr }, ...]
 */
function scalesByCategory(scaleResults, category) {
  var out = [];
  for (var k in scaleResults) {
    var sr = scaleResults[k];
    if (sr.category !== category) continue;
    var q   = sr.questions[0];
    var dev = calcDeviation(sr.avg, q ? q.avg : null, q ? q.sd : null);
    var displayDev = dev;
    out.push({ key: k, name: cleanScaleName(k), dev: dev, displayDev: displayDev, sr: sr });
  }
  return out;
}

/**
 * 信号機カラーを返す
 * @param {number}  dev      偏差値
 * @param {boolean} negHigh  true=高いほど悪い（ストレッサー・反応系）
 * @returns {string} 'blue' | 'yellow' | 'red'
 */
function getDevColor(dev, negHigh) {
  var diff = negHigh ? dev - 50 : 50 - dev;
  if (diff <= 5)  return 'blue';
  if (diff <= 10) return 'yellow';
  return 'red';
}
