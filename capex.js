/* SOXX Sniper · Capex cycle: cheap semis vs the cost and supply of capital (a thesis note added 2026-11-03).
   The note: anxiety about AI capex is very high; new bond issues raise the question of the cost and availability of
   capital; the SOX trades at about 12.2× blended 24-month forward earnings (near 2022 levels, below the Liberation Day
   and Iran-escalation lows); Nvidia at about 10× (its lowest since 2013). The market may be saying that estimates are at
   risk and 2027 could be the peak, because the cost of capital and the capacity to finance the build-out limit how fast
   companies can move (like late-1990s tech: capacity before use). Bull case: robotics and enterprise automation have
   barely started. Bear case: balance sheets and debt markets are real, binding limits.
   What this file makes of it:
   1. The valuation snapshot (the numbers above, editable; they decay with age). Not tested: forward P/E history is not
      in our free data. Slow node, small weight: cheap multiples help over months, not over hours.
   2. The binding constraint, measured live and tested: the cost and supply of capital.
        IG credit   LQD vs IEF over 20 days (hyperscalers borrow investment grade): IG falling behind Treasuries = tighter
        HY credit   HYG vs IEF over 20 days
        Rates       the 10-year yield (^TNX) over 20 days: up = a higher cost of capital
   3. The bull/bear split as a regime: SOXX 20%+ below its 1-year high ("multiple compression") AND credit easing =
      "cheap and financed" (the bull case); cheap AND credit tightening = "cheap for a reason" (the bear case).
   Test (5 years of daily bars, the Worker's /chart): the signs come from the note, not from the data (nothing is fitted),
   so every test is out of sample; outcomes are SOXX's next 5 and 20 trading days, non-overlapping. Results go to the
   knowledge hub; to the signal web (asset SOXL): cap.value, cap.estrisk, cap.ig, cap.hy, cap.rates, cap.regime. */
