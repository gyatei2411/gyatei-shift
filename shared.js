/* ぎゃあてい シフト調整アプリ 共通ロジック
 *
 * Firebase Realtime Database 統合 + localStorage フォールバック
 * - firebase-config.js が存在し window.FIREBASE_CONFIG が設定されていれば
 *   回答は Firebase 経由でリアルタイム同期される
 * - 未設定の場合は localStorage に保存（旧挙動）
 */

const App = {
  // テンプレ525シートの実在メンバー（24名）
  DEFAULT_STAFF: [
    '青木','渡邉','山口','兼松','西川','駒原','一谷','舩井',
    '山口大','加藤康','安原','工藤','中島','岩本','大橋','藤田',
    '上野','鉄尾','田茂井','盛重','北川','羽生田','浅賀','米村'
  ],

  DOW_LABELS: ['月', '火', '水', '木', '金', '土', '日'],
  DOW_LABELS_FULL: ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'],

  SYMBOLS: {
    o: { mark: '○', label: '出勤可', color: '#10B981', bg: '#D1FAE5' },
    t: { mark: '△', label: '条件付き', color: '#D97706', bg: '#FEF3C7' },
    x: { mark: '✕', label: '不可', color: '#DC2626', bg: '#FEE2E2' },
    m: { mark: '未', label: '未定', color: '#7C3AED', bg: '#EDE9FE' }
  },

  /* ===== 日付ユーティリティ ===== */

  toDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  },

  weekStart(from) {
    const d = from ? new Date(from + 'T00:00:00') : new Date();
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diff);
    return App.toDateStr(d);
  },

  weekDates(ws) {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws + 'T00:00:00');
      d.setDate(d.getDate() + i);
      return App.toDateStr(d);
    });
  },

  shiftWeek(ws, n) {
    const d = new Date(ws + 'T00:00:00');
    d.setDate(d.getDate() + 7 * n);
    return App.toDateStr(d);
  },

  fmtMD(ds) {
    const d = new Date(ds + 'T00:00:00');
    return `${d.getMonth() + 1}/${d.getDate()}`;
  },

  toMMDD(ds) {
    const d = new Date(ds + 'T00:00:00');
    return String(d.getMonth() + 1) + String(d.getDate()).padStart(2, '0');
  },

  weekLabel(ws) {
    const dates = App.weekDates(ws);
    return `${App.fmtMD(dates[0])}(月)〜${App.fmtMD(dates[6])}(日)`;
  },

  toExcelSerial(ds) {
    const d = new Date(ds + 'T00:00:00Z');
    const epoch = Date.UTC(1899, 11, 30);
    return Math.floor((d.getTime() - epoch) / 86400000);
  },

  /* ===== URL codec ===== */

  encodeBase64Url(obj) {
    const json = JSON.stringify(obj);
    const utf8 = new TextEncoder().encode(json);
    let bin = '';
    utf8.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },

  decodeBase64Url(str) {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice(0, (4 - str.length % 4) % 4);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  },

  buildRequestUrl(baseUrl, payload) {
    return `${baseUrl}?r=${App.encodeBase64Url(payload)}`;
  },

  parseUrl() {
    const params = new URLSearchParams(location.search);
    if (params.has('r')) {
      try { return { type: 'request', data: App.decodeBase64Url(params.get('r')) }; }
      catch (e) { return { type: 'error', error: e.message }; }
    }
    return { type: 'none' };
  },

  /* ===== 祝日 =====
     ネットに見に行かずに計算で出す（2020年以降の制度。春分・秋分は2099年まで有効）
     振替休日と国民の休日（例: 9/22のシルバーウィーク）も出す */
  _holCache: {},

  _pad2(n) { return String(n).padStart(2, '0'); },

  // その年の祝日を { 'YYYY-MM-DD': '名前' } で返す
  holidaysOf(year) {
    if (App._holCache[year]) return App._holCache[year];
    const key = (m, d) => `${year}-${App._pad2(m)}-${App._pad2(d)}`;
    // その月の n 番目の月曜日
    const nthMon = (m, n) => {
      const first = new Date(year, m - 1, 1).getDay();   // 0=日
      return 1 + ((8 - first) % 7) + (n - 1) * 7;
    };
    const eq = (base) => Math.floor(base + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));

    const h = {};
    h[key(1, 1)]            = '\u5143\u65e5';
    h[key(1, nthMon(1, 2))] = '\u6210\u4eba\u306e\u65e5';
    h[key(2, 11)]           = '\u5efa\u56fd\u8a18\u5ff5\u306e\u65e5';
    h[key(2, 23)]           = '\u5929\u7687\u8a95\u751f\u65e5';
    h[key(3, eq(20.8431))]  = '\u6625\u5206\u306e\u65e5';
    h[key(4, 29)]           = '\u662d\u548c\u306e\u65e5';
    h[key(5, 3)]            = '\u61b2\u6cd5\u8a18\u5ff5\u65e5';
    h[key(5, 4)]            = '\u307f\u3069\u308a\u306e\u65e5';
    h[key(5, 5)]            = '\u3053\u3069\u3082\u306e\u65e5';
    h[key(7, nthMon(7, 3))] = '\u6d77\u306e\u65e5';
    h[key(8, 11)]           = '\u5c71\u306e\u65e5';
    h[key(9, nthMon(9, 3))] = '\u656c\u8001\u306e\u65e5';
    h[key(9, eq(23.2488))]  = '\u79cb\u5206\u306e\u65e5';
    h[key(10, nthMon(10, 2))] = '\u30b9\u30dd\u30fc\u30c4\u306e\u65e5';
    h[key(11, 3)]           = '\u6587\u5316\u306e\u65e5';
    h[key(11, 23)]          = '\u52e4\u52b4\u611f\u8b1d\u306e\u65e5';

    const fmt = (d) => `${d.getFullYear()}-${App._pad2(d.getMonth() + 1)}-${App._pad2(d.getDate())}`;

    // 振替休日：日曜と重なったら、次の祝日でない日
    Object.keys(h).sort().forEach(k => {
      const d = new Date(k + 'T00:00:00');
      if (d.getDay() !== 0) return;
      const n = new Date(d);
      do { n.setDate(n.getDate() + 1); } while (h[fmt(n)]);
      h[fmt(n)] = '\u632f\u66ff\u4f11\u65e5';
    });

    // 国民の休日：祝日にはさまれた平日（例: 2026/9/22）
    const d = new Date(year, 0, 1);
    while (d.getFullYear() === year) {
      const k = fmt(d);
      if (!h[k] && d.getDay() !== 0) {
        const prev = new Date(d); prev.setDate(prev.getDate() - 1);
        const next = new Date(d); next.setDate(next.getDate() + 1);
        if (h[fmt(prev)] && h[fmt(next)]) h[k] = '\u56fd\u6c11\u306e\u4f11\u65e5';
      }
      d.setDate(d.getDate() + 1);
    }

    App._holCache[year] = h;
    return h;
  },

  // 'YYYY-MM-DD' が祝日なら名前を返す。違えば ''
  holidayName(ds) {
    const t = String(ds || '');
    const y = parseInt(t.slice(0, 4), 10);
    if (!y) return '';
    return App.holidaysOf(y)[t] || '';
  },

  /* ===== Firebase / localStorage ハイブリッド ===== */

  // 今日の日付（端末の時計で）。UTCだと日本では朝9時まで前日になる
  todayLocal() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  },

  // その週がもう終わっているか（日曜日を過ぎたか）
  isPastWeek(ws, today) {
    const days = App.weekDates(ws);
    return days[6] < (today || App.todayLocal());
  },

  // アプリのバージョン（更新したらここを書き換える）
  VERSION: '2026.09.03',
  lastSyncAt: null,   // Firebase から最後に受け取った時刻

  KEYS: {
    requests: 'sa_v4_requests',
    replies:  'sa_v4_replies',
    staff:    'sa_v4_staff',
    active:   'sa_v4_active',
    manual:   'sa_v4_manual',
    staffmeta: 'sa_v4_staffmeta',
    confirmed: 'sa_v4_confirmed',
    seenWelcome: 'sa_v4_seen_welcome',
    morningBase: 'sa_v4_morning_base'
  },

  // 0部(9:00-9:30 の朝の準備)のポジション
  //   1部の仕事の前にやる仕事。シフト表では 1部/2部 の左の枠に書く
  POSITIONS0: ['C', '1F', 'Rj', 'Tj', 'm'],
  POSITIONS0_FULL: {
    'C':  'クリーン（廊下の掃除）・1日 1人',
    '1F': '一階の準備・1日 1人',
    'Rj': 'レストラン準備ヘルプ・朝の人数が不足する日だけ',
    'Tj': 'テイクアウト準備・朝の人数が不足する日だけ',
    'm':  '盛り付け・Wの人だけ・時間は問わない（他の0部と兼任可）'
  },
  // 時刻ではなく仕事の中身で決まるポジション（9時出勤でなくてもよい）
  POSITIONS0_ANYTIME: ['m'],
  // 朝の人数が足りない日にだけ発生するポジション
  POSITIONS0_SHORT: ['Rj', 'Tj'],

  // 朝（9時出勤）の基準人数。これを下回った日は Rj・Tj を立てる
  getMorningBase() {
    const v = App._read(App.KEYS.morningBase, null);
    const n = parseInt(v, 10);
    return (isNaN(n) || n < 0) ? 6 : n;
  },
  setMorningBase(n) {
    const v = Math.max(0, Math.min(20, parseInt(n, 10) || 0));
    App._write(App.KEYS.morningBase, v);
    App._pushSetting('morningBase', v);
    return v;
  },

  // 1部(9-16)のポジション
  POSITIONS: ['K', 'R2', 'R2d', 'R1', 'W', 'T'],
  // 2部(16-L)のポジション
  POSITIONS2: ['W', 'T'],

  /* ===== 当日欠勤（欠） =====
     急に休みになった人。シフトはそのまま残して「欠」と表示し、出勤人数からは外す
     確定シフトのスナップショットには入れない（当日の出来事なので、シフトの修正ではない） */
  absKey(name, d) { return `s_${name}_${d}_abs`; },
  isAbsent(cells, name, d) {
    return (cells || {})[App._safeCellKey(App.absKey(name, d))] === '1';
  },
  setAbsent(reqId, name, d, on) {
    App.setManualCell(reqId, App.absKey(name, d), on ? '1' : '');
  },

  /* ===== UPの日 =====
     忙しかった日の売上に応じて時給を上げる日。500円 / 1000円の2種類 */
  UP_LEVELS: ['500', '1000'],
  upKey(d) { return `up_${d}`; },
  upOf(cells, d) {
    const v = String((cells || {})[App._safeCellKey(App.upKey(d))] || '');
    return App.UP_LEVELS.indexOf(v) >= 0 ? v : '';
  },
  setUp(reqId, d, v) {
    const t = String(v == null ? '' : v);
    App.setManualCell(reqId, App.upKey(d), App.UP_LEVELS.indexOf(t) >= 0 ? t : '');
  },
  // 押すたびに なし → 500 → 1000 → なし
  nextUp(v) {
    const i = App.UP_LEVELS.indexOf(String(v || ''));
    return i < 0 ? App.UP_LEVELS[0] : (App.UP_LEVELS[i + 1] || '');
  },

  // メモ欄の「まか○○」= スタッフ・家族以外でその日まかないを食べる人
  //   「まかゆうま」→ 1名（ゆうま）
  //   「まかゆうま まかみき」→ 2名
  //   「まか2」「まか2人」→ 2名
  //   「まかないゆうま」も同じ（「ない」はあってもなくてもよい）
  extraMakanai(txt) {
    const t = String(txt || '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    const out = { count: 0, names: [] };
    const re = /まか(?:ない)?[\s　]*([^\s　、。,，・／\/+＋]*)/g;
    let m;
    while ((m = re.exec(t)) !== null) {
      const rest = (m[1] || '').trim();
      const num = rest.match(/^(\d+)人?$/);
      if (num) {
        const n = parseInt(num[1], 10) || 0;
        out.count += n;
        if (n) out.names.push(n + '名');
      } else {
        out.count += 1;
        out.names.push(rest || 'まかない');
      }
      if (re.lastIndex === m.index) re.lastIndex++;
    }
    out.count = Math.max(0, Math.min(20, out.count));
    return out;
  },

  // 家族（役職）。まかないの人数に含める
  //   店=店長 / 若奥=若奥さん / 奥=奥さん / 会=会長
  FAMILY: ['\u5e97', '\u82e5\u5965', '\u5965', '\u4f1a'],
  FAMILY_FULL: { '\u5e97': '\u5e97\u9577', '\u82e5\u5965': '\u82e5\u5965\u3055\u3093', '\u5965': '\u5965\u3055\u3093', '\u4f1a': '\u4f1a\u9577' },

  // 休む家族の**人数**を返す。誰か分からないときは「1人」「2人」と数字で書ける
  //   例: '会奥' → 2 / '若' → 1 / '1人' → 1 / '2' → 2 / '店 1人' → 2 / '' → 0
  familyOffCount(txt) {
    const t = String(txt || '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    const names = App.parseFamilyOff(t);
    let rest = t;
    // 名前（略記含む）を全部取り除いてから数字を拾う
    ['\u82e5\u5965', '\u82e5', '\u5e97', '\u5965', '\u4f1a'].forEach(k => { rest = rest.split(k).join(''); });
    let num = 0;
    const m = rest.match(/\d+/g);
    if (m) m.forEach(x => { num += parseInt(x, 10) || 0; });
    return Math.max(0, Math.min(App.FAMILY.length, names.length + num));
  },

  // 休む家族の書き方。「若奥」は「若」だけでもよい
  FAMILY_ALIAS: { '\u82e5': '\u82e5\u5965' },

  // 「会奥」のような文字列から、その日休む家族を拾う
  //   ※ 「若奥」「若」を先に取る（「奥」と間違えないため）
  parseFamilyOff(txt) {
    let t = String(txt || '');
    const off = [];
    ['\u82e5\u5965', '\u82e5'].forEach(k => {
      if (off.indexOf('\u82e5\u5965') < 0 && t.indexOf(k) >= 0) {
        off.push('\u82e5\u5965'); t = t.split(k).join('');
      }
    });
    ['\u5e97', '\u5965', '\u4f1a'].forEach(k => { if (t.indexOf(k) >= 0) off.push(k); });
    return off;
  },

  // Firebase が初期化済みかどうか
  fbReady: false,
  fbDB: null,
  fbListeners: {},  // requestId -> unsubscribe

  initFirebase() {
    if (App.fbReady) return true;
    if (typeof firebase === 'undefined') return false;
    if (typeof FIREBASE_CONFIG === 'undefined' || !FIREBASE_CONFIG || !FIREBASE_CONFIG.databaseURL) return false;
    try {
      if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      App.fbDB = firebase.database();
      App.fbReady = true;
      return true;
    } catch (e) {
      console.error('Firebase init failed:', e);
      return false;
    }
  },

  isOnline() { return App.fbReady; },

  _read(key, def) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(def)); }
    catch (e) { return def; }
  },
  _write(key, val) { localStorage.setItem(key, JSON.stringify(val)); },

  /* ===== requests (依頼) ===== */

  getRequests() { return App._read(App.KEYS.requests, []); },
  saveRequest(req) {
    const all = App.getRequests();
    const i = all.findIndex(r => r.id === req.id);
    if (i >= 0) all[i] = req; else all.push(req);
    App._write(App.KEYS.requests, all);
    App.setActiveRequest(req.id);
    // Firebase にもメタを書いておく（update: 手入力データ manual を消さないため）
    if (App.fbReady) {
      App.fbDB.ref('requests/' + req.id).update({
        ws: req.ws, shop: req.shop, staff: req.staff,
        closed: req.closed || [], createdAt: req.createdAt
      }).catch(e => console.error('FB save request failed', e));
    }
    return req;
  },
  getRequest(id) { return App.getRequests().find(r => r.id === id); },
  deleteRequest(id) {
    App._write(App.KEYS.requests, App.getRequests().filter(r => r.id !== id));
    App._write(App.KEYS.replies, App._read(App.KEYS.replies, []).filter(r => r.id !== id));
    const manualAll = App._read(App.KEYS.manual, {});
    delete manualAll[id];
    App._write(App.KEYS.manual, manualAll);
    if (App.getActiveRequest() === id) App._write(App.KEYS.active, null);
    if (App.fbReady) {
      App.fbDB.ref('requests/' + id).remove().catch(()=>{});
      App.fbDB.ref('replies/' + id).remove().catch(()=>{});
    }
    if (App.fbListeners[id]) { App.fbListeners[id](); delete App.fbListeners[id]; }
    if (App.fbListeners['m_' + id]) { App.fbListeners['m_' + id](); delete App.fbListeners['m_' + id]; }
  },

  /* ===== replies (回答) ===== */

  getReplies(id) {
    const all = App._read(App.KEYS.replies, []);
    return id ? all.filter(r => r.id === id) : all;
  },

  // ローカルキャッシュに保存（Firebaseとは独立）
  _saveReplyLocal(reply) {
    if (!reply.receivedAt) reply.receivedAt = new Date().toISOString();
    const all = App._read(App.KEYS.replies, []);
    const i = all.findIndex(r => r.id === reply.id && r.name === reply.name);
    let isUpdate = false;
    if (i >= 0) { all[i] = reply; isUpdate = true; }
    else all.push(reply);
    App._write(App.KEYS.replies, all);
    return { reply, isUpdate };
  },

  // スタッフ側: 回答を送信（Firebase優先）
  submitReply(reply) {
    if (!reply.receivedAt) reply.receivedAt = new Date().toISOString();
    if (App.fbReady) {
      const safeName = encodeURIComponent(reply.name);
      return App.fbDB.ref(`replies/${reply.id}/${safeName}`).set({
        name: reply.name,
        ws: reply.ws,
        d: reply.d,
        dnotes: reply.dnotes || {},   // 曜日ごとの出勤可能時間 { "1": "11-15:30" }
        gnote: reply.gnote || '',
        receivedAt: reply.receivedAt
      }).then(() => ({ ok: true, online: true }));
    }
    return Promise.resolve({ ok: false, online: false });
  },

  // 管理者側: Firebase の回答を購読し、ローカルに反映
  subscribeReplies(reqId, onUpdate) {
    if (!App.fbReady) return null;
    if (App.fbListeners[reqId]) App.fbListeners[reqId]();
    const ref = App.fbDB.ref('replies/' + reqId);
    const cb = (snap) => {
      const data = snap.val() || {};
      // Firebaseの結果でローカルキャッシュを更新
      const all = App._read(App.KEYS.replies, []).filter(r => r.id !== reqId);
      Object.values(data).forEach(r => {
        all.push({
          id: reqId, name: r.name, ws: r.ws, d: r.d,
          dnotes: r.dnotes || {}, gnote: r.gnote || '', receivedAt: r.receivedAt
        });
      });
      App._write(App.KEYS.replies, all);
      onUpdate && onUpdate();
    };
    ref.on('value', cb);
    App.fbListeners[reqId] = () => ref.off('value', cb);
    return App.fbListeners[reqId];
  },

  /* ===== 手入力データ (シフト表の直接編集) ===== */

  // FBキーに使えない文字を除去
  _safeCellKey(key) {
    return String(key).replace(/[.#$\/\[\]]/g, '_');
  },

  getManual(reqId) {
    const all = App._read(App.KEYS.manual, {});
    return all[reqId] || {};
  },

  setManualCell(reqId, key, val) {
    const safeKey = App._safeCellKey(key);
    const all = App._read(App.KEYS.manual, {});
    if (!all[reqId]) all[reqId] = {};
    if (val === '' || val == null) delete all[reqId][safeKey];
    else all[reqId][safeKey] = val;
    App._write(App.KEYS.manual, all);
    if (App.fbReady) {
      const ref = App.fbDB.ref(`requests/${reqId}/manual/${safeKey}`);
      (val === '' || val == null ? ref.remove() : ref.set(val)).catch(e => console.error('FB manual save failed', e));
    }
  },

  // 手入力データのFirebase購読（他端末との同期）
  subscribeManual(reqId, onUpdate) {
    if (!App.fbReady) return null;
    const lkey = 'm_' + reqId;
    if (App.fbListeners[lkey]) App.fbListeners[lkey]();
    const ref = App.fbDB.ref(`requests/${reqId}/manual`);
    const cb = (snap) => {
      const data = snap.val() || {};
      const all = App._read(App.KEYS.manual, {});
      all[reqId] = data;
      App._write(App.KEYS.manual, all);
      onUpdate && onUpdate();
    };
    ref.on('value', cb);
    App.fbListeners[lkey] = () => ref.off('value', cb);
    return App.fbListeners[lkey];
  },

  /* ===== スタッフ別設定 (できるポジション・メモ) ===== */

  // { 名前: { positions:['K','R2'], positions2:['W','T'], t2always:false, t2extra:false, note:'', priority:false } }
  // positions0 … 0部(9:00-9:30 朝の準備)でできるポジション（C / 1F / Rj / Tj / m）
  // positions  … 1部(9-16)でできるポジション
  // positions2 … 2部(16-L)でできるポジション（W / T）
  // t2always   … 出勤日は必ず2部T
  // t2extra    … 仕事が終わり次第2部Tに合流（3人の枠外）
  // rank       … '' (無印) / 'priority'(★優先) / 'housewife'(主婦) / 'student'(学生)
  //              優先順位: ★優先 > 主婦 > 無印 > 学生
  // daysMin/Max … 週の希望出勤回数（例: 2〜3回）。Max が自動割り当ての上限
  // priority   … 旧データ互換（rank が無ければ priority=true を ★優先 とみなす）
  getStaffMeta() {
    return App._read(App.KEYS.staffmeta, {});
  },

  setStaffMeta(name, meta) {
    const all = App.getStaffMeta();
    all[name] = meta;
    App._write(App.KEYS.staffmeta, all);
    if (App.fbReady) {
      const safeName = App._safeCellKey(encodeURIComponent(name));
      App.fbDB.ref(`staffmeta/${safeName}`).set({ name, ...meta })
        .catch(e => console.warn('FB staffmeta save failed (ルール未設定の可能性):', e.message));
    }
  },

  // スタッフ別設定を消す（名前変更のときの旧キー削除用）
  removeStaffMeta(name) {
    const all = App.getStaffMeta();
    delete all[name];
    App._write(App.KEYS.staffmeta, all);
    if (App.fbReady) {
      const safeName = App._safeCellKey(encodeURIComponent(name));
      App.fbDB.ref(`staffmeta/${safeName}`).remove().catch(() => {});
    }
  },

  /* ===== スタッフの名前を変える ===== */
  //  名前はキーとしてあちこちで使われているので、全部まとめて置き換える。
  //  （名簿 / スタッフ別設定 / 依頼の対象者 / シフト表のセル / 確定シフト / 回答）
  //  ※ 変更履歴の本文はそのときの記録なので書き換えない
  renameStaff(oldName, newName) {
    const res = { ok: false, msg: '', staff: 0, meta: 0, cells: 0, confirmed: 0, replies: 0 };
    oldName = String(oldName || '').trim();
    newName = String(newName || '').trim();
    if (!oldName || !newName) { res.msg = '名前が空です'; return res; }
    if (oldName === newName) { res.msg = '名前が変わっていません'; return res; }

    const list = App.getStaff();
    if (list.indexOf(newName) >= 0) { res.msg = `「${newName}」はすでに名簿にあります`; return res; }

    // 1) 名簿
    const i = list.indexOf(oldName);
    if (i >= 0) { list[i] = newName; App.setStaff(list); res.staff = 1; }

    // 2) スタッフ別設定
    const meta = App.getStaffMeta()[oldName];
    if (meta) { App.setStaffMeta(newName, meta); App.removeStaffMeta(oldName); res.meta = 1; }

    const oldPre = App._safeCellKey('s_' + oldName + '_');
    const newPre = App._safeCellKey('s_' + newName + '_');

    App.getRequests().forEach(req => {
      // 3) 依頼の対象者
      const si = (req.staff || []).indexOf(oldName);
      if (si >= 0) { req.staff[si] = newName; App.saveRequest(req); }

      // 4) シフト表の手入力セル
      const man = App.getManual(req.id);
      Object.keys(man).forEach(k => {
        if (k.indexOf(oldPre) !== 0) return;
        App.setManualCell(req.id, newPre + k.slice(oldPre.length), man[k]);
        App.setManualCell(req.id, k, '');
        res.cells++;
      });

      // 5) 確定シフト
      const conf = App.getConfirmed(req.id);
      if (conf) {
        let ch = false;
        const cells = {};
        Object.keys(conf.cells || {}).forEach(k => {
          if (k.indexOf(oldPre) === 0) { cells[newPre + k.slice(oldPre.length)] = conf.cells[k]; ch = true; }
          else cells[k] = conf.cells[k];
        });
        (conf.avail || []).forEach(a => { if (a && a.n === oldName) { a.n = newName; ch = true; } });
        if (ch) { conf.cells = cells; App.saveConfirmed(req.id, conf); res.confirmed++; }
      }

      // 6) 回答
      const reps = App._read(App.KEYS.replies, []);
      let rch = false;
      reps.forEach(r => { if (r.id === req.id && r.name === oldName) { r.name = newName; rch = true; } });
      if (rch) {
        App._write(App.KEYS.replies, reps);
        res.replies++;
        if (App.fbReady) {
          const encOld = encodeURIComponent(oldName), encNew = encodeURIComponent(newName);
          App.fbDB.ref(`replies/${req.id}/${encOld}`).once('value').then(sn => {
            const v = sn.val();
            if (!v) return null;
            v.name = newName;
            return App.fbDB.ref(`replies/${req.id}/${encNew}`).set(v)
              .then(() => App.fbDB.ref(`replies/${req.id}/${encOld}`).remove());
          }).catch(e => console.warn('FB reply rename failed', e && e.message));
        }
      }
    });

    res.ok = true;
    return res;
  },

  // Firebase から staffmeta を購読（ルール設定済みの場合のみ動作）
  subscribeStaffMeta(onUpdate) {
    if (!App.fbReady) return null;
    const lkey = 'staffmeta';
    if (App.fbListeners[lkey]) App.fbListeners[lkey]();
    const ref = App.fbDB.ref('staffmeta');
    const cb = (snap) => {
      const data = snap.val();
      if (!data) return;  // ルール未設定・データなしなら localStorage を維持
      const all = {};
      Object.values(data).forEach(m => {
        if (m && m.name) all[m.name] = {
          positions0: m.positions0 || [],
          positions: m.positions || [], positions2: m.positions2 || [],
          t2always: !!m.t2always, t2extra: !!m.t2extra,
          rank: m.rank || '', daysMin: m.daysMin || null, daysMax: m.daysMax || null,
          note: m.note || '', priority: !!m.priority
        };
      });
      App._write(App.KEYS.staffmeta, all);
      onUpdate && onUpdate();
    };
    ref.on('value', cb, () => {});  // 権限エラーは無視
    App.fbListeners[lkey] = () => ref.off('value', cb);
    return App.fbListeners[lkey];
  },

  /* ===== スタッフマスタ ===== */

  getStaff() {
    const stored = App._read(App.KEYS.staff, null);
    if (stored && stored.length) return stored;
    App._write(App.KEYS.staff, App.DEFAULT_STAFF.slice());
    return App.DEFAULT_STAFF.slice();
  },
  setStaff(list) {
    App._write(App.KEYS.staff, list);
    App._pushSetting('staff', list);
  },
  resetStaffToDefault() {
    App._write(App.KEYS.staff, App.DEFAULT_STAFF.slice());
    App._pushSetting('staff', App.DEFAULT_STAFF.slice());
    return App.DEFAULT_STAFF.slice();
  },

  /* ===== 端末間で共有する設定（スタッフ名簿・朝の基準人数） ===== */
  //  スタッフ名簿はもともとその端末の中だけに保存されていたので、
  //  スマホで開くと初期名簿のままになっていた。settings に入れて全端末で共有する
  _pushSetting(key, val) {
    if (!App.fbReady) return;
    App.fbDB.ref('settings/' + key).set(val)
      .catch(e => console.warn('FB settings save failed (ルール未設定の可能性):', e.message));
  },

  subscribeSettings(onUpdate) {
    if (!App.fbReady) return null;
    const lkey = 'settings';
    if (App.fbListeners[lkey]) App.fbListeners[lkey]();
    const ref = App.fbDB.ref('settings');
    const cb = (snap) => {
      const d = snap.val() || {};
      let changed = false;
      const list = Array.isArray(d.staff) ? d.staff.filter(Boolean) : null;
      if (list && list.length) {
        App._write(App.KEYS.staff, list);
        changed = true;
      } else {
        // Firebase にまだ名簿がない → この端末の名簿が初期値と違うなら初回登録する
        //（初期名簿のままの端末からは上書きしない）
        const local = App._read(App.KEYS.staff, null);
        if (local && local.length && local.join('|') !== App.DEFAULT_STAFF.join('|')) {
          App._pushSetting('staff', local);
        }
      }
      if (d.morningBase != null && !isNaN(parseInt(d.morningBase, 10))) {
        App._write(App.KEYS.morningBase, parseInt(d.morningBase, 10));
        changed = true;
      }
      App.lastSyncAt = new Date();
      if (changed) onUpdate && onUpdate();
    };
    ref.on('value', cb, () => {});
    App.fbListeners[lkey] = () => ref.off('value', cb);
    return App.fbListeners[lkey];
  },

  // アプリのファイルを強制的に取り直してから再読み込み
  //（スマホは古い HTML/JS を抛え込むことがあるため）
  forceUpdate() {
    const files = ['shared.js', 'xlsx-export.js', 'firebase-config.js', 'style.css',
                   'admin.html', 'shift-view.html', 'board.html', 'reply.html'];
    return Promise.all(files.map(f => fetch(f, { cache: 'reload' }).catch(() => {})))
      .then(() => { location.reload(); });
  },

  getActiveRequest() { return App._read(App.KEYS.active, null); },
  setActiveRequest(id) { App._write(App.KEYS.active, id); },

  newRequestId() {
    return 'req_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  },

  /* ===== 共通ユーティリティ ===== */

  copyToClipboard(text) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); document.body.removeChild(ta); return true; }
      catch (e) { document.body.removeChild(ta); return false; }
    });
  },


  /* ===== 確定シフト（スナップショット＋修正履歴） ===== */

  // { reqId: { version, at, cells:{...}, history:[{v, at, changes:[...]}] } }
  // スタッフの区分を数値にする（小さいほど優先）
  //   0=★優先  1=主婦  2=無印  3=学生
  RANK_ORDER: { priority: 0, housewife: 1, '': 2, student: 3 },
  RANK_LABEL: { priority: '\u2605\u512a\u5148', housewife: '\u4e3b\u5a66', student: '\u5b66\u751f' },
  rankOf(meta) {
    const m = meta || {};
    const r = m.rank || (m.priority ? 'priority' : '');
    return App.RANK_ORDER[r] !== undefined ? App.RANK_ORDER[r] : 2;
  },
  rankKey(meta) {
    const m = meta || {};
    return m.rank || (m.priority ? 'priority' : '');
  },

  getConfirmedAll() { return App._read(App.KEYS.confirmed, {}); },
  getConfirmed(reqId) { return App.getConfirmedAll()[reqId] || null; },

  saveConfirmed(reqId, snap) {
    const all = App.getConfirmedAll();
    all[reqId] = snap;
    App._write(App.KEYS.confirmed, all);
    if (App.fbReady) {
      App.fbDB.ref('requests/' + reqId + '/confirmed').set(snap)
        .catch(e => console.error('FB confirmed save failed', e));
    }
  },

  // 確定を取り消す（履歴ごと削除）
  clearConfirmed(reqId) {
    const all = App.getConfirmedAll();
    delete all[reqId];
    App._write(App.KEYS.confirmed, all);
    if (App.fbReady) App.fbDB.ref('requests/' + reqId + '/confirmed').remove().catch(() => {});
  },

  subscribeConfirmed(reqId, onUpdate) {
    if (!App.fbReady) return null;
    const lkey = 'c_' + reqId;
    if (App.fbListeners[lkey]) App.fbListeners[lkey]();
    const ref = App.fbDB.ref('requests/' + reqId + '/confirmed');
    const cb = (snap) => {
      const data = snap.val();
      const all = App.getConfirmedAll();
      if (data) {
        data.cells = data.cells || {};
        data.history = data.history || [];
        all[reqId] = data;
      } else {
        delete all[reqId];
      }
      App._write(App.KEYS.confirmed, all);
      onUpdate && onUpdate();
    };
    ref.on('value', cb, () => {});
    App.fbListeners[lkey] = () => ref.off('value', cb);
    return App.fbListeners[lkey];
  },

  // 依頼一覧をFirebaseから読み込む（タブレット表示など、依頼を作っていない端末用）
  subscribeRequests(onUpdate, onError) {
    if (!App.fbReady) return null;
    const lkey = 'reqlist';
    if (App.fbListeners[lkey]) App.fbListeners[lkey]();
    const ref = App.fbDB.ref('requests');
    const cb = (snap) => {
      const data = snap.val() || {};
      const confirmedAll = App.getConfirmedAll();
      const manualAll = App._read(App.KEYS.manual, {});
      // ローカルの依頼は消さず、Firebase 側の内容を上書きマージする
      const byId = {};
      App.getRequests().forEach(r => { byId[r.id] = r; });
      Object.keys(data).forEach(id => {
        const r = data[id] || {};
        if (!r.ws) return;
        byId[id] = { id, ws: r.ws, shop: r.shop || '', staff: r.staff || [], closed: r.closed || [], createdAt: r.createdAt || '' };
        manualAll[id] = r.manual || {};
        if (r.confirmed) {
          const c = r.confirmed;
          c.cells = c.cells || {};
          c.history = c.history || [];
          confirmedAll[id] = c;
        } else {
          delete confirmedAll[id];
        }
      });
      // 他の端末で削除された依頼をこちらでも消す
      //   Firebase に中身があるときだけやる（空の読み取りで全滅しないため）
      const fbIds = Object.keys(data);
      if (fbIds.length) {
        Object.keys(byId).forEach(id => {
          if (fbIds.indexOf(id) >= 0) return;
          delete byId[id];
          delete manualAll[id];
          delete confirmedAll[id];
        });
      }
      const reqs = Object.keys(byId).map(k => byId[k]);
      App._write(App.KEYS.requests, reqs);
      App._write(App.KEYS.manual, manualAll);
      App._write(App.KEYS.confirmed, confirmedAll);
      App.lastSyncAt = new Date();
      onUpdate && onUpdate();
    };
    ref.on('value', cb, (err) => {
      console.warn('FB requests read failed:', err && err.message);
      onError && onError(err);
    });
    App.fbListeners[lkey] = () => ref.off('value', cb);
    return App.fbListeners[lkey];
  },

  /* ===== 勤怠の集計（20日締め） ===== */

  // y年m月の締め期間。20日締めなら (m-1)月21日 〜 m月20日
  closingRange(y, m, cut) {
    const c = Math.max(1, Math.min(28, parseInt(cut, 10) || 20));
    return {
      from: App.toDateStr(new Date(y, m - 2, c + 1)),
      to:   App.toDateStr(new Date(y, m - 1, c))
    };
  },

  // from〜to の出勤回数と UP日の回数を人ごとに数える
  //   出勤 = ポジションか時刻が入っている日。欠勤（欠）の日は数えない
  countAttendance(from, to) {
    const rows = {};
    const touch = (n) => rows[n] || (rows[n] = {
      name: n, days: 0, up500: 0, up1000: 0, absent: 0, bonus: 0, detail: []
    });
    App.getRequests().forEach(req => {
      const dates = App.weekDates(req.ws);
      if (dates[6] < from || dates[0] > to) return;
      const conf = App.getConfirmed(req.id);
      const live = App.getManual(req.id);
      const base = conf ? (conf.cells || {}) : live;   // 確定済みなら確定版を数える
      const closed = new Set(req.closed || []);
      const g = (n, d, f) => base[App._safeCellKey(`s_${n}_${d}_${f}`)] || '';
      const names = (req.staff || []).slice();
      // 名簿から外れた人でも、シフトが入っていれば数える
      Object.keys(base).forEach(k => {
        const m = k.match(/^s_(.+)_\d_(?:main|start|end)$/);
        if (m && names.indexOf(m[1]) < 0) names.push(m[1]);
      });
      for (let d = 0; d < 7; d++) {
        const ds = dates[d];
        if (closed.has(d) || ds < from || ds > to) continue;
        const up = App.upOf(live, d);
        names.forEach(n => {
          if (!(g(n, d, 'main') || g(n, d, 'start') || g(n, d, 'end'))) return;
          const r = touch(n);
          if (App.isAbsent(live, n, d)) { r.absent++; return; }
          r.days++;
          if (up === '500') r.up500++;
          else if (up === '1000') r.up1000++;
          r.detail.push({ date: ds, up: up, pos: g(n, d, 'main') });
        });
      }
    });
    const order = App.getStaff();
    const list = Object.keys(rows).map(n => rows[n]);
    list.forEach(r => {
      r.bonus = r.up500 * 500 + r.up1000 * 1000;
      r.detail.sort((a, b) => a.date < b.date ? -1 : 1);
    });
    list.sort((a, b) => {
      const ia = order.indexOf(a.name), ib = order.indexOf(b.name);
      return (ia < 0 ? 9999 : ia) - (ib < 0 ? 9999 : ib) || (a.name < b.name ? -1 : 1);
    });
    return list;
  },

  // その期間のUP日一覧（日付順）
  upDaysIn(from, to) {
    const out = [];
    App.getRequests().forEach(req => {
      const dates = App.weekDates(req.ws);
      if (dates[6] < from || dates[0] > to) return;
      const live = App.getManual(req.id);
      const closed = new Set(req.closed || []);
      for (let d = 0; d < 7; d++) {
        const ds = dates[d];
        if (closed.has(d) || ds < from || ds > to) continue;
        const up = App.upOf(live, d);
        if (up) out.push({ date: ds, up: up });
      }
    });
    out.sort((a, b) => a.date < b.date ? -1 : 1);
    return out;
  },

  lineShareUrl(text) {
    return 'https://line.me/R/share?text=' + encodeURIComponent(text);
  },

  toast(msg, kind = 'info') {
    const el = document.createElement('div');
    el.className = 'toast toast-' + kind;
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }
};

// Firebase の自動初期化（HTML側で firebase SDK を読み込んでいれば）
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    App.initFirebase();
  });
}
