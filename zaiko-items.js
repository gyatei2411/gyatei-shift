/* ===== 在庫の商品一覧（zaiko.html と zaiko-list.html の両方が読む） =====
   id は保存先のキーになるので、名前を変えても id は変えないこと（その日の入力が迷子になる）。
   par   … 2階・1階の冷蔵庫の定数。補充メモの数量の右に出す（1階だけ違うときは par1）
   teisu … 総在庫の定数。総在庫の数量の右に出す。これと同じか少ないと要注文。無い商品は補充メモだけ
   ret   … 数ではなく「Tへ返却」のチェックだけの商品 */
const DRINKS = [
  { id: 'kolsch',     name: 'ケルシュ（青）',       par: '10',  teisu: 20 },
  { id: 'alt',        name: 'アルト（赤）',         par: '10',  teisu: 20 },
  { id: 'matcha',     name: '抹茶ビール',           par: '5',   teisu: 20 },
  { id: 'junmai',     name: '純米酒',               par: '5',   teisu: 10 },
  { id: 'asahi',      name: 'アサヒスーパードライ', par: '10',  teisu: 20 },
  { id: 'yuzuchu',    name: 'ゆずチューハイ',       par: '5',   teisu: 10 },
  { id: 'umechu',     name: '梅チューハイ',         par: '5',   teisu: 10 },
  { id: 'gyokuro',    name: '玉露梅酒',             par: '5',   teisu: 5 },
  { id: 'hannari',    name: 'はんなり梅酒',         par: '5',   teisu: 5 },
  { id: 'yuzucider',  name: 'ゆずサイダー',         par: '10',  teisu: 20 },
  { id: 'cola',       name: 'コーラ',               par: '10',  teisu: 20 },
  { id: 'allfree',    name: 'オールフリー',         par: '8',   teisu: 10 },
  { id: 'jurakudai',  name: '聚楽第',               par: '1',   teisu: 1 },
  { id: 'kinshi',     name: 'キンシ政宗',           par: '1',   teisu: 1 },
  { id: 'ine',        name: '伊根満開',             par: '1',   teisu: 1 },
  { id: 'gessho',     name: 'げっしょう',           par: '1',   teisu: 1 },
  { id: 'orange',     name: 'オレンジジュース',     par: '2/3', teisu: 2 },
  { id: 'tansan',     name: '炭酸',                 par: '3' },
  { id: 'arashicola', name: '嵐山コーラ',           par: '1' },
  { id: 'shiso',      name: 'しそジュース',         ret: true },
];
const BIHIN = [
  { id: 'alcohol',   name: 'アルコールペーパー', teisu: 10 },
  { id: 'obutsu',    name: '汚物袋(黒)',         teisu: 1 },
  { id: 'kowari',    name: '子割り箸',           teisu: 1 },
  { id: 'hashi',     name: '箸',                 teisu: 8 },
  { id: 'hashibuk',  name: '箸袋',               teisu: 10 },
  { id: 'furikake',  name: 'ふりかけ',           teisu: 1 },
  { id: 'ittoko',    name: 'イットコ',           teisu: 10 },
  { id: 'straw',     name: 'ストロー',           teisu: 5 },
  { id: 'toilet',    name: 'トイレットペーパー', teisu: 3 },
  { id: 'quickle',   name: 'トイレクイックル',   teisu: 5 },
  { id: 'youji',     name: 'つまようじ',         teisu: 1 },
  { id: 'oshibori',  name: 'おしぼり',           teisu: 2 },
];
