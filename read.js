/* SOXX Sniper · The Sniper read, at the top of the page: one call that uses all the intelligence on the page.
   Each input gives a lean from −1 (down: SOXS / short SOXL) to +1 (up: SOXL) and a weight; the read is their
   weighted sum. Inputs:
     the page's decision read (alignment, beta order, fear and greed, rates, credit, news, session model, tested rules)
     top 20 SOXL whales: net position and their newest moves; worst 20 wallets: net position (faded)
     whale tendencies: what the beliefs that fire right now did before, for the best vs the worst traders (why.js)
     market makers on the SOXL perp: net inventory (contra: short inventory = customers buying)
     Hyperdash cohorts: smart vs fools on the SOXL perp and on the SOXX holdings (basket)
     spot players: what the biggest side-taking spot traders and the takers did in the last hour (risk appetite)
     the signal web (both sites, learned), the leveraged-ETF rebalance flow, the big-move radar and macro stress
   It also says how big a move to expect, where it likely goes (levels), and what would prove it wrong.
   Uses globals from index.html and the other modules: lastD, Q, FUND, letfFlow, todaySess, phaseAt, etInfo, fmtPx, fmtPct,
   wwSummary, wwMoves, wwPain, Basket, Web, SpotFlow, Why, inWhy, Radar. */
