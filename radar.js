/* SOXX Sniper · Big-move radar: after-hours and overnight risk for SOXL / SOXS, and live cross-asset macro.
   1. Event risk: SOXX holdings that report earnings in the next days, their weight, how far they and SOXX gapped after
      their past reports (Finnhub past dates + Yahoo daily bars), and the move that implies for SOXL tonight.
   2. Big-move model: logistic regression fitted in the browser on 2 years of SOXL days. Target: an overnight gap
      (close → next open) of 7% or more. Inputs known at the close: VIX term structure, VIX level, bond volatility (MOVE),
      SOXL realized-volatility percentile, the 5-day move, and "a big holding reports tonight". Output: today's odds vs the base rate.
   3. Direction lean: positioning that tends to precede the direction (cohort basket gap, smart money on the reporter's
      perp, the top/worst SOXL whales, the signal web).
   4. After-hours shock watch: the SOXL perp on Hyperliquid trades 24/7. After 4 pm ET it is compared with the close;
      moves of 3%, 6% and 10% alert, with the implied SOXS move.
   5. Macro live: VIX, VIX3M, MOVE, 10Y, 3M bill, dollar, copper, gold, oil, SOX, Nasdaq-100, SKEW, each with a z-score
      vs the last year, and a stress index.
   Uses SOXX Sniper globals: Q, FUND, fredProxy, fhGet, apiKey, compute, EARN, etInfo, etDate, addDays, fmtPct, alert1, demo, fv. */
