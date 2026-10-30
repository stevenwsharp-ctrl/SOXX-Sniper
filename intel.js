/* SOXX Sniper · intelligence card: the semis basket (smart vs fools on the SOXX holdings' perps), spot buying/selling of the
   best and worst SOXL traders, and the nightly leveraged-ETF rebalance / market-maker study. Uses basket.js and whales.js. */
(function () {
  "use strict";
  const HL = "https://api.hyperliquid.xyz/info";
  const post = b => fetch(HL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => { if (r.status === 429) throw new Error("429"); if (!r.ok) throw new Error(r.status); return r.json(); });
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const usd = n => { const a = Math.abs(n); return (n < 0 ? "-$" : "$") + (a >= 1e9 ? (a / 1e9).toFixed(2) + "B" : a >= 1e6 ? (a / 1e6).toFixed(2) + "M" : a >= 1e3 ? (a / 1e3).toFixed(1) + "K" : Math.round(a)); };
  const pxf = p => !p ? "–" : p >= 1000 ? p.toLocaleString(undefined, { maximumFractionDigits: 0 }) : p >= 1 ? p.toFixed(2) : p.toPrecision(4);
  const ago = t => { const m = Math.max(1, Math.round((Date.now() - t) / 6e4)); return m < 60 ? m + "m" : Math.round(m / 60) + "h"; };
  const anchor = document.getElementById("whaleCard"); if (!anchor) return;
  const card = document.createElement("section"); card.className = "card"; card.id = "intelCard"; card.style.marginBottom = "12px";
  card.innerHTML = `<details open id="inBk"><summary class="label" style="cursor:pointer">Semis basket · smart vs fools on the SOXX holdings (Hyperliquid perps)</summary><div id="inBkBody"></div></details>
    <details open id="inWhy" style="margin-top:12px"><summary class="label" style="cursor:pointer">Why they trade · the belief behind each whale move, and which beliefs win or lose</summary><div id="inWhyBody"></div></details>
    <details open id="inSf" style="margin-top:12px"><summary class="label" style="cursor:pointer">Spot flow · the biggest spot traders on Hyperliquid, live (5m · 15m · 1h · 4h · 24h)</summary><div id="inSfBody"></div></details>
    <details open id="inSp" style="margin-top:12px"><summary class="label" style="cursor:pointer">Spot · what the best and worst SOXL traders buy, sell and hold</summary><div id="inSpNote" class="bk-f" style="font-size:12px;margin:4px 0"></div><div id="inSpBody"></div></details>
    <details open id="inRb" style="margin-top:12px"><summary class="label" style="cursor:pointer">Nightly rebalance · market makers · after-hours</summary><div id="inRbBody"></div></details>
    <details open id="inWeb" style="margin-top:12px"><summary class="label" style="cursor:pointer">Signal web · what both sites learn together</summary><div id="inWebF" style="margin:4px 0 8px"></div><div id="inWebBody"></div></details>`;
  anchor.after(card);
  const css = document.createElement("style");
  css.textContent = `#intelCard summary{list-style:none}#intelCard summary::before{content:"▾ ";color:var(--mute)}#intelCard details:not([open]) summary::before{content:"▸ "}
#intelCard .sp table{width:100%;border-collapse:collapse;font:12px var(--mono)}#intelCard .sp th,#intelCard .sp td{padding:3px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
#intelCard .sp th{color:var(--dim);font-size:11px}#intelCard .sp td:first-child,#intelCard .sp th:first-child,#intelCard .sp td.tl{text-align:left}`;
  document.head.appendChild(css);

  /* ---------- basket ---------- */
  async function basket() {
    const D = await Basket.load(); const live = s => { try { return Q && Q[s] && Q[s].c || null; } catch (e) { return null; } };
    const R = D ? Basket.compute(D, { px: live }) : null;
    document.getElementById("inBkBody").innerHTML = Basket.html(R);
    if (window.Web && R && R.basket.gap != null) { Web.emit("basket.gap", "SEMIS", Math.max(-1, Math.min(1, R.basket.gap * 2)), "Semis basket: smart vs fools gap");
      if (R.basket.d4h != null) Web.emit("basket.trend4h", "SEMIS", Math.max(-1, Math.min(1, R.basket.d4h / 20)), "Semis basket: gap change 4h"); }
  }

  /* ---------- lab share + rebalance ---------- */
  function shareLab() {
    try {
      const st = typeof ST !== "undefined" && ST ? ST : (typeof sessStats === "function" && typeof SESS !== "undefined" && SESS.length ? sessStats() : null);
      if (!st || !st.rebal || !(st.n >= 60)) return null;   // keep the last good study; do not overwrite it with an empty one
      const out = { at: Date.now(), n: st.n, first: st.first, last: st.last, rebal: st.rebal,
        rules: (st.rules || []).map(r => ({ id: r.id, title: r.title, r: r.full && isFinite(r.full.r) ? r.full.r : null, oos: r.oos && isFinite(r.oos.r) ? r.oos.r : null, verdict: r.verdict, who: r.who })) };
      localStorage.setItem("soxx_lab_share", JSON.stringify(out)); return out;
    } catch (e) { return null; }
  }
  function rebal() {
    let rb = null;
    try { const lf = letfFlow(todaySess()); if (lf && isFinite(lf.idx)) rb = Basket.rebalance(lf.idx, typeof LETF_AUM !== "undefined" ? LETF_AUM : null); } catch (e) { }
    document.getElementById("inRbBody").innerHTML = Basket.knowledge(rb, shareLab() || Basket.lab());
    try { if (window.Web && rb && isFinite(rb.usd)) Web.emit("soxx.rebal", "SOXL", Math.max(-1, Math.min(1, rb.usd / 3e9)), "SOXX · LETF rebalance flow");
      const S = window.wwSummary && wwSummary(); if (window.Web && S && S.ok) { if (S.b && S.b.n) Web.emit("whales.best", "SOXL", Math.max(-1, Math.min(1, S.b.net / 2e6)), "SOXL top 20 whales net");
        if (S.w && S.w.n) Web.emit("whales.worst", "SOXL", Math.max(-1, Math.min(1, S.w.net / 2e6)), "SOXL worst 20 wallets net"); } } catch (e) { }
    web();
  }
  /* Past data into the web: SOXX Sniper's stored SOXL sessions (up to 2 years). For each day at 3:00 pm ET, rebuild
     signals that the live page also sends (move from the open, the morning gap, yesterday, the 5-day trend, VIX term
     structure) and score them with the move from 3:00 pm to the end of after-hours (8:00 pm). That is the window of the
     closing rebalance and the after-hours reaction. Web.ingest skips days it already learned. */
  const cl1 = v => Math.max(-1, Math.min(1, v));
  const vixTs = d => { try { const V = JSON.parse(localStorage.getItem("rd_d_^VIX") || "null"), V3 = JSON.parse(localStorage.getItem("rd_d_^VIX3M") || "null"); if (!V || !V3) return NaN;
    const a = V.bars.find(b => b.d === d), b = V3.bars.find(b => b.d === d); return a && b ? a.c / b.c : NaN; } catch (e) { return NaN; } };
  let histFed = 0;
  function feedHistory() {
    if (!window.Web || Date.now() - histFed < 6 * 36e5) return;
    let st = null; try { st = typeof sessStats === "function" && typeof SESS !== "undefined" && SESS.length >= 60 ? sessStats() : null; } catch (e) { }
    if (!st || !st.D || st.D.length < 60) return; histFed = Date.now();
    const D = st.D, items = [];
    for (let i = 5; i < D.length; i++) { const d = D[i], p = D[i - 1];
      if (![d.r15, d.l60, d.nAh].every(isFinite)) continue;
      const x = { "soxl.r15": cl1(d.r15 / 0.05), "soxl.prevday": isFinite(p.cc) ? cl1(p.cc / 0.08) : 0, "soxl.trend5": cl1(D.slice(i - 5, i).reduce((a, q) => a + (isFinite(q.cc) ? q.cc : 0), 0) / 0.15) };
      if (isFinite(d.gap)) x["soxl.gap"] = cl1(d.gap / 0.05);
      const ts = vixTs(d.d); if (isFinite(ts)) x["macro.vixts"] = cl1(-(ts - 0.92) * 5);
      Object.keys(x).forEach(k => { if (!x[k]) delete x[k]; });
      // volatility regime: today's move vs the average of the last 20 days
      const av = D.slice(Math.max(0, i - 20), i).reduce((a, q) => a + (isFinite(q.cc) ? Math.abs(q.cc) : 0), 0) / Math.min(20, i);
      const reg = av > 0 && isFinite(d.r15) ? cl1(Math.abs(d.r15) / av - 1) : 0;
      // 4h ≈ 3 pm → end of after-hours; 24h ≈ 3 pm → next day's close
      const r4 = (1 + d.l60) * (1 + d.nAh) - 1, r24 = isFinite(d.nCC) ? (1 + d.l60) * (1 + d.nCC) - 1 : null, r1 = d.l60;
      items.push({ t: etEpochMin(d.d, 900) * 60000, a: "SOXL", x, reg, rh: { 1: r1, 4: r4, 24: r24 } });
    }
    Web.ingest("soxl-sessions", items, "SOXL sessions (2y)");
  }
  // the same signals, live, during the regular session
  function emitLive() {
    if (!window.Web) return; const e = etInfo(Date.now()); if (e.wd === 0 || e.wd === 6 || e.min < 570 || e.min >= 960) return;
    const q = Q && Q[FUND]; if (!(q && q.c > 0 && q.o > 0 && q.pc > 0)) return;
    Web.emit("soxl.r15", "SOXL", cl1((q.c / q.o - 1) / 0.05), "SOXL · move from the open");
    Web.emit("soxl.gap", "SOXL", cl1((q.o / q.pc - 1) / 0.05), "SOXL · morning gap");
    try { const L = JSON.parse(localStorage.getItem("rd_d_SOXL") || "null"); if (L && L.bars.length > 7) { const b = L.bars.filter(x => x.d < e.d), n = b.length;
      Web.emit("soxl.prevday", "SOXL", cl1((b[n - 1].c / b[n - 2].c - 1) / 0.08), "SOXL · yesterday's move"); Web.emit("soxl.trend5", "SOXL", cl1((b[n - 1].c / b[n - 6].c - 1) / 0.15), "SOXL · 5-day trend"); } } catch (x) { }
    const ts = vixTs(e.d) || vixTs((JSON.parse(localStorage.getItem("rd_d_^VIX") || "{\"bars\":[]}").bars.slice(-1)[0] || {}).d); if (isFinite(ts)) Web.emit("macro.vixts", "SOXL", cl1(-(ts - 0.92) * 5), "Macro · calm (VIX below VIX3M)");
  }
  function web() {
    if (!window.Web) return;
    try { feedHistory(); emitLive(); } catch (e) { }
    Web.addPrice && !web.p && (web.p = 1, Web.addPrice(a => { try { return Q && Q[a] && Q[a].c || null; } catch (e) { return null; } }));
    document.getElementById("inWebF").innerHTML = ["SOXL", "SEMIS"].map(a => Web.forecastHtml(a)).filter(Boolean).map((h, i) => `<div>${i ? "Semis (SOXL + SOXX + SOXS, both sites): " : "SOXL: "}${h}</div>`).join("");
    if (!document.getElementById("inWeb").open) return;
    Web.render(document.getElementById("inWebBody"), { h: 340 });
  }

  /* ---------- spot ---------- */
  const FILLS = {}, BAL = {}; window.inFills = () => FILLS; let SPM = null, spmT = 0, HOLD = 0, spT = 0;
  const start = () => Date.now() - 30 * 864e5;   // keep 30 days of fills (spot study uses 7, the why study all)
  window.wwRawFills = (a, f, init) => { if (!Array.isArray(f)) return; const s = start(), cur = FILLS[a];
    FILLS[a] = { t: Date.now(), f: (init || !cur ? f : cur.f.concat(f)).filter(x => x.time >= s) }; };
  async function meta() {
    if (SPM && Date.now() - spmT < 60000) return;
    try { const [m, ctxs] = await post({ type: "spotMetaAndAssetCtxs" }); const tok = {}; m.tokens.forEach(t => tok[t.index] = t.name); const by = {}; ctxs.forEach(c => by[c.coin] = c);
      const o = {}; m.universe.forEach(u => { const c = by[u.name] || {}, px = +c.markPx || +c.midPx || 0, pv = +c.prevDayPx || 0;
        o[u.name] = { base: tok[u.tokens[0]], quote: tok[u.tokens[1]], px, ch: pv ? (px / pv - 1) * 100 : null, vol: +c.dayNtlVlm || 0 }; }); SPM = o; spmT = Date.now(); } catch (e) { if (/429/.test(e.message)) HOLD = Date.now() + 60000; }
  }
  const baseOf = c => SPM && SPM[c] ? SPM[c].base : String(c).includes("/") ? String(c).split("/")[0] : null;
  const pairOf = tok => { if (!SPM) return null; let b = null; for (const p of Object.values(SPM)) if (p.base === tok && /^USD/.test(p.quote || "") && (!b || p.vol > b.vol)) b = p; return b; };
  // whales.js reads the best wallets every minute and hands us their fills; we read the worst wallets and all spot balances, slowly.
  async function pull() {
    if (Date.now() < HOLD || (window.wwHlLimited && wwHlLimited()) || document.hidden) return;
    await meta(); const L = window.wwList ? wwList() : []; let n = 0;
    for (const w of L.filter(w => w.g === "W")) {
      if (n >= 3 || Date.now() < HOLD) break; const F = FILLS[w.a];
      if (F && Date.now() - F.t < 300000) continue;
      try { if (!F) { wwRawFills(w.a, await post({ type: "userFills", user: w.a, aggregateByTime: true }), true); n++; }
        else { const last = F.f.reduce((m, x) => Math.max(m, x.time), start()); wwRawFills(w.a, await post({ type: "userFillsByTime", user: w.a, startTime: last + 1, aggregateByTime: true }), false); } }
      catch (e) { if (/429/.test(e.message)) { HOLD = Date.now() + 60000; break; } }
      await new Promise(r => setTimeout(r, 700));
    }
    let k = 0;
    for (const w of L.slice().sort((a, b) => ((BAL[a.a] || {}).t || 0) - ((BAL[b.a] || {}).t || 0))) {
      if (k >= 5 || Date.now() < HOLD) break; if (BAL[w.a] && Date.now() - BAL[w.a].t < 600000) continue;
      try { const j = await post({ type: "spotClearinghouseState", user: w.a }); BAL[w.a] = { t: Date.now(), b: j && j.balances || [] }; k++; } catch (e) { if (/429/.test(e.message)) { HOLD = Date.now() + 60000; break; } }
      await new Promise(r => setTimeout(r, 400));
    }
    spT = Date.now(); spot();
  }
  function spot() {
    const L = window.wwList ? wwList() : [], grp = {}; L.forEach(w => grp[w.a] = w.g === "B" ? "g" : "b");
    const now = Date.now(), T = {}; let nF = 0;
    const row = t => T[t] = T[t] || { tok: t, g24: 0, g7: 0, b24: 0, b7: 0, gB: new Set(), gS: new Set(), bB: new Set(), bS: new Set(), gH: 0, bH: 0, gHn: 0, bHn: 0 };
    for (const [a, F] of Object.entries(FILLS)) { const g = grp[a]; if (!g) continue; nF++;
      F.f.forEach(x => { const c = String(x.coin); if (!(c.startsWith("@") || c.includes("/"))) return; const t = baseOf(c); if (!t) return;
        const r = row(t), v = +x.sz * +x.px * (x.side === "B" ? 1 : -1), age = now - x.time; if (age > 7 * 864e5) return; r[g + "7"] += v; (v > 0 ? r[g + "B"] : r[g + "S"]).add(a); if (age <= 864e5) r[g + "24"] += v; }); }
    let nB = 0;
    for (const [a, B] of Object.entries(BAL)) { const g = grp[a]; if (!g) continue; nB++;
      B.b.forEach(b => { if (/^USD/.test(b.coin)) return; const p = pairOf(b.coin); if (!p || !p.px) return; const v = +b.total * p.px; if (v < 100) return; const r = row(b.coin); r[g + "H"] += v; r[g + "Hn"]++; }); }
    const list = Object.values(T).filter(r => Math.abs(r.g7) + Math.abs(r.b7) + r.gH + r.bH >= 1000).sort((a, b) => (Math.abs(b.g7) + Math.abs(b.b7) + (b.gH + b.bH) / 4) - (Math.abs(a.g7) + Math.abs(a.b7) + (a.gH + a.bH) / 4)).slice(0, 20);
    const sig = r => { const g = Math.sign(Math.round(r.g7 / 1000)), b = Math.sign(Math.round(r.b7 / 1000));
      return g > 0 && b < 0 ? ["up", "Smart accumulate · fools sell"] : g < 0 && b > 0 ? ["down", "Smart distribute · fools buy"] : g > 0 && b > 0 ? ["", "Both buying"] : g < 0 && b < 0 ? ["", "Both selling"] : g > 0 ? ["up", "Smart buying"] : g < 0 ? ["down", "Smart selling"] : b > 0 ? ["down", "Fools buying"] : b < 0 ? ["up", "Fools selling"] : ["", "Holding"]; };
    const $v = v => v ? `<span class="${v > 0 ? "up" : "down"}">${v > 0 ? "+" : ""}${usd(v)}</span>` : `<span style="color:var(--mute)">0</span>`;
    const nb = Object.values(T).reduce((a, r) => a + r.g7, 0), nf = Object.values(T).reduce((a, r) => a + r.b7, 0);
    // who actually trades spot, and how much cash (USDC / USDH / USDT) each group holds: cash = dry powder or risk-off
    const act = { g: new Set(), b: new Set() }, cash = { g: 0, b: 0 }, nW = { g: 0, b: 0 }, cov = { g: [], b: [] };
    Object.values(T).forEach(r => { ["g", "b"].forEach(g => { r[g + "B"].forEach(a => act[g].add(a)); r[g + "S"].forEach(a => act[g].add(a)); }); });
    for (const [a, Bl] of Object.entries(BAL)) { const g = grp[a]; if (!g) continue; Bl.b.forEach(b => { if (/^USD/.test(b.coin)) cash[g] += +b.total || 0; }); }
    for (const [a, F] of Object.entries(FILLS)) { const g = grp[a]; if (!g) continue; nW[g]++; if (F.f.length) cov[g].push(Math.min(...F.f.map(x => x.time))); }
    const grpCard = (lab, n, g) => `<div><span class="bk-f">${lab}</span>${act[g].size ? `<b class="${n >= 0 ? "bk-L" : "bk-S"}">${n >= 0 ? "+" : ""}${usd(n)}</b>${n >= 0 ? "buying" : "selling"} · ${act[g].size} of ${nW[g]} trade spot` : `<b>no spot trades</b>${nW[g]} wallets read: they trade perps only`}${cash[g] >= 1000 ? ` · hold ${usd(cash[g])} cash` : ""}</div>`;
    const top = SPM ? Object.values(SPM).filter(p => /^USD/.test(p.quote || "") && p.vol > 0).sort((a, b) => b.vol - a.vol).slice(0, 10) : [];
    const totV = SPM ? Object.values(SPM).reduce((a, p) => a + (/^USD/.test(p.quote || "") ? p.vol : 0), 0) : 0, up = top.filter(p => p.ch > 0).length;
    document.getElementById("inSpNote").innerHTML = `Spot fills (7 days) and spot balances of the 20 best and 20 worst SOXL traders (${nF} with fills, ${nB} with balances loaded so far; the first full read takes a few minutes to stay inside Hyperliquid's rate limit). Hyperliquid has no spot chip stocks: SOXL, SOXX and the holdings trade here only as perps (see the basket above). Spot shows the same traders' risk appetite in crypto. When the best SOXL traders sell spot and raise cash while the worst ones buy, that often comes before risk-off days in high-beta chips. ${spT ? `Updated ${ago(spT)} ago.` : ""}`;
    document.getElementById("inSpBody").innerHTML = `<div class="bk-sum bk">
      ${grpCard("Best traders · net spot 7d", nb, "g")}${grpCard("Worst traders · net spot 7d", nf, "b")}
      <div><span class="bk-f">Hyperliquid spot volume 24h</span><b>${usd(totV)}</b>${up}/${top.length} top pairs up</div>
      ${top.slice(0, 4).map(p => `<div><span class="bk-f">spot ${esc(p.base)}</span><b>${pxf(p.px)}</b><span class="${p.ch >= 0 ? "bk-L" : "bk-S"}">${p.ch != null ? (p.ch >= 0 ? "+" : "") + p.ch.toFixed(2) + "%" : "–"}</span> · ${usd(p.vol)}</div>`).join("")}</div>
      ${list.length ? `<div class="sp" style="overflow-x:auto"><table><thead><tr><th>Token</th><th>Price</th><th>24h</th><th>Best net 24h</th><th>Best net 7d</th><th>Worst net 24h</th><th>Worst net 7d</th><th>Best hold</th><th>Worst hold</th><th>Signal</th></tr></thead><tbody>${list.map(r => { const p = pairOf(r.tok), s = sig(r);
        return `<tr><td><b>${esc(r.tok)}</b></td><td>${p ? pxf(p.px) : "–"}</td><td>${p && p.ch != null ? `<span class="${p.ch >= 0 ? "up" : "down"}">${p.ch >= 0 ? "+" : ""}${p.ch.toFixed(2)}%</span>` : "–"}</td><td>${$v(r.g24)}</td><td>${$v(r.g7)} <span style="color:var(--mute)">${r.gB.size}↑ ${r.gS.size}↓</span></td><td>${$v(r.b24)}</td><td>${$v(r.b7)} <span style="color:var(--mute)">${r.bB.size}↑ ${r.bS.size}↓</span></td><td>${r.gH ? usd(r.gH) + ` <span style="color:var(--mute)">${r.gHn}</span>` : "–"}</td><td>${r.bH ? usd(r.bH) + ` <span style="color:var(--mute)">${r.bHn}</span>` : "–"}</td><td class="tl ${s[0]}">${s[1]}</td></tr>`; }).join("")}</tbody></table></div>`
        : `<div style="color:var(--mute);font-size:12px">No spot trades or holdings of $1K+ loaded yet.</div>`}`;
  }

  /* ---------- why: the belief behind each top / worst SOXL trade, and whether it worked ---------- */
  let WC = null, wcT = 0;
  async function why() {
    if (!window.Why) return; const el = document.getElementById("inWhyBody"); if (!el || !document.getElementById("inWhy").open) return;
    if (!WC || Date.now() - wcT > 10 * 6e4) { try { const c = await post({ type: "candleSnapshot", req: { coin: "xyz:SOXL", interval: "1h", startTime: Date.now() - 200 * 864e5, endTime: Date.now() } });
      if (Array.isArray(c) && c.length) { WC = c.map(x => ({ t: x.t, o: +x.o, h: +x.h, l: +x.l, c: +x.c })); wcT = Date.now(); } } catch (e) { } }
    if (!WC) { el.innerHTML = `<div class="bk-f" style="font-size:12px">Loading SOXL perp price history…</div>`; return; }
    const L = window.wwList ? wwList() : [], rank = {}; ["B", "W"].forEach(g => L.filter(w => w.g === g).forEach((w, i) => rank[w.a] = (g === "B" ? "Top #" : "Worst #") + (i + 1)));
    const M = [];
    // the growing log from the data job (Cohort Sniper's data branch): every move of the 40 wallets, up to 200 days
    if (!why.log || Date.now() - why.logT > 5 * 6e4) { try { const r = await fetch("https://raw.githubusercontent.com/stevenwsharp-ctrl/Hyperdash-Cohort-Tracker/data/whalelog.json?t=" + Math.floor(Date.now() / 3e5)); if (r.ok) { why.log = await r.json(); why.logT = Date.now(); } } catch (e) { } }
    const lastLog = {};
    if (why.log && why.log.moves) why.log.moves.forEach(m => { const w = why.log.wallets[m[1]]; if (!w) return; const a = w[0]; lastLog[a] = Math.max(lastLog[a] || 0, m[0]);
      M.push({ t: m[0], a, g: w[1] === "B" ? "best" : "worst", who: rank[a] || (w[1] === "B" ? "top trader" : "worst wallet"), entry: !!m[2], dir: m[3], px: m[4], usd: m[5] }); });
    const F = window.inFills ? inFills() : {};
    // top wallets without loaded fills yet: use the whale tracker's move list
    (window.wwMoves ? wwMoves() : []).filter(m => !F[m.a] && m.t0 > (lastLog[m.a] || 0) + 30 * 6e4).forEach(m => M.push({ t: m.t0, a: m.a, g: "best", who: rank[m.a] || "top trader", entry: m.grp !== "shrink", dir: m.side === "long" ? 1 : -1, px: m.px, usd: m.usd }));
    L.forEach(w => { const f = (F[w.a] && F[w.a].f || []).filter(x => x.coin === "xyz:SOXL" && x.time > (lastLog[w.a] || 0) + 30 * 6e4).sort((a, b) => a.time - b.time); let cur = null;
      f.forEach(x => { const d = x.dir || "", entry = /Open|>/.test(d), dir = /> Long|Open Long|Close Short/.test(d) ? (entry ? 1 : -1) : (entry ? -1 : 1), sideDir = dir;   // entry: the new side; exit: the side they leave
        const v = +x.sz * +x.px; if (cur && cur.entry === entry && cur.dir === sideDir && x.time - cur.t1 < 30 * 6e4) { cur.usd += v; cur.t1 = x.time; cur.sz += +x.sz; cur.px = cur.usd / cur.sz; }
        else { cur = { t: x.time, t1: x.time, a: w.a, g: w.g === "B" ? "best" : "worst", who: rank[w.a], entry, dir: sideDir, px: +x.px, usd: v, sz: +x.sz }; M.push(cur); } }); });
    const evs = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!/^rd_e_/.test(k)) continue; (JSON.parse(localStorage.getItem(k)).L || []).forEach(e => { try { evs.push(etEpochMin(e.d, e.h === "bmo" ? 480 : 960) * 60000); } catch (x) { } }); } } catch (e) { }
    const rows = Why.analyze(M.filter(m => m.usd >= 5000), WC, { events: evs }); window.inWhy = { rows, C: WC, evs };
    el.innerHTML = Why.html(rows, WC, { sym: "SOXL", events: evs, recent: 12 }) + `<div class="bk-f" style="font-size:11.5px;margin-top:4px">${M.length} tracked moves ($5K+): top traders from their fills (newest 2,000 each), worst wallets from their fills as they load. ${why.log ? `Log: ${why.log.moves.length.toLocaleString()} moves since ${new Date(why.log.moves[0] ? why.log.moves[0][0] : Date.now()).toLocaleDateString()}, saved by the data job and growing.` : "The data job's move log loads with its next run."} Prices: the SOXL perp on Hyperliquid, hourly bars, 200 days.</div>`;
  }
  basket(); rebal(); spot();
  setTimeout(why, 9000); setInterval(why, 5 * 6e4);
  if (window.SpotFlow) { const tagOf = a => { const L = window.wwList ? wwList() : []; const w = L.find(x => x.a.toLowerCase() === String(a).toLowerCase()); return w ? { name: w.g === "B" ? "top SOXL trader" : "worst SOXL wallet", kind: w.g === "B" ? "best" : "worst" } : null; };
    SpotFlow.mount(document.getElementById("inSfBody"), { tag: tagOf }); }
  setInterval(basket, 120000); setInterval(rebal, 60000);
  setTimeout(pull, 20000); setInterval(pull, 60000);
})();
