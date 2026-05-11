/* ぎゃあてい シフト xlsx 出力モジュール
 *
 * 行レイアウト（テンプレ準拠）:
 *   各曜日3列ブロック、1スタッフ=2行ペア
 *   上段: 確定始業 | 確定終業 | スタッフ希望時刻 ★Web入力で自動埋め
 *   下段: サブポジション | メインポジション | ○/△/✕ ★Web入力で自動埋め
 */

const XlsxExport = (() => {
  // 月=B(2), 火=E(5), 水=H(8), 木=K(11), 金=N(14), 土=Q(17), 日=T(20)
  const DAY_START_COL = [2, 5, 8, 11, 14, 17, 20];
  // 各曜日の3列目
  const COL3 = DAY_START_COL.map(c => c + 2);

  function generate(req, replies) {
    if (!window.XLSX) throw new Error('SheetJS が読み込まれていません');

    const wb = XLSX.utils.book_new();
    const ws = {};
    const dates = App.weekDates(req.ws);

    const setCell = (r, c, val, opts = {}) => {
      const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
      const cell = { v: val };
      if (opts.t) cell.t = opts.t; else cell.t = (typeof val === 'number') ? 'n' : 's';
      if (opts.z) cell.z = opts.z;
      ws[addr] = cell;
    };

    // R02: 日付シリアル
    dates.forEach((d, i) => setCell(2, DAY_START_COL[i], App.toExcelSerial(d), { t: 'n', z: 'm/d' }));
    // R03: 曜日ラベル
    App.DOW_LABELS_FULL.forEach((lbl, i) => setCell(3, DAY_START_COL[i], lbl));
    // R04-06: ヘッダ
    setCell(4, 1, '予想'); setCell(5, 1, 'UP'); setCell(6, 1, '物販');

    // R07以降: スタッフ2行ペア
    const orderedNames = req.staff.slice();
    replies.forEach(r => { if (!orderedNames.includes(r.name)) orderedNames.push(r.name); });
    const replyMap = {};
    replies.forEach(r => { replyMap[r.name] = r; });

    let row = 7;
    for (const name of orderedNames) {
      // 上段
      setCell(row, 1, name);     // A列: スタッフ名
      setCell(row, 23, name);    // W列: 再掲
      // 下段
      const reply = replyMap[name];
      if (reply) {
        for (let i = 0; i < 7; i++) {
          // 上段3列目: 希望時刻
          const time = reply.times && reply.times[i] ? reply.times[i] : '';
          if (time) setCell(row, COL3[i], time);
          // 下段3列目: ○/△/✕
          const sym = reply.d[i] || 'x';
          const ch = symToChar(sym);
          setCell(row + 1, COL3[i], ch);
        }
      }
      row += 2;
    }

    // ポジション集計（テンプレ準拠 K/R/W/T/G1/G2/G/LT、すべて0）
    const POSITIONS = ['K', 'R', 'W', 'T', 'G1', 'G2', 'G', 'LT'];
    POSITIONS.forEach(p => {
      setCell(row, 1, p);
      for (let i = 0; i < 7; i++) setCell(row, DAY_START_COL[i], 0, { t: 'n' });
      setCell(row, 23, p);
      row++;
    });
    setCell(row, 1, '数'); setCell(row, 23, '数'); row++;
    const noteRow = row;
    setCell(row, 1, '備考'); setCell(row, 23, '備考');

    // 全体備考をW列右に集約
    const gNotes = [];
    for (const r of replies) {
      if (r.gnote) gNotes.push(`${r.name}: ${r.gnote}`);
    }
    if (gNotes.length) setCell(noteRow, 24, '全体備考: ' + gNotes.join(' / '));

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: noteRow - 1, c: 27 } });

    // 列幅
    ws['!cols'] = [
      { wch: 10 },  // A
      { wch: 5 }, { wch: 5 }, { wch: 7 },   // B-D 月（D=希望時刻なので少し広め）
      { wch: 5 }, { wch: 5 }, { wch: 7 },   // E-G 火
      { wch: 5 }, { wch: 5 }, { wch: 7 },   // H-J 水
      { wch: 5 }, { wch: 5 }, { wch: 7 },   // K-M 木
      { wch: 5 }, { wch: 5 }, { wch: 7 },   // N-P 金
      { wch: 5 }, { wch: 5 }, { wch: 7 },   // Q-S 土
      { wch: 5 }, { wch: 5 }, { wch: 7 },   // T-V 日
      { wch: 10 },                          // W
      { wch: 4 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 }
    ];

    const sheetName = App.toMMDD(req.ws);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `シフト_${sheetName}.xlsx`);
  }

  function symToChar(sym) {
    return ({ o: '○', t: '△', x: '✕' })[sym] || '';
  }

  return { generate };
})();