(function () {
  "use strict";
  const anchor = document.getElementById("intelCard") || document.getElementById("whaleCard"); if (!anchor) return;
  const lsG = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pc = (v, d = 1) => v == null || !isFinite(v) ? "–" : (v > 0 ? "+" : "") + (v * 100).toFixed(d) + "%";
  const cl = v => !isFinite(v) || !v ? "" : v > 0 ? "up" : "down";
  const mean = a => { const v = a.filter(isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
  const sdv = a => { const v = a.filter(isFinite); if (v.length < 3) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
  const W = () => { try { return fredProxy(); } catch (e) { return ""; } };

  const card = document.createElement("section"); card.className = "card"; card.id = "radarCard"; card.style.marginBottom = "12px";
  card.innerHTML = `<div class="label">Big-move radar · after-hours and overnight risk for SOXL / SOXS</div>
    <div id="rdShock"></div><div id="rdTop" class="bk-sum bk"></div>
    <details open><summary class="label" style="cursor:pointer;margin-top:8px">Earnings tonight and this week · what they did before</summary><div id="rdEv"></div></details>
    <details open><summary class="label" style="cursor:pointer;margin-top:8px">Big overnight move model (fitted on 2 years of SOXL)</summary><div id="rdMod"></div></details>
    <details open><summary class="label" style="cursor:pointer;margin-top:8px">Direction lean · who is positioned which way</summary><div id="rdDir"></div></details>
    <details open><summary class="label" style="cursor:pointer;margin-top:8px">Macro live · cross-asset stress</summary><div id="rdMac"></div></details>`;
  anchor.before(card);
  const st = document.createElement("style");
  st.textContent = `#radarCard table{width:100%;border-collapse:collapse;font:12px var(--mono)}#radarCard th,#radarCard td{padding:3px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
#radarCard th{color:var(--dim);font-size:11px}#radarCard td.l,#radarCard th.l{text-align:left}#radarCard .tw{overflow-x:auto}#radarCard .nt{font-size:12px;color:var(--dim);margin:4px 0;line-height:1.5}
#radarCard summary{list-style:none}#radarCard summary::before{content:"▾ ";color:var(--mute)}#radarCard details:not([open]) summary::before{content:"▸ "}
.rdshock{border:1px solid var(--line);border-radius:10px;padding:8px 12px;margin:6px 0;font:600 14px var(--sans)}.rdshock.down{border-color:var(--down);background:rgba(255,77,94,.08)}.rdshock.up{border-color:var(--up);background:rgba(25,211,138,.08)}`;
  document.head.appendChild(st);

  /* ---------- data ---------- */
  const DAY = {};   // symbol -> { at, bars: [{d, o, h, l, c}] }
  async function daily(sym) {
    const c = DAY[sym] || lsG("rd_d_" + sym, null); if (c && Date.now() - c.at < 6 * 36e5) return (DAY[sym] = c).bars;
    const p = W(); if (!p || demo) return c ? c.bars : [];
    try { const j = await (await fetch(`${p}/chart?t=${encodeURIComponent(sym)}&range=2y&interval=1d`)).json();
      if (j.status === "ok") { const bars = j.bars.filter(b => b[4] > 0).map(b => ({ d: etInfo(b[0]).d, o: b[1], h: b[2], l: b[3], c: b[4] })); DAY[sym] = { at: Date.now(), bars }; lsS("rd_d_" + sym, DAY[sym]); return bars; } } catch (e) { }
    return c ? c.bars : [];
  }
  const LIVE = {};
  async function liveQ(sym) { const p = W(); if (!p || demo) return null; const c = LIVE[sym]; if (c && Date.now() - c.at < 120000) return c;
    try { const j = await (await fetch(`${p}/chart?t=${encodeURIComponent(sym)}&range=1d&interval=5m`)).json(); if (j.status === "ok" && j.meta) return LIVE[sym] = { at: Date.now(), px: j.meta.price, prev: j.meta.prevClose }; } catch (e) { }
    return c || null; }
  // past report dates (Finnhub), cached a week per symbol
  async function pastEarn(sym) {
    const c = lsG("rd_e_" + sym, null); if (c && Date.now() - c.at < 7 * 864e5) return c.L;
    if (typeof fhGet !== "function" || !apiKey) return c ? c.L : [];
    try { const j = await fhGet(`calendar/earnings?from=${addDays(etDate(), -730)}&to=${etDate()}&symbol=${sym}`, "earn");
      const L = ((j && j.earningsCalendar) || []).filter(e => e.symbol === sym).map(e => ({ d: e.date, h: e.hour }));
      lsS("rd_e_" + sym, { at: Date.now(), L }); return L; } catch (e) { return c ? c.L : []; }
  }
  // the overnight gap that belongs to a report: after the close (amc) → next open; before the open (bmo) → that open vs prior close
  function eventGap(bars, d, h) {
    const i = bars.findIndex(b => b.d >= d); if (i < 0) return null;
    if (h === "bmo") { if (bars[i].d !== d || i < 1) return null; return bars[i].o / bars[i - 1].c - 1; }
    if (bars[i].d !== d || i + 1 >= bars.length) return null; return bars[i + 1].o / bars[i].c - 1;   // amc (or unknown: treat as after close)
  }

  /* ---------- 1. event risk ---------- */
  let EVT = null;
  async function events() {
    const rows = (() => { try { return compute().rows; } catch (e) { return []; } })(), wOf = s => (rows.find(r => r.s === s) || {}).w || 0;
    const today = etDate(), end = addDays(today, 7), up = (typeof EARN !== "undefined" ? EARN : []).filter(e => e.d >= today && e.d <= end).sort((a, b) => a.d.localeCompare(b.d));
    const soxx = await daily("SOXX"), soxl = await daily("SOXL"), out = [];
    for (const e of up.slice(0, 10)) {
      const b = await daily(e.s), past = await pastEarn(e.s), R = [];
      past.filter(p => p.d < today).forEach(p => { const g = eventGap(b, p.d, p.h || e.h), gx = eventGap(soxx, p.d, p.h || e.h), gl = eventGap(soxl, p.d, p.h || e.h); if (g != null) R.push({ d: p.d, g, gx, gl }); });
      const absG = mean(R.map(r => Math.abs(r.g))), absX = mean(R.map(r => Math.abs(r.gx))), absL = mean(R.map(r => Math.abs(r.gl)));
      const beta = (() => { const v = R.filter(r => isFinite(r.gx) && isFinite(r.g)); const sxx = v.reduce((a, r) => a + r.g * r.g, 0); return sxx ? v.reduce((a, r) => a + r.g * r.gx, 0) / sxx : NaN; })();
      const worstL = R.length ? R.reduce((m, r) => Math.abs(r.gl) > Math.abs(m) ? r.gl : m, 0) : NaN;
      out.push({ ...e, w: wOf(e.s), n: R.length, absG, absX, absL, beta, worstL, R });
    }
    EVT = { up: out, at: Date.now() };
    const tonight = out.filter(e => (e.d === today && e.h !== "bmo") || (e.d === addDays(today, 1) && e.h === "bmo") || (new Date(addDays(today, 1) + "T12:00:00Z").getUTCDay() === 6 && e.d === addDays(today, 3) && e.h === "bmo"));
    EVT.tonight = tonight;
    // combined expected SOXL overnight move from tonight's reporters (independent, root-sum-square)
    EVT.expL = tonight.length ? Math.sqrt(tonight.reduce((a, e) => a + (isFinite(e.absL) ? e.absL : 3 * e.w * (e.absG || 0.06) * 0.6) ** 2, 0)) : 0;
    renderEv();
  }
  function renderEv() {
    const el = document.getElementById("rdEv"); if (!EVT) { el.innerHTML = `<div class="nt">Loading…</div>`; return; }
    if (!EVT.up.length) { el.innerHTML = `<div class="nt">No SOXX holding reports in the next 7 days (Finnhub calendar${typeof apiKey !== "undefined" && apiKey ? "" : "; add your API key"}).</div>`; return; }
    el.innerHTML = `<div class="tw"><table><tr><th class="l">Holding</th><th class="l">Date</th><th>SOXX weight</th><th>Past reports</th><th>Avg stock gap</th><th>Avg SOXX gap</th><th>Avg SOXL gap</th><th>Worst SOXL gap</th><th>SOXX per 1% of stock</th></tr>
      ${EVT.up.map(e => `<tr${EVT.tonight.includes(e) ? ' style="background:rgba(255,181,71,.12)"' : ""}><td class="l"><b>${esc(e.s)}</b>${EVT.tonight.includes(e) ? ' <span class="wwhot">tonight</span>' : ""}</td><td class="l">${esc(e.d)} ${e.h === "amc" ? "after close" : e.h === "bmo" ? "before open" : ""}</td><td>${(e.w * 100).toFixed(1)}%</td><td>${e.n}</td><td>±${isFinite(e.absG) ? (e.absG * 100).toFixed(1) : "–"}%</td><td>±${isFinite(e.absX) ? (e.absX * 100).toFixed(2) : "–"}%</td><td><b>±${isFinite(e.absL) ? (e.absL * 100).toFixed(1) : "–"}%</b></td><td class="${cl(e.worstL)}">${pc(e.worstL)}</td><td>${isFinite(e.beta) ? (e.beta * 100).toFixed(0) + " bp" : "–"}</td></tr>`).join("")}</table></div>
      <div class="nt">Gap = the open after the report vs the close before it. "SOXX per 1% of stock" = how much SOXX moved, on average, for each 1% the reporter gapped (weight plus contagion: Intel's warning on Oct 29 took the whole group down, not just its ${(EVT.up.find(e => e.s === "INTC") || { w: 0.1 }).w * 100 | 0}% weight). SOXL gaps about 3× SOXX; SOXS about −3×.</div>`;
  }

  /* ---------- 2. big overnight move model ---------- */
  let MOD = null;
  async function model() {
    const L = await daily("SOXL"), V = await daily("^VIX"), V3 = await daily("^VIX3M"), M = await daily("^MOVE");
    if (L.length < 250 || V.length < 200) { MOD = { err: "Needs 2 years of daily data from the Worker." }; renderMod(); return; }
    const by = A => Object.fromEntries(A.map(b => [b.d, b])), v = by(V), v3 = by(V3), mv = by(M);
    // big-holding report nights (amc that day / bmo next day), from the cached Finnhub history of the 10 largest holdings
    const rows = (() => { try { return compute().rows.slice().sort((a, b) => b.w - a.w).slice(0, 10); } catch (e) { return []; } })(), evN = {};
    for (const r of rows) { const P = await pastEarn(r.s); P.forEach(p => { const k = p.h === "bmo" ? addDays(p.d, -1) : p.d; evN[k] = (evN[k] || 0) + r.w; }); }
    const lr = L.map((b, i) => i ? Math.log(b.c / L[i - 1].c) : NaN), X = [], Y = [], D = [];
    for (let i = 60; i < L.length - 1; i++) {
      const d = L[i].d, rv = sdv(lr.slice(i - 19, i + 1)), rvH = lr.slice(Math.max(1, i - 250), i + 1).map((_, j, a) => j >= 19 ? sdv(a.slice(j - 19, j + 1)) : NaN).filter(isFinite);
      const pct = rvH.length ? rvH.filter(x => x <= rv).length / rvH.length : 0.5;
      const ts = v[d] && v3[d] ? v[d].c / v3[d].c : NaN, lvl = v[d] ? v[d].c : NaN, mo = mv[d] ? mv[d].c : NaN, r5 = L[i].c / L[i - 5].c - 1;
      const x = [ts, lvl, isFinite(mo) ? mo : 100, pct, Math.abs(r5), Math.min(1, (evN[d] || 0) / 0.05)];
      if (x.some(z => !isFinite(z))) continue;
      X.push(x); Y.push(Math.abs(L[i + 1].o / L[i].c - 1) >= 0.07 ? 1 : 0); D.push(d);
    }
    // standardize and fit (gradient descent, L2)
    const k = X[0].length, mu = [...Array(k)].map((_, j) => mean(X.map(x => x[j]))), sg = [...Array(k)].map((_, j) => sdv(X.map(x => x[j])) || 1);
    const Z = X.map(x => x.map((z, j) => (z - mu[j]) / sg[j])), w = new Array(k).fill(0); let b0 = Math.log((mean(Y) + 1e-3) / (1 - mean(Y) + 1e-3));
    const P = z => 1 / (1 + Math.exp(-(b0 + z.reduce((a, q, j) => a + q * w[j], 0))));
    const nTr = Math.floor(Z.length * 0.75);
    for (let it = 0; it < 600; it++) { const g = new Array(k).fill(0); let gb = 0; for (let i = 0; i < nTr; i++) { const e = Y[i] - P(Z[i]); gb += e; for (let j = 0; j < k; j++) g[j] += e * Z[i][j]; }
      b0 += 0.5 * gb / nTr; for (let j = 0; j < k; j++) w[j] += 0.5 * (g[j] / nTr - 0.01 * w[j]); }
    // out-of-sample check on the last 25%: big-move rate in the top fifth of predicted odds vs the rest
    const oos = Z.slice(nTr).map((z, i) => ({ p: P(z), y: Y[nTr + i] })).sort((a, b) => b.p - a.p), q = Math.max(1, Math.floor(oos.length / 5));
    const topR = mean(oos.slice(0, q).map(o => o.y)), restR = mean(oos.slice(q).map(o => o.y));
    // today (features at the latest close; tonight's event from the live calendar)
    const i = L.length - 1, d = L[i].d, rv = sdv(lr.slice(i - 19, i + 1)), rvH = lr.slice(i - 250, i + 1).map((_, j, a) => j >= 19 ? sdv(a.slice(j - 19, j + 1)) : NaN).filter(isFinite);
    const liveV = await liveQ("^VIX"), liveV3 = await liveQ("^VIX3M"), liveM = await liveQ("^MOVE");
    const xt = [liveV && liveV3 ? liveV.px / liveV3.px : (v[d] && v3[d] ? v[d].c / v3[d].c : mu[0]), liveV ? liveV.px : (v[d] ? v[d].c : mu[1]), liveM ? liveM.px : (mv[d] ? mv[d].c : mu[2]),
      rvH.filter(x => x <= rv).length / rvH.length, Math.abs(L[i].c / L[i - 5].c - 1), Math.min(1, (EVT && EVT.tonight ? EVT.tonight.reduce((a, e) => a + e.w, 0) : 0) / 0.05)];
    const zt = xt.map((z, j) => (z - mu[j]) / sg[j]), p = P(zt), base = mean(Y);
    const NAMES = ["VIX term structure (VIX ÷ VIX3M)", "VIX level", "Bond volatility (MOVE)", "SOXL realized-vol percentile", "Size of the 5-day move", "Big holding reports tonight"];
    MOD = { p, base, n: Y.length, big: Y.reduce((a, y) => a + y, 0), topR, restR, w, xt, NAMES, contrib: zt.map((z, j) => ({ n: NAMES[j], c: z * w[j], x: xt[j] })).sort((a, b) => Math.abs(b.c) - Math.abs(a.c)) };
    renderMod(); top();
  }
  function renderMod() {
    const el = document.getElementById("rdMod"); if (!MOD) { el.innerHTML = `<div class="nt">Fitting…</div>`; return; } if (MOD.err) { el.innerHTML = `<div class="nt">${esc(MOD.err)}</div>`; return; }
    const fx = (n, x) => /term/.test(n) ? x.toFixed(2) + (x > 1 ? " (backwardation: stress)" : " (contango)") : /percentile/.test(n) ? Math.round(x * 100) + "th" : /5-day/.test(n) ? (x * 100).toFixed(1) + "%" : /reports/.test(n) ? (x ? "yes" : "no") : x.toFixed(1);
    el.innerHTML = `<div class="nt">Odds of a SOXL overnight gap of 7%+ (either way) after tonight's close: <b style="font-size:15px">${(MOD.p * 100).toFixed(0)}%</b> vs the usual ${(MOD.base * 100).toFixed(0)}% (${MOD.big} of ${MOD.n} nights). Out of sample (last 25% of the data), the nights the model ranked in its top fifth had a big gap ${(MOD.topR * 100).toFixed(0)}% of the time, vs ${(MOD.restR * 100).toFixed(0)}% for the other nights${MOD.topR > MOD.restR * 1.3 ? ": the model has real skill." : ": skill is weak; use it as a rough guide."}</div>
      <div class="tw"><table><tr><th class="l">Input (at the close)</th><th>Now</th><th>Push on the odds</th></tr>${MOD.contrib.map(c => `<tr><td class="l">${c.n}</td><td>${fx(c.n, c.x)}</td><td class="${c.c > 0 ? "down" : "up"}">${c.c > 0 ? "▲" : "▼"} ${Math.abs(c.c).toFixed(2)}</td></tr>`).join("")}</table></div>`;
  }

  /* ---------- 3. direction lean ---------- */
  async function lean() {
    const L = [];
    try { const F = window.Web && Web.forecast("SEMIS"); if (F) L.push(["Signal web (both sites), semis 4h", (F.p - 0.5) * 2, `P(up) ${Math.round(F.p * 100)}%${F.ready ? "" : " (still learning)"}`]); } catch (e) { }
    try { const D = window.Basket && await Basket.load(); const R = D && Basket.compute(D, {}); if (R) { L.push(["Cohort smart vs fools on the SOXX holdings", Math.max(-1, Math.min(1, R.basket.gap * 2)), `gap ${Math.round(R.basket.gap * 100)}`]);
      (EVT && EVT.tonight || []).forEach(e => { const h = R.rows.find(x => x.sym === e.s && x.has); if (h) L.push([`Smart money on ${e.s} perp into its report`, Math.max(-1, Math.min(1, h.gap * 2)), `smart ${Math.round(h.sm.b * 100)} · fools ${Math.round(h.fo.b * 100)} · gap ${Math.round(h.gap * 100)}`]); });
      const s = R.etf.find(x => x.sym === "SOXL"); if (s) L.push(["Cohort smart vs fools on the SOXL perp", Math.max(-1, Math.min(1, s.gap * 2)), `gap ${Math.round(s.gap * 100)}`]); } } catch (e) { }
    try { const S = window.wwSummary && wwSummary(); if (S && S.ok) { L.push(["Top 20 SOXL whales, net", Math.max(-1, Math.min(1, S.b.net / 2e6)), `${S.b.net >= 0 ? "long" : "short"} $${Math.abs(S.b.net / 1e6).toFixed(2)}M`]);
      L.push(["Worst 20 SOXL wallets, net (fade)", Math.max(-1, Math.min(1, -S.w.net / 2e6)), `${S.w.net >= 0 ? "long" : "short"} $${Math.abs(S.w.net / 1e6).toFixed(2)}M`]); } } catch (e) { }
    const sc = L.length ? mean(L.map(x => x[1])) : 0;
    document.getElementById("rdDir").innerHTML = L.length ? `<div class="tw"><table><tr><th class="l">Signal</th><th>Lean</th><th class="l">Reading</th></tr>${L.map(x => `<tr><td class="l">${x[0]}</td><td class="${cl(x[1])}">${x[1] > 0.05 ? "▲ up" : x[1] < -0.05 ? "▼ down" : "–"} ${Math.abs(x[1]).toFixed(2)}</td><td class="l">${esc(x[2])}</td></tr>`).join("")}</table></div>
      <div class="nt">Combined lean: <b class="${cl(sc)}">${sc > 0.15 ? "UP → SOXL" : sc < -0.15 ? "DOWN → SOXS / short SOXL" : "no clear side"}</b> (${sc.toFixed(2)}). A big move is a question of size (model above) and side (this table). The setup to watch: high big-move odds and a clear down lean, as on the night of Oct 29, when Intel's warning after the close took the whole chip group down and SOXL gapped sharply lower.</div>` : `<div class="nt">Loading positioning…</div>`;
    LEAN = sc; top();
  }
  let LEAN = 0;

  /* ---------- 4. after-hours shock watch (Hyperliquid SOXL perp, 24/7) ---------- */
  let SH = null;
  async function shock() {
    const e = etInfo(Date.now()), after = e.wd === 0 || e.wd === 6 || e.min >= 960 || e.min < 570; if (!after) { SH = null; document.getElementById("rdShock").innerHTML = ""; return; }
    try {
      const r = await fetch("https://api.hyperliquid.xyz/info", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "metaAndAssetCtxs", dex: "xyz" }) }); if (!r.ok) return;
      const [m, c] = await r.json(), i = m.universe.findIndex(u => /SOXL$/i.test(u.name)); if (i < 0) return;
      const perp = +c[i].markPx, L = await daily("SOXL"), last = L[L.length - 1], close = e.min < 570 && last && last.d === etDate() ? L[L.length - 2].c : last && last.c;
      const rcl = Q && Q[FUND] && Q[FUND].regClose > 0 ? Q[FUND].regClose : null, qc = Q && Q[FUND] && Q[FUND].c; const ref = rcl || close || qc;   // the live regular close first (daily bars can lag) if (!(perp > 0 && ref > 0)) return;
      const mv = perp / ref - 1; SH = { perp, ref, mv };
      const lvl = Math.abs(mv) >= 0.10 ? 3 : Math.abs(mv) >= 0.06 ? 2 : Math.abs(mv) >= 0.03 ? 1 : 0;
      document.getElementById("rdShock").innerHTML = `<div class="rdshock ${lvl ? (mv < 0 ? "down" : "up") : ""}">${lvl ? "⚡ " : ""}SOXL perp (Hyperliquid, trades 24/7) ${pc(mv, 1)} vs the last close ($${perp.toFixed(2)} vs $${ref.toFixed(2)}) · implied SOXS ≈ ${pc(-mv, 1)} at the open${lvl >= 2 ? " · a big overnight move is under way" : ""}</div>`;
      if (lvl) try { alert1(`rdshock:${etDate()}:${lvl}:${Math.sign(mv)}`, 6 * 36e5, `⚡ After hours: $SOXL perp ${pc(mv, 1)} vs the close · $SOXS ≈ ${pc(-mv, 1)}`, FUND, true); } catch (x) { }
    } catch (x) { }
  }

  /* ---------- 5. macro live ---------- */
  // [symbol, name, stress sign (+ = up is stress), group]
  const MAC = [["^VIX", "VIX", 1, "Volatility"], ["^VIX3M", "VIX 3-month", 1, "Volatility"], ["^MOVE", "MOVE (bond volatility)", 1, "Volatility"], ["^SKEW", "SKEW (tail risk)", 1, "Volatility"],
    ["^TNX", "10Y Treasury yield", 0.5, "Rates"], ["^FVX", "5Y Treasury yield", 0.3, "Rates"], ["^TYX", "30Y Treasury yield", 0.3, "Rates"], ["^IRX", "3M T-bill yield", 0, "Rates"],
    ["TLT", "Long Treasuries (TLT)", -0.4, "Bonds"], ["HYG", "Junk bonds (HYG)", -1, "Bonds"], ["LQD", "Corporate bonds (LQD)", -0.4, "Bonds"], ["TIP", "Inflation-linked (TIP)", 0, "Bonds"],
    ["DX-Y.NYB", "Dollar index", 0.5, "Currencies"], ["FXY", "Japanese yen (FXY)", 0.6, "Currencies"], ["FXE", "Euro (FXE)", -0.2, "Currencies"], ["CYB", "Chinese yuan (CYB)", -0.3, "Currencies"],
    ["CPER", "Copper", -0.5, "Commodities"], ["GLD", "Gold", 0.3, "Commodities"], ["USO", "Oil", 0, "Commodities"], ["^SOX", "SOX (semis)", -1, "Stocks"], ["^NDX", "Nasdaq-100", -1, "Stocks"]];
  async function macro() {
    const out = [];
    for (const [s, n, sgn, grp] of MAC) { const b = await daily(s), q = await liveQ(s); if (!b.length) continue;
      const px = q && q.px || b[b.length - 1].c, prev = q && q.prev || (b.length > 1 ? b[b.length - 2].c : NaN), y = b.slice(-252).map(x => x.c), z = (px - mean(y)) / (sdv(y) || 1);
      const r = b.slice(-253).map((x, i, a) => i ? x.c / a[i - 1].c - 1 : NaN).filter(isFinite), d = px / prev - 1, zd = d / (sdv(r) || 1);
      out.push({ s, n, px, d, z, zd, sgn, grp }); }
    const g = s => out.find(o => o.s === s), ts = g("^VIX") && g("^VIX3M") ? g("^VIX").px / g("^VIX3M").px : NaN;
    // stress index: z-scores signed so that + = stress (VIX, MOVE, SKEW, dollar, yields up; copper, semis, Nasdaq down), plus term structure
    const parts = out.filter(o => o.sgn).map(o => o.sgn * (0.6 * Math.max(-3, Math.min(3, o.z)) + 0.4 * Math.max(-3, Math.min(3, o.zd))) / Math.abs(o.sgn) * Math.min(1, Math.abs(o.sgn)));
    let stress = mean(parts); if (isFinite(ts)) stress += (ts - 0.92) * 4;
    const t2 = (() => { try { return fv("T10Y2Y"); } catch (e) { return NaN; } })(), hy = (() => { try { return fv("BAMLH0A0HYM2"); } catch (e) { return NaN; } })();
    document.getElementById("rdMac").innerHTML = `<div class="bk-sum bk"><div><span class="bk-f">Macro stress index</span><b class="${stress > 0.5 ? "bk-S" : stress < -0.3 ? "bk-L" : ""}">${isFinite(stress) ? stress.toFixed(2) : "–"}</b>${stress > 1 ? "high stress: big moves more likely" : stress > 0.5 ? "rising stress" : stress < -0.3 ? "calm" : "normal"}</div>
      <div><span class="bk-f">VIX ÷ VIX3M</span><b class="${ts > 1 ? "bk-S" : ""}">${isFinite(ts) ? ts.toFixed(2) : "–"}</b>${ts > 1 ? "backwardation: near-term fear" : "contango: normal"}</div>
      <div><span class="bk-f">10Y − 2Y curve</span><b>${isFinite(t2) ? t2.toFixed(2) + "%" : "–"}</b>FRED</div><div><span class="bk-f">High-yield spread</span><b>${isFinite(hy) ? hy.toFixed(2) + "%" : "–"}</b>credit stress, FRED</div></div>
      <div class="tw"><table><tr><th class="l">Market</th><th>Now</th><th>Today</th><th>Today vs normal day</th><th>vs 1-year average</th></tr>${out.map(o => `<tr><td class="l">${o.n}</td><td>${o.px >= 100 ? o.px.toFixed(1) : o.px.toFixed(2)}</td><td class="${cl(o.d)}">${pc(o.d, 2)}</td><td class="${Math.abs(o.zd) >= 2 ? (o.sgn * o.zd > 0 ? "down" : "up") : ""}">${o.zd.toFixed(1)}σ</td><td>${o.z > 0 ? "+" : ""}${o.z.toFixed(1)}σ</td></tr>`).join("")}</table></div>
      <div class="nt">σ = standard deviations: "today vs normal day" compares today's change with a normal daily change; "vs 1-year average" compares the level with the last 12 months. Moves of 2σ or more are colored (red = stress side). VIX above VIX3M (backwardation), a MOVE spike and a dollar spike came before most of the big semis drops of the last two years; the big-move model above uses the VIX ratio, VIX and MOVE.</div>`;
    MS = stress; top();
    // the signal web learns what each bond, rate and currency move means for SOXL: the raw move (in σ of a normal day) is the node;
    // the web finds the sign and the size (for example: yields up, yen up = carry-trade unwinding, junk bonds down = credit stress)
    try { if (window.Web) { out.forEach(o => { if (/SOX|NDX/.test(o.s)) return; Web.emit("mkt." + o.s.replace(/[^A-Z0-9]/gi, "").toLowerCase(), "SOXL", Math.max(-1, Math.min(1, o.zd / 2.5)), `${o.grp} · ${o.n} today (σ)`); });
      if (isFinite(ts)) Web.emit("mkt.vix-term", "SOXL", Math.max(-1, Math.min(1, (ts - 0.92) * 5)), "Volatility · VIX ÷ VIX3M (backwardation +)");
      const y10 = g("^TNX"), y3m = g("^IRX"); if (y10 && y3m) Web.emit("mkt.curve-3m10y", "SOXL", Math.max(-1, Math.min(1, (y10.px - y3m.px) / 1.5)), "Rates · yield curve 10Y − 3M");
      if (isFinite(hy)) Web.emit("mkt.hy-spread", "SOXL", Math.max(-1, Math.min(1, (hy - 3.5) / 1.5)), "Bonds · high-yield credit spread (wide +)");
      const r10 = (() => { try { return fv("DGS10") - fv("T10YIE"); } catch (e) { return NaN; } })(); if (isFinite(r10)) Web.emit("mkt.real10y", "SOXL", Math.max(-1, Math.min(1, (r10 - 1.8) / 1)), "Rates · real 10Y yield (high +)"); } } catch (e) { }
    window.MACROLIVE = out;
  }
  let MS = NaN;

  function top() {
    const p = MOD && !MOD.err ? MOD.p : null, ex = EVT ? EVT.expL : 0;
    document.getElementById("rdTop").innerHTML = `<div><span class="bk-f">Big overnight gap odds (7%+)</span><b class="${p != null && MOD && p > MOD.base * 1.5 ? "bk-S" : ""}">${p != null ? Math.round(p * 100) + "%" : "–"}</b>usual ${MOD && MOD.base ? Math.round(MOD.base * 100) + "%" : "–"}</div>
      <div><span class="bk-f">Earnings move priced from history</span><b>${ex ? "±" + (ex * 100).toFixed(1) + "%" : "none tonight"}</b>SOXL overnight${EVT && EVT.tonight && EVT.tonight.length ? " · " + EVT.tonight.map(e => e.s).join(", ") : ""}</div>
      <div><span class="bk-f">Direction lean</span><b class="${LEAN > 0.15 ? "bk-L" : LEAN < -0.15 ? "bk-S" : ""}">${LEAN > 0.15 ? "UP · SOXL" : LEAN < -0.15 ? "DOWN · SOXS" : "unclear"}</b>${LEAN.toFixed(2)}</div>
      <div><span class="bk-f">Macro stress</span><b class="${MS > 0.5 ? "bk-S" : ""}">${isFinite(MS) ? MS.toFixed(2) : "–"}</b>${MS > 1 ? "high" : MS > 0.5 ? "rising" : "normal / calm"}</div>`;
    // alert once a day when size and side line up
    try { if (p != null && MOD && p >= Math.max(0.15, MOD.base * 2) && Math.abs(LEAN) >= 0.25) alert1(`rdset:${etDate()}:${Math.sign(LEAN)}`, 12 * 36e5, `🎯 Big-move setup: ${Math.round(p * 100)}% odds of a 7%+ SOXL overnight gap (usual ${Math.round(MOD.base * 100)}%), lean ${LEAN > 0 ? "UP → SOXL" : "DOWN → SOXS"}${ex ? `, earnings priced ±${(ex * 100).toFixed(1)}%` : ""}`, FUND, true); } catch (e) { }
  }

  window.Radar = { get: () => ({ MOD, LEAN, MS, EVT, SH }) };
  async function all() { try { await events(); } catch (e) { console.warn("radar events", e); } try { await model(); } catch (e) { console.warn("radar model", e); } try { await lean(); } catch (e) { } try { await macro(); } catch (e) { } }
  renderEv(); renderMod(); top();
  setTimeout(all, 6000); setInterval(all, 15 * 6e4);
  setInterval(lean, 2 * 6e4); setInterval(shock, 60000); setTimeout(shock, 8000);
})();
