/* Team Empire forms: "Pending Callback Input" (agents type, admin reads and deletes when done)
   and "Agent Observation" (agents write an observation on their own failed items, admin reads).
   Shared storage = Google Apps Script web app (backend/Code.gs). Without it the data stays on this device only. */
(() => {
  const CFG = { backendUrl: '' }; fetch('config.json?ts=' + Date.now()).then(r => r.ok ? r.json() : {}).then(j => { Object.assign(CFG, j || {}); try { if (typeof st !== 'undefined' && S && (st.v == 'cb' || st.v == 'ob')) render() } catch (_) { } }).catch(() => { });
  const $ = s => document.querySelector(s), LS = { cb: 'te-local-cb', ob: 'te-local-ob', ro: 'te-local-ro', adj: 'te-local-adj' }, be = () => (localStorage.getItem('te-be') || CFG.backendUrl || '').trim(), ak = () => sessionStorage.getItem('te-ak') || '';
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7), rd = k => { try { return JSON.parse(localStorage.getItem(LS[k]) || '[]') } catch (_) { return [] } }, wr = (k, v) => localStorage.setItem(LS[k], JSON.stringify(v));
  async function call(body) {
    let r; try { r = await fetch(be(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), cache: 'no-store', credentials: 'omit' }) } catch (_) { throw Error('Cannot reach shared storage. Open the web-app link in a private window: it must show {"ok":true…}. If it asks you to sign in, redeploy the script with “Who has access: Anyone” and use the link that ends with /exec.') } let j;
    try { j = await r.json() } catch (_) { throw Error('Shared storage did not answer. Check the web app URL and that it is deployed for “Anyone”.') } if (!j.ok) throw Error(/Unknown kind/.test(j.error || '') ? 'The shared storage script is an older version. Paste the new Code.gs and deploy a new version (see README).' : (j.error || 'Server error')); return j;
  }
  const Store = {
    remote: () => !!be(),
    async add(kind, rec) { rec.id = rec.id || uid(); rec.createdAt = new Date().toISOString(); if (be()) return call({ a: 'add', kind, rec }); const L = rd(kind), i = kind == 'ob' ? L.findIndex(x => x.agentEid == rec.agentEid && x.itemKey == rec.itemKey) : kind == 'ro' ? L.findIndex(x => x.agentEid == rec.agentEid && x.forDate == rec.forDate) : -1; if (i >= 0) { rec.id = L[i].id; L[i] = rec } else L.push(rec); wr(kind, L); return { ok: true, id: rec.id } },
    async list(kind, o = {}) { if (be()) return (await call({ a: 'list', kind, agent: o.agent || '', key: ak() })).rows; let L = rd(kind); if (o.agent) L = L.filter(x => x.agentEid == o.agent); return L },
    async del(kind, id) { if (be()) return call({ a: 'del', kind, id, key: ak() }); wr(kind, rd(kind).filter(x => x.id != id)); return { ok: true } }
  };
  const toast = (t, bad) => { let e = $('#toast'); if (!e) { e = document.createElement('div'); e.id = 'toast'; document.body.appendChild(e) } e.textContent = t; e.className = 'on' + (bad ? ' bad' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => e.className = '', bad ? 9000 : 3200) };
  const fdt = iso => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? esc(iso) : d.toLocaleString('en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) };
  const li = ms => { const d = new Date(ms), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) };
  const isAgent = () => ROLE.type == 'agent';
  const status = () => Store.remote() ? '<div class="note" style="border-color:#10b981">✔ Connected to shared storage.</div>' : `<div class="note">${isAgent() ? 'Shared storage is not connected yet: what you submit stays on this device and your supervisor will not see it until the admin connects it.' : 'Shared storage is not connected: submissions from agents’ phones will not reach you. Open “Shared storage setup” below.'}</div>`;
  const setup = () => isAgent() ? '' : `<details class="card" style="margin-top:14px"><summary style="cursor:pointer;font-weight:700">Shared storage setup (admin)</summary><div class="mut" style="font-size:13px;margin:8px 0">Paste the Google Apps Script web app URL (see README, “Shared storage”). To connect every device, also put it in <b>config.json</b> on GitHub. Admin key = the ADMIN_KEY you set in the script; it is kept only for this browser session.</div>
    <label class="fl">Web app URL<input id="beurl" type="text" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(localStorage.getItem('te-be') || '')}"></label><label class="fl">Admin key<input id="akin" type="password" autocomplete="off" placeholder="ADMIN_KEY" value="${esc(ak())}"></label>
    <div class="umb"><button class="btn pri" data-act="besave">Save</button><button class="btn" data-act="betest">Test connection</button><button class="btn" data-act="beclear">Disconnect</button></div></details>`;
  const keyForm = () => `<div class="card"><h3>Admin key needed</h3><div class="mut" style="font-size:13px">Type the ADMIN_KEY you set in the Apps Script (kept only for this browser session).</div><label class="fl"><input id="akin2" type="password" autocomplete="off" placeholder="ADMIN_KEY"></label><div class="umb"><button class="btn pri" data-act="aksave2">Unlock</button></div></div>`;
  const chips = (arr, cur, attr) => `<div class="chips">${arr.map(([k, l]) => `<button class="chip2${k == cur ? ' on' : ''}" ${attr}="${k}">${l}</button>`).join('')}</div>`;

  // ================= Pending Callback Input =================
  const CBT = [['24h', '24 Hours Callback'], ['sup', 'Supervisor Callback']];
  function cbPage() {
    st.cbt = st.cbt || '24h'; st.cbf = st.cbf || 'all'; const head = '<div class="view"><h2>📞 Pending Callback Input</h2>';
    if (!isAgent()) return head + `<div class="mut">Callbacks entered by agents. When a callback is done, delete it.</div>${status()}<div id="cbbox"><div class="empty">Loading…</div></div>${setup()}</div>`;
    const a = ag(ROLE.eid), t = st.cbt;
    return head + `<div class="mut">Choose the callback type, fill the details and press Submit. Your supervisor will see it.</div>${status()}${chips(CBT, t, 'data-cbt')}
    <div class="card fm"><label class="fl">Customer number *<input id="cbnum" type="tel" inputmode="tel" autocomplete="off" placeholder="01XXXXXXXXX"></label><label class="fl">Customer name<input id="cbname" type="text" autocomplete="off"></label>
    <label class="fl">Issue / reason *<textarea id="cbiss" rows="3" maxlength="500" placeholder="What does the customer need?"></textarea></label>
    <label class="fl">Callback due<input id="cbdue" type="datetime-local" value="${t == '24h' ? li(Date.now() + 864e5) : ''}"></label>
    <label class="fl" id="cbsupw" style="${t == 'sup' ? '' : 'display:none'}">Supervisor name<input id="cbsup" type="text" autocomplete="off"></label>
    <label class="fl">Notes<textarea id="cbnote" rows="2" maxlength="500"></textarea></label><div class="mut" style="font-size:12px">Agent: ${esc(a ? a.name : '')} · EID ${ROLE.eid}</div>
    <button class="lgb" style="margin-top:12px" data-act="cbsubmit">Submit callback</button></div></div>`;
  }
  async function cbSubmit() {
    const num = $('#cbnum').value.replace(/[^\d+]/g, ''), iss = $('#cbiss').value.trim(), t = st.cbt || '24h', a = ag(ROLE.eid);
    if (num.replace(/\D/g, '').length < 8) return toast('Enter a valid customer number', true); if (iss.length < 3) return toast('Write the issue / reason', true); if (t == 'sup' && !$('#cbsup').value.trim()) return toast('Write the supervisor name', true);
    const b = $('[data-act=cbsubmit]'); b.disabled = true;
    try { await Store.add('cb', { type: t, agentEid: ROLE.eid, agentName: a ? a.name : '', tl: a ? a.tl : '', number: num, name: $('#cbname').value.trim(), issue: iss, due: $('#cbdue').value, supervisor: t == 'sup' ? $('#cbsup').value.trim() : '', notes: $('#cbnote').value.trim() }); toast('✔ Callback submitted'); ['#cbnum', '#cbname', '#cbiss', '#cbnote', '#cbsup'].forEach(s => { const e = $(s); if (e) e.value = '' }); if (t == '24h') $('#cbdue').value = li(Date.now() + 864e5) }
    catch (e) { toast('✖ ' + e.message, true) } finally { b.disabled = false }
  }
  let cbRows = [];
  async function loadCb() {
    const box = $('#cbbox'); if (!box) return; if (Store.remote() && !ak()) { box.innerHTML = keyForm(); return }
    try { cbRows = await Store.list('cb'); drawCb() } catch (e) { box.innerHTML = `<div class="note">✖ ${esc(e.message)}</div>` }
  }
  function drawCb() {
    const box = $('#cbbox'); if (!box) return; const n24 = cbRows.filter(x => x.type == '24h').length, ns = cbRows.filter(x => x.type == 'sup').length, now = Date.now();
    let L = cbRows.filter(x => (st.cbf == 'all' || x.type == st.cbf) && (!st.cba || x.agentEid == st.cba)).sort((x, y) => (x.due || '9').localeCompare(y.due || '9'));
    box.innerHTML = chips([['all', `All (${cbRows.length})`], ['24h', `24 Hours Callback (${n24})`], ['sup', `Supervisor Callback (${ns})`]], st.cbf, 'data-cbf') +
      `<div class="bar2"><select id="cbag"><option value="">All agents</option>${S.agents.slice().sort((x, y) => x.name.localeCompare(y.name)).map(a => `<option value="${a.eid}"${a.eid == st.cba ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select><button class="btn" data-act="cbref">↻ Refresh</button><b>${L.length} pending</b></div>` +
      (L.length ? L.map(x => { const late = x.due && new Date(x.due) < now; return `<div class="cbc t${x.type}"><div class="cbh"><span class="sk" style="background:${x.type == '24h' ? '#f59e0b' : '#7c3aed'};margin:0">${x.type == '24h' ? '24 Hours' : 'Supervisor'}</span>${late ? '<span class="st r">Overdue</span>' : ''}<span class="mut" style="margin-left:auto;font-size:12px">${fdt(x.createdAt)}</span></div>
        <div class="cbn"><a href="tel:${esc(x.number)}">${esc(x.number)}</a>${x.name ? ' · ' + esc(x.name) : ''}</div><div>${esc(x.issue)}</div>
        <div class="mut" style="font-size:12px;margin-top:4px">Due: <b>${x.due ? fdt(x.due) : '—'}</b>${x.supervisor ? ' · Supervisor: <b>' + esc(x.supervisor) + '</b>' : ''}<br>By ${esc(x.agentName)} (EID ${esc(x.agentEid)})${x.notes ? '<br>Notes: ' + esc(x.notes) : ''}</div>
        <button class="btn" style="margin-top:8px;color:#047857;border-color:#a7f3d0" data-act="cbdel" data-id="${esc(x.id)}">✔ Done · Delete</button></div>` }).join('') : '<div class="empty">No pending callbacks 🎉</div>');
  }

  // ================= Agent Observation =================
  const OBO = [['ce', 'CE Observation'], ['emp', 'Empathy Fail Call Observation'], ['inv', 'Invalid Complaint Observation'], ['dkb', 'DKB Absent Observation']];
  const cut = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n) + ' …' : t };
  function obItems(eid, m, opt) {
    const b = B(m, eid);
    if (opt == 'ce') return b.q.filter(x => x.ce).map(x => ({ key: 'ce:' + x.callId + ':' + x.callTime, title: x.callDate + ' ' + x.callTime + ' · Call ' + (x.phone || '—'), lines: [['Call ID', x.callId], ['Topic', x.topic || x.ceTopic], ['CE reason', cut(x.ceReason || x.remarks, 300)], ['Auditor', x.auditor]] }));
    if (opt == 'emp') return b.q.filter(x => x.empFail > 0).map(x => ({ key: 'emp:' + x.callId + ':' + x.callTime, title: x.callDate + ' ' + x.callTime + ' · Call ' + (x.phone || '—'), lines: [['Call ID', x.callId], ['Empathy parameters failed', x.empFail], ['Details', cut(x.fails.filter(f => /^1\./.test(f.param)).map(f => f.param + (f.detail ? ': ' + f.detail : '')).join('; ') || x.nceReason, 300)], ['Auditor', x.auditor]] }));
    if (opt == 'inv') return ((S.esc || {})[eid] || []).filter(x => x.created.slice(0, 7) == m).map(x => ({ key: 'inv:' + x.ticket, title: x.created + ' · Ticket ' + x.ticket, lines: [['Category', x.category + ' / ' + x.sub], ['MSISDN', x.msisdn], ['Front line comment', cut(x.comment, 300)]] }));
    return b.dkb.filter(x => x.status == 'Absent').map(x => ({ key: 'dkb:' + x.date, title: dlab(x.date) + ' · Absent', lines: [['LOB', x.lob], ['TL', x.tl]] }));
  }
  const lines = it => it.lines.filter(l => l[1] !== '' && l[1] != null).map(l => `<div class="mut" style="font-size:13px"><b>${l[0]}:</b> ${esc(l[1])}</div>`).join('');
  const sum = it => it.lines.filter(l => l[1] !== '' && l[1] != null).map(l => l[0] + ': ' + l[1]).join(' | ').slice(0, 900);
  function obPage() {
    st.obo = st.obo || 'ce'; const head = '<div class="view"><h2>📝 Agent Observation</h2>';
    return head + `<div class="mut">${isAgent() ? 'Your failed or invalid items for the selected month. Write your observation on each one and press Submit.' : 'Observations submitted by agents. Pick an option; choose an agent to see all their items.'}</div>${status()}${chips(OBO, st.obo, 'data-obo')}<div id="obbox"><div class="empty">Loading…</div></div>${setup()}</div>`;
  }
  let obSubs = [];
  async function loadOb() {
    const box = $('#obbox'); if (!box) return;
    if (!isAgent() && Store.remote() && !ak()) { box.innerHTML = keyForm(); return }
    try { obSubs = await Store.list('ob', isAgent() ? { agent: ROLE.eid } : {}); isAgent() ? drawObAgent() : drawObAdmin() } catch (e) { box.innerHTML = `<div class="note">✖ ${esc(e.message)}</div>` }
  }
  const mine = (eid, key) => obSubs.find(s => s.agentEid == eid && s.itemKey == key);
  function drawObAgent() {
    const box = $('#obbox'), items = obItems(ROLE.eid, st.m, st.obo), done = items.filter(i => mine(ROLE.eid, i.key)).length;
    box.innerHTML = items.length ? `<div class="mut" style="margin:6px 2px" id="obprog">${done} of ${items.length} observed · ${mlab(st.m)}</div><div class="bar" style="margin-bottom:10px"><i id="obbar" style="width:${done / items.length * 100}%"></i></div>` +
      items.map(it => { const s = mine(ROLE.eid, it.key); return `<div class="obc" data-k="${esc(it.key)}"><div class="cbh"><b>${esc(it.title)}</b><span class="st ${s ? 'g' : 'y'}" style="margin-left:auto">${s ? 'Submitted ✓' : 'Pending'}</span></div>${lines(it)}
        <textarea rows="3" maxlength="800" placeholder="Write your observation…" data-ta="${esc(it.key)}">${s ? esc(s.text) : ''}</textarea><button class="btn pri" data-act="obsave" data-key="${esc(it.key)}">${s ? 'Update' : 'Submit'}</button></div>` }).join('')
      : `<div class="empty">Nothing to observe here for ${mlab(st.m)} 🎉</div>`;
  }
  async function obSave(key) {
    const it = obItems(ROLE.eid, st.m, st.obo).find(i => i.key == key), card = [...document.querySelectorAll('.obc')].find(c => c.dataset.k == key), ta = card && card.querySelector('textarea'), a = ag(ROLE.eid); if (!it || !ta) return;
    const txt = ta.value.trim(); if (txt.length < 3) return toast('Write your observation first', true); const b = card.querySelector('[data-act=obsave]'); b.disabled = true;
    try { await Store.add('ob', { option: st.obo, agentEid: ROLE.eid, agentName: a ? a.name : '', tl: a ? a.tl : '', month: st.m, itemKey: key, itemTitle: it.title, itemSummary: sum(it), text: txt });
      const i = obSubs.findIndex(s => s.agentEid == ROLE.eid && s.itemKey == key), rec = { agentEid: ROLE.eid, itemKey: key, text: txt }; i >= 0 ? obSubs[i] = rec : obSubs.push(rec);
      card.querySelector('.st').className = 'st g'; card.querySelector('.st').textContent = 'Submitted ✓'; b.textContent = 'Update'; const items = obItems(ROLE.eid, st.m, st.obo), done = items.filter(x => mine(ROLE.eid, x.key)).length; $('#obprog').textContent = done + ' of ' + items.length + ' observed · ' + mlab(st.m); $('#obbar').style.width = done / items.length * 100 + '%'; toast('✔ Observation submitted') }
    catch (e) { toast('✖ ' + e.message, true) } finally { b.disabled = false }
  }
  function drawObAdmin() {
    const box = $('#obbox'), A = S.agents.slice().sort((x, y) => x.name.localeCompare(y.name)), opt = st.obo, subs = obSubs.filter(s => s.option == opt && s.month == st.m);
    let h = `<div class="bar2"><select id="obag"><option value="">All agents</option>${A.map(a => `<option value="${a.eid}"${a.eid == st.oba ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select><button class="btn" data-act="obref">↻ Refresh</button><b>${subs.length} submitted · ${mlab(st.m)}</b></div>`;
    if (st.oba) { const a = ag(st.oba), items = obItems(st.oba, st.m, opt); h += `<h3 style="margin:8px 2px">${esc(a.name)}: ${items.length} item(s)</h3>` + (items.length ? items.map(it => { const s = mine(st.oba, it.key); return `<div class="obc"><div class="cbh"><b>${esc(it.title)}</b><span class="st ${s ? 'g' : 'r'}" style="margin-left:auto">${s ? 'Observed' : 'Not submitted'}</span></div>${lines(it)}${s ? `<div class="obt">${esc(s.text)}</div><div class="mut" style="font-size:12px">${fdt(s.createdAt)}</div>` : ''}</div>` }).join('') : '<div class="empty">No items for this agent 🎉</div>'); }
    else {
      h += `<div class="card"><h3>Coverage</h3>` + tbl([['Agent', r => esc(r.a.name)], ['Items', r => r.n], ['Observed', r => r.o], ['Pending', r => r.n - r.o > 0 ? `<span class="st r">${r.n - r.o}</span>` : '<span class="st g">0</span>']], A.map(a => ({ a, n: obItems(a.eid, st.m, opt).length, o: subs.filter(s => s.agentEid == a.eid).length })).filter(r => r.n || r.o), r => r.n - r.o > 0 ? 'warn' : '') + '</div>';
      h += `<h3 style="margin:14px 2px 6px">Submitted observations</h3>` + (subs.length ? subs.sort((x, y) => (y.createdAt || '').localeCompare(x.createdAt || '')).map(s => `<div class="obc"><div class="cbh"><b>${esc(s.agentName)}</b><span class="mut" style="margin-left:auto;font-size:12px">${fdt(s.createdAt)}</span></div><div style="font-weight:600">${esc(s.itemTitle)}</div><div class="mut" style="font-size:13px">${esc(s.itemSummary)}</div><div class="obt">${esc(s.text)}</div></div>`).join('') : '<div class="empty">No observations submitted yet.</div>');
    }
    box.innerHTML = h;
  }


  // ================= Next-day roster requirement (shown after an agent logs in) =================
  const SHIFTS = ['07:00-16:00', '08:00-17:00', '09:00-17:00', '12:00-21:00', '14:00-23:00', '15:00-23:00', '16:00-23:00', '17:00-23:00', '18:00-00:00', 'Night (21:00-07:00)'];
  const ADJ = ['Only Login Adjustment', 'Only Logout Adjustment', 'Only Lag Adjustment', 'Login Adherence + Lag Adjustment', 'Logout Adjustment + Lag Adjustment'];
  const SUPS = ['Md Ariful Islam Niloy', 'Mohammad Imam Hossain', 'Nusrat Jahan Tamanna', 'Sattazit Gosh', 'Shajjadul Rhythm', 'Fahad Hridoy', 'Sanjida Islam Tinny'];
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), dayOff = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d) };
  const nice = d => new Date(d + 'T00:00').toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  let roState = null;
  async function roLoad() { const date = dayOff(1); let rows = []; try { rows = await Store.list('ro', { agent: ROLE.eid }) } catch (_) { return roState = { date, shift: null, err: true } } const m = rows.find(r => r.forDate == date); return roState = { date, shift: m ? m.shift : null } }
  const ROPT = SHIFTS.concat(['DayOff']);
  function roPage() {
    const head = '<div class="view"><h2>🗓️ আগামীকালের রোস্টার রিকোয়ারমেন্ট</h2>';
    if (!isAgent()) return head + '<div class="note">This form is for agents. The submitted requirements are in <b>Requests</b> → Roster Requirements.</div></div>';
    return head + `<div class="mut">তোমার আগামীকাল রোস্টার রিকোয়ারমেন্ট সাবমিট করো<br>Next day roster requirement for <b>${nice(dayOff(1))}</b></div>${status()}<div id="roCur"></div>
    <div class="card fm"><label class="fl">Shift / শিফট<select id="roSel"><option value="">— Select shift —</option>${ROPT.map(s => `<option>${s}</option>`).join('')}</select></label>
    <button class="lgb" style="margin-top:14px" data-act="rosubmit">Submit</button></div><h3 style="margin:16px 2px 6px">My recent roster requirements</h3><div id="roMine"><div class="empty">Loading…</div></div></div>`;
  }
  async function roInit() {
    await roLoad(); const s = roState || {}, sel = $('#roSel'), cur = $('#roCur'); if (!sel) return; if (s.shift) sel.value = s.shift;
    cur.innerHTML = s.err ? '<div class="note">Could not check your earlier submission. You can still submit.</div>' : s.shift ? `<div class="card" style="border-left:5px solid #10b981">✔ Submitted for ${nice(s.date)}: <b>${esc(s.shift)}</b>. You can change it below.</div>` : `<div class="card" style="border-left:5px solid #f59e0b">⚠ তোমার আগামীকালের রোস্টার রিকোয়ারমেন্ট এখনো সাবমিট করা হয়নি</div>`;
    const box = $('#roMine'); try { const L = (await Store.list('ro', { agent: ROLE.eid })).sort((x, y) => y.forDate.localeCompare(x.forDate)).slice(0, 7); box.innerHTML = L.length ? L.map(x => `<div class="obc"><div class="cbh"><b>${nice(x.forDate)}</b><span class="sk" style="background:#2563eb;margin-left:auto">${esc(x.shift)}</span></div><div class="mut" style="font-size:12px">Submitted ${fdt(x.createdAt)}</div></div>`).join('') : '<div class="empty">No submissions yet.</div>' } catch (e) { box.innerHTML = `<div class="note">✖ ${esc(e.message)}</div>` }
  }
  async function roSubmit() {
    const v = $('#roSel').value; if (!v) return toast('Select a shift', true); const a = ag(ROLE.eid), b = $('[data-act=rosubmit]'); b.disabled = true;
    try { await Store.add('ro', { forDate: dayOff(1), agentEid: ROLE.eid, agentName: a ? a.name : '', tl: a ? a.tl : '', shift: v }); roState = { date: dayOff(1), shift: v }; toast('✔ Roster requirement submitted'); roInit() }
    catch (e) { toast('✖ ' + e.message, true) } finally { b.disabled = false }
  }
  async function roBanner() {
    const box = $('#rosterBn'); if (!box || !isAgent()) return; if (!roState) await roLoad(); const s = roState || {};
    box.innerHTML = s.shift ? `<div class="card" style="margin-top:12px;border-left:5px solid #10b981">🗓️ Tomorrow’s roster requirement (${nice(s.date)}): <b>${esc(s.shift)}</b> ✓ <button class="lnk" data-act="roopen" style="margin-left:8px">Change</button></div>`
      : `<div class="card" style="margin-top:12px;border-left:5px solid #f59e0b">⚠ তোমার আগামীকালের রোস্টার রিকোয়ারমেন্ট এখনো সাবমিট করা হয়নি <button class="btn pri" data-act="roopen" style="margin-left:8px">Submit now</button></div>`;
  }

  // ================= Lag & Adherence Adjustment form =================
  const hm = s => { const m = /(\d{1,2}):(\d{2})/.exec(s || ''); return m ? m[1].padStart(2, '0') + ':' + m[2] : '' }, shiftFmt = s => { const m = /^(\d{2})(\d{2})-(\d{2})(\d{2})$/.exec(s || ''); return m ? m[1] + ':' + m[2] + '-' + m[3] + ':' + m[4] : (s || '') };
  const NEED = { 'Only Login Adjustment': ['adPin', 'adLog'], 'Only Logout Adjustment': ['adPout', 'adLogout'], 'Only Lag Adjustment': [], 'Login Adherence + Lag Adjustment': ['adPin', 'adLog'], 'Logout Adjustment + Lag Adjustment': ['adPout', 'adLogout'] };
  const NEEDTXT = { adPin: 'Punch In', adLog: 'Login', adPout: 'Punch Out', adLogout: 'Logout' };
  function adPage() {
    const head = '<div class="view"><h2>⏱️ Lag & Adherence Adjustment</h2>';
    if (!isAgent()) return head + '<div class="note">This form is for agents. The submitted forms are in <b>Requests</b>.</div></div>';
    const a = ag(ROLE.eid), opts = [0, -1, -2].map(n => `<option value="${dayOff(n)}">${n ? 'Today' + n : 'Today'} · ${nice(dayOff(n))}</option>`).join('');
    return head + `<div class="mut">Fill this form when you need a lag or adherence adjustment. Times are filled from the system where available; correct anything that is wrong.</div>${status()}
    <div class="card fm"><label class="fl">Date<select id="adDate">${opts}</select></label>
    <label class="fl">Employee ID<input id="adEid" type="text" readonly value="${ROLE.eid}"></label><label class="fl">Name<input id="adName" type="text" readonly value="${esc(a ? a.name : '')}"></label>
    <label class="fl">Which shift you did<input id="adShift" type="text" list="adShl" autocomplete="off" placeholder="e.g. 09:00-17:00"><datalist id="adShl">${SHIFTS.map(s => `<option value="${s}">`).join('')}<option value="Dayoff"></datalist></label>
    <label class="fl">What kind of Adjustment you Needed<select id="adKind"><option value="">— Select —</option>${ADJ.map(k => `<option>${k}</option>`).join('')}</select></label><div id="adNeed" class="mut" style="font-size:12px;margin-top:4px"></div>
    <div class="adg"><label class="fl">Your Punch In Time<input id="adPin" type="time"></label><label class="fl">Your Login Time<input id="adLog" type="time"></label><label class="fl">Your Punch Out Time<input id="adPout" type="time"></label><label class="fl">Your Logout Time<input id="adLogout" type="time"></label></div>
    <label class="fl">কতটুকু এডজাস্টমেন্ট লাগবে / How much adjustment needed (minutes)<input id="adDur" type="number" min="1" inputmode="numeric" placeholder="e.g. 25"></label>
    <div class="fl" style="margin-top:10px">কোন টাইম থেকে কোন টাইম পর্যন্ত এডজাস্টমেন্ট লাগবে / From which time to which time adjustment needed</div><div class="adg"><label class="fl">From time<input id="adFrom" type="time"></label><label class="fl">End time<input id="adTo" type="time"></label></div>
    <label class="fl">Floor Supervisor Name<select id="adSup"><option value="">— Select —</option>${SUPS.map(s => `<option>${s}</option>`).join('')}</select></label>
    <button class="lgb" style="margin-top:14px" data-act="adsubmit">Submit adjustment</button></div><h3 style="margin:16px 2px 6px">My recent submissions</h3><div id="adMine"><div class="empty">Loading…</div></div></div>`;
  }
  function adFill() {
    const d = $('#adDate').value, m = d.slice(0, 7), r = B(m, ROLE.eid).att.find(x => x.date == d), p = ((S.punch || {})[ROLE.eid] || []).find(x => x.date == d), set = (id, v) => { const e = $('#' + id); if (e) e.value = v || '' };
    set('adShift', r ? (r.dayOff ? 'Dayoff' : shiftFmt(r.shift)) : (p ? shiftFmt(p.shift) : '')); set('adLog', hm(r && r.login)); set('adLogout', hm(r && r.logout)); set('adPin', hm(p && p.first && p.first.slice(11))); set('adPout', hm(p && p.last && p.last.slice(11)));
  }
  function adNeed() { const k = $('#adKind').value, n = NEED[k] || []; $('#adNeed').textContent = k ? (n.length ? 'Required for this type: ' + n.map(x => NEEDTXT[x]).join(' + ') + ' time' : 'No punch/login times are required for this type.') : ''; ['adPin', 'adLog', 'adPout', 'adLogout'].forEach(i => $('#' + i).parentElement.classList.toggle('reqd', n.includes(i))) }
  function adAuto() { const f = $('#adFrom').value, t = $('#adTo').value, d = $('#adDur'); if (!f || !t || (d.value && !d.dataset.auto)) return; const [a, b] = [f, t].map(x => { const [h, m] = x.split(':').map(Number); return h * 60 + m }); d.value = ((b - a) + 1440) % 1440 || ''; d.dataset.auto = '1' }
  async function adSubmit() {
    const g = id => $('#' + id).value.trim(), kind = g('adKind'), bad = [];
    ['adShift', 'adKind', 'adDur', 'adFrom', 'adTo', 'adSup'].forEach(i => { if (!g(i)) bad.push(i) }); (NEED[kind] || []).forEach(i => { if (!g(i)) bad.push(i) });
    document.querySelectorAll('.fm .bad').forEach(e => e.classList.remove('bad')); bad.forEach(i => $('#' + i).classList.add('bad'));
    if (bad.length) { $('#' + bad[0]).scrollIntoView({ block: 'center', behavior: 'smooth' }); return toast('Fill the highlighted fields', true) }
    const a = ag(ROLE.eid), b = $('[data-act=adsubmit]'); b.disabled = true;
    try { await Store.add('adj', { date: g('adDate'), agentEid: ROLE.eid, agentName: a ? a.name : '', tl: a ? a.tl : '', shift: g('adShift'), kind, punchIn: g('adPin'), login: g('adLog'), punchOut: g('adPout'), logout: g('adLogout'), duration: g('adDur'), fromTime: g('adFrom'), toTime: g('adTo'), supervisor: g('adSup') });
      toast('✔ Adjustment submitted'); ['adKind', 'adDur', 'adFrom', 'adTo', 'adSup'].forEach(i => { $('#' + i).value = ''; delete $('#' + i).dataset.auto }); adNeed(); adMine() }
    catch (e) { toast('✖ ' + e.message, true) } finally { b.disabled = false }
  }
  async function adMine() {
    const box = $('#adMine'); if (!box) return; try { const L = (await Store.list('adj', { agent: ROLE.eid })).sort((x, y) => (y.createdAt || '').localeCompare(x.createdAt || '')).slice(0, 10);
      box.innerHTML = L.length ? L.map(x => `<div class="obc"><div class="cbh"><b>${nice(x.date)}</b><span class="sk" style="background:#2563eb;margin-left:auto">${esc(x.kind)}</span></div><div class="mut" style="font-size:13px">${esc(x.fromTime)} → ${esc(x.toTime)} · ${esc(x.duration)} min · ${esc(x.supervisor)}<br>Submitted ${fdt(x.createdAt)}</div></div>`).join('') : '<div class="empty">No submissions yet.</div>' } catch (e) { box.innerHTML = `<div class="note">✖ ${esc(e.message)}</div>` }
  }

  // ================= Admin: Requests (roster requirements + adjustment forms) =================
  const RQ = [['ro', 'Roster Requirements'], ['adj', 'Adjustment Forms']];
  function rqPage() { st.rqt = st.rqt || 'ro'; return '<div class="view"><h2>📋 Requests</h2><div class="mut">Roster requirements and lag / adherence adjustment forms submitted by agents.</div>' + status() + chips(RQ, st.rqt, 'data-rqt') + '<div id="rqbox"><div class="empty">Loading…</div></div>' + setup() + '</div>' }
  let rqRows = [];
  async function loadRq() {
    const box = $('#rqbox'); if (!box) return; if (Store.remote() && !ak()) { box.innerHTML = keyForm(); return }
    try { rqRows = await Store.list(st.rqt); st.rqt == 'ro' ? drawRo() : drawAdj() } catch (e) { box.innerHTML = `<div class="note">✖ ${esc(e.message)}</div>` }
  }
  function drawRo() {
    const box = $('#rqbox'), dates = [...new Set([dayOff(1), ...rqRows.map(r => r.forDate)])].sort().reverse(); if (!dates.includes(st.rqd)) st.rqd = dayOff(1);
    const L = rqRows.filter(r => r.forDate == st.rqd), A = S.agents.slice().sort((x, y) => x.name.localeCompare(y.name)), by = {}; L.forEach(r => by[r.shift] = (by[r.shift] || 0) + 1); const miss = A.filter(a => !L.some(r => r.agentEid == a.eid));
    box.innerHTML = `<div class="bar2"><b>For date</b><select id="rqd">${dates.map(d => `<option value="${d}"${d == st.rqd ? ' selected' : ''}>${nice(d)}${d == dayOff(1) ? ' (tomorrow)' : ''}</option>`).join('')}</select><button class="btn" data-act="rqref">↻ Refresh</button><b>${L.length} of ${A.length} submitted</b></div>
      <div class="chips">${Object.entries(by).sort().map(([s, n]) => `<span class="chip2 on" style="cursor:default">${esc(s)} · ${n}</span>`).join('') || ''}</div>` +
      `<div class="card">${tbl([['Agent', r => esc(r.agentName)], ['TL', r => esc(r.tl)], ['Shift required', r => '<b>' + esc(r.shift) + '</b>'], ['Submitted', r => fdt(r.createdAt)]], L.sort((x, y) => x.shift.localeCompare(y.shift)))}</div>` +
      `<h3 style="margin:14px 2px 6px">Not submitted yet (${miss.length})</h3>` + (miss.length ? `<div class="card">${miss.map(a => `<span class="st r" style="margin:3px">${esc(a.name)}</span>`).join('')}</div>` : '<div class="empty">Everyone has submitted 🎉</div>');
  }
  function drawAdj() {
    const box = $('#rqbox'), dopt = [['', 'All dates'], [dayOff(0), 'Today'], [dayOff(-1), 'Today-1'], [dayOff(-2), 'Today-2']], A = S.agents.slice().sort((x, y) => x.name.localeCompare(y.name));
    const L = rqRows.filter(r => (!st.rqdt || r.date == st.rqdt) && (!st.rqsup || r.supervisor == st.rqsup) && (!st.rqag || r.agentEid == st.rqag)).sort((x, y) => (y.createdAt || '').localeCompare(x.createdAt || ''));
    box.innerHTML = `<div class="bar2"><select id="rqdt">${dopt.map(([v, l]) => `<option value="${v}"${v == (st.rqdt || '') ? ' selected' : ''}>${l}</option>`).join('')}</select><select id="rqsup"><option value="">All supervisors</option>${SUPS.map(s => `<option${s == st.rqsup ? ' selected' : ''}>${s}</option>`).join('')}</select><select id="rqag"><option value="">All agents</option>${A.map(a => `<option value="${a.eid}"${a.eid == st.rqag ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select><button class="btn" data-act="rqref">↻ Refresh</button><b>${L.length} form(s)</b></div>` +
      (L.length ? L.map(x => `<div class="obc"><div class="cbh"><b>${esc(x.agentName)}</b><span class="mut">EID ${esc(x.agentEid)}</span><span class="sk" style="background:#2563eb;margin-left:auto">${esc(x.kind)}</span></div>
        <div><b>${nice(x.date)}</b> · Shift ${esc(x.shift)}</div><div class="adg mut" style="font-size:13px;margin:6px 0"><div>Punch In: <b>${esc(x.punchIn) || '—'}</b></div><div>Login: <b>${esc(x.login) || '—'}</b></div><div>Punch Out: <b>${esc(x.punchOut) || '—'}</b></div><div>Logout: <b>${esc(x.logout) || '—'}</b></div></div>
        <div>Adjustment: <b>${esc(x.duration)} min</b> (${esc(x.fromTime)} → ${esc(x.toTime)})</div><div class="mut" style="font-size:12px;margin-top:4px">Floor supervisor: <b>${esc(x.supervisor)}</b> · Submitted ${fdt(x.createdAt)}</div></div>`).join('') : '<div class="empty">No adjustment forms for this filter.</div>');
  }

  // ================= wiring =================
  function after() { const v = st.v; if (v == 'cb' && !isAgent()) loadCb(); if (v == 'ob') loadOb(); if (v == 'ad' && isAgent()) { adFill(); adMine() } if (v == 'rq' && !isAgent()) loadRq(); if (v == 'me' && isAgent()) roBanner(); if (v == 'ro' && isAgent()) roInit() }
  document.addEventListener('click', async e => {
    const c = e.target.closest('[data-cbt],[data-cbf],[data-obo],[data-act]'); if (!c) return;
    if (c.dataset.cbt) { st.cbt = c.dataset.cbt; document.querySelectorAll('[data-cbt]').forEach(x => x.classList.toggle('on', x == c)); $('#cbsupw').style.display = st.cbt == 'sup' ? '' : 'none'; const d = $('#cbdue'); if (d && !d.value && st.cbt == '24h') d.value = li(Date.now() + 864e5); return }
    if (c.dataset.cbf) { st.cbf = c.dataset.cbf; return drawCb() } if (c.dataset.obo) { st.obo = c.dataset.obo; document.querySelectorAll('[data-obo]').forEach(x => x.classList.toggle('on', x == c)); return loadOb() }
    const a = c.dataset.act;
    if (a == 'cbsubmit') return cbSubmit(); if (a == 'obsave') return obSave(c.dataset.key); if (a == 'cbref') return loadCb(); if (a == 'obref') return loadOb();
    if (a == 'cbdel') { if (!confirm('Mark this callback as done and delete it?')) return; try { await Store.del('cb', c.dataset.id); cbRows = cbRows.filter(x => x.id != c.dataset.id); drawCb(); toast('✔ Deleted') } catch (x) { toast('✖ ' + x.message, true) } return }
    if (a == 'besave') { const u = $('#beurl').value.trim(), k = $('#akin').value; u ? localStorage.setItem('te-be', u) : localStorage.removeItem('te-be'); k ? sessionStorage.setItem('te-ak', k) : sessionStorage.removeItem('te-ak'); toast('Saved'); render(); return }
    if (a == 'beclear') { localStorage.removeItem('te-be'); sessionStorage.removeItem('te-ak'); toast('Disconnected (using this device only)'); render(); return }
    if (a == 'betest') { const u = ($('#beurl').value.trim() || be()), k = $('#akin').value || ak(); if (!u) return toast('Paste the web app URL first', true);
      try { const j = await (await fetch(u)).json(); if (!j.ok) throw 0; if (!k) return toast('✔ Storage reached. Type the admin key and test again to check it.'); const jj = await (await fetch(u, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ a: 'list', kind: 'cb', key: k }) })).json(); toast(jj.ok ? '✔ Connected, and the admin key is correct' : '✔ Storage reached, but: ' + jj.error, !jj.ok) }
      catch (_) { toast('✖ Could not reach it. The URL must end with /exec and “Who has access” must be Anyone.', true) } return }
    if (a == 'aksave2') { const k = $('#akin2').value; if (!k) return; sessionStorage.setItem('te-ak', k); after(); return }
  });
  document.addEventListener('change', e => { if (e.target.id == 'cbag') { st.cba = e.target.value; drawCb() } if (e.target.id == 'obag') { st.oba = e.target.value; drawObAdmin() } });
  document.addEventListener('click', async e => { const c = e.target.closest('[data-rqt],[data-act]'); if (!c) return;
    if (c.dataset.rqt) { st.rqt = c.dataset.rqt; document.querySelectorAll('[data-rqt]').forEach(x => x.classList.toggle('on', x == c)); return loadRq() }
    const a = c.dataset.act; if (a == 'rosubmit') return roSubmit(); if (a == 'roopen') return nav('ro'); if (a == 'adsubmit') return adSubmit(); if (a == 'rqref') return loadRq() });
  document.addEventListener('change', e => { const i = e.target.id; if (i == 'adDate') adFill(); if (i == 'adKind') adNeed(); if (i == 'adFrom' || i == 'adTo') adAuto(); if (i == 'rqd') { st.rqd = e.target.value; drawRo() } if (i == 'rqdt') { st.rqdt = e.target.value; drawAdj() } if (i == 'rqsup') { st.rqsup = e.target.value; drawAdj() } if (i == 'rqag') { st.rqag = e.target.value; drawAdj() } });
  document.addEventListener('input', e => { if (e.target.id == 'adDur') delete e.target.dataset.auto; if (e.target.classList.contains('bad')) e.target.classList.remove('bad') });
  window.Forms = { cbPage, obPage, adPage, rqPage, roPage, after, Store };
})();
