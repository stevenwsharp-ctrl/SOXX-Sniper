/* SOXX Sniper · Market stance (top of the page) + Nasdaq futures and KOSPI.
   Tiles: Nasdaq-100 futures (NQ=F) and S&P 500 futures (ES=F) from CME through the Worker's /chart, the KOSPI index (^KS11),
   and three Hyperliquid perps that trade every hour of every day: KOSPI 200, Nasdaq-100 and SOXL (the SOXL perp vs the last
   SOXL cash price = the implied gap at the next open).
   Why KOSPI: Samsung and SK Hynix are about 1/3 of the KOSPI and are the world's biggest memory makers. Korea trades while
   the US sleeps (7 pm–1:30 am ET), so it is the first read on chips each night.
   The stance blends futures, KOSPI, the SOXL gap, VIX, the dollar, the 10Y yield and the signal web into one score (−1 … +1).
   To the signal web: fut.nq, fut.es, fut.kospi, fut.kr200, fut.ndxperp, fut.soxlgap (window.STANCE feeds the Sniper read).
   Uses: fredProxy (Worker URL), Q (SOXL quote), MACROLIVE (radar.js), Web. */
(function () {
  "use strict";
  const main = document.getElementById("mainView"), hl = document.getElementById("hlBar"); if (!main) return;
  const sec = document.createElement("section"); sec.className = "card"; sec.id = "stanceCard"; sec.style.marginBottom = "12px";
  hl ? hl.before(sec) : main.prepend(sec);
  const st = document.createElement("style");
  st.textContent = `#stanceCard{padding:12px 14px}#stanceCard .sth{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px}#stanceCard .stl{font:600 19px var(--sans);letter-spacing:.2px}
    #stanceCard .stsc{font:13px var(--mono);color:var(--dim)}#stanceCard .sts{font-size:13.5px;color:var(--ink);margin:4px 0 10px;line-height:1.45}
    #stanceCard .stg{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px}#stanceCard .stt{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:7px 10px;min-width:0}
    #stanceCard .stn{font:11px var(--mono);color:var(--dim);display:flex;justify-content:space-between;gap:6px}#stanceCard .stp{font:600 16px var(--mono);margin-top:2px}#stanceCard .stc{font:12.5px var(--mono)}
    #stanceCard .sto{font:10px var(--mono);padding:0 5px;border-radius:5px;border:1px solid var(--line)}#stanceCard .sto.on{color:var(--up);border-color:var(--up)}
    #stanceCard svg{display:block;width:100%;height:26px;margin-top:3px}#stanceCard .stw{display:flex;flex-wrap:wrap;gap:5px 12px;font:11.5px var(--mono);color:var(--dim);margin-top:9px}
    #stanceCard .L{color:var(--up)}#stanceCard .S{color:var(--down)}#stanceCard .bar{height:6px;border-radius:3px;background:linear-gradient(90deg,var(--down),var(--line) 50%,var(--up));position:relative;width:160px;align-self:center}
    #stanceCard .bar i{position:absolute;top:-4px;width:3px;height:14px;background:var(--ink);border-radius:2px}`;
  document.head.appendChild(st);
  const c1 = v => Math.max(-1, Math.min(1, v)), pc = (v, d) => v == null || !isFinite(v) ? "–" : (v >= 0 ? "+" : "") + (v * 100).toFixed(d == null ? 2 : d) + "%";
  const cls = v => v > 0 ? "L" : v < 0 ? "S" : "", fx = v => v == null ? "–" : v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 1 }) : v >= 100 ? v.toFixed(2) : v.toFixed(3);
  // sessions
  const etMin = t => { const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date(t)), g = k => p.find(x => x.type === k).value; return { wd: g("weekday"), m: +g("hour") * 60 + +g("minute") }; };
  const cmeOpen = t => { const { wd, m } = etMin(t); if (wd === "Sat") return false; if (wd === "Sun") return m >= 1080; if (wd === "Fri") return m < 1020; return !(m >= 1020 && m < 1080); };
  const krxOpen = t => { const d = new Date(t + 9 * 36e5), wd = d.getUTCDay(), m = d.getUTCHours() * 60 + d.getUTCMinutes(); return wd >= 1 && wd <= 5 && m >= 540 && m < 930; };
  const usCash = t => { const { wd, m } = etMin(t); return !["Sat", "Sun"].includes(wd) && m >= 570 && m < 960; };
  const T = {}; let workerOld = false;
  async function yq(sym) {
    const p = typeof fredProxy === "function" ? fredProxy() : ""; if (!p) return null;
    try { const r = await fetch(`${p}/chart?t=${encodeURIComponent(sym)}&range=1d&interval=5m`), j = await r.json();
      if (r.status === 400 && /bad ticker/.test(j.error || "")) { workerOld = true; return null; }
      if (j.status !== "ok" || !j.meta) return null; const b = (j.bars || []).filter(x => x[4] != null);
      const px = b.length ? b[b.length - 1][4] : j.meta.price, prev = j.meta.prevClose;
      return { px, prev, d: prev ? px / prev - 1 : null, spark: b.map(x => x[4]).slice(-120), at: b.length ? b[b.length - 1][0] : Date.now() }; } catch (e) { return null; } }
  async function perps() {
    try { const r = await fetch("https://api.hyperliquid.xyz/info", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "metaAndAssetCtxs", dex: "xyz" }) });
      if (!r.ok) return null; const [m, c] = await r.json(), o = {}; m.universe.forEach((u, i) => { const x = c[i]; if (x) o[u.name.split(":").pop()] = { px: +x.markPx, prev: +x.prevDayPx, d: +x.prevDayPx ? +x.markPx / +x.prevDayPx - 1 : null, f: +x.funding }; }); return o; } catch (e) { return null; } }
  const spark = a => { if (!a || a.length < 3) return ""; const lo = Math.min(...a), hi = Math.max(...a), w = 160, h = 26, k = (hi - lo) || 1;
    const pts = a.map((v, i) => `${(i / (a.length - 1) * w).toFixed(1)},${(h - 2 - (v - lo) / k * (h - 4)).toFixed(1)}`).join(" ");
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="var(--${a[a.length - 1] >= a[0] ? "up" : "down"})" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`; };
  async function tick() {
    if (document.hidden && T.at) return;
    const [nq, es, ks, P] = await Promise.all([yq("NQ=F"), yq("ES=F"), yq("^KS11"), perps()]);
    if (nq) T.nq = nq; if (es) T.es = es; if (ks) T.ks = ks; if (P) { T.P = P; window.PERPCTX = P; } T.at = Date.now();
    draw();
  }
  function parts() {
    const now = Date.now(), L = [], I = [], P = T.P || {}, w = (id, v, wt, lab, txt) => { if (v == null || !isFinite(v)) return; L.push({ id, v: c1(v), wt, lab, txt }); };
    const nq = T.nq || (P.XYZ100 && { d: P.XYZ100.d, perp: true }), ks = T.ks, kr = P.KR200, nd = P.XYZ100, sx = P.SOXL;
    if (nq && nq.d != null) { w("fut.nq", nq.d / 0.012, 1.5, "Nasdaq-100 futures", pc(nq.d)); I.push(["fut.nq", "SOXL", c1(nq.d / 0.015), "Futures · Nasdaq-100 futures vs prior close"]); }
    if (T.es && T.es.d != null) { w("fut.es", T.es.d / 0.01, 0.7, "S&P 500 futures", pc(T.es.d)); I.push(["fut.es", "SOXL", c1(T.es.d / 0.012), "Futures · S&P 500 futures vs prior close"]); }
    if (ks && ks.d != null && now - ks.at < 30 * 36e5) { w("fut.kospi", ks.d / 0.015, 1, "KOSPI", pc(ks.d)); I.push(["fut.kospi", "SOXL", c1(ks.d / 0.02), "Korea · KOSPI today (Samsung, SK Hynix: memory chips)"]); }
    if (kr && kr.d != null) I.push(["fut.kr200", "SOXL", c1(kr.d / 0.02), "Korea · KOSPI 200 perp, 24 h (trades every hour)"]);
    if (nd && nd.d != null && !T.nq) I.push(["fut.ndxperp", "SOXL", c1(nd.d / 0.015), "Futures · Nasdaq-100 perp, 24 h"]);
    const cash = typeof Q === "object" && Q.SOXL && Q.SOXL.c > 0 ? Q.SOXL.c : null, gap = sx && cash && !usCash(now) ? sx.px / cash - 1 : null;
    if (gap != null) { w("fut.soxlgap", gap / 0.04, 1, "SOXL perp vs last cash price", pc(gap)); if (Math.abs(gap) >= 0.003) I.push(["fut.soxlgap", "SOXL", c1(gap / 0.05), "Futures · SOXL perp vs last cash price (implied gap)"]); }
    const M = window.MACROLIVE || [], g = s => M.find(o => o.s === s);
    const vx = g("^VIX"); if (vx && isFinite(vx.zd)) w("vix", -vx.zd / 2, 1, "VIX", (vx.d >= 0 ? "+" : "") + (vx.d * 100).toFixed(1) + "%");
    const dx = g("DX-Y.NYB"); if (dx && isFinite(dx.zd)) w("usd", -dx.zd / 2.5, 0.5, "Dollar", pc(dx.d));
    const tn = g("^TNX"); if (tn && isFinite(tn.zd)) w("10y", -tn.zd / 2.5, 0.5, "10Y yield", pc(tn.d));
    try { const F = window.Web && (Web.forecast("SEMIS") || Web.forecast("SOXL")); if (F && F.ready) w("web", (F.p - 0.5) * 4, 1, "Signal web, 4 h", Math.round(F.p * 100) + "% up"); } catch (e) { }
    return { L, I, gap, cash };
  }
  function draw() {
    const { L, I, gap, cash } = parts(), sw = L.reduce((s, x) => s + x.wt, 0), sc = sw ? L.reduce((s, x) => s + x.v * x.wt, 0) / sw : null, now = Date.now(), P = T.P || {};
    try { if (window.Web) I.forEach(([id, a, v, lab]) => { if (v) Web.emit(id, a, v, lab); }); } catch (e) { }
    window.STANCE = { at: now, score: sc, L, I, T };
    const lab = sc == null ? "Loading…" : sc >= 0.35 ? "RISK-ON" : sc >= 0.12 ? "LEANING RISK-ON" : sc <= -0.35 ? "RISK-OFF" : sc <= -0.12 ? "LEANING RISK-OFF" : "MIXED";
    const pos = L.filter(x => x.v >= 0.15).sort((a, b) => b.v * b.wt - a.v * a.wt), neg = L.filter(x => x.v <= -0.15).sort((a, b) => a.v * a.wt - b.v * b.wt);
    const nm = x => `${x.lab} ${x.txt}`, cmeO = cmeOpen(now), krO = krxOpen(now), us = usCash(now);
    let sum = sc == null ? "Reading futures, KOSPI and the macro board…" : `${pos.length ? "Support: " + pos.slice(0, 3).map(nm).join(", ") + ". " : ""}${neg.length ? "Pressure: " + neg.slice(0, 3).map(nm).join(", ") + ". " : ""}${!pos.length && !neg.length ? "No strong push from any side. " : ""}`;
    if (sc != null) sum += sc >= 0.12 ? "Lean: SOXL." : sc <= -0.12 ? "Lean: SOXS, or wait." : "No clear lean: size down or wait.";
    if (!us && gap != null) sum += ` The SOXL perp implies a ${pc(gap)} gap at the next open (last cash ${fx(cash)}).`;
    try { const TT = window.TRAPSIG && TRAPSIG.T, U = v => "$" + (v / 1e6).toFixed(1) + "M"; if (TT) sum += ` Trapped on the SOXL perp: longs ${U(TT.L.usd)} (${(TT.L.depW * 100).toFixed(1)}% under) vs shorts ${U(TT.S.usd)} (${(TT.S.depW * 100).toFixed(1)}% under)${TT.P > 0.05 ? ", squeeze risk up" : TT.P < -0.05 ? ", flush risk down" : ""}.`; } catch (e) { }
    if (krO) sum += " Korea is open: watch Samsung and SK Hynix for the first chip read of the night.";
    const ten = (name, o, open, sub, sp, note) => `<div class="stt"><div class="stn"><span>${name}</span>${open != null ? `<span class="sto ${open ? "on" : ""}">${open ? "open" : "closed"}</span>` : ""}</div>
      <div class="stp">${o ? fx(o.px) : "–"}</div><div class="stc"><span class="${o ? cls(o.d) : ""}">${o ? pc(o.d) : "–"}</span> <span style="color:var(--dim)">${sub}</span></div>${sp ? spark(sp) : ""}${note ? `<div class="stn" style="margin-top:2px">${note}</div>` : ""}</div>`;
    sec.innerHTML = `<div class="sth"><div class="label" style="margin:0">Market stance</div><div class="stl ${cls(sc && Math.abs(sc) >= 0.12 ? sc : 0)}">${lab}</div>${sc != null ? `<div class="bar"><i style="left:calc(${((sc + 1) / 2 * 100).toFixed(1)}% - 1px)"></i></div><div class="stsc">${sc >= 0 ? "+" : ""}${sc.toFixed(2)} (−1 risk-off … +1 risk-on)</div>` : ""}</div>
      <div class="sts">${sum}</div>
      <div class="stg">${ten("Nasdaq-100 futures (NQ)", T.nq, cmeO, "vs prior close", T.nq && T.nq.spark, !T.nq && workerOld ? "repaste the Worker for CME futures" : "")}
        ${ten("S&P 500 futures (ES)", T.es, cmeO, "vs prior close", T.es && T.es.spark)}
        ${ten("KOSPI (Korea)", T.ks, krO, "vs prior close", T.ks && T.ks.spark, "Samsung + SK Hynix ≈ 1/3")}
        ${ten("KOSPI 200 perp · 24/7", P.KR200, null, "24 h · Hyperliquid")}
        ${ten("Nasdaq-100 perp · 24/7", P.XYZ100, null, "24 h · Hyperliquid")}
        ${ten("SOXL perp · 24/7", P.SOXL, null, "24 h · Hyperliquid", null, gap != null ? `implied open gap <b class="${cls(gap)}">${pc(gap)}</b>` : us ? "US cash market open" : "")}</div>
      ${L.length ? `<div class="stw">${L.map(x => `<span title="weight ${x.wt}">${x.lab} <b class="${cls(x.v)}">${x.v > 0 ? "▲" : x.v < 0 ? "▼" : "·"}${Math.abs(x.v).toFixed(2)}</b></span>`).join("")}</div>` : ""}
      <div class="stw" style="margin-top:4px">CME futures trade Sun 6 pm – Fri 5 pm ET (break 5–6 pm daily). KOSPI trades 7 pm – 1:30 am ET (9:00–15:30 Seoul). Perps trade all hours. Updates every minute.</div>`;
  }
  tick(); setInterval(tick, 60000);
  setInterval(() => { if (!document.hidden) draw(); }, 15000);   // macro board, web and SOXL quote refresh between ticks
})();
