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
    x: { mark: '✕', label: '不可', color: '#DC2626', bg: '#FEE2E2' }
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

  /* ===== Firebase / localStorage ハイブリッド ===== */

  KEYS: {
    requests: 'sa_v4_requests',
    replies:  'sa_v4_replies',
    staff:    'sa_v4_staff',
    active:   'sa_v4_active',
    manual:   'sa_v4_manual',
    seenWelcome: 'sa_v4_seen_welcome'
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
          gnote: r.gnote || '', receivedAt: r.receivedAt
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

  /* ===== スタッフマスタ ===== */

  getStaff() {
    const stored = App._read(App.KEYS.staff, null);
    if (stored && stored.length) return stored;
    App._write(App.KEYS.staff, App.DEFAULT_STAFF.slice());
    return App.DEFAULT_STAFF.slice();
  },
  setStaff(list) { App._write(App.KEYS.staff, list); },
  resetStaffToDefault() {
    App._write(App.KEYS.staff, App.DEFAULT_STAFF.slice());
    return App.DEFAULT_STAFF.slice();
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
