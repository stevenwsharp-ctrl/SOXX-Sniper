/* SOXX Sniper · Price trio (SOXX, SOXL, SOXS) and side-by-side charts
   Prices: the live quotes in Q (Finnhub trades in the regular session; the Worker /ext feed in pre-market,
   after-hours and overnight). Charts: Worker /chart (Yahoo, 1-minute or 5-minute bars with extended hours),
   reloaded every minute, with the newest live price added between reloads.
   Depends on globals from index.html: $, Q, FUND, fredProxy, demo, fmtPx, fmtPct, esc, lsGet, lsSet, phaseAt. */
(function () {
  "use strict";
  const SY = [["SOXL", "3× bull"], ["SOXX", "semis index ETF"], ["SOXS", "3× bear"]];
  const box = $("pxTrio"), chartCard = $("trioCard"); if (!box || !chartCard) return;
  const css = `
.toprow{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:12px;margin:0 0 12px}
.pxtrio{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.pxc{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px 14px;position:relative;overflow:hidden;min-width:0}
.pxc.pu{background:linear-gradient(160deg,color-mix(in srgb,var(--up) 12%,var(--panel)),var(--panel) 70%)}
.pxc.pd{background:linear-gradient(160deg,color-mix(in srgb,var(--down) 12%,var(--panel)),var(--panel) 70%)}
.pxc .n{display:flex;justify-content:space-between;align-items:baseline;gap:6px;font-family:var(--mono);font-size:13px;font-weight:600}
.pxc .n span{font-weight:400;font-size:10px;color:var(--dim);letter-spacing:.04em;text-transform:uppercase}
.pxc .p{font-family:var(--mono);font-size:30px;font-weight:600;line-height:1.15;margin:6px 0 2px;transition:color .4s}
.pxc .p.fu{color:var(--up)}.pxc .p.fd{color:var(--down)}
.pxc .c{font-family:var(--mono);font-size:13px}
.pxc .x{font-family:var(--mono);font-size:11px;color:var(--dim);margin-top:3px;min-height:15px}
.pxc{display:flex;flex-direction:column}.pxc canvas{display:block;width:100%;flex:1 1 34px;min-height:34px;max-height:90px;margin-top:6px}
#trioCard .trhd{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;cursor:pointer}
#trioCard .trhd .label{margin:0}
#trioBody{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}
#trioBody.hide{display:none}
.trc{border:1px solid var(--line);border-radius:12px;padding:8px 10px;background:var(--panel2);min-width:0}
.trc .h{display:flex;justify-content:space-between;font-family:var(--mono);font-size:12px;margin-bottom:4px;gap:6px}
.trc .cw{position:relative;height:240px}.trc canvas{width:100%;height:100%;display:block}
.trc .tip{position:absolute;top:2px;left:6px;font-family:var(--mono);font-size:11px;background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:2px 6px;display:none;pointer-events:none;white-space:nowrap}
#trioCtl button{padding:4px 9px;font-size:11px}#trioCtl button.on{border-color:var(--accent);color:var(--accent)}
@media (max-width:980px){.toprow{grid-template-columns:minmax(0,1fr)}}
@media (max-width:760px){#trioBody{grid-template-columns:minmax(0,1fr)}.trc .cw{height:200px}}
@media (max-width:520px){.pxc .hm{display:none}.pxc{padding:10px}.pxc .p{font-size:21px}.pxc .c{font-size:11px}.pxc .n span{display:none}}
`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const col = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
  const etMin = t => { const d = new Date(t), s = d.toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour12: false, hour: "2-digit", minute: "2-digit" }); return +s.slice(0, 2) * 60 + +s.slice(3, 5); };
  const etDay = t => new Date(t).toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  // ---------- price cards ----------
  const last = {}, flash = {};
  function quote(s) {
    const q = Q[s]; if (!q || !(q.c > 0)) return null;
    const ext = q.xsess && q.xsess !== "regular" && q.regClose > 0 && phaseAt(Date.now()) !== "regular";
    const base = q.pc > 0 ? q.pc : NaN;
    return { p: q.c, pc: base, day: base > 0 ? q.c / base - 1 : NaN, dCh: base > 0 ? q.c - base : NaN, ext, rc: q.regClose, x: ext && q.regClose > 0 ? q.c / q.regClose - 1 : NaN, sess: q.xsess };
  }
  function cards() {
    box.innerHTML = SY.map(([s, sub]) => `<div class="pxc" id="pxc${s}"><div class="n"><b>$${s}</b><span>${sub}</span></div><div class="p" id="pxp${s}">--</div><div class="c" id="pxd${s}">--</div><div class="x" id="pxx${s}"></div><canvas id="pxs${s}"></canvas></div>`).join("");
  }
  const sessName = s => s === "pre" ? "Pre-market" : s === "post" ? "After-hours" : s === "overnight" ? "Overnight" : "Extended";
  function renderCards() {
    for (const [s] of SY) {
      const q = quote(s), el = $("pxc" + s); if (!el) continue;
      if (!q) { $("pxp" + s).textContent = "--"; continue; }
      const pe = $("pxp" + s); pe.textContent = fmtPx(q.p);
      if (last[s] && q.p !== last[s]) { pe.classList.remove("fu", "fd"); pe.classList.add(q.p > last[s] ? "fu" : "fd"); clearTimeout(flash[s]); flash[s] = setTimeout(() => pe.classList.remove("fu", "fd"), 900); }
      last[s] = q.p;
      el.classList.toggle("pu", q.day > 0); el.classList.toggle("pd", q.day < 0);
      $("pxd" + s).innerHTML = isFinite(q.day) ? `<span class="${q.day >= 0 ? "up" : "down"}">${q.dCh >= 0 ? "+" : "−"}${Math.abs(q.dCh).toFixed(2)} (${fmtPct(q.day, 2)})</span> <span class="sub hm">vs prior close</span>` : "--";
      $("pxx" + s).innerHTML = q.ext && isFinite(q.x) ? `${sessName(q.sess)}: <b class="${q.x >= 0 ? "up" : "down"}">${fmtPct(q.x, 2)}</b> vs ${fmtPx(q.rc)} close` : phaseAt(Date.now()) === "regular" ? "Regular session · <span class=\"hm\">live</span>" : "";
      spark(s);
    }
  }
  function spark(s) {
    const cv = $("pxs" + s), d = DATA[s]; if (!cv || !d || d.bars.length < 2) return;
    const W = cv.clientWidth, H = cv.clientHeight, r = window.devicePixelRatio || 1; if (!W) return;
    cv.width = W * r; cv.height = H * r; const g = cv.getContext("2d"); g.setTransform(r, 0, 0, r, 0, 0);
    const day = etDay(d.bars[d.bars.length - 1][0]), B = d.bars.filter(b => etDay(b[0]) === day), c = B.map(b => b[4]);
    if (c.length < 2) return; const lo = Math.min(...c, d.pc || Infinity), hi = Math.max(...c, d.pc || -Infinity);
    const X = i => i / (c.length - 1) * W, Y = v => H - 2 - (v - lo) / ((hi - lo) || 1) * (H - 4);
    if (d.pc > 0) { g.strokeStyle = col("--mute"); g.setLineDash([2, 3]); g.beginPath(); g.moveTo(0, Y(d.pc)); g.lineTo(W, Y(d.pc)); g.stroke(); g.setLineDash([]); }
    g.strokeStyle = c[c.length - 1] >= (d.pc || c[0]) ? col("--up") : col("--down"); g.lineWidth = 1.4; g.beginPath(); c.forEach((v, i) => i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))); g.stroke();
  }

  // ---------- charts ----------
  const DATA = {}; let range = lsGet("soxx_trio_rng") || "1d", open = lsGet("soxx_trio") !== "closed", loadAt = 0, loadErr = "";
  async function load() {
    loadAt = Date.now();
    if (demo) { loadErr = ""; SY.forEach(([s], i) => { if (!DATA[s] || DATA[s].demo !== range) DATA[s] = demoBars(s, i); }); return; }
    const p = fredProxy(); if (!p) { loadErr = "Add the Worker URL to load charts."; return; }
    const iv = range === "5d" ? "5m" : "1m";
    await Promise.all(SY.map(async ([s]) => {
      try {
        const j = await (await fetch(`${p}/chart?t=${s}&range=${range}&interval=${iv}`)).json();
        if (j.status !== "ok") throw new Error(j.error || "chart error");
        const bars = j.bars.filter(b => b[4] != null);
        DATA[s] = { bars, pc: j.meta && j.meta.prevClose, at: Date.now(), rng: range };
        loadErr = "";
      } catch (e) { loadErr = "Charts: the Worker /chart did not answer."; }
    }));
  }
  function demoBars(s, i) {
    const n = 390, B = [], now = Date.now(), base = Q[s] && Q[s].c > 0 ? Q[s].c : [60, 300, 20][i]; let p = base;
    for (let k = n - 1; k >= 0; k--) { const o = p / (1 + (Math.random() - 0.5) * 0.004 * (i === 1 ? 0.4 : 1)); B.unshift([now - k * 60000, o, Math.max(o, p), Math.min(o, p), p, 1000]); p = o; }
    return { bars: B, pc: B[0][4], demo: range };
  }
  function liveAppend() {
    for (const [s] of SY) {
      const d = DATA[s], q = Q[s]; if (!d || !d.bars.length || !q || !(q.c > 0)) continue;
      const step = range === "5d" ? 300000 : 60000, t = Math.floor(Date.now() / step) * step, L = d.bars[d.bars.length - 1];
      if (t === L[0]) { L[2] = Math.max(L[2], q.c); L[3] = Math.min(L[3], q.c); L[4] = q.c; }
      else if (t > L[0] && t - L[0] < 4 * 3600000) d.bars.push([t, L[4], Math.max(L[4], q.c), Math.min(L[4], q.c), q.c, 0]);
    }
  }
  const HV = {};
  function draw(s) {
    const cv = $("trc" + s), d = DATA[s]; if (!cv) return;
    const W = cv.clientWidth, H = cv.clientHeight, r = window.devicePixelRatio || 1; if (!W) return;
    cv.width = W * r; cv.height = H * r; const g = cv.getContext("2d"); g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, W, H);
    g.font = "10px JetBrains Mono, ui-monospace, Menlo, monospace";
    if (!d || d.bars.length < 2) { g.fillStyle = col("--dim"); g.fillText(loadErr || "Loading…", 8, 18); return; }
    const B = d.bars, n = B.length, ax = 48, top = 6, bot = H - 16;
    let lo = Math.min(...B.map(b => b[3])), hi = Math.max(...B.map(b => b[2])); if (d.pc > 0) { lo = Math.min(lo, d.pc); hi = Math.max(hi, d.pc); }
    const pad = (hi - lo) * 0.06 || hi * 0.01; lo -= pad; hi += pad;
    const X = i => (i + 0.5) * (W - ax) / n, Y = v => top + (hi - v) / (hi - lo) * (bot - top);
    // extended-hours shading
    g.fillStyle = col("--line"); g.globalAlpha = 0.35;
    B.forEach((b, i) => { const m = etMin(b[0]); if (m < 570 || m >= 960) g.fillRect(X(i) - (W - ax) / n / 2, top, (W - ax) / n + 0.5, bot - top); }); g.globalAlpha = 1;
    // grid and axis
    g.strokeStyle = col("--line"); g.fillStyle = col("--mute"); g.lineWidth = 1;
    for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4, y = Y(v); g.globalAlpha = 0.5; g.beginPath(); g.moveTo(0, y); g.lineTo(W - ax, y); g.stroke(); g.globalAlpha = 1; g.fillText(v.toFixed(2), W - ax + 4, y + 3); }
    // prior close
    if (d.pc > 0) { const y = Y(d.pc); g.strokeStyle = col("--amber"); g.setLineDash([4, 4]); g.beginPath(); g.moveTo(0, y); g.lineTo(W - ax, y); g.stroke(); g.setLineDash([]); g.fillStyle = col("--amber"); g.fillText("prior close", 4, y - 3); }
    // price line with area
    const lastP = B[n - 1][4], upc = lastP >= (d.pc || B[0][4]), lc = upc ? col("--up") : col("--down");
    g.beginPath(); B.forEach((b, i) => i ? g.lineTo(X(i), Y(b[4])) : g.moveTo(X(i), Y(b[4])));
    g.strokeStyle = lc; g.lineWidth = 1.5; g.stroke();
    g.lineTo(X(n - 1), bot); g.lineTo(X(0), bot); g.closePath(); const gr = g.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, lc + "33"); gr.addColorStop(1, lc + "00"); g.fillStyle = gr; g.fill();
    // VWAP of the regular session of the last day
    const day = etDay(B[n - 1][0]); let pv = 0, vv = 0; g.beginPath(); let stt = false;
    B.forEach((b, i) => { const m = etMin(b[0]); if (etDay(b[0]) !== day || m < 570 || m >= 960 || !b[5]) return; const tp = (b[2] + b[3] + b[4]) / 3; pv += tp * b[5]; vv += b[5]; const y = Y(pv / vv); stt ? g.lineTo(X(i), y) : g.moveTo(X(i), y); stt = true; });
    if (stt) { g.strokeStyle = col("--violet"); g.lineWidth = 1; g.globalAlpha = 0.8; g.stroke(); g.globalAlpha = 1; }
    // last price tag
    const y = Y(lastP); g.fillStyle = lc; g.fillRect(W - ax, y - 7, ax, 14); g.fillStyle = col("--bg"); g.fillText(lastP.toFixed(2), W - ax + 4, y + 3);
    g.beginPath(); g.arc(X(n - 1), y, 2.5, 0, 7); g.fillStyle = lc; g.fill();
    // time labels
    g.fillStyle = col("--mute"); g.textAlign = "center"; const stp = Math.max(1, Math.round(n / 4));
    for (let i = 0; i < n; i += stp) g.fillText(new Date(B[i][0]).toLocaleString("en-US", range === "5d" ? { timeZone: "America/New_York", weekday: "short" } : { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }), X(i), H - 3);
    g.textAlign = "left"; HV[s] = { B, X, n, ax, W };
    const chg = d.pc > 0 ? lastP / d.pc - 1 : NaN;
    $("trh" + s).innerHTML = `<b>$${s}</b> <span>${fmtPx(lastP)} <b class="${chg >= 0 ? "up" : "down"}">${isFinite(chg) ? fmtPct(chg, 2) : ""}</b></span>`;
  }
  function drawAll() { if (!open) return; SY.forEach(([s]) => draw(s)); }
  function shell() {
    chartCard.innerHTML = `<div class="trhd" id="trioHd"><div class="label">Charts · SOXL, SOXX and SOXS side by side</div><div class="row" id="trioCtl"></div></div><div id="trioBody">${SY.map(([s]) => `<div class="trc"><div class="h" id="trh${s}"><b>$${s}</b></div><div class="cw"><canvas id="trc${s}"></canvas><div class="tip" id="trt${s}"></div></div></div>`).join("")}</div><div class="sub" id="trioNote" style="margin-top:6px"></div>`;
    SY.forEach(([s]) => {
      const cv = $("trc" + s), tip = $("trt" + s);
      cv.addEventListener("mousemove", e => { const h = HV[s]; if (!h) return; const rc = cv.getBoundingClientRect(), x = e.clientX - rc.left, i = Math.floor(x / ((h.W - h.ax) / h.n)), b = h.B[i]; if (!b) { tip.style.display = "none"; return; }
        tip.textContent = `${new Date(b[0]).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" })} · ${fmtPx(b[4])}`; tip.style.display = "block"; });
      cv.addEventListener("mouseleave", () => tip.style.display = "none");
    });
    ctl();
  }
  function ctl() {
    $("trioCtl").innerHTML = (open ? [["1d", "1 day · 1m"], ["5d", "5 days · 5m"]].map(([k, l]) => `<button data-trr="${k}" class="${range === k ? "on" : ""}">${l}</button>`).join("") : "") + `<button id="trioTg">${open ? "Hide charts ▲" : "Show charts ▼"}</button>`;
    $("trioBody").classList.toggle("hide", !open);
    const a = loadAt ? Math.round((Date.now() - loadAt) / 1000) : null;
    $("trioNote").innerHTML = !open ? "" : loadErr ? `<span class="down">${esc(loadErr)}</span>` : `Shaded: pre-market, after-hours and overnight. Dashed: prior close. Violet: VWAP (regular session). Bars reload every minute${a != null ? ` (last ${a}s ago)` : ""}; the newest price is added live.`;
  }
  chartCard.addEventListener("click", async e => {
    const b = e.target.closest("[data-trr]"); if (b) { e.stopPropagation(); range = b.dataset.trr; lsSet("soxx_trio_rng", range); ctl(); await load(); drawAll(); return; }
    if (e.target.id === "trioTg" || e.target.closest(".trhd") && !e.target.closest("button")) { open = !open; lsSet("soxx_trio", open ? "open" : "closed"); ctl(); if (open) { if (Date.now() - loadAt > 55000) await load(); drawAll(); } }
  });
  window.addEventListener("resize", () => { drawAll(); renderCards(); });

  // ---------- max pain: options (SOXL and SOXS) and liquidations (tracked Hyperliquid wallets) ----------
  const MP = {}; let mpAt = 0, mpErr = "";
  async function loadMP() {
    mpAt = Date.now();
    if (demo) { MP.SOXL = { expiries: [{ exp: "Demo expiry", maxPain: 99, callOI: 134942, putOI: 123505, pcr: 0.92, callWall: 120, callWallOI: 22000, putWall: 70, putWallOI: 18000 }] }; MP.SOXS = { expiries: [{ exp: "Demo expiry", maxPain: 40.5, callOI: 30143, putOI: 19466, pcr: 0.65, callWall: 60, callWallOI: 5000, putWall: 30, putWallOI: 4000 }] }; return; }
    const p = fredProxy(); if (!p) return;
    for (const s of ["SOXL", "SOXS"]) {
      try { const j = await (await fetch(`${p}/maxpain?t=${s}`)).json(); if (j.status === "ok") { MP[s] = j; mpErr = ""; } else mpErr = j.error || "max pain error"; }
      catch (e) { mpErr = "The Worker has no /maxpain yet (deploy the new Worker code)."; }
    }
  }
  function nextExp(j) {
    // skip an expiry that already ended (after 4 pm ET on its day)
    const now = Date.now(), today = etDay(now), m = etMin(now);
    return (j.expiries || []).filter(e => { const d = Date.parse(e.exp + " 12:00 UTC"); if (!isFinite(d)) return true; const ds = new Date(d).toISOString().slice(0, 10); return ds > today || (ds === today && m < 960); });
  }
  function renderPain() {
    const el = $("painCard"); if (!el) return;
    const tile = (k, v, sub, c) => `<div class="st"><div class="k">${k}</div><div class="v ${c || ""}">${v}</div><div class="s">${sub || ""}</div></div>`;
    const opt = s => { const j = MP[s], q = Q[s], P = q && q.c > 0 ? q.c : NaN; if (!j) return tile(`${s} options max pain`, "--", mpErr ? esc(mpErr) : "loading…");
      const E = nextExp(j); if (!E.length) return tile(`${s} options max pain`, "--", "no open expiry");
      const e = E[0], e2 = E[1], d = isFinite(P) && e.maxPain ? e.maxPain / P - 1 : NaN;
      return tile(`${s} options max pain · ${esc(e.exp.replace(/, \d{4}$/, ""))}`, fmtPx(e.maxPain), `${isFinite(d) ? `${fmtPct(d, 1)} from ${fmtPx(P)} · ` : ""}${e2 ? `next ${esc(e2.exp.replace(/, \d{4}$/, ""))}: ${fmtPx(e2.maxPain)}` : ""}<br>Call wall ${fmtPx(e.callWall)} · put wall ${fmtPx(e.putWall)} · P/C ${e.pcr != null ? e.pcr.toFixed(2) : "--"}`, isFinite(d) ? (d > 0 ? "up" : "down") : ""); };
    const pn = window.wwPain ? window.wwPain() : null, U = x => { const a = Math.abs(x); return "$" + (a >= 1e6 ? (a / 1e6).toFixed(2) + "M" : Math.round(a / 1e3) + "K"); };
    const liq = (side) => { const x = pn && pn[side]; const lab = side === "long" ? "Longs' max pain (liquidations below)" : "Shorts' max pain (liquidations above)";
      return x ? tile(lab, fmtPx(x.p), `${U(x.usd)} of ${x.n} tracked ${side}${x.n > 1 ? "s" : ""} liquidate near here · ${fmtPct(x.d, 1)} away`, side === "long" ? "down" : "up") : tile(lab, "--", pn ? `no tracked ${side} liquidation within 40%` : "waiting for Hyperliquid"); };
    el.innerHTML = `<div class="toolbar" style="margin:0 0 8px"><div class="label" style="margin:0">Max pain · both sides</div><span class="sub">Options: open interest from Nasdaq (updates once a day). Liquidations: the tracked Hyperliquid wallets, live.</span></div>
      <div class="stiles">${liq("long")}${liq("short")}${opt("SOXL")}${opt("SOXS")}</div>
      <div class="sub" style="margin-top:6px">Options max pain: the strike where option buyers lose the most at that expiry; price often drifts toward it into expiry. A long liquidation cluster pulls price down when it is near (forced selling); a short cluster pulls price up (forced buying). SOXS moves opposite to SOXL.</div>`;
  }

  cards(); shell();
  loadMP().then(renderPain); setInterval(() => { try { if (Date.now() - mpAt > (Object.keys(MP).length ? 30 * 60000 : 15000)) loadMP().then(renderPain); else renderPain(); } catch (e) { } }, 5000);
  (async () => { await load(); renderCards(); drawAll(); ctl(); })();
  setInterval(() => { try { renderCards(); } catch (e) { } }, 1000);
  setInterval(() => { try { liveAppend(); drawAll(); ctl(); } catch (e) { } }, 5000);
  setInterval(async () => { try { const miss = SY.some(([x]) => !DATA[x]); if (miss ? Date.now() - loadAt > 8000 : Date.now() - loadAt > 58000) { await load(); drawAll(); renderCards(); } } catch (e) { } }, 4000);
})();
