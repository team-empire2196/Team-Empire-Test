/* Team Empire Performance - in-browser updater (admin only).
   Reads the (password-protected) Excel on THIS device, builds dashboard.json with the same logic as scripts/build_data.py,
   and optionally publishes it to GitHub with a personal access token. Password and token are never stored or sent anywhere except GitHub's API. */
(function () {
  const enc = new TextEncoder(), dec = new TextDecoder("utf-16le"), S = crypto.subtle;
  const u16 = (b, o) => b[o] | (b[o + 1] << 8), u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  const cat = (...a) => { const n = a.reduce((t, x) => t + x.length, 0), o = new Uint8Array(n); let p = 0; a.forEach(x => { o.set(x, p); p += x.length; }); return o; };
  const le32 = n => new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0)), hex = s => Uint8Array.from(s.match(/../g), h => parseInt(h, 16));
  const sha = async b => new Uint8Array(await S.digest("SHA-512", b));

  // ---------- 1. open the encrypted Office file (CFB container + ECMA-376 agile encryption) ----------
  function cfb(d) {
    const ss = 1 << u16(d, 30), mss = 1 << u16(d, 32), nfat = u32(d, 44), dirStart = u32(d, 48), cutoff = u32(d, 56), mfStart = u32(d, 60), difStart = u32(d, 68), nDif = u32(d, 72);
    const sec = n => d.subarray((n + 1) * ss, (n + 2) * ss), END = 0xFFFFFFFA;
    const difat = []; for (let i = 0; i < 109; i++) difat.push(u32(d, 76 + i * 4));
    let x = difStart; for (let i = 0; i < nDif; i++) { const s = sec(x); for (let j = 0; j < ss / 4 - 1; j++) difat.push(u32(s, j * 4)); x = u32(s, ss - 4); }
    const fat = []; difat.slice(0, nfat).forEach(f => { const s = sec(f); for (let j = 0; j < ss / 4; j++) fat.push(u32(s, j * 4)); });
    const chain = st => { const o = []; let n = st; while (n < END) { o.push(n); n = fat[n]; } return o; };
    const read = st => cat(...chain(st).map(sec));
    const dir = read(dirStart), ents = {};
    for (let i = 0; i < dir.length / 128; i++) { const e = dir.subarray(i * 128, i * 128 + 128), nl = u16(e, 64); ents[new TextDecoder("utf-16le").decode(e.subarray(0, Math.max(nl - 2, 0)))] = [e[66], u32(e, 116), u32(e, 120)]; }
    const mini = ents["Root Entry"] ? read(ents["Root Entry"][1]) : new Uint8Array(0), mf = mfStart < END ? read(mfStart) : new Uint8Array(0);
    return name => {
      const [, st, sz] = ents[name];
      if (sz < cutoff) { const parts = []; let n = st; while (n < END) { parts.push(mini.subarray(n * mss, (n + 1) * mss)); n = u32(mf, n * 4); } return cat(...parts).subarray(0, sz); }
      return read(st).subarray(0, sz);
    };
  }
  // WebCrypto only does padded CBC: forge one valid padding block so raw CBC blocks can be decrypted.
  async function aesDec(keyBytes, iv, c) {
    const k = await S.importKey("raw", keyBytes, "AES-CBC", false, ["encrypt", "decrypt"]);
    const pad = new Uint8Array(await S.encrypt({ name: "AES-CBC", iv: c.subarray(c.length - 16) }, k, new Uint8Array(0)));
    return new Uint8Array(await S.decrypt({ name: "AES-CBC", iv }, k, cat(c, pad)));
  }
  async function decrypt(bytes, password, log) {
    const get = cfb(bytes), info = get("EncryptionInfo"), pkg = get("EncryptedPackage"), xml = new TextDecoder().decode(info.subarray(8));
    const at = tag => { const m = new RegExp("<(?:\\w+:)?" + tag + "\\b([^>]*)>").exec(xml), o = {}; m[1].replace(/(\w+)="([^"]*)"/g, (_, k, v) => (o[k] = v)); return o; };
    const kd = at("keyData"), ek = at("encryptedKey"); if (ek.hashAlgorithm !== "SHA512") throw Error("Unsupported Excel encryption (" + ek.hashAlgorithm + ")");
    const salt = b64(ek.saltValue), spin = +ek.spinCount, kb = +ek.keyBits / 8;
    log("Unlocking Excel file (this takes a few seconds)…");
    let h = await sha(cat(salt, enc.encode(password).length ? (() => { const o = new Uint8Array(password.length * 2); for (let i = 0; i < password.length; i++) { o[i * 2] = password.charCodeAt(i) & 255; o[i * 2 + 1] = password.charCodeAt(i) >> 8; } return o; })() : new Uint8Array(0)));
    for (let i = 0; i < spin; i++) h = await sha(cat(le32(i), h));
    const derive = async bk => { const k = (await sha(cat(h, hex(bk)))).subarray(0, kb); return cat(k, new Uint8Array(Math.max(0, kb - k.length)).fill(0x36)); };
    const vin = (await aesDec(await derive("fea7d2763b4b9e79"), salt, b64(ek.encryptedVerifierHashInput))).subarray(0, +ek.saltSize);
    const vhv = await aesDec(await derive("d7aa0f6d3061344e"), salt, b64(ek.encryptedVerifierHashValue)), hv = await sha(vin);
    if (hv.some((x, i) => x !== vhv[i])) throw Error("Wrong Excel password.");
    const key = (await aesDec(await derive("146e0be7abacd0d6"), salt, b64(ek.encryptedKeyValue))).subarray(0, kb), ksalt = b64(kd.saltValue);
    const size = u32(pkg, 0), body = pkg.subarray(8), out = new Uint8Array(Math.ceil(body.length / 16) * 16);
    for (let i = 0, p = 0; p < body.length; i++, p += 4096) {
      const iv = (await sha(cat(ksalt, le32(i)))).subarray(0, 16), seg = body.subarray(p, p + 4096), pt = await aesDec(key, iv, seg);
      out.set(pt, p); if (i % 800 === 0) log("Decrypting… " + Math.round((p / body.length) * 100) + "%");
    }
    return out.subarray(0, size);
  }

  // ---------- 2. minimal .xlsx reader (JSZip + regex; only the sheets we need are inflated) ----------
  const unesc = s => s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (m, e) => e === "amp" ? "&" : e === "lt" ? "<" : e === "gt" ? ">" : e === "quot" ? '"' : e === "apos" ? "'" : String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : +e.slice(1))).replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const colIdx = L => { let n = 0; for (const c of L) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };
  async function openBook(bytes) {
    const zip = await JSZip.loadAsync(bytes), str = async p => (await zip.file(p).async("string")).replace(/\r\n?/g, "\n");
    const wbx = await str("xl/workbook.xml"), rels = await str("xl/_rels/workbook.xml.rels"), rmap = {};
    (rels.match(/<Relationship\b[^>]*>/g) || []).forEach(t => { const id = /\bId="([^"]*)"/.exec(t), tg = /\bTarget="([^"]*)"/.exec(t); if (id && tg) rmap[id[1]] = tg[1].startsWith("/") ? tg[1].slice(1) : "xl/" + tg[1]; });
    const sheets = {}; (wbx.match(/<sheet\b[^>]*>/g) || []).forEach(t => { const n = /\bname="([^"]*)"/.exec(t), r = /\br:id="([^"]*)"/.exec(t); if (n && r) sheets[unesc(n[1])] = rmap[r[1]]; });
    const ss = []; if (zip.file("xl/sharedStrings.xml")) { const x = await str("xl/sharedStrings.xml"); (x.match(/<si\s*\/>|<si\b[^>]*>[\s\S]*?<\/si>/g) || []).forEach(si => { si = si.replace(/<rPh\b[\s\S]*?<\/rPh>/g, ""); let t = ""; si.replace(/<t\b[^>]*>([\s\S]*?)<\/t>/g, (_, v) => (t += v)); ss.push(unesc(t)); }); }
    return { sheets, async read(name, maxCol = 400, maxRow = 1e9) {
      if (!sheets[name]) return null; const xml = await str(sheets[name]), rows = [], re = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g; let m;
      while ((m = re.exec(xml))) {
        const a = m[1], r = /\br="([A-Z]+)(\d+)"/.exec(a); if (!r || !m[2]) continue; const ci = colIdx(r[1]), ri = +r[2] - 1; if (ri >= maxRow) break; if (ci >= maxCol) continue;
        const ty = (/\bt="(\w+)"/.exec(a) || [0, "n"])[1]; let val = null;
        if (ty === "inlineStr") { let t = ""; m[2].replace(/<t\b[^>]*>([\s\S]*?)<\/t>/g, (_, v) => (t += v)); val = unesc(t); }
        else { const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(m[2]); if (v) { const w = v[1]; val = ty === "s" ? ss[+w] : ty === "str" ? unesc(w) : ty === "b" ? w === "1" : ty === "e" ? null : (isNaN(parseFloat(w)) ? null : parseFloat(w)); } }
        if (val !== null && val !== undefined) (rows[ri] || (rows[ri] = []))[ci] = val;
      }
      for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = []; return rows;
    } };
  }

  // ---------- 3. value helpers (mirror build_data.py) ----------
  const EPOCH = Date.UTC(1899, 11, 30), pad = (n, l = 2) => String(n).padStart(l, "0");
  const num = v => { if (v == null || typeof v === "boolean") return null; const x = typeof v === "string" ? parseFloat(v.trim().replace("%", "")) : v; return typeof v === "string" && !/^[\s+-]?[\d.]+%?\s*$/.test(v) ? null : isFinite(x) ? x : null; };
  const pct = v => { const x = num(v); return x != null && typeof v === "string" && v.trim().endsWith("%") ? x / 100 : x; };
  const txt = v => (v == null || ["", "nan", "NaT"].includes(String(v).trim()) ? "" : String(v).trim());
  const secs = v => typeof v === "number" ? Math.floor(v * 86400 + 0.001) : typeof v === "string" && /^(\d+):(\d\d):(\d\d)$/.test(v.trim()) ? v.trim().split(":").reduce((t, x) => t * 60 + +x, 0) : null;
  const clock = v => { if (typeof v === "number") { const s = Math.floor((v - Math.floor(v)) * 86400 + 0.001) % 86400; return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s % 3600 / 60)) + ":" + pad(s % 60); } return typeof v === "string" && /^\d\d:\d\d:\d\d$/.test(v.trim()) ? v.trim() : null; };
  const parts = v => {
    if (typeof v === "number") { if (!(v > 20000 && v < 90000)) return null; const d = new Date(EPOCH + Math.floor(v * 86400 + 0.001) * 1000); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]; }
    const m = /(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(v == null ? "" : v)); return m ? [+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)] : null;
  };
  const dstr = p => p[0] + "-" + pad(p[1]) + "-" + pad(p[2]), tstr = p => pad(p[3]) + ":" + pad(p[4]) + ":" + pad(p[5]);
  const eid = v => (num(v) != null ? String(Math.trunc(num(v))) : txt(v));
  const mask = v => { if (typeof v === "number" && Number.isInteger(v)) v = String(v); const s = String(v == null ? "" : v).replace(/\D/g, ""); return s ? "*".repeat(Math.max(s.length - 3, 0)) + s.slice(-3) : ""; };
  const clean = (t, cap = 1800) => { t = txt(t).replace(/\b(?:\+?88)?0?1\d{9}\b/g, m => "*******" + m.slice(-3)); return t.length <= cap ? t : t.slice(0, cap) + " …"; };
  const splitRemarks = t => { const ce = [], nce = []; let last = null; (t || "").split(/\n+/).forEach(seg => { const m = /^\s*(non\s*ce|ce)\s*:\s*([\s\S]*)/i.exec(seg); if (m) { last = /^non/i.test(m[1]) ? nce : ce; last.push(m[2].trim()); } else if (seg.trim() && last) last[last.length - 1] += " " + seg.trim(); }); return [ce.join(" | "), nce.join(" | ")]; };
  const colMap = hdr => { const o = {}; hdr.forEach((h, i) => { if (h != null && !(String(h) in o)) o[String(h)] = i; }); return o; };
  const g = (r, i) => (i == null ? null : r[i] == null ? null : r[i]);

  // ---------- 4. build dashboard.json ----------
  async function build(file, password, log, oldAgents) {
    let bytes = new Uint8Array(await file.arrayBuffer());
    if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) bytes = await decrypt(bytes, password, log);
    log("Reading workbook…"); const wb = await openBook(bytes), names = Object.keys(wb.sheets);
    const dkn = ["DKB Attendance Raw", "dkb attedance raw"].find(n => names.includes(n)), qn = ["CE & NCE & RTC Raw", "Quality Raw"].find(n => names.includes(n)), need = ["KPI", "Day Wise CFS Tracker", "Day Wise AHT Tracker", "Quality & DKB & Quiz Report", "Escalation Accuracy & FCR", "Schedule Attendance Raw"];
    const miss = need.filter(n => !names.includes(n)).concat(qn ? [] : ["CE & NCE & RTC Raw"]).concat(dkn ? [] : ["DKB Attendance Raw"]); if (miss.length) throw Error("Sheets missing in this Excel: " + miss.join(", "));
    // KPI
    const kr = await wb.read("KPI", 55, 60), hi = kr.findIndex(r => r[0] === "ID" && r[1] === "Name" && r[2] === "TL");
    const SLAB = { ce: 11, empathy: 14, fcr: 17, escalation: 20, adherence: 26, login: 29, aht: 34, csat: 37, dkb: 42, quiz: 44, service: 23, break: 40 };
    const M = { ce: ["Critical Error (CE)", 10, 11, 9, "pct"], empathy: ["Empathy", 13, 14, 12, "pct"], fcr: ["First Call Resolution (FCR)", 16, 17, 15, "pct"], escalation: ["Complaint Escalation Accuracy", 19, 20, 18, "pct"], adherence: ["Schedule Adherence", 25, 26, 24, "pct"], login: ["Login Hour Compliance", 30, 31, null, "pct"], aht: ["AHT (sec)", 33, 34, 32, "sec"], csat: ["CSAT / CFS", 36, 37, 35, "pct"], dkb: ["DKB Attendance", 41, 42, null, "pct"], quiz: ["Quiz Score", 43, 44, null, "raw"], service: ["Service Delivery", 22, 23, 21, "pct"], break: ["Break Time (% of target)", 38, 40, null, "pct"] };
    const agents = {}, kpi = {}, agentList = [];
    kr.slice(hi + 1).forEach(r => {
      if (num(r[0]) == null) return; const e = eid(r[0]); agents[e] = { eid: e, name: txt(r[1]), tl: txt(r[2]), team: "Team Empire" }; agentList.push(agents[e]);
      const k = { final: num(r[47]), category: g(r, 48), eligibility: g(r, 6), roster: num(r[3]), present: num(r[4]), absent: num(r[5]), extraBreak: { sec: secs(r[39]), text: typeof r[39] === "string" ? r[39] : null }, lagSec: secs(r[29]), readySec: secs(r[28]), targetReadySec: secs(r[27]), metrics: {} };
      for (const [key, [label, vc, sc, tc, kind]] of Object.entries(M)) { const v = g(r, vc), val = kind === "pct" ? pct(v) : num(v), tv = tc != null ? g(r, tc) : null; k.metrics[key] = { label, value: val, raw: val == null && typeof v === "string" ? v : null, kpiScore: num(g(r, sc)), max: num(g(kr[0], SLAB[key])), target: tv != null ? (kind === "pct" ? pct(tv) : num(tv)) : null }; }
      kpi[e] = k;
    });
    const EIDS = new Set(Object.keys(agents)); if (!EIDS.size) throw Error("No agents found in the KPI sheet.");
    // trackers
    const tracker = async (name, hrow, first, step, withVdi, drow) => {
      const rr = await wb.read(name, 130, 60), out = {}, vmap = {}, dates = {};
      for (let c = first; c < 130; c += step) { const p = typeof g(rr[drow] || [], c) === "number" ? parts(rr[drow][c]) : null; if (p) dates[c] = dstr(p); }
      rr.slice(hrow).forEach(r => { if (num(r[0]) == null) return; const e = eid(r[0]); if (withVdi && r[1]) vmap[String(r[1]).trim().toLowerCase()] = e; const days = {}; for (const [c, d] of Object.entries(dates)) days[d] = [0, 1, 2].map(i => g(r, +c + i)); out[e] = { monthly: Array.from({ length: first - (withVdi ? 4 : 3) }, (_, i) => g(r, (withVdi ? 4 : 3) + i)), days }; });
      return [out, vmap];
    };
    const [cfs, vmap] = await tracker("Day Wise CFS Tracker", 3, 7, 3, true, 1), [aht] = await tracker("Day Wise AHT Tracker", 2, 6, 3, false, 0);
    const D = {}, bundle = (m, e) => ((D[m] || (D[m] = {}))[e] || (D[m][e] = { att: [], dkb: [], cfs: [], aht: [], q: [], sd: [] }));
    // attendance
    log("Reading attendance…"); const sr = await wb.read("Schedule Attendance Raw", 40), sc = colMap(sr[0]), att = []; let attMax = "";
    sr.slice(1).forEach(r => {
      const e = eid(g(r, sc["ID"])), p = parts(g(r, sc["Date"])); if (!EIDS.has(e) || !p) return; const ds = dstr(p); if (ds > attMax) attMax = ds;
      const tb = secs(g(r, sc["Target Break"])), bt = secs(g(r, sc["Break Time"])), ts = secs(g(r, sc["Target Ready"])), sy = secs(g(r, sc["System Ready Time"])), shift = r[sc["Roster"]] == null ? "nan" : String(r[sc["Roster"]]), off = shift.toLowerCase() === "dayoff";
      att.push([ds, e, { date: ds, shift, dayOff: off, rosterCount: Math.trunc(num(g(r, sc["Roster Count"])) || 0), present: Math.trunc(num(g(r, sc["Present Count"])) || 0), absent: Math.trunc(num(g(r, sc["Absent Count"])) || 0), login: clock(g(r, sc["Login Time"])), logout: clock(g(r, sc["Logout Time"])), state: num(g(r, sc["LoginLogout Status"])), targetBreakSec: tb, breakSec: bt, overSec: bt != null && tb != null && !off ? bt - tb : null, targetReadySec: ts, readySec: sy, lagSec: ts != null && sy != null && !off ? ts - sy : null, auditCount: num(g(r, sc["Audit Count"])), cePass: num(g(r, sc["CE Pass"])), nonCePass: num(g(r, sc["Non CE Pass"])) }]);
    });
    att.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).forEach(([ds, e, o]) => bundle(ds.slice(0, 7), e).att.push(o));
    // DKB
    const dr = await wb.read(dkn, 12), dc = colMap(dr[0]), dk = []; let dkMax = "";
    dr.slice(1).forEach(r => { const e = eid(g(r, dc["ID"])), p = parts(g(r, dc["Date"])); if (!EIDS.has(e) || !p) return; const ds = dstr(p); if (ds > dkMax) dkMax = ds; dk.push([ds, e, { date: ds, status: String(g(r, dc["Status"])), lob: txt(g(r, dc["LOB"])), tl: txt(g(r, dc["TL"])), role: txt(g(r, dc["Role"])), category: txt(g(r, dc["Category"])) }]); });
    dk.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).forEach(([ds, e, o]) => bundle(ds.slice(0, 7), e).dkb.push(o));
    // CFS / AHT day-wise
    for (const [src, key] of [[cfs, "cfs"], [aht, "aht"]]) for (const [e, v] of Object.entries(src)) { if (!EIDS.has(e)) continue; for (const [day, x] of Object.entries(v.days)) bundle(day.slice(0, 7), e)[key].push(key === "cfs" ? { date: day, csat: num(x[0]), dsat: num(x[1]), score: pct(x[2]) } : { date: day, staffSec: secs(x[0]), auxSec: secs(x[1]), aht: num(x[2]), note: num(x[2]) == null ? txt(x[2]) : null }); }
    // FCR
    const fr = await wb.read("Escalation Accuracy & FCR", 14), fcr = {}; fr.slice(1).forEach(r => { if (num(g(r, 8)) != null) fcr[eid(r[8])] = { calls: num(g(r, 11)), fcr: num(g(r, 12)), pct: num(g(r, 13)) }; });
    // quality (call level)
    log("Reading quality calls…"); const qr = await wb.read(qn, 220), qh = qr[0], qx = colMap(qh), pc = []; qh.forEach((c, i) => { if (i < 190 && c != null && (/^\d+\.\d/.test(String(c)) || String(c).startsWith("Customer Affecting") || String(c).startsWith("Fatal"))) pc.push(i); });
    qr.slice(1).forEach(r => {
      const vd = txt(g(r, qx["VDI ID"])).toLowerCase(), e = vmap[vd], p = parts(g(r, qx["Local End Time"])); if (!e || !EIDS.has(e) || !p) return;
      const fails = []; pc.forEach(i => { if (String(r[i] == null ? "" : r[i]).trim().toLowerCase() === "fail") fails.push({ param: String(qh[i]).trim(), detail: clean([r[i + 1], r[i + 2]].map(txt).filter(Boolean).join(" | "), 600) }); });
      const rem = txt(g(r, qx["Error Remarks"])), [cr, nr] = splitRemarks(rem), rt = qx["7.1 RTC"];
      bundle(dstr(p).slice(0, 7), e).q.push({ callDate: dstr(p), callTime: tstr(p), phone: mask(g(r, qx["ANI"])), callId: txt(g(r, qx["Call ID String"])), agent: txt(g(r, qx["Agent Name"])), tl: txt(g(r, qx["Team Leader"])), auditor: txt(g(r, qx["Auditor"])) || txt(g(r, qx["QA"])), form: txt(g(r, qx["Form"])), score: num(g(r, qx["Evaluation Score"])), result: txt(g(r, qx["Pass or Fail"])), ce: txt(g(r, qx["Critical Error"])) === "Fail", ceTopic: txt(g(r, qx["10.0 CE Topics Name"])), empPass: num(g(r, qx["Total Emp Parameter Pass Count"])), empFail: num(g(r, qx["Total Emp Parameter Fail Count"])), rtcPass: num(g(r, qx["RTC Pass"])), rtcFail: num(g(r, qx["RTC Fail"])), rtcDetail: rt == null ? "" : [r[rt + 1], r[rt + 2]].map(txt).filter(Boolean).join(" | "), fails, party: txt(g(r, qx["Audit Party"])), topic: txt(g(r, qx["Topic"])), ceReason: clean(cr, 1500), nceReason: clean(nr, 1500), nce: !!nr, remarks: clean(rem, 1500), comments: clean(g(r, qx["Audit Comments"]), 1500) });
    });
    // service delivery
    let sdn = 0; if (names.includes("Service Delivery Raw")) {
      const sr2 = await wb.read("Service Delivery Raw", 40), sx = colMap(sr2[0]);
      sr2.slice(1).forEach(r => {
        const e = vmap[txt(g(r, sx["Complaint against (Agent ID/Name)"])).toLowerCase()] || (num(g(r, sx["ID"])) != null && EIDS.has(eid(r[sx["ID"]])) ? eid(r[sx["ID"]]) : null);
        const p = parts(g(r, sx["Complaint received date"])) || parts(g(r, sx["Incident date"])); if (!e || !p) return; sdn++;
        bundle(dstr(p).slice(0, 7), e).sd.push({ received: dstr(p) + " " + pad(p[3]) + ":" + pad(p[4]), ticket: txt(g(r, sx["STS ticket"])), customer: mask(g(r, sx["Customer Number"])), topic: txt(g(r, sx["Topic"])), validation: txt(g(r, sx["Complaint Validation (Valid/Invalid)"])), errorBy: txt(g(r, sx["Service delivery Error By (Agent/Non Agent)"])), against: txt(g(r, sx["Complaint against (Agent ID/Name)"])), id: txt(g(r, sx["ID"])).replace(".0", ""), tl: txt(g(r, sx["TL name"])), tenure: txt(g(r, sx["Tenure"])), front: clean(g(r, sx["Frontliner's Comment"])), mgt: clean(g(r, sx["Complaint mgt. agent's comment"])), findings: clean(g(r, sx["Incident Findings from line function"])), gap: txt(g(r, sx["Service Gap Category"])), action: clean(g(r, sx["Action Taken"]), 400) });
      });
    }
    // audit summary
    const geo = t => t.replace(/"?lat"?\s*:\s*-?[\d.]+\s*,\s*"?long"?\s*:\s*-?[\d.]+/g, "location removed");
    const stamp = v => { const p = parts(v); return p ? dstr(p) + " " + tstr(p) : null; }, secf = v => (typeof v === "number" ? Math.round(v * 86400 * 100) / 100 : 0);
    const escI = {}, escSummary = {}, punch = {}, salary = {}, salaryKpi = {};
    if (names.includes("Escalation Accuracy Raw")) { log("Escalation accuracy…"); const er = await wb.read("Escalation Accuracy Raw", 20), ex = colMap(er[0]);
      er.slice(1).forEach(r => { const e = vmap[txt(g(r, ex["TicketCreatedBy"])).toLowerCase()], p = parts(g(r, ex["TicketCreatedDate"])); if (!e || !p) return; const m = dstr(p).slice(0, 7), c = (escSummary[m] || (escSummary[m] = {}))[e] || (escSummary[m][e] = { valid: 0, invalid: 0 }), acc = txt(g(r, ex["EscalationAccuracy"]));
        if (acc === "Valid") c.valid++; else if (acc === "Invalid") { c.invalid++; (escI[e] || (escI[e] = [])).push({ ticket: txt(g(r, ex["TicketId"])), msisdn: mask(g(r, ex["MSISDN"])), category: txt(g(r, ex["Category"])), sub: txt(g(r, ex["SubCategory"])), created: dstr(p) + " " + tstr(p), by: txt(g(r, ex["TicketCreatedBy"])), accuracy: acc, comment: clean(geo(txt(g(r, ex["FrontLineComments"]))), 1500) }); } }); }
    if (names.includes("Punch Data")) { log("Punch data…"); const pr = await wb.read("Punch Data", 25), px = colMap(pr[0]);
      pr.slice(1).forEach(r => { const e = eid(g(r, px["Gnx ID"])), p = parts(g(r, px["Date"])); if (!EIDS.has(e) || !p) return; (punch[e] || (punch[e] = [])).push({ date: dstr(p), shift: txt(g(r, px["Final Roster"])), first: stamp(g(r, px["First Punch Date & Time"])), last: stamp(g(r, px["Last Punch Date & Time"])), durSec: secs(g(r, px["Login Duration"])),
        punches: Math.trunc(num(g(r, px["Punch Count"])) || 0), rosterCount: Math.trunc(num(g(r, px["Roster Count"])) || 0), present: Math.trunc(num(g(r, px["Present Count"])) || 0), absent: Math.trunc(num(g(r, px["Absent Count"])) || 0), ontime: Math.trunc(num(g(r, px["Ontime Arrival"])) || 0), status: txt(g(r, px["Status"])), remarks: txt(g(r, px["Remarks"])) }); }); }
    let salaryKpiCycle = "";
    if (names.includes("Salary Data")) { log("Salary data…"); const sl = await wb.read("Salary Data", 40), cyc = (y, m, d) => (d >= 16 ? [y, m] : (m > 1 ? [y, m - 1] : [y - 1, 12])), hr = sl.findIndex((r, i) => i < 8 && r.some((_, c) => txt(r[c]) === "Date" && txt(r[c + 1]) === "ID"));
      if (hr >= 0) { const H = sl[hr], starts = []; for (let c = 0; c < H.length - 7; c++) if (txt(H[c]) === "Date" && txt(H[c + 1]) === "ID") starts.push(c);
        starts.forEach(c => sl.slice(hr + 1).forEach(r => { if (num(r[c + 1]) == null) return; const e = eid(r[c + 1]), p = parts(r[c]); if (!EIDS.has(e) || !p) return; if (!salaryKpiCycle) { const k = cyc(p[0], p[1], p[2]); salaryKpiCycle = k[0] + "-" + String(k[1]).padStart(2, "0") }
          (salary[e] || (salary[e] = [])).push({ date: dstr(p), skill: txt(r[c + 2]), roster: txt(r[c + 4]), paySec: secf(r[c + 5]), breakSec: secf(r[c + 6]), totalSec: secf(r[c + 7]) }); }));
        for (let i = 0; i < Math.min(10, sl.length); i++) for (let c = 1; c < sl[i].length - 4; c++) if (txt(sl[i][c]) === "ID" && txt(sl[i][c + 3]) === "Agent-Skill" && txt(sl[i][c + 4]) === "Category") sl.slice(i + 1).forEach(r => { if (num(r[c]) == null) return; const e = eid(r[c]); if (EIDS.has(e)) salaryKpi[e] = { bucket: txt(r[c + 4]), skill: txt(r[c + 3]), tl: txt(r[c + 2]) } });
        Object.values(salary).forEach(a => a.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0))); } }
    const qs = await wb.read("Quality & DKB & Quiz Report", 6), qsum = {}, byName = {}; qs.slice(3).forEach(r => { if (r[0] != null) byName[String(r[0]).trim().toLowerCase()] = r; });
    Object.entries(agents).forEach(([e, a]) => { const r = byName[a.name.trim().toLowerCase()]; if (r) qsum[e] = { audit: Math.trunc(num(r[1]) || 0), pass: Math.trunc(num(r[2]) || 0), fail: Math.trunc(num(r[3]) || 0), ce: num(r[4]), emp: num(r[5]) }; });
    // assemble
    const photo = {}; (oldAgents || []).forEach(a => { if (a.photo) photo[a.eid] = a.photo; }); Object.values(agents).forEach(a => (a.photo = photo[a.eid] || null));
    const months = Object.keys(D).sort(), kpiMonth = months.filter(m => Object.values(D[m]).some(b => b.cfs.length)).pop() || months[months.length - 1], now = new Date();
    const out = { generated: now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) + " " + pad(now.getHours()) + ":" + pad(now.getMinutes()), months, agents: agentList.map(a => ({ ...a, vdi: Object.keys(vmap).find(k => vmap[k] === a.eid) || "" })), kpi, kpiMonth, fcr,
      cfsMonthly: Object.fromEntries(Object.entries(cfs).filter(([e]) => EIDS.has(e)).map(([e, v]) => [e, { csat: num(v.monthly[0]), dsat: num(v.monthly[1]), score: pct(v.monthly[2]) }])),
      ahtMonthly: Object.fromEntries(Object.entries(aht).filter(([e]) => EIDS.has(e)).map(([e, v]) => [e, { staffSec: secs(v.monthly[0]), auxSec: secs(v.monthly[1]), aht: num(v.monthly[2]) }])), qsum, esc: escI, escSummary, punch, salary, salaryKpi, salaryKpiCycle, salaryConfig: { skillRates: { Premium: 57, Mass: 50 }, bonusPerHour: { "A+": 10, A: 10, B: 8, C: 5, D: 0 }, breakPercent: 11.5, currentCycleSkill: "Premium" }, coverage: { attendanceThrough: attMax, dkbThrough: dkMax }, data: D };
    // self-checks (same as the Python report)
    let bad = 0; Object.keys(agents).forEach(e => { const a = ((D[kpiMonth] || {})[e] || { att: [] }).att, ro = a.reduce((t, x) => t + x.rosterCount, 0), ok = a.reduce((t, x) => t + (x.rosterCount ? x.state || 0 : 0), 0), kv = kpi[e].metrics.adherence.value; if (ro && kv != null && Math.abs(ok / ro - kv) > 0.001) bad++; });
    let ceBad = 0; Object.keys(qsum).forEach(e => { const k = kpi[e].metrics.ce.value, q = qsum[e]; if (k != null && q.audit && Math.abs(q.fail / q.audit - k) > 0.001) ceBad++; });
    const calls = months.map(m => m + ": " + Object.values(D[m]).reduce((t, b) => t + b.q.length, 0));
    out.report = [`Agents ${Object.keys(agents).length} · months ${months.join(", ")} · KPI month ${kpiMonth}`, `Photos kept: ${Object.values(agents).filter(a => a.photo).length}/${Object.keys(agents).length} (add new photos on GitHub, named by EID)`, `Adherence vs KPI sheet mismatches: ${bad} · CE% vs KPI sheet mismatches: ${ceBad}`, `Quality calls by month → ${calls.join(" | ")} · Service complaints matched: ${sdn}`];
    return out;
  }

  // ---------- 5. publish to GitHub (needs a token with Contents: read & write on the repository) ----------
  async function publish({ token, repo, branch, path, data, log }) {
    const H = { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" }, base = "https://api.github.com/repos/" + repo + "/contents/", paths = path ? [path] : ["data/dashboard.json", "public/data/dashboard.json"];
    let found = null; for (const p of paths) { const r = await fetch(base + p + "?ref=" + encodeURIComponent(branch), { headers: H }); if (r.status === 401) throw Error("GitHub rejected the token (401). Create a new token and try again."); if (r.status === 403) throw Error("GitHub refused (403): the token needs Contents: Read and write permission on this repository."); if (r.ok) { found = { p, sha: (await r.json()).sha }; break; } }
    if (!found) throw Error("Could not find data/dashboard.json in " + repo + " (branch " + branch + "). Check the repository name, branch and path under Repository settings; the token must have access to this repository.");
    const clean = Object.assign({}, data); delete clean.report; const bytes = enc.encode(JSON.stringify(clean)); let bin = ""; for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    log("Publishing to GitHub (" + Math.round(bytes.length / 1024) + " KB)…");
    const r = await fetch(base + found.p, { method: "PUT", headers: H, body: JSON.stringify({ message: "Update dashboard data (" + data.generated + ")", content: btoa(bin), sha: found.sha, branch }) });
    if (!r.ok) throw Error("GitHub publish failed (" + r.status + "): " + ((await r.json().catch(() => ({}))).message || "unknown error")); return found.p;
  }
  window.TEUpdater = { build, publish };
})();