(function () {
  "use strict";
  const hl = document.getElementById("hlPrev") ? document.getElementById("hlPrev").closest("section") : null;
  const top = document.getElementById("topRow"); if (!top) return;
  const card = document.createElement("section"); card.className = "card"; card.id = "readCard"; card.style.marginBottom = "12px";
  card.innerHTML = `<div class="rdhd"><div class="label" style="margin:0">The Sniper read · all signals in one call</div><span class="sub" id="rdAt"></span></div>
    <div class="rdtwo"><div id="rdMain"></div><div class="rdweb"><div class="label" style="margin:0 0 4px">Signal web · what both sites have learned</div><div id="rdWeb"></div>
      <div class="sub" style="line-height:1.5;margin-top:4px">Each dot is a signal; bigger = scored more often. <b class="up">Green</b> = right more than half the time, <b class="down">red</b> = wrong more often (a signal to fade or ignore), grey = under 10 checks. Lines join signals that fire together; green line = right when they agree.</div></div></div>
    <div id="rdEdge"></div>
    <details id="rdDet"><summary class="label" style="cursor:pointer;margin-top:8px">Why · every input, its lean and weight</summary><div id="rdTbl"></div></details>`;
  top.before(card);
  // the old one-line read and the 1h / 4h / 12h / 24h model move up here too
  const eb = document.getElementById("edgeBar"); if (eb) document.getElementById("rdEdge").appendChild(eb);
  try { const o = localStorage.getItem("soxx_rd_det"); if (o === "1") document.getElementById("rdDet").open = true; } catch (e) { }
  document.getElementById("rdDet").addEventListener("toggle", e => { try { localStorage.setItem("soxx_rd_det", e.target.open ? "1" : "0"); } catch (x) { } });
  const st = document.createElement("style");
  st.textContent = `#readCard{border-width:2px}#readCard .rdhd{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
#readCard .rdcall{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 18px;margin:8px 0 6px}#readCard .rdcall .big{font:700 26px var(--sans)}
#readCard .rdgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px;margin:6px 0}
#readCard .rdgrid>div{border:1px solid var(--line);border-radius:10px;padding:6px 10px;background:var(--panel2);font:12px var(--mono);color:var(--dim)}#readCard .rdgrid b{display:block;font-size:15px;color:var(--ink)}
#readCard .rdbar{height:8px;border-radius:4px;background:linear-gradient(90deg,var(--down),var(--line) 50%,var(--up));position:relative;margin:4px 0 2px}#readCard .rdbar u{position:absolute;top:-4px;width:4px;height:16px;border-radius:2px;background:var(--ink);transform:translateX(-50%)}
#readCard ul{margin:4px 0 0 18px;padding:0;font-size:13px;line-height:1.55}#readCard table{width:100%;border-collapse:collapse;font:12px var(--mono)}#readCard td,#readCard th{padding:3px 6px;border-bottom:1px solid var(--line);text-align:right}#readCard td.l,#readCard th.l{text-align:left;white-space:normal}
#readCard #rdEdge .edge{margin:8px 0 0}
#readCard .rdtwo{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:14px;align-items:start}
#readCard .rdweb{border:1px solid var(--line);border-radius:12px;padding:8px 10px;background:var(--panel2)}
@media (max-width:1000px){#readCard .rdtwo{grid-template-columns:minmax(0,1fr)}}`;
  document.head.appendChild(st);
  const cl = v => v > 0.05 ? "up" : v < -0.05 ? "down" : "";
  const c1 = v => Math.max(-1, Math.min(1, v));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const U = n => { const a = Math.abs(n); return (n < 0 ? "-$" : "$") + (a >= 1e9 ? (a / 1e9).toFixed(2) + "B" : a >= 1e6 ? (a / 1e6).toFixed(2) + "M" : a >= 1e3 ? (a / 1e3).toFixed(1) + "K" : Math.round(a)); };

  // market makers and cohort holders of the SOXL perp: Cohort Sniper's holder file (top 30 holders, labels)
  let SPX = null, spxT = 0;
  async function holders() {
    if (SPX && Date.now() - spxT < 10 * 6e4) return SPX;
    try { const r = await fetch("https://raw.githubusercontent.com/stevenwsharp-ctrl/Hyperdash-Cohort-Tracker/data/specialists.json?t=" + Math.floor(Date.now() / 6e5)); if (r.ok) { const j = await r.json(); SPX = j.m && j.m["XYZ:SOXL"] || null; spxT = Date.now(); } } catch (e) { }
    return SPX;
  }
  const MM_RE = /wintermute|cumberland|\bjump\b|\bgsr\b|flow ?traders|amber|b2c2|\bdwf\b|keyrock|galaxy|auros|selini|\bhlp\b|hyperliquidity|jane ?street|citadel|virtu|optiver|\bimc\b|\bdrw\b|susquehanna|\bsig\b|\bxtx\b|tower research|\bqcp\b|presto|kronos|market ?mak|\bmm\b/i;

  async function inputs() {
    const I = [], add = (k, v, w, txt, grp) => { if (isFinite(v) && w > 0) I.push({ k, v: c1(v), w, txt, grp }); };
    const D = typeof lastD !== "undefined" ? lastD : null;
    if (D && isFinite(D.bias)) add("Page decision read", D.bias, 2, `${D.stance} (${D.regime || ""})`, "Market");
    // whales
    try { const S = wwSummary(); if (S && S.ok) {
      add("Top 20 SOXL whales · net position", S.b.net / 2e6, 1.5, `${S.b.longs} long / ${S.b.shorts} short · net ${U(S.b.net)}`, "Holders");
      add("Worst 20 SOXL wallets · net (faded)", -S.w.net / 2e6, 1, `${S.w.longs} long / ${S.w.shorts} short · net ${U(S.w.net)}: their side tends to lose`, "Holders"); } } catch (e) { }
    try { const M = (wwMoves() || []).filter(m => Date.now() - m.t1 < 6 * 36e5 && m.usd >= 25000).slice(0, 8);
      if (M.length) { const v = M.reduce((a, m) => a + (m.grp === "shrink" ? -1 : 1) * (m.side === "long" ? 1 : -1) * Math.min(1, m.usd / 2e5), 0) / M.length;
        add("Top whales · newest moves (6h)", v, 1.2, M.slice(0, 3).map(m => `${m.k} ${m.side} ${U(m.usd)}`).join(" · "), "Holders"); } } catch (e) { }
    // tendencies: the beliefs that fire now, and their records
    try { if (window.inWhy && window.Why && inWhy.rows && inWhy.rows.length) { const N = Why.now(inWhy.C, { events: inWhy.evs }), S = Why.summary(inWhy.rows);
      const rec = side => { const B = N[side].filter(b => b !== "open").map(b => S.find(o => o.b === b && o.g === "all")).filter(o => o && o.n >= 5); return B.length ? { win: B.reduce((a, o) => a + o.win, 0) / B.length, n: B.reduce((a, o) => a + o.n, 0), names: N[side].filter(b => b !== "open").map(b => Why.NAME[b]) } : null; };
      const L = rec("long"), Sh = rec("short");
      if (L || Sh) { const v = ((L ? L.win - 0.5 : 0) - (Sh ? Sh.win - 0.5 : 0)) * 3;
        add("Whale tendencies · what this setup did before", v, 1.2, `${L ? `long now = ${L.names.join(" + ")}: right ${Math.round(L.win * 100)}% (${L.n})` : ""}${L && Sh ? " · " : ""}${Sh ? `short now = ${Sh.names.join(" + ")}: right ${Math.round(Sh.win * 100)}% (${Sh.n})` : ""}`, "Holders"); } } } catch (e) { }
    // market makers and cohorts on the SOXL perp
    try { const X = await holders(); if (X && X.holders) { let net = 0, tot = 0; const who = [];
      X.holders.forEach(h => { if (h.miss) return; tot += h.n; if (MM_RE.test(h.lb || "")) { net += h.sd * h.n; who.push(h.lb); } });
      if (who.length && tot) add("Market makers · SOXL perp inventory (contra)", -Math.sign(net) * Math.min(1, Math.abs(net) / tot / 0.25), 1, `${who.slice(0, 3).join(", ")} net ${net < 0 ? "short" : "long"} ${U(Math.abs(net))}: customers have been ${net < 0 ? "buying" : "selling"}`, "Market makers");
      const A = X.agg; if (A && A.conf >= 0.3 && isFinite(A.sig)) add("SOXL perp specialists (win more on SOXL)", A.sig * A.conf, 1, `${A.nS} specialists ${A.sb > 0 ? "long" : A.sb < 0 ? "short" : "flat"} · ${A.nL} SOXL losers ${A.lb > 0 ? "long" : A.lb < 0 ? "short" : "flat"}`, "Holders"); } } catch (e) { }
    try { const Dd = await Basket.load(); if (Dd) { const R = Basket.compute(Dd, {}); add("Cohorts · smart vs fools on SOXX holdings", R.basket.gap * 2, 1.3, `basket gap ${Math.round(R.basket.gap * 100)} · smart ${Math.round(R.basket.sm * 100)} vs fools ${Math.round(R.basket.fo * 100)}`, "Cohorts");
      const s = R.etf.find(x => x.sym === "SOXL"); if (s) add("Cohorts · smart vs fools on the SOXL perp", s.gap * 2, 0.8, `gap ${Math.round(s.gap * 100)}`, "Cohorts"); } } catch (e) { }
    // spot players (risk appetite)
    try { const J = window.SpotFlow && await SpotFlow.load(); if (J && J.tokens) { const T = Object.values(J.tokens), tk = T.reduce((a, t) => a + (t.W["1h"][0] - t.W["1h"][1]), 0), vol = T.reduce((a, t) => a + t.W["1h"][0] + t.W["1h"][1], 0);
      const wh = J.whales.filter(w => !w.mm).reduce((a, w) => a + (w.net["1h"] || 0), 0);
      if (vol > 0) add("Spot players · takers 1h (crypto risk appetite)", tk / vol * 4, 0.5, `takers net ${U(tk)} of ${U(vol)}`, "Spot");
      if (wh) add("Spot players · biggest side-takers 1h", wh / 2e6, 0.5, `net ${U(wh)}`, "Spot"); } } catch (e) { }
    // the web, rebalance, radar lean
    try { const F = window.Web && Web.forecast("SEMIS"); if (F) add("Signal web (learned, both sites) · semis 4h", (F.p - 0.5) * 4, F.ready ? 1.5 : 0.5, `P(up) ${Math.round(F.p * 100)}%${F.ready ? "" : " (still learning)"}`, "Learned"); } catch (e) { }
    try { const e = etInfo(Date.now()); if (!e.wk && e.min >= 840 && e.min < 960) { const lf = letfFlow(todaySess()); if (lf && isFinite(lf.usd)) add("Leveraged-ETF rebalance into the close", lf.usd / 3e9, 1, `${lf.usd > 0 ? "BUY" : "SELL"} ~${U(Math.abs(lf.usd))} of chip exposure by 4 pm`, "Flows"); } } catch (e) { }
    // crowd psychology (psych.js) and bonds / rates / currencies (radar.js live macro)
    try { (window.MESH && MESH.I || []).forEach(([id, v, lab]) => add(lab, v, id === "ent.cohesion" ? 0.4 : 0.6, (MESH.why || []).slice(0, 2).join(" · "), "Links")); } catch (e) { }
    try { (window.PSY && PSY.I || []).forEach(x => { if (x.v) add("Psychology · " + x.nm, x.v, 0.6, x.read.replace(/<[^>]+>/g, ""), "Psychology"); }); } catch (e) { }
    try { const M = window.MACROLIVE || [], g = s => M.find(o => o.s === s), z = (s, k) => { const o = g(s); return o && isFinite(o.zd) ? Math.max(-1, Math.min(1, o.zd / 2.5)) * k : NaN; };
      const y = [z("^TNX", -1), z("^FVX", -1)].filter(isFinite); if (y.length) add("Treasury yields today (rising = headwind)", y.reduce((a, v) => a + v, 0) / y.length, 0.7, `10Y ${g("^TNX") ? g("^TNX").px.toFixed(2) + "% (" + g("^TNX").zd.toFixed(1) + "σ)" : "–"}`, "Rates & currencies");
      const fx = [z("DX-Y.NYB", -1), z("FXY", -1)].filter(isFinite); if (fx.length) add("Dollar and yen today (rising = risk-off)", fx.reduce((a, v) => a + v, 0) / fx.length, 0.6, `dollar ${g("DX-Y.NYB") ? fmtPct(g("DX-Y.NYB").d, 2) : "–"} · yen ${g("FXY") ? fmtPct(g("FXY").d, 2) : "–"} (a fast yen rise = carry trades unwinding)`, "Rates & currencies");
      const cr = [z("HYG", 1), z("^MOVE", -1)].filter(isFinite); if (cr.length) add("Credit and bond volatility today", cr.reduce((a, v) => a + v, 0) / cr.length, 0.7, `junk bonds ${g("HYG") ? fmtPct(g("HYG").d, 2) : "–"} · MOVE ${g("^MOVE") ? g("^MOVE").px.toFixed(0) : "–"}`, "Rates & currencies"); } catch (e) { }
    return I;
  }

  async function render() {
    const I = await inputs(); if (!I.length) return;
    // learned trust per input (from its own graded record): weight = base weight × trust
    const MU = (() => { try { return JSON.parse(localStorage.getItem("soxx_read_mult") || "{}"); } catch (e) { return {}; } })();
    I.forEach(x => { x.base = x.w; x.m = MU[x.k] ? MU[x.k].m : 1; x.w = x.base * x.m; });
    const W = I.reduce((a, x) => a + x.w, 0), score = I.reduce((a, x) => a + x.v * x.w, 0) / W;
    const up = I.filter(x => x.v > 0.05).length, dn = I.filter(x => x.v < -0.05).length;
    const agree = Math.max(up, dn) / Math.max(1, up + dn), conf = Math.abs(score) * (0.5 + agree) ;
    const call = score > 0.12 ? "UP" : score < -0.12 ? "DOWN" : "NO CLEAR SIDE", c = cl(score);
    const R = window.Radar ? Radar.get() : {}, M = R.MOD && !R.MOD.err ? R.MOD : null, ph = phaseAt(Date.now());
    const q = Q[FUND], P = q && q.c > 0 ? q.c : NaN, D = typeof lastD !== "undefined" ? lastD : null;
    // levels: next level from the page, whales' liquidation clusters, options max pain
    const L = []; try { if (D && D.fav) L.push(`next level ${fmtPx(D.fav.price)} (${Math.round(D.fav.p30 * 100)}% in 30m)`); } catch (e) { }
    try { const pn = wwPain(); if (pn && pn.long) L.push(`long liquidations ${fmtPx(pn.long.p)}`); if (pn && pn.short) L.push(`short liquidations ${fmtPx(pn.short.p)}`); } catch (e) { }
    // horizons: tonight (after-hours / overnight) leans more on flows and the radar; 1–2 days on holders, cohorts and the web
    const pick = gs => { const X = I.filter(x => gs.includes(x.grp)); const w = X.reduce((a, x) => a + x.w, 0); return w ? X.reduce((a, x) => a + x.v * x.w, 0) / w : 0; };
    const sTon = 0.5 * pick(["Flows", "Spot", "Market makers"]) + 0.3 * (R.LEAN || 0) + 0.2 * (R.SH ? Math.max(-1, Math.min(1, R.SH.mv / 0.03)) : 0);
    const sDay = pick(["Holders", "Cohorts", "Learned", "Market"]);
    const lab = v => v > 0.12 ? `<b class="up">▲ up</b>` : v < -0.12 ? `<b class="down">▼ down</b>` : `<b>◆ unclear</b>`;
    // trade plan from the normal daily move and the levels on the page
    let sd = NaN; try { const Lb = JSON.parse(localStorage.getItem("rd_d_SOXL") || "null"); if (Lb && Lb.bars.length > 61) { const r = Lb.bars.slice(-61).map((b, i, a) => i ? b.c / a[i - 1].c - 1 : NaN).filter(isFinite); sd = Math.sqrt(r.reduce((a, x) => a + x * x, 0) / r.length); } } catch (e) { }
    let plan = "";
    if (call !== "NO CLEAR SIDE" && P > 0 && isFinite(sd)) { const d = call === "UP" ? 1 : -1, pn = (() => { try { return wwPain(); } catch (e) { return null; } })();
      let stop = P * (1 - d * 0.5 * sd), t1 = P * (1 + d * 0.6 * sd), t2 = P * (1 + d * 1.2 * sd);
      const liq = pn && (d > 0 ? pn.short : pn.long); if (liq && liq.p && (liq.p - P) * d > 0 && Math.abs(liq.p / P - 1) < 2 * sd) t2 = liq.p;
      const opp = pn && (d > 0 ? pn.long : pn.short); if (opp && opp.p && (P - opp.p) * d > 0 && Math.abs(opp.p / P - 1) < 0.8 * sd) stop = opp.p * (1 - d * 0.003);
      const rr = Math.abs(t1 - P) / Math.abs(P - stop);
      plan = `<li><b>Plan (${d > 0 ? "SOXL long" : "short SOXL / SOXS long"}):</b> from ${fmtPx(P)}, stop ${fmtPx(stop)} (${fmtPct(stop / P - 1, 1)}), target 1 ${fmtPx(t1)} (${fmtPct(t1 / P - 1, 1)}), target 2 ${fmtPx(t2)} (${fmtPct(t2 / P - 1, 1)})${liq && t2 === liq.p ? " = the " + (d > 0 ? "shorts'" : "longs'") + " liquidation cluster" : ""}. Reward ÷ risk ${rr.toFixed(1)} to target 1. Based on a normal SOXL day of ±${(sd * 100).toFixed(1)}%.${d < 0 ? " SOXS moves about −3× SOXX, so the same targets are roughly the mirror image." : ""}</li>`; }
    // the read's own record: logged every 30 minutes, graded after 4 and 24 hours
    let REC = null; try { const now = Date.now(), Lg = JSON.parse(localStorage.getItem("soxx_read_log") || "[]");
      if (P > 0 && (!Lg.length || now - Lg[Lg.length - 1].t > 30 * 6e4)) Lg.push({ t: now, s: Math.round(score * 100) / 100, p: P, in: Object.fromEntries(I.map(x => [x.k, Math.round(x.v * 100) / 100])) });
      Lg.forEach(x => { for (const [k, h] of [["r4", 4], ["r24", 24]]) if (x[k] == null && now - x.t >= h * 36e5 && now - x.t < (h + 2) * 36e5 && P > 0) {
        x[k] = P / x.p - 1;
        // learn from it: each input that leaned the right way gains trust, each that leaned the wrong way loses it
        // (multiplicative weights: trust × e^(0.12 × lean × direction), kept between 0.25 and 3)
        if (k === "r4" && x.in && Math.abs(x[k]) >= 0.003) { const dir = Math.sign(x[k]);
          for (const [nm, v] of Object.entries(x.in)) { const o = MU[nm] = MU[nm] || { m: 1, n: 0, ok: 0 }; o.m = Math.max(0.25, Math.min(3, o.m * Math.exp(0.12 * v * dir))); o.n++; if (Math.sign(v) === dir && Math.abs(v) > 0.05) o.ok++; }
          localStorage.setItem("soxx_read_mult", JSON.stringify(MU)); } } });
      const keep = Lg.filter(x => now - x.t < 60 * 864e5); localStorage.setItem("soxx_read_log", JSON.stringify(keep.slice(-3000)));
      const g = k => { const v = keep.filter(x => x[k] != null && Math.abs(x.s) >= 0.12); return v.length ? { n: v.length, hit: v.filter(x => Math.sign(x[k]) === Math.sign(x.s)).length / v.length } : null; };
      // post-mortems: the newest graded calls, what misled and what was right
      const pm = keep.filter(x => x.r4 != null && x.in && Math.abs(x.s) >= 0.12).slice(-6).reverse().map(x => { const dir = Math.sign(x.r4), E = Object.entries(x.in).filter(([, v]) => Math.abs(v) > 0.15);
        return { t: x.t, ok: Math.sign(x.s) === dir, s: x.s, r: x.r4, mis: E.filter(([, v]) => Math.sign(v) !== dir).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 2).map(e => e[0]), good: E.filter(([, v]) => Math.sign(v) === dir).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 2).map(e => e[0]) }; });
      REC = { r4: g("r4"), r24: g("r24"), n: keep.length, pm }; } catch (e) { }
    // ---- every path, not one guess: five scenarios with odds, triggers, who gets hurt, and the trade for each ----
    function scen() {
      if (!(P > 0) || !isFinite(sd)) return "";
      let pUp = 0.5 + score * 0.35; try { const F = window.Web && Web.forecast("SOXL"); if (F && F.ready) pUp = 0.5 * pUp + 0.5 * F.ph[4]; } catch (e) { }
      pUp = Math.max(0.1, Math.min(0.9, pUp));
      const big = M ? Math.max(0.05, Math.min(0.6, M.p)) : 0.15, chop = Math.max(0.1, Math.min(0.5, 0.15 + 0.35 * (1 - agree)));
      const rest = Math.max(0, 1 - big - chop), pn = (() => { try { return wwPain(); } catch (e) { return null; } })(), S = (() => { try { return wwSummary(); } catch (e) { return null; } })();
      const lvU = pn && pn.short ? pn.short.p : P * (1 + sd), lvD = pn && pn.long ? pn.long.p : P * (1 - sd);
      const worstSide = S && S.ok && Math.abs(S.w.net) > 1e5 ? (S.w.net > 0 ? "long" : "short") : null;
      const rows = [
        { n: "Squeeze / big move up", p: big * pUp, c: "up", trig: `breaks ${fmtPx(Math.min(lvU, P * (1 + 0.4 * sd)))} with rising volume; after-hours perp +3%+`, tgt: fmtPx(Math.max(lvU, P * (1 + sd))), hurt: `shorts${pn && pn.short ? ` (${U(pn.short.usd)} liquidates near ${fmtPx(pn.short.p)})` : ""}${worstSide === "short" ? " and the worst wallets" : ""}`, play: "SOXL; SOXS holders cut fast" },
        { n: "Grind up", p: rest * pUp, c: "up", trig: "higher lows, holds VWAP, takers buy", tgt: fmtPx(P * (1 + 0.5 * sd)), hurt: "late shorts", play: "SOXL small, add on dips to VWAP" },
        { n: "Chop / range", p: chop, c: "", trig: "inputs keep disagreeing; price inside the day range", tgt: `${fmtPx(P * (1 - 0.3 * sd))}–${fmtPx(P * (1 + 0.3 * sd))}`, hurt: "both sides pay spread and decay (3x funds lose in chop)", play: "stand aside; leveraged ETFs decay" },
        { n: "Grind down", p: rest * (1 - pUp), c: "down", trig: "lower highs, loses VWAP, takers sell", tgt: fmtPx(P * (1 - 0.5 * sd)), hurt: "dip buyers", play: "SOXS small, add on bounces" },
        { n: "Flush / big move down", p: big * (1 - pUp), c: "down", trig: `loses ${fmtPx(Math.max(lvD, P * (1 - 0.4 * sd)))}; after-hours perp −3% or worse`, tgt: fmtPx(Math.min(lvD, P * (1 - sd))), hurt: `longs${pn && pn.long ? ` (${U(pn.long.usd)} liquidates near ${fmtPx(pn.long.p)})` : ""}${worstSide === "long" ? " and the worst wallets" : ""}`, play: "SOXS; SOXL holders cut fast" }];
      const best = rows.slice().sort((a, b) => b.p - a.p)[0];
      // contrarian check: if the crowd that usually loses turns out right this time
      const contra = worstSide ? `<div class="sub" style="margin-top:4px"><b>Contrarian check:</b> the worst wallets are net <b>${worstSide}</b>. If they are right this time, the path is "${worstSide === "long" ? "Squeeze / big move up" : "Flush / big move down"}"; the first sign is price through ${fmtPx(worstSide === "long" ? Math.min(lvU, P * (1 + 0.4 * sd)) : Math.max(lvD, P * (1 - 0.4 * sd)))}. Respect it if it happens: cut, do not argue.</div>` : "";
      return `<div class="label" style="margin-top:10px">Every path · odds, trigger, target, who gets hurt, the trade</div><div style="overflow-x:auto"><table><tr><th class="l">Scenario</th><th>Odds</th><th class="l">First sign</th><th>Target</th><th class="l">Who gets hurt</th><th class="l">Trade</th></tr>
        ${rows.map(r => `<tr${r === best ? ' style="background:rgba(77,163,255,.08)"' : ""}><td class="l"><b class="${r.c}">${r.n}</b></td><td>${Math.round(r.p * 100)}%</td><td class="l">${r.trig}</td><td>${r.tgt}</td><td class="l">${r.hurt}</td><td class="l">${r.play}</td></tr>`).join("")}</table></div>
        <div class="sub" style="margin-top:4px">Odds: the read and the signal web set up vs down; the big-move model sets how much is a big move; disagreement between inputs sets chop. Most likely path highlighted. Plan for the others: each has a first sign, so you can see which one is happening.</div>${contra}`;
    }
    // ---- learning from mistakes and confirmations ----
    function lessons() {
      const T = Object.entries(MU).filter(([, o]) => o.n >= 4).map(([k, o]) => ({ k, ...o, r: o.ok / o.n })).sort((a, b) => b.m - a.m);
      const pm = REC && REC.pm || [];
      if (!T.length && !pm.length) return `<div class="sub" style="margin-top:8px">Learning: every 30 minutes the read saves its inputs; 4 hours later each input is graded. Inputs that were right gain weight, inputs that misled lose weight, and the misses are explained here.</div>`;
      return `<div class="label" style="margin-top:10px">What the read learned · from its mistakes and confirmations</div>
        ${T.length ? `<div class="sub" style="line-height:1.6">Trusted more: ${T.slice(0, 3).map(t => `<b class="up">${esc(t.k)}</b> ×${t.m.toFixed(2)} (right ${Math.round(t.r * 100)}% of ${t.n})`).join(" · ")}<br>Trusted less: ${T.slice(-3).reverse().map(t => `<b class="down">${esc(t.k)}</b> ×${t.m.toFixed(2)} (right ${Math.round(t.r * 100)}% of ${t.n})`).join(" · ")}</div>` : ""}
        ${pm.length ? `<ul>${pm.map(x => `<li>${new Date(x.t).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}: called ${x.s > 0 ? "up" : "down"}, SOXL went ${fmtPct(x.r, 1)} in 4h, <b class="${x.ok ? "up" : "down"}">${x.ok ? "right" : "wrong"}</b>.${x.ok ? (x.good.length ? ` Confirmed by: ${x.good.map(esc).join(", ")}.` : "") : ` Misled by: ${x.mis.map(esc).join(", ") || "–"}${x.good.length ? `; the inputs that saw it: ${x.good.map(esc).join(", ")}` : ""}.`}</li>`).join("")}</ul>` : ""}`;
    }
    const exp = M ? `${Math.round(M.p * 100)}% odds of a 7%+ overnight gap (usual ${Math.round(M.base * 100)}%)` : "";
    const act = call === "NO CLEAR SIDE" ? "Stand aside or trade small: the inputs disagree." : call === "UP" ? "Favors SOXL (long). Size by the big-move odds; a fade of the worst wallets' side is the cleanest edge." : "Favors SOXS / short SOXL. Size by the big-move odds; watch the after-hours perp for confirmation.";
    const strong = I.slice().sort((a, b) => Math.abs(b.v * b.w) - Math.abs(a.v * a.w)), pro = strong.filter(x => Math.sign(x.v) === Math.sign(score) && Math.abs(x.v) > 0.05).slice(0, 3), con = strong.filter(x => Math.sign(x.v) === -Math.sign(score) && Math.abs(x.v) > 0.05).slice(0, 2);
    document.getElementById("rdMain").innerHTML = `<div class="rdcall"><span class="big ${c}">${call === "UP" ? "▲ LEAN UP · SOXL" : call === "DOWN" ? "▼ LEAN DOWN · SOXS" : "◆ NO CLEAR SIDE"}</span>
        <span class="sub">score ${score >= 0 ? "+" : ""}${score.toFixed(2)} · ${Math.max(up, dn)} of ${up + dn} inputs agree · confidence ${conf >= 0.45 ? "high" : conf >= 0.25 ? "medium" : "low"} · ${ph === "regular" ? "regular session" : ph === "post" ? "after-hours" : ph === "pre" ? "pre-market" : "market closed (perps trade 24/7)"}</span></div>
      <div class="rdbar"><u style="left:${50 + score * 50}%"></u></div>
      <div class="rdgrid">
        <div>Tonight / overnight<b>${lab(sTon)}</b>flows, spot, market makers, radar, after-hours perp</div>
        <div>Next 1–2 days<b>${lab(sDay)}</b>holders, cohorts, signal web, decision read</div>
        <div>The read's record<b>${REC && REC.r4 ? Math.round(REC.r4.hit * 100) + "% right (4h)" : "starts now"}</b>${REC && REC.r4 ? `${REC.r4.n} calls${REC.r24 ? ` · 24h ${Math.round(REC.r24.hit * 100)}% of ${REC.r24.n}` : ""}` : "logged every 30 min, graded at 4h and 24h"}</div>
        <div>Size of the next move<b>${M ? Math.round(M.p * 100) + "% big-gap odds" : "--"}</b>${M ? `usual ${Math.round(M.base * 100)}%` : ""}${R.EVT && R.EVT.tonight && R.EVT.tonight.length ? ` · earnings tonight: ${R.EVT.tonight.map(e => e.s).join(", ")}` : ""}</div>
        <div>Macro stress<b class="${R.MS > 0.5 ? "down" : ""}">${isFinite(R.MS) ? R.MS.toFixed(2) : "--"}</b>${R.MS > 1 ? "high: big moves likely" : R.MS > 0.5 ? "rising" : "normal"}</div>
        <div>After-hours perp<b class="${R.SH ? cl(R.SH.mv) : ""}">${R.SH ? fmtPct(R.SH.mv, 1) : "--"}</b>${R.SH ? "SOXL perp vs the close" : "shows after 4 pm ET"}</div>
        <div>Levels<b style="font-size:12px">${L.slice(0, 2).join(" · ") || "--"}</b>${L.slice(2).join(" · ")}</div></div>
      <ul><li><b>What to do:</b> ${act}${exp ? ` ${exp}.` : ""}</li>${plan}
        ${pro.length ? `<li><b>Why:</b> ${pro.map(x => `${esc(x.k)} (${esc(x.txt)})`).join("; ")}.</li>` : ""}
        ${con.length ? `<li><b>Against it / what proves it wrong:</b> ${con.map(x => `${esc(x.k)} (${esc(x.txt)})`).join("; ")}. If these grow, the read flips.</li>` : ""}</ul>
      ${scen()}${lessons()}`;
    const grp = [...new Set(I.map(x => x.grp))];
    document.getElementById("rdTbl").innerHTML = `<div style="overflow-x:auto"><table><tr><th class="l">Input</th><th>Lean</th><th>Weight</th><th>Trust</th><th class="l">Reading</th></tr>${grp.map(g => `<tr><td class="l" colspan="5" style="color:var(--dim);font-weight:600">${g}</td></tr>` + I.filter(x => x.grp === g).map(x => `<tr><td class="l">${esc(x.k)}</td><td class="${cl(x.v)}">${x.v > 0.05 ? "▲" : x.v < -0.05 ? "▼" : "–"} ${x.v.toFixed(2)}</td><td>${x.base}</td><td class="${x.m > 1.05 ? "up" : x.m < 0.95 ? "down" : ""}">×${x.m.toFixed(2)}</td><td class="l">${esc(x.txt)}</td></tr>`).join("")).join("")}</table></div>
      <div class="sub" style="margin-top:4px">Lean −1 … +1 (+ = up, SOXL). Weight = base weight × trust; trust is learned from each input's own graded record (right → more trust, misled → less, between ×0.25 and ×3). Market makers and the worst wallets count against their own side, because their positions show the other side of the flow.</div>`;
    document.getElementById("rdAt").textContent = "updated " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
    // every input is also its own node in the signal web, so the web learns how much each one is worth
    try { if (window.Web) { Web.emit("read.score", "SOXL", score, "SOXX · Sniper read (all inputs)");
      I.forEach(x => { if (x.k === "Page decision read" || /Signal web/.test(x.k)) return; Web.emit("read." + x.k.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40), "SOXL", x.v, "SOXX · " + x.k); });
      if (R && isFinite(R.LEAN)) Web.emit("radar.lean", "SOXL", R.LEAN, "Radar · direction lean");
      if (R && isFinite(R.MS)) Web.emit("macro.calm", "SOXL", -Math.max(-1, Math.min(1, R.MS / 1.5)), "Macro · calm (low cross-asset stress)");
      if (R && R.SH) Web.emit("ah.perp", "SOXL", Math.max(-1, Math.min(1, R.SH.mv / 0.05)), "After-hours SOXL perp move"); } } catch (e) { }
  }
  function web() { if (!window.Web || document.hidden) return; try { Web.render(document.getElementById("rdWeb"), { h: 300, compact: true }); } catch (e) { } }
  setTimeout(web, 8000); setInterval(web, 60000);
  setTimeout(render, 5000); setInterval(() => { if (!document.hidden) render().catch(e => console.warn("read", e)); }, 30000);
})();
