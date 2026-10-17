/* ===== 在庫の商品一覧（zaiko.html / zaiko-list.html / zaiko-edit.html が読む） =====
   商品と定数は設定ページ（zaiko-edit.html）で変えられる。変えた中身は Firebase の zaiko/master に入り、
   そちらが優先される。下の DEFAULT_… は、まだ一度も設定を保存していないときの初期値。

   id は保存先のキーになるので、名前を変えても id は変えないこと（その日の入力が迷子になる）。
   par   … 2階・1階の冷蔵庫の定数。補充メモの数量の右に出す
   teisu … 総在庫の定数。総在庫の数量の右に出す。これと同じか少ないと要注文。無い商品は補充メモだけ
   ret   … 数ではなく「Tへ返却」のチェックだけの商品 */
// 並びは冷蔵庫の順（2026/10/17 社長指定：オレンジジュースのあとに ゆずサイダー・ケルシュ・アルト・抹茶ビール・ぎゃあてい純米酒）
const DEFAULT_DRINKS = [
  { id: 'asahi',      name: 'アサヒスーパードライ', par: '10',  teisu: 20 },
  { id: 'yuzuchu',    name: 'ゆずチューハイ',       par: '5',   teisu: 10 },
  { id: 'umechu',     name: '梅チューハイ',         par: '5',   teisu: 10 },
  { id: 'gyokuro',    name: '玉露梅酒',             par: '5',   teisu: 5 },
  { id: 'hannari',    name: 'はんなり梅酒',         par: '5',   teisu: 5 },
  { id: 'cola',       name: 'コーラ',               par: '10',  teisu: 20 },
  { id: 'allfree',    name: 'オールフリー',         par: '8',   teisu: 10 },
  { id: 'jurakudai',  name: '聚楽第',               par: '1',   teisu: 1 },
  { id: 'kinshi',     name: 'キンシ政宗',           par: '1',   teisu: 1 },
  { id: 'ine',        name: '伊根満開',             par: '1',   teisu: 1 },
  { id: 'gessho',     name: 'げっしょう',           par: '1',   teisu: 1 },
  { id: 'orange',     name: 'オレンジジュース',     par: '2/3', teisu: 2 },
  { id: 'yuzucider',  name: 'ゆずサイダー',         par: '10',  teisu: 20 },
  { id: 'kolsch',     name: 'ケルシュ（青）',       par: '10',  teisu: 20 },
  { id: 'alt',        name: 'アルト（赤）',         par: '10',  teisu: 20 },
  { id: 'matcha',     name: '抹茶ビール',           par: '5',   teisu: 20 },
  { id: 'junmai',     name: 'ぎゃあてい純米酒',     par: '5',   teisu: 10 },
  { id: 'tansan',     name: '炭酸',                 par: '3' },
  { id: 'arashicola', name: '嵐山コーラ',           par: '1' },
  { id: 'shiso',      name: 'しそジュース',         ret: true },
];
const DEFAULT_BIHIN = [
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

let DRINKS = DEFAULT_DRINKS;
let BIHIN = DEFAULT_BIHIN;
const ZAIKO_MASTER_KEY = 'gy_zaiko_master';

// 保存されている一覧を、使える形だけに整える。空や壊れた中身なら初期値に戻す（画面を空にしない）
function cleanZaikoList(v, fallback) {
  const arr = Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : null);
  if (!arr) return fallback;
  const out = arr.filter(x => x && x.id && x.name).map(x => {
    const o = { id: String(x.id), name: String(x.name) };
    if (x.par != null && x.par !== '') o.par = String(x.par);
    if (typeof x.teisu === 'number') o.teisu = x.teisu;
    if (x.ret) o.ret = true;
    return o;
  });
  return out.length ? out : fallback;
}
function applyZaikoMaster(m) {
  DRINKS = cleanZaikoList(m && m.drinks, DEFAULT_DRINKS);
  BIHIN = cleanZaikoList(m && m.bihin, DEFAULT_BIHIN);
}
// 前に読んだ設定を先に使う（開いた瞬間に古い一覧が一瞬出るのを防ぐ。電波が無いときもこれで動く）
try { applyZaikoMaster(JSON.parse(localStorage.getItem(ZAIKO_MASTER_KEY) || 'null')); } catch (e) {}

// 設定が変わるたびに cb を呼ぶ。Firebase につながっていないときは何もしない
function watchZaikoMaster(cb) {
  if (!App.fbReady) return;
  App.fbDB.ref('zaiko/master').on('value', snap => {
    const m = snap.val();
    try {
      if (m) localStorage.setItem(ZAIKO_MASTER_KEY, JSON.stringify(m));
      else localStorage.removeItem(ZAIKO_MASTER_KEY);
    } catch (e) {}
    applyZaikoMaster(m);
    cb();
  }, () => {});
}
