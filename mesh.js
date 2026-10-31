/* SOXX Sniper · Links card: what moves together with SOXL, and which traders move together.
   Coupling map (Ent, link.js): 15-minute bars, 10 days, Hyperliquid perps for SOXL, the biggest semis, the S&P 500, the
   Nasdaq 100, the 10Y yield, the euro, the yen, gold, oil and Bitcoin. Emits ent.catchup, ent.lead and ent.cohesion to the web.
   Coordination (Sync, link.js): the data job's SOXL move log (20 best + 20 worst wallets, up to 200 days) with hourly SOXL
   prices. Emits sync.burst, sync.best, sync.worst and sync.leader. Sets window.MESH for the Sniper read. */
(function () {
  "use strict";
  const anchor = document.getElementById("radarCard") || document.getElementById("intelCard"); if (!anchor || !window.Ent) return;
  const card = document.createElement("section"); card.className = "card"; card.id = "meshCard"; card.style.marginBottom = "12px";
  card.innerHTML = `<details open><summary class="label" style="cursor:pointer">Links · what moves with SOXL, and which traders move together</summary>
    <div id="meshNow" style="margin:6px 0"></div><div class="mesh2"><div><div class="label" style="margin-top:6px">Coupling map ("entanglement")</div><div id="meshEnt"></div></div>
    <div><div class="label" style="margin-top:6px">Coordination · SOXL whales</div><div id="meshSync"></div></div></div></details>`;
  anchor.before(card);
  const st = document.createElement("style");
  st.textContent = `#meshCard table{width:100%;border-collapse:collapse;font:12px var(--mono)}#meshCard th,#meshCard td{padding:3px 6px;border-bottom:1px solid var(--line);text-align:right}#meshCard th{color:var(--muted,#888);font-weight:600}
    #meshCard .L{color:var(--up)}#meshCard .S{color:var(--down)}#meshCard .note{font-size:11.5px;color:var(--muted,#888);margin:4px 0}.mesh2{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:900px){.mesh2{grid-template-columns:1fr}}`;
  document.head.appendChild(st);
  const HL = "https://api.hyperliquid.xyz/info", post = b => fetch(HL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  const sleep = ms => new Promise(r => setTimeout(r, ms)), c1 = v => Math.max(-1, Math.min(1, v));
  const U = v => { const a = Math.abs(v); return (v < 0 ? "-$" : "$") + (a >= 1e6 ? (a / 1e6).toFixed(1) + "M" : a >= 1e3 ? (a / 1e3).toFixed(1) + "K" : a.toFixed(0)); };
  const SET = [["xyz:SOXL", "SOXL"], ["xyz:NVDA", "NVDA"], ["xyz:AMD", "AMD"], ["xyz:AVGO", "AVGO"], ["xyz:MU", "MU"], ["xyz:TSM", "TSM"], ["xyz:INTC", "INTC"], ["xyz:SMH", "SMH"],
    ["xyz:SP500", "S&P 500"], ["xyz:XYZ100", "Nasdaq 100"], ["para:10Y", "US 10Y"], ["xyz:EUR", "Euro"], ["xyz:JPY", "Yen"], ["xyz:GOLD", "Gold"], ["xyz:CL", "Oil"], ["BTC", "Bitcoin"]];
  const NM = Object.fromEntries(SET.map(([c, n]) => [c, n])), nm = c => NM[c] || c;
  let E = null, eT = 0, Y = null, yT = 0, H1 = null, h1T = 0, busy = false;
  const SC = {};   // coin -> { t, k }: bars per market, kept between runs, so one rate-limit reply does not empty the map
  async function loadEnt() {
    if (Date.now() - eT < 15 * 6e4) return;
    for (const [c] of SET) { if (SC[c] && Date.now() - SC[c].t < 14 * 6e4) continue;
      for (let tr = 0; tr < 2; tr++) { try { const k = await post({ type: "candleSnapshot", req: { coin: c, interval: "15m", startTime: Date.now() - 10 * 864e5, endTime: Date.now() } });
        if (Array.isArray(k) && k.length) SC[c] = { t: Date.now(), k: k.map(b => [b.t, +b.c]) }; break; } catch (e) { await sleep(String(e.message) === "429" ? 8000 : 1500); } }
      await sleep(500); }
    const S = {}; Object.entries(SC).forEach(([c, v]) => S[c] = v.k);
    E = Ent.analyze(S, { bar: 9e5, short: 24, k: 8, maxLag: 3, minN: 60, tag: window.Tax ? Tax.tag : null }); eT = Object.keys(S).length >= SET.length - 2 ? Date.now() : Date.now() - 12 * 6e4;   // incomplete: retry in ~3 min
  }
  async function loadSync() {
    if (Date.now() - yT < 10 * 6e4) return;
    try { if (!H1 || Date.now() - h1T > 30 * 6e4) { const k = await post({ type: "candleSnapshot", req: { coin: "xyz:SOXL", interval: "1h", startTime: Date.now() - 200 * 864e5, endTime: Date.now() } }); if (Array.isArray(k) && k.length) { H1 = k.map(b => [b.t, +b.c]); h1T = Date.now(); } } } catch (e) { }
    let L = null; try { const r = await fetch("https://raw.githubusercontent.com/stevenwsharp-ctrl/Hyperdash-Cohort-Tracker/data/whalelog.json?t=" + Math.floor(Date.now() / 3e5)); if (r.ok) L = await r.json(); } catch (e) { }
    if (!L || !L.moves) return;
    const px = t => { if (!H1 || !H1.length) return null; let lo = 0, hi = H1.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (H1[m][0] <= t) lo = m; else hi = m - 1; } return t - H1[lo][0] <= 2 * 36e5 && H1[lo][0] <= t ? H1[lo][1] : null; };
    const T = L.moves.map(m => { const w = L.wallets[m[1]]; return w ? { t: m[0], a: w[0], g: w[1] === "B" ? "best" : "worst", d: m[2] ? m[3] : -m[3], usd: m[5] } : null; }).filter(Boolean);
    // live fills from the whale table (newer than the log) join the study
    try { const F = window.inFills ? inFills() : {}, last = T.reduce((m, x) => Math.max(m, x.t), 0), gm = Object.fromEntries(L.wallets.map(w => [w[0], w[1] === "B" ? "best" : "worst"]));
      Object.entries(F).forEach(([a, f]) => { if (!gm[a] || !f || !f.f) return; f.f.filter(x => x.coin === "xyz:SOXL" && x.time > last).forEach(x => { const dir = x.dir || "", entry = /Open|>/.test(dir), side = /Long > Short/.test(dir) ? -1 : /Short > Long/.test(dir) ? 1 : /Long/.test(dir) ? 1 : -1;
        T.push({ t: x.time, a, g: gm[a], d: entry ? side : -side, usd: +x.sz * +x.px }); }); }); } catch (e) { }
    Y = Sync.analyze(T, { win: 15 * 6e4, minW: 3, px }); yT = Date.now();
  }
  function emit() {
    const I = [];
    const s = Ent.signals(E, "xyz:SOXL");
    if (s) { if (s.catchup) I.push(["ent.catchup", s.catchup, "Coupling · stretch vs coupled markets closes"]); if (s.lead) I.push(["ent.lead", s.lead, "Coupling · a leading market already moved"]); if (s.peer) I.push(["ent.peer", s.peer, "Peers · SOXL ahead of or behind the chip stocks"]); }
    if (E && E.coh.long != null && E.coh.short != null) { const sp = E.R["xyz:SP500"], r = sp ? sp.r.slice(-8).reduce((a, v) => a + (v || 0), 0) : 0;
      if (E.coh.short > E.coh.long + 0.05) I.push(["ent.cohesion", c1((E.coh.short - E.coh.long) * 5) * Math.sign(r || 0), "Coupling · macro tide (markets move as one, with the S&P)"]); }
    const lv = Sync.live(Y, null, 2 * 36e5);
    if (lv) { if (lv.burst) I.push(["sync.burst", lv.burst, "Coordination · wallets moved together"]); if (lv.best) I.push(["sync.best", lv.best, "Coordination · best traders moved together"]);
      if (lv.worst) I.push(["sync.worst", lv.worst, "Coordination · worst traders moved together (fade?)"]); if (lv.leader) I.push(["sync.leader", lv.leader, "Coordination · a leader wallet moved first"]); }
    try { if (window.Web) I.forEach(([id, v, lab]) => { if (isFinite(v) && v) Web.emit(id, "SOXL", c1(v), lab); }); } catch (e) { }
    window.MESH = { I, why: [].concat(s ? s.why : [], lv ? lv.why : []), E, Y };
    return I;
  }
  function render(I) {
    const why = (window.MESH && MESH.why) || [], F = id => { try { const f = window.Web && Web.forecast("SOXL"); return f && f.contrib ? f.contrib.find(c => c.id === id) : null; } catch (e) { return null; } };
    document.getElementById("meshNow").innerHTML = I.length || why.length ? `<table><thead><tr><th style="text-align:left">Live link signal</th><th>Lean</th></tr></thead><tbody>${I.map(([id, v, lab]) => `<tr><td style="text-align:left">${lab}</td><td class="${v > 0 ? "L" : "S"}">${v > 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(2)}</td></tr>`).join("")}</tbody></table>${why.length ? `<div class="note">${why.slice(0, 6).join(" · ")}</div>` : ""}<div class="note">The signal web learns the weight of each link (up, down or zero) from what SOXL did next. A "worst traders together" burst can be worth fading; the web finds out.</div>` : `<div class="note">No live link signal now: nothing stretched, no leader moved, no wallets moved together in the last 2 hours.</div>`;
    document.getElementById("meshEnt").innerHTML = Ent.html(E, nm) + `<div class="note">"Entanglement" here is a metaphor: in physics, measuring one entangled particle tells you the other's state. In markets, coupled assets share drivers (rates, the dollar, AI spend), so a move in one tells you about the other — but the link is statistical, and it can break. A breaking link is information too: a new story for that name.</div>` + (E && E.G ? `<div class="label" style="margin-top:8px">Stocks, bonds, currencies, commodities, crypto · together or apart</div>` + Ent.groupHtml(E, nm, ["cls", "ind"]) : "");
    document.getElementById("meshSync").innerHTML = Sync.html(Y, { usd: U, label: a => a.slice(0, 6) + "…" + a.slice(-4) });
  }
  async function run() {
    if (busy || document.hidden) return; busy = true;
    try { await loadSync(); render(emit()); await loadEnt(); render(emit()); } catch (e) { console.warn("mesh", e); } busy = false;
  }
  setTimeout(run, 12000); setInterval(run, 5 * 6e4);
})();
