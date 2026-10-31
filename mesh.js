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
    <div><div class="label" style="margin-top:6px">Coordination · SOXL whales</div><div id="meshSync"></div></div></div>
    <div class="label" style="margin-top:10px">Venues · the same thing in different places and currencies</div><div id="meshVen"></div>
    <div class="label" style="margin-top:10px">Rhythm · randomness, regularity, Fibonacci, music and flow (SOXL perp, hourly, 200 days)</div><div id="meshRhy"></div></details>`;
  anchor.before(card);
  const st = document.createElement("style");
  st.textContent = `#meshCard table{width:100%;border-collapse:collapse;font:12px var(--mono)}#meshCard th,#meshCard td{padding:3px 6px;border-bottom:1px solid var(--line);text-align:right}#meshCard th{color:var(--muted,#888);font-weight:600}#meshRhy td{text-align:left;vertical-align:top}#meshRhy td:first-child{white-space:nowrap;width:120px}
    #meshCard .L{color:var(--up)}#meshCard .S{color:var(--down)}#meshCard .note{font-size:11.5px;color:var(--muted,#888);margin:4px 0}.mesh2{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:900px){.mesh2{grid-template-columns:1fr}}`;
  document.head.appendChild(st);
  const HL = "https://api.hyperliquid.xyz/info", post = b => fetch(HL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  const sleep = ms => new Promise(r => setTimeout(r, ms)), c1 = v => Math.max(-1, Math.min(1, v));
  const U = v => { const a = Math.abs(v); return (v < 0 ? "-$" : "$") + (a >= 1e6 ? (a / 1e6).toFixed(1) + "M" : a >= 1e3 ? (a / 1e3).toFixed(1) + "K" : a.toFixed(0)); };
  const SET = [["xyz:SOXL", "SOXL"], ["xyz:NVDA", "NVDA"], ["xyz:AMD", "AMD"], ["xyz:AVGO", "AVGO"], ["xyz:MU", "MU"], ["xyz:TSM", "TSM"], ["xyz:INTC", "INTC"], ["xyz:SMH", "SMH"],
    ["xyz:SP500", "S&P 500"], ["xyz:XYZ100", "Nasdaq 100"], ["para:10Y", "US 10Y"], ["xyz:EUR", "Euro"], ["xyz:JPY", "Yen"], ["xyz:GOLD", "Gold"], ["xyz:CL", "Oil"], ["BTC", "Bitcoin"]];
  const NM = Object.fromEntries(SET.map(([c, n]) => [c, n])), nm = c => NM[c] || c;
  let E = null, eT = 0, Y = null, yT = 0, H1 = null, HB = null, h1T = 0, busy = false, RH = null, rhT = 0;
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
    try { if (!H1 || Date.now() - h1T > 30 * 6e4) { const k = await post({ type: "candleSnapshot", req: { coin: "xyz:SOXL", interval: "1h", startTime: Date.now() - 200 * 864e5, endTime: Date.now() } }); if (Array.isArray(k) && k.length) { H1 = k.map(b => [b.t, +b.c]); HB = k.map(b => [b.t, +b.o, +b.h, +b.l, +b.c]); h1T = Date.now(); } } } catch (e) { }
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
    // rhythm (rhythm.js): randomness, regularity, Fibonacci, music, flow — on SOXL hourly bars, 200 days
    try { if (window.Rhythm && HB && (!RH || Date.now() - rhT > 10 * 6e4)) { RH = Rhythm.analyze(HB, { win: 400 }); rhT = Date.now(); } } catch (e) { console.warn("rhythm", e); }
    const RI = []; if (RH) [["trend", "Rhythm · path memory (trend or snap-back)"], ["hour", "Rhythm · this hour of the day, history"], ["cycle", "Rhythm · repeating cycle"], ["fib", "Rhythm · Fibonacci level (back-tested)"], ["home", "Rhythm · pull back home (vs chance)"], ["flow", "Rhythm · poetry in motion (smooth trend)"]].forEach(([k, lab]) => { const v = RH.sig[k]; if (v) RI.push(["rhy." + k, v, lab]); });
    window.RHYTHM = { R: RH, I: RI };
    try { if (window.Web) I.concat(RI).forEach(([id, v, lab]) => { if (isFinite(v) && v) Web.emit(id, "SOXL", c1(v), lab); }); } catch (e) { }
    window.MESH = { I, why: [].concat(s ? s.why : [], lv ? lv.why : []), E, Y };
    return I;
  }
  function render(I) {
    const why = (window.MESH && MESH.why) || [], F = id => { try { const f = window.Web && Web.forecast("SOXL"); return f && f.contrib ? f.contrib.find(c => c.id === id) : null; } catch (e) { return null; } };
    document.getElementById("meshNow").innerHTML = I.length || why.length ? `<table><thead><tr><th style="text-align:left">Live link signal</th><th>Lean</th></tr></thead><tbody>${I.map(([id, v, lab]) => `<tr><td style="text-align:left">${lab}</td><td class="${v > 0 ? "L" : "S"}">${v > 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(2)}</td></tr>`).join("")}</tbody></table>${why.length ? `<div class="note">${why.slice(0, 6).join(" · ")}</div>` : ""}<div class="note">The signal web learns the weight of each link (up, down or zero) from what SOXL did next. A "worst traders together" burst can be worth fading; the web finds out.</div>` : `<div class="note">No live link signal now: nothing stretched, no leader moved, no wallets moved together in the last 2 hours.</div>`;
    document.getElementById("meshEnt").innerHTML = Ent.html(E, nm) + `<div class="note">"Entanglement" here is a metaphor: in physics, measuring one entangled particle tells you the other's state. In markets, coupled assets share drivers (rates, the dollar, AI spend), so a move in one tells you about the other — but the link is statistical, and it can break. A breaking link is information too: a new story for that name.</div>` + (E && E.G ? `<div class="label" style="margin-top:8px">Stocks, bonds, currencies, commodities, crypto · together or apart</div>` + Ent.groupHtml(E, nm, ["cls", "ind"]) : "");
    try { const R = window.RHYTHM; document.getElementById("meshRhy").innerHTML = (R && R.I.length ? `<div class="note">Live rhythm signals: ${R.I.map(([id, v, lab]) => `<span class="${v > 0 ? "L" : "S"}">${lab.replace("Rhythm · ", "")} ${v > 0 ? "▲" : "▼"}${Math.abs(v).toFixed(2)}</span>`).join(" · ")}</div>` : "") + Rhythm.html(R && R.R, { px: v => "$" + v.toFixed(2) }); } catch (e) { }
    document.getElementById("meshSync").innerHTML = Sync.html(Y, { usd: U, label: a => a.slice(0, 6) + "…" + a.slice(-4) });
  }
  async function run() {
    if (busy || document.hidden) return; busy = true;
    try { await loadSync(); render(emit()); await loadEnt(); render(emit()); } catch (e) { console.warn("mesh", e); } busy = false;
  }
  setTimeout(run, 12000); setInterval(run, 5 * 6e4);
  // venues (venues.js): Hyperliquid stock perps vs their stocks, crypto across exchanges, and SOXL vs 3 × SOXX today
  const SEMI = new Set(["SOXL", "SMH", "SOXX", "NVDA", "AMD", "AVGO", "MU", "TSM", "INTC", "QCOM", "MRVL", "ARM", "ASML", "AMAT", "LRCX", "KLAC", "SKHY", "SMSN", "SNDK", "TER", "CRDO"]);
  let VEN = null;
  async function venTick() {
    if (!window.Venues || document.hidden) return;
    try { const [x, m] = await Promise.all([post({ type: "metaAndAssetCtxs", dex: "xyz" }).catch(() => null), post({ type: "metaAndAssetCtxs" }).catch(() => null)]);
      const L = []; if (x) x[0].universe.forEach((u, i) => { const c = x[1][i]; if (c) L.push({ key: "XYZ:" + u.name.split(":").pop(), px: +c.markPx, o: +c.oraclePx, v: +c.dayNtlVlm }); });
      Venues.perps(L); const hl = {}; if (m) m[0].universe.forEach((u, i) => { if (["BTC", "ETH", "SOL", "XRP", "DOGE"].includes(u.name)) hl[u.name] = +m[1][i].markPx; });
      await Venues.crypto(hl);
      const I = Venues.signals().filter(s => SEMI.has(s[1]) || ["BTC", "ETH"].includes(s[1]));
      // SOXL vs 3 × SOXX today (during the session): a premium or discount to what the fund should do
      let nav = null; try { const a = Q.SOXL, b = Q.SOXX; if (a && b && a.pc > 0 && b.pc > 0 && a.c > 0 && b.c > 0 && Venues.usOpen()) { const g = (a.c / a.pc - 1) - 3 * (b.c / b.pc - 1); nav = g; if (Math.abs(g) >= 0.002) I.push(["dis.etfnav", "SOXL", Math.max(-1, Math.min(1, g / 0.01)), "Venues · SOXL vs 3 × SOXX today (premium or discount)"]); } } catch (e) { }
      try { if (window.Web) I.forEach(([id, a, v, lab]) => Web.emit(id, a === "SOXL" || SEMI.has(a) ? a : a, v, lab)); } catch (e) { }
      VEN = { I, nav };
      const el = document.getElementById("meshVen"); if (el) el.innerHTML = (nav != null ? `<div class="note">SOXL today ${((Q.SOXL.c / Q.SOXL.pc - 1) * 100).toFixed(2)}% vs 3 × SOXX ${(3 * (Q.SOXX.c / Q.SOXX.pc - 1) * 100).toFixed(2)}% → <b class="${nav > 0 ? "L" : nav < 0 ? "S" : ""}">${nav >= 0 ? "+" : ""}${(nav * 100).toFixed(2)}%</b> ${Math.abs(nav) < 0.002 ? "(in line)" : nav > 0 ? "(SOXL rich vs its index: a premium that market makers sell into)" : "(SOXL cheap vs its index: a discount they buy)"}</div>` : "")
        + Venues.html({ filter: r => SEMI.has(r.sym), n: 10, px: v => "$" + (v >= 100 ? v.toFixed(2) : v.toFixed(3)) });
    } catch (e) { console.warn("venues", e); } }
  setTimeout(venTick, 9000); setInterval(venTick, 60000);
  window.mesh_ven = () => VEN;
})();
