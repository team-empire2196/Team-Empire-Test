/* Team Empire forms: "Pending Callback Input" (agents type, admin reads and deletes when done)
   and "Agent Observation" (agents write an observation on their own failed items, admin reads).
   Shared storage = Google Apps Script web app (backend/Code.gs). Without it the data stays on this device only. */
(() => {
  const CFG = { backendUrl: '' }; fetch('config.json?ts=' + Date.now()).then(r => r.ok ? r.json() : {}).then(j => Object.assign(CFG, j || {})).catch(() => { });
  const $ = s => document.querySelector(s), LS = { cb: 'te-local-cb', ob: 'te-local-ob' }, be = () => (localStorage.getItem('te-be') || CFG.backendUrl || '').trim(), ak = () => sessionStorage.getItem('te-ak') || '';
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7), rd = k => { try { return JSON.parse(localStorage.getItem(LS[k]) || '[]') } catch (_) { return [] } }, wr = (k, v) => localStorage.setItem(LS[k], JSON.stringify(v));
  async function call(body) {
    const r = await fetch(be(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }); let j;
    try { j = await r.json() } catch (_) { throw Error('Shared storage did not answer. Check the web app URL and that it is deployed for “Anyone”.') } if (!j.ok) throw Error(j.error || 'Server error'); return j;
  }
  const Store = {
    remote: () => !!be(),
    async add(kind, rec) { rec.id = rec.id || uid(); rec.createdAt = new Date().toISOString(); if (be()) return call({ a: 'add', kind, rec }); const L = rd(kind), i = kind == 'ob' ? L.findIndex(x => x.agentEid == rec.agentEid && x.itemKey == rec.itemKey) : -1; if (i >= 0) { rec.id = L[i].id; L[i] = rec } else L.push(rec); wr(kind, L); return { ok: true, id: rec.id } },
    async list(kind, o = {}) { if (be()) return (await call({ a: 'list', kind, agent: o.agent || '', key: ak() })).rows; let L = rd(kind); if (o.agent) L = L.filter(x => x.agentEid == o.agent); return L },
    async del(kind, id) { if (be()) return call({ a: 'del', kind, id, key: ak() }); wr(kind, rd(kind).filter(x => x.id != id)); return { ok: true } }
  };
  const toast = (t, bad) => { let e = $('#toast'); if (!e) { e = document.createElement('div'); e.id = 'toast'; document.body.appendChild(e) } e.textContent = t; e.className = 'on' + (bad ? ' bad' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => e.className = '', 3200) };
  const fdt = iso => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? esc(iso) : d.toLocaleString('en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) };
  const li = ms => { const d = new Date(ms), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) };
  const isAgent = () => ROLE.type == 'agent';
  const status = () => Store.remote() ? '<div class="note" style="border-color:#10b981">✔ Connected to shared storage.</div>' : `<div class="note">${isAgent() ? 'Shared storage is not connected yet: what you submit stays on this device and your supervisor will not see it until the admin connects it.' : 'Shared storage is not connected: submissions from agents’ phones will not reach you. Open “Shared storage setup” below.'}</div>`;
  const setup = () => isAgent() ? '' : `<details class="card" style="margin-top:14px"><summary style="cursor:pointer;font-weight:700">Shared storage setup (admin)</summary><div class="mut" style="font-size:13px;margin:8px 0">Paste the Google Apps Script web app URL (see README, “Shared storage”). To connect every device, also put it in <b>config.json</b> on GitHub. Admin key = the ADMIN_KEY you set in the script; it is kept only for this browser session.</div>
    <label class="fl">Web app URL<input id="beurl" type="text" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(localStorage.getItem('te-be') || '')}"></label><label class="fl">Admin key<input id="akin" type="password" autocomplete="off" placeholder="ADMIN_KEY" value="${esc(ak())}"></label>
    <div class="umb"><button class="btn pri" data-act="besave">Save</button><button class="btn" data-act="beclear">Disconnect</button></div></details>`;
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

  // ================= wiring =================
  function after() { const v = st.v; if (v == 'cb' && !isAgent()) loadCb(); if (v == 'ob') loadOb() }
  document.addEventListener('click', async e => {
    const c = e.target.closest('[data-cbt],[data-cbf],[data-obo],[data-act]'); if (!c) return;
    if (c.dataset.cbt) { st.cbt = c.dataset.cbt; document.querySelectorAll('[data-cbt]').forEach(x => x.classList.toggle('on', x == c)); $('#cbsupw').style.display = st.cbt == 'sup' ? '' : 'none'; const d = $('#cbdue'); if (d && !d.value && st.cbt == '24h') d.value = li(Date.now() + 864e5); return }
    if (c.dataset.cbf) { st.cbf = c.dataset.cbf; return drawCb() } if (c.dataset.obo) { st.obo = c.dataset.obo; document.querySelectorAll('[data-obo]').forEach(x => x.classList.toggle('on', x == c)); return loadOb() }
    const a = c.dataset.act;
    if (a == 'cbsubmit') return cbSubmit(); if (a == 'obsave') return obSave(c.dataset.key); if (a == 'cbref') return loadCb(); if (a == 'obref') return loadOb();
    if (a == 'cbdel') { if (!confirm('Mark this callback as done and delete it?')) return; try { await Store.del('cb', c.dataset.id); cbRows = cbRows.filter(x => x.id != c.dataset.id); drawCb(); toast('✔ Deleted') } catch (x) { toast('✖ ' + x.message, true) } return }
    if (a == 'besave') { const u = $('#beurl').value.trim(), k = $('#akin').value; u ? localStorage.setItem('te-be', u) : localStorage.removeItem('te-be'); k ? sessionStorage.setItem('te-ak', k) : sessionStorage.removeItem('te-ak'); toast('Saved'); render(); return }
    if (a == 'beclear') { localStorage.removeItem('te-be'); sessionStorage.removeItem('te-ak'); toast('Disconnected (using this device only)'); render(); return }
    if (a == 'aksave2') { const k = $('#akin2').value; if (!k) return; sessionStorage.setItem('te-ak', k); after(); return }
  });
  document.addEventListener('change', e => { if (e.target.id == 'cbag') { st.cba = e.target.value; drawCb() } if (e.target.id == 'obag') { st.oba = e.target.value; drawObAdmin() } });
  window.Forms = { cbPage, obPage, after, Store };
})();