(function () {
  "use strict";
  if (window.CAPEX) return; window.CAPEX = 1;
  const K = "capex_v1", lsG = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const DEF = { at: "2026-11-03", sox: 12.16, nvda: 10, note: "SOX ≈12.2× and NVDA ≈10× blended 24-month forward P/E: SOX near 2022 levels, NVDA lowest since 2013. Bond issues raise cost-of-capital worries." };
  let V = Object.assign({}, DEF, lsG(K, {}));
  const proxy = () => { try { return (localStorage.getItem("soxx_fred_proxy") || "").trim().replace(/\/+$/, ""); } catch (e) { return ""; } };
  const c1 = v => Math.max(-1, Math.min(1, v)), pc = (v, d) => v == null || !isFinite(v) ? "–" : (v >= 0 ? "+" : "") + (v * 100).toFixed(d == null ? 1 : d) + "%", esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, x => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[x]));
  const card = document.createElement("section"); card.className = "card"; card.id = "capexCard"; card.style.margin = "0 0 12px";
  const place = () => { const a = document.getElementById("hubCard") || document.getElementById("agCard") || document.getElementById("botCard") || document.getElementById("stanceCard"); if (a && !card.isConnected) a.after(card); return !!a; };
  const st = document.createElement("style"); st.textContent = `#capexCard table{width:100%;border-collapse:collapse;font:12px var(--mono)}#capexCard th,#capexCard td{padding:3px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}#capexCard th{color:var(--dim);font-weight:600}#capexCard td.l,#capexCard th.l{text-align:left}#capexCard .L{color:var(--up)}#capexCard .S{color:var(--down)}#capexCard .A{color:var(--amber,#ffb547)}#capexCard .note{font-size:11.5px;color:var(--dim);margin:4px 0;line-height:1.45}#capexCard .g2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}@media(max-width:900px){#capexCard .g2{grid-template-columns:1fr}}#capexCard input{width:64px;font:12px var(--mono);background:var(--panel2,transparent);color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:2px 5px}`; document.head.appendChild(st);
  // ---------- data ----------
  const D = {}; let T = null, NOW = null, loadT = 0;
  async function daily(t) { const j = await (await fetch(`${proxy()}/chart?t=${encodeURIComponent(t)}&range=5y&interval=1d`)).json().catch(() => null); if (!j || j.status !== "ok") return null; const m = new Map(); (j.bars || []).forEach(b => { if (b[4] != null) m.set(new Date(b[0]).toISOString().slice(0, 10), b[4]); }); return m; }
  async function load() { if (!proxy() || Date.now() - loadT < 6 * 36e5 && T) return; loadT = Date.now(); const L = await Promise.all(["SOXX", "LQD", "HYG", "IEF", "^TNX"].map(daily)); if (L.some(x => !x)) return;
    const [S, LQ, HY, IE, TN] = L, days = [...S.keys()].filter(d => LQ.has(d) && HY.has(d) && IE.has(d) && TN.has(d)).sort(); D.days = days;
    D.s = days.map(d => S.get(d)); D.ig = days.map(d => Math.log(LQ.get(d) / IE.get(d))); D.hy = days.map(d => Math.log(HY.get(d) / IE.get(d))); D.tn = days.map(d => TN.get(d)); analyze(); }
  // ---------- features and tests ----------
  const sd = a => { const m = a.reduce((p, q) => p + q, 0) / a.length; return Math.sqrt(a.reduce((p, q) => p + (q - m) ** 2, 0) / Math.max(1, a.length - 1)) || 1e-9; };
  function analyze() {
    const n = D.days.length; if (n < 300) return; const L = 20, ch = (a, i) => i >= L ? a[i] - a[i - L] : null;
    const ig = D.ig.map((_, i) => ch(D.ig, i)), hy = D.hy.map((_, i) => ch(D.hy, i)), tn = D.tn.map((_, i) => ch(D.tn, i)), hi = D.s.map((v, i) => Math.max(...D.s.slice(Math.max(0, i - 251), i + 1))), dd = D.s.map((v, i) => v / hi[i] - 1);
    const zs = a => { const v = a.filter(x => x != null); const s = sd(v); return a.map(x => x == null ? null : x / s); }, IGz = zs(ig), HYz = zs(hy), TNz = zs(tn);
    const fut = (i, h) => i + h < n ? Math.log(D.s[i + h] / D.s[i]) : null;
    // fixed signs from the note: easing credit (+) and falling yields (+) are good for semis
    const test = (x, h, sign) => { const xs = [], ys = []; for (let i = 260; i < n - h; i += h) { const a = x[i], y = fut(i, h); if (a == null || y == null) continue; xs.push(sign * a); ys.push(y); }
      const m = xs.length; if (m < 12) return null; const mx = xs.reduce((p, q) => p + q, 0) / m, my = ys.reduce((p, q) => p + q, 0) / m; let sxy = 0, sxx = 0, syy = 0; for (let k = 0; k < m; k++) { sxy += (xs[k] - mx) * (ys[k] - my); sxx += (xs[k] - mx) ** 2; syy += (ys[k] - my) ** 2; }
      const r = sxy / Math.sqrt(sxx * syy || 1); return { n: m, r, z: r * Math.sqrt(m - 2) / Math.sqrt(Math.max(1e-9, 1 - r * r)) }; };
    const reg = i => dd[i] <= -0.2 ? (ig[i] != null && ig[i] >= 0 ? "financed" : "constrained") : "normal";
    const regT = h => { const G = { financed: [], constrained: [], normal: [] }; for (let i = 260; i < n - h; i += h) { const y = fut(i, h); if (y != null) G[reg(i)].push(y); } const all = Object.values(G).flat(), mu = a => a.length ? a.reduce((p, q) => p + q, 0) / a.length : null;
      const R = {}; for (const k in G) { const a = G[k]; R[k] = { n: a.length, m: mu(a), w: a.length ? a.filter(y => y > 0).length / a.length : null }; } const f = G.financed, c = G.constrained;
      R.z = f.length >= 4 && c.length >= 4 ? (mu(f) - mu(c)) / Math.sqrt(sd(f) ** 2 / f.length + sd(c) ** 2 / c.length) : null; R.all = mu(all); return R; };
    T = { ig5: test(IGz, 5, 1), ig20: test(IGz, 20, 1), hy5: test(HYz, 5, 1), hy20: test(HYz, 20, 1), tn5: test(TNz, 5, -1), tn20: test(TNz, 20, -1), reg20: regT(20), reg5: regT(5), from: D.days[260], to: D.days[n - 1] };
    const i = n - 1; NOW = { ig: ig[i], igz: IGz[i], hy: hy[i], hyz: HYz[i], tn: D.tn[i], tnc: tn[i], tnz: TNz[i], dd: dd[i], reg: reg(i), px: D.s[i], d: D.days[i] };
    try { if (window.Hub) { const F = []; [["ig", "IG credit easing (LQD vs IEF, 20 d)"], ["hy", "HY credit easing (HYG vs IEF, 20 d)"], ["tn", "10-year yield falling (20 d)"]].forEach(([k, rule]) => [5, 20].forEach(h => { const x = T[k + h]; if (x) F.push({ eng: "capex · cost of capital", mkt: "SOXX", rule, h: h + "d", n: x.n, m: x.r, unit: "corr", z: x.z, oos: true }); }));
        [5, 20].forEach(h => { const R = T["reg" + h]; if (R.z != null) F.push({ eng: "capex · cheap and financed", mkt: "SOXX", rule: "20%+ below the 1-y high: credit easing vs tightening", h: h + "d", n: R.financed.n + R.constrained.n, m: R.financed.m - R.constrained.m, unit: "log ret", z: R.z, oos: true }); }); Hub.report(F); } } catch (e) { }
    emit(); draw(); }
  // ---------- to the signal web ----------
  const age = () => Math.max(0, (Date.now() - Date.parse(V.at)) / 864e5), decay = () => Math.pow(0.5, age() / 30);
  function emit() { if (!window.Web) return; const w = k => { const x = T && T[k]; return x ? Math.max(0.15, Math.min(1, 0.4 + x.z / 4)) : 0.4; };   // a test that holds up gives a bigger voice
    try { const dv = decay(); Web.emit("cap.value", "SOXL", 0.5 * dv, "Capex · valuation snapshot (SOX ≈" + V.sox + "× 24m fwd; slow, not tested)"); Web.emit("cap.estrisk", "SOXL", -0.3 * dv, "Capex · estimate risk (2027 peak worry; not tested)");
      if (NOW) { Web.emit("cap.ig", "SOXL", c1(NOW.igz / 2.5) * w("ig20"), "Capex · IG credit (LQD vs IEF, 20 d)"); Web.emit("cap.hy", "SOXL", c1(NOW.hyz / 2.5) * w("hy20"), "Capex · HY credit (HYG vs IEF, 20 d)"); Web.emit("cap.rates", "SOXL", c1(-NOW.tnz / 2.5) * w("tn20"), "Capex · 10-year yield (20 d)");
        Web.emit("cap.regime", "SOXL", NOW.reg === "financed" ? 0.6 : NOW.reg === "constrained" ? -0.6 : 0, "Capex · cheap and financed vs cheap for a reason"); } } catch (e) { } }
  // ---------- the card ----------
  function draw() { if (!place()) return;
    const tr = (lab, x, h) => x ? `<tr><td class="l">${lab}</td><td>${h}</td><td>${x.n}</td><td class="${x.r > 0 ? "L" : "S"}">${x.r.toFixed(2)}</td><td class="${x.z >= 2 ? "L" : x.z <= -2 ? "S" : "A"}">${x.z.toFixed(1)}</td><td class="l">${x.z >= 2 ? "holds" : x.z <= -2 ? "the opposite holds" : "not proven"}</td></tr>` : "";
    const R = T && T.reg20, rr = (k, l) => R && R[k] ? `<tr><td class="l">${l}</td><td>${R[k].n}</td><td class="${R[k].m >= 0 ? "L" : "S"}">${pc(R[k].m)}</td><td>${R[k].w != null ? Math.round(R[k].w * 100) + "%" : "–"}</td></tr>` : "";
    const regT = NOW ? NOW.reg === "financed" ? '<b class="L">Cheap and financed</b> (the bull case: compressed and credit is easing)' : NOW.reg === "constrained" ? '<b class="S">Cheap for a reason</b> (the bear case: compressed and credit is tightening)' : `<b>Not compressed by price</b> (SOXX ${pc(NOW.dd)} from its 1-year high; the regime needs −20%)` : "–";
    const g = (lab, z, val, good) => `<tr><td class="l">${lab}</td><td>${val}</td><td class="${z == null ? "" : z * good > 0 ? "L" : "S"}">${z == null ? "–" : z.toFixed(1) + "σ"}</td><td class="l">${z == null ? "" : z * good > 0.5 ? "easier capital" : z * good < -0.5 ? "tighter capital" : "neutral"}</td></tr>`;
    card.innerHTML = `<details open><summary class="label" style="cursor:pointer">🏗 Capex cycle · cheap semis vs the cost and supply of capital</summary>
      <div class="g2"><div><div class="note" style="font-size:12.5px;color:var(--ink)"><b>Thesis (note added ${esc(V.at)}):</b> the multiples are compressed: SOX ≈<input id="cxS" value="${V.sox}">× and NVDA ≈<input id="cxN" value="${V.nvda}">× blended 24-month forward P/E (SOX near 2022 levels; NVDA lowest since 2013). The market may price risk to estimates (a 2027 peak), because the cost of capital and the capacity to finance the build-out set the speed limit. Bull: robotics and enterprise automation have barely started. Bear: balance sheets and debt markets are binding. <button id="cxSave" style="font:11px var(--mono);padding:2px 8px;border-radius:6px;border:1px solid var(--line);background:var(--panel2);color:var(--ink);cursor:pointer">update numbers</button></div>
        <div class="note">So the question for the next weeks is not "are semis cheap" (they are), but "is capital still flowing". The gauges on the right watch that, every day. The valuation snapshot fades with a 30-day half-life (now ${Math.round(decay() * 100)}% weight): enter new numbers when you get them.</div>
        <div style="margin-top:6px;font-size:13.5px">Now: ${regT}</div></div>
      <div>${NOW ? `<table><tr><th class="l">Cost of capital (${esc(NOW.d)})</th><th>20-day change</th><th>vs normal</th><th class="l">Reads</th></tr>${g("IG credit · LQD vs IEF", NOW.igz, pc(NOW.ig, 2), 1)}${g("HY credit · HYG vs IEF", NOW.hyz, pc(NOW.hy, 2), 1)}${g("10-year yield", NOW.tnz, `${NOW.tn.toFixed(2)}% (${NOW.tnc >= 0 ? "+" : ""}${(NOW.tnc * 100).toFixed(0)} bp)`, -1)}</table>` : `<div class="note">${proxy() ? "Loading 5 years of LQD, HYG, IEF, the 10-year yield and SOXX…" : "Add the Worker URL (the ⚙ settings) to measure the cost of capital live."}</div>`}</div></div>
      ${T ? `<div class="g2" style="margin-top:10px"><div><table><tr><th class="l">Test: the note's sign, SOXX next…</th><th>Horizon</th><th>Samples</th><th>Corr</th><th>z</th><th class="l"></th></tr>${tr("IG credit easing → semis up", T.ig5, "5 d")}${tr("", T.ig20, "20 d")}${tr("HY credit easing → semis up", T.hy5, "5 d")}${tr("", T.hy20, "20 d")}${tr("Yields falling → semis up", T.tn5, "5 d")}${tr("", T.tn20, "20 d")}</table></div>
        <div><table><tr><th class="l">Regime · SOXX next 20 days</th><th>Samples</th><th>Mean</th><th>Up</th></tr>${rr("financed", "Cheap and financed")}${rr("constrained", "Cheap for a reason")}${rr("normal", "Not compressed")}</table><div class="note">${R && R.z != null ? `Financed vs for-a-reason difference: z ${R.z.toFixed(1)} ${Math.abs(R.z) >= 2 ? "(holds)" : "(not proven: few compressed periods in 5 years)"}.` : "Too few compressed periods to compare."}</div></div></div>
      <div class="note">${esc(T.from)} to ${esc(T.to)}, non-overlapping 5- and 20-day outcomes. The signs come from the note, not from the data, so nothing is fitted. All results go to the knowledge hub; the live gauges go to the signal web (cap.*), with a bigger voice when their test holds.</div>` : ""}</details>`;
    const sv = card.querySelector("#cxSave"); if (sv) sv.onclick = () => { const s = parseFloat(card.querySelector("#cxS").value), nv = parseFloat(card.querySelector("#cxN").value); if (s > 0 && nv > 0) { V = { ...V, sox: s, nvda: nv, at: new Date().toISOString().slice(0, 10) }; lsS(K, V); emit(); draw(); } };
  }
  const go = () => { draw(); load(); emit(); }; setTimeout(go, 2500); setInterval(() => { emit(); load(); }, 10 * 6e4);
  window.CAPEXDATA = () => ({ V, T, NOW });
})();
