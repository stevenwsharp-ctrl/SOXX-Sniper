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
  const U = n => { const a = Math.abs(n); return (n < 0 ? "-$" : "$") + (a >= 1e9 ? (a / 1e9).toFixed(2) + "B" : a >= 1e6 ? (a / 1e6).toFixed(2) + "M" : a >= 1e3 ? (a / 1e3).toFixed(0) + "K" : Math.round(a)); };

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
    return I;
  }

  async function render() {
    const I = await inputs(); if (!I.length) return;
    const W = I.reduce((a, x) => a + x.w, 0), score = I.reduce((a, x) => a + x.v * x.w, 0) / W;
    const up = I.filter(x => x.v > 0.05).length, dn = I.filter(x => x.v < -0.05).length;
    const agree = Math.max(up, dn) / Math.max(1, up + dn), conf = Math.abs(score) * (0.5 + agree) ;
    const call = score > 0.12 ? "UP" : score < -0.12 ? "DOWN" : "NO CLEAR SIDE", c = cl(score);
    const R = window.Radar ? Radar.get() : {}, M = R.MOD && !R.MOD.err ? R.MOD : null, ph = phaseAt(Date.now());
    const q = Q[FUND], P = q && q.c > 0 ? q.c : NaN, D = typeof lastD !== "undefined" ? lastD : null;
    // levels: next level from the page, whales' liquidation clusters, options max pain
    const L = []; try { if (D && D.fav) L.push(`next level ${fmtPx(D.fav.price)} (${Math.round(D.fav.p30 * 100)}% in 30m)`); } catch (e) { }
    try { const pn = wwPain(); if (pn && pn.long) L.push(`long liquidations ${fmtPx(pn.long.p)}`); if (pn && pn.short) L.push(`short liquidations ${fmtPx(pn.short.p)}`); } catch (e) { }
    const exp = M ? `${Math.round(M.p * 100)}% odds of a 7%+ overnight gap (usual ${Math.round(M.base * 100)}%)` : "";
    const act = call === "NO CLEAR SIDE" ? "Stand aside or trade small: the inputs disagree." : call === "UP" ? "Favors SOXL (long). Size by the big-move odds; a fade of the worst wallets' side is the cleanest edge." : "Favors SOXS / short SOXL. Size by the big-move odds; watch the after-hours perp for confirmation.";
    const strong = I.slice().sort((a, b) => Math.abs(b.v * b.w) - Math.abs(a.v * a.w)), pro = strong.filter(x => Math.sign(x.v) === Math.sign(score) && Math.abs(x.v) > 0.05).slice(0, 3), con = strong.filter(x => Math.sign(x.v) === -Math.sign(score) && Math.abs(x.v) > 0.05).slice(0, 2);
    document.getElementById("rdMain").innerHTML = `<div class="rdcall"><span class="big ${c}">${call === "UP" ? "▲ LEAN UP · SOXL" : call === "DOWN" ? "▼ LEAN DOWN · SOXS" : "◆ NO CLEAR SIDE"}</span>
        <span class="sub">score ${score >= 0 ? "+" : ""}${score.toFixed(2)} · ${Math.max(up, dn)} of ${up + dn} inputs agree · confidence ${conf >= 0.45 ? "high" : conf >= 0.25 ? "medium" : "low"} · ${ph === "regular" ? "regular session" : ph === "post" ? "after-hours" : ph === "pre" ? "pre-market" : "market closed (perps trade 24/7)"}</span></div>
      <div class="rdbar"><u style="left:${50 + score * 50}%"></u></div>
      <div class="rdgrid">
        <div>Size of the next move<b>${M ? Math.round(M.p * 100) + "% big-gap odds" : "--"}</b>${M ? `usual ${Math.round(M.base * 100)}%` : ""}${R.EVT && R.EVT.tonight && R.EVT.tonight.length ? ` · earnings tonight: ${R.EVT.tonight.map(e => e.s).join(", ")}` : ""}</div>
        <div>Macro stress<b class="${R.MS > 0.5 ? "down" : ""}">${isFinite(R.MS) ? R.MS.toFixed(2) : "--"}</b>${R.MS > 1 ? "high: big moves likely" : R.MS > 0.5 ? "rising" : "normal"}</div>
        <div>After-hours perp<b class="${R.SH ? cl(R.SH.mv) : ""}">${R.SH ? fmtPct(R.SH.mv, 1) : "--"}</b>${R.SH ? "SOXL perp vs the close" : "shows after 4 pm ET"}</div>
        <div>Levels<b style="font-size:12px">${L.slice(0, 2).join(" · ") || "--"}</b>${L.slice(2).join(" · ")}</div></div>
      <ul><li><b>What to do:</b> ${act}${exp ? ` ${exp}.` : ""}</li>
        ${pro.length ? `<li><b>Why:</b> ${pro.map(x => `${esc(x.k)} (${esc(x.txt)})`).join("; ")}.</li>` : ""}
        ${con.length ? `<li><b>Against it / what proves it wrong:</b> ${con.map(x => `${esc(x.k)} (${esc(x.txt)})`).join("; ")}. If these grow, the read flips.</li>` : ""}</ul>`;
    const grp = [...new Set(I.map(x => x.grp))];
    document.getElementById("rdTbl").innerHTML = `<div style="overflow-x:auto"><table><tr><th class="l">Input</th><th>Lean</th><th>Weight</th><th class="l">Reading</th></tr>${grp.map(g => `<tr><td class="l" colspan="4" style="color:var(--dim);font-weight:600">${g}</td></tr>` + I.filter(x => x.grp === g).map(x => `<tr><td class="l">${esc(x.k)}</td><td class="${cl(x.v)}">${x.v > 0.05 ? "▲" : x.v < -0.05 ? "▼" : "–"} ${x.v.toFixed(2)}</td><td>${x.w}</td><td class="l">${esc(x.txt)}</td></tr>`).join("")).join("")}</table></div>
      <div class="sub" style="margin-top:4px">Lean −1 … +1 (+ = up, SOXL). Weights are fixed today; the signal web learns which inputs predict, and its forecast is one of the inputs. Market makers and the worst wallets count against their own side, because their positions show the other side of the flow.</div>`;
    document.getElementById("rdAt").textContent = "updated " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
    try { if (window.Web) { Web.emit("read.score", "SOXL", score, "SOXX · Sniper read (all inputs)"); } } catch (e) { }
  }
  function web() { if (!window.Web || document.hidden) return; try { Web.render(document.getElementById("rdWeb"), { h: 300, compact: true }); } catch (e) { } }
  setTimeout(web, 8000); setInterval(web, 60000);
  setTimeout(render, 5000); setInterval(() => { if (!document.hidden) render().catch(e => console.warn("read", e)); }, 30000);
})();
