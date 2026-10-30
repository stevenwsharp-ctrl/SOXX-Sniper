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
.pxc{display:flex;flex-direction:column}.pxc canvas{display:block;width:100%;flex:1 1 130px;min-height:120px;margin-top:4px;cursor:crosshair}
.pxtf{display:flex;gap:2px;margin-top:6px}.pxtf button{font:10px var(--mono);padding:2px 6px;border-radius:6px;border:1px solid var(--line);background:transparent;color:var(--dim);cursor:pointer}.pxtf button.on{border-color:var(--accent);color:var(--accent)}
.pxst{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3px 6px;margin-top:6px;font:10.5px var(--mono);color:var(--dim)}.pxst b{display:block;font-size:11.5px;font-weight:600}
.pxbar{grid-column:1/-1;display:flex;align-items:center;gap:6px}.pxbar i{flex:1;height:5px;border-radius:3px;background:linear-gradient(90deg,var(--down),var(--line) 50%,var(--up));position:relative;opacity:.8}.pxbar i u{position:absolute;top:-3px;width:3px;height:11px;border-radius:2px;background:var(--ink);transform:translateX(-50%)}
.pxtip{position:absolute;left:8px;right:8px;font:10.5px/1.4 var(--mono);background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:3px 7px;pointer-events:none;display:none;z-index:3;box-shadow:0 4px 14px rgba(0,0,0,.3)}
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
    box.innerHTML = SY.map(([s, sub]) => `<div class="pxc" id="pxc${s}"><div class="n"><b>$${s}</b><span>${sub}</span></div><div class="p" id="pxp${s}">--</div><div class="c" id="pxd${s}">--</div><div class="x" id="pxx${s}"></div>
      <div class="pxtf">${CRS.map(([k, l]) => `<button data-crg="${k}">${l}</button>`).join("")}</div><canvas id="pxs${s}"></canvas><div class="pxtip" id="pxtip${s}"></div><div class="pxst" id="pxst${s}"></div></div>`).join("");
    box.addEventListener("click", async e => { const b = e.target.closest("[data-crg]"); if (!b) return; CR = b.dataset.crg; lsSet("soxx_card_rng", CR); await loadCards(); renderCards(); });
    SY.forEach(([s]) => { const cv = $("pxs" + s), tp = $("pxtip" + s);
      cv.addEventListener("mousemove", e => { const h = CHV[s]; if (!h) return; const rc = cv.getBoundingClientRect(), x = e.clientX - rc.left, i = Math.max(0, Math.min(h.B.length - 1, Math.round(x / rc.width * (h.B.length - 1)))), b = h.B[i];
        const ch = b[4] / h.base - 1;
        tp.innerHTML = `<b>${fmtPx(b[4])}</b> <span class="${ch >= 0 ? "up" : "down"}">${fmtPct(ch, 2)}</span> vs ${h.baseLab}<br><span class="sub">${new Date(b[0]).toLocaleString("en-US", { timeZone: "America/New_York", ...(h.daily ? { month: "short", day: "numeric", year: "numeric" } : { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) })} ET${b[5] ? " · vol " + (b[5] >= 1e6 ? (b[5] / 1e6).toFixed(1) + "M" : Math.round(b[5] / 1e3) + "K") : ""}</span>`;
        tp.style.display = "block"; tp.style.top = Math.max(0, cv.offsetTop - tp.offsetHeight - 2) + "px"; });
      cv.addEventListener("mouseleave", () => tp.style.display = "none"); });
  }
  // ---------- card charts: 1D / 5D / 1M / 6M / 1Y, and the stats strip ----------
  const CRS = [["1d", "1D"], ["5d", "5D"], ["1mo", "1M"], ["6mo", "6M"], ["1y", "1Y"]], CIV = { "1d": "1m", "5d": "5m", "1mo": "30m", "6mo": "1d", "1y": "1d" }, CTTL = { "1d": 6e4, "5d": 12e4, "1mo": 6e5, "6mo": 36e5, "1y": 36e5 };
  let CR = lsGet("soxx_card_rng") || "1d"; const CD = {}, CHV = {};
  async function getC(s, rng) {
    const k = s + "|" + rng, c = CD[k]; if (c && Date.now() - c.at < CTTL[rng]) return c;
    if (demo) { const d = demoBars(s, SY.findIndex(x => x[0] === s)); return CD[k] = { bars: d.bars, pc: d.pc, at: Date.now() }; }
    const p = fredProxy(); if (!p) return c || null;
    try { const j = await (await fetch(`${p}/chart?t=${s}&range=${rng}&interval=${CIV[rng]}`)).json(); if (j.status === "ok") return CD[k] = { bars: j.bars.filter(b => b[4] != null), pc: j.meta && j.meta.prevClose, at: Date.now() }; } catch (e) { }
    return c || null;
  }
  async function loadCards() { await Promise.all(SY.flatMap(([s]) => [getC(s, CR), getC(s, "1y"), getC(s, "1d")])); }
  function stats(s, P) {
    const y = CD[s + "|1y"]; if (!y || y.bars.length < 30 || !(P > 0)) return "";
    const B = y.bars, C = B.map(b => b[4]), n = C.length, ch = k => n > k ? P / C[n - 1 - k] - 1 : NaN;
    const r = C.slice(-61).map((c, i, a) => i ? c / a[i - 1] - 1 : NaN).filter(isFinite), sd = Math.sqrt(r.reduce((a, x) => a + x * x, 0) / Math.max(1, r.length));
    const q = Q[s], day = q && q.pc > 0 ? P / q.pc - 1 : NaN, hi52 = Math.max(...B.map(b => b[2]), P), lo52 = Math.min(...B.map(b => b[3]), P);
    // today's regular-session high / low from today's 1-minute bars (the quote's high / low can be stale)
    let dh = NaN, dl = NaN; { const d1 = CD[s + "|1d"]; if (d1 && d1.bars.length) { const day = etDay(d1.bars[d1.bars.length - 1][0]), R = d1.bars.filter(b => etDay(b[0]) === day && etMin(b[0]) >= 570 && etMin(b[0]) < 960);
      if (R.length) { dh = Math.max(...R.map(b => b[2])); dl = Math.min(...R.map(b => b[3])); } } }
    if (!isFinite(dh) && q && q.h > 0) { dh = q.h; dl = q.l; }
    if (phaseAt(Date.now()) === "regular") { dh = Math.max(dh, P); dl = Math.min(dl, P); }
    const c = v => !isFinite(v) ? "" : v >= 0 ? "up" : "down", f = v => isFinite(v) ? fmtPct(v, 1) : "--", pos = (v, a, b) => b > a ? Math.max(0, Math.min(100, (v - a) / (b - a) * 100)) : 50;
    return `<div><span>5D</span><b class="${c(ch(5))}">${f(ch(5))}</b></div><div><span>1M</span><b class="${c(ch(21))}">${f(ch(21))}</b></div><div><span>3M</span><b class="${c(ch(63))}">${f(ch(63))}</b></div><div><span>1Y</span><b class="${c(P / C[0] - 1)}">${f(P / C[0] - 1)}</b></div>
      <div class="pxbar" title="Today's range: low ${fmtPx(dl)} – high ${fmtPx(dh)}"><span>Day</span><i><u style="left:${pos(P, dl, dh)}%"></u></i><span>${isFinite(dl) ? dl.toFixed(2) + "–" + dh.toFixed(2) : "--"}</span></div>
      <div class="pxbar" title="52-week range: ${fmtPx(lo52)} – ${fmtPx(hi52)}"><span>52W</span><i><u style="left:${pos(P, lo52, hi52)}%"></u></i><span>${fmtPct(P / hi52 - 1, 0)} from high</span></div>
      <div style="grid-column:1/-1">Normal day ±${(sd * 100).toFixed(1)}% · today <b style="display:inline" class="${Math.abs(day) >= 2 * sd ? (day < 0 ? "down" : "up") : ""}">${isFinite(day) && sd ? (day / sd).toFixed(1) + "σ" : "--"}</b>${Math.abs(day) >= 3 * sd ? " · rare move" : Math.abs(day) >= 2 * sd ? " · big move" : ""}</div>`;
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
    document.querySelectorAll("#pxc" + s + " [data-crg]").forEach(b => b.classList.toggle("on", b.dataset.crg === CR));
    const cv = $("pxs" + s), d = CD[s + "|" + CR], q = Q[s], P = q && q.c > 0 ? q.c : NaN; const stEl = $("pxst" + s); if (stEl) stEl.innerHTML = stats(s, P);
    if (!cv || !d || d.bars.length < 2) return;
    const W = cv.clientWidth, H = cv.clientHeight, r = window.devicePixelRatio || 1; if (!W || !H) return;
    cv.width = W * r; cv.height = H * r; const g = cv.getContext("2d"); g.setTransform(r, 0, 0, r, 0, 0); g.font = "9px JetBrains Mono, ui-monospace, monospace";
    let B = d.bars.slice(); const daily = CIV[CR] === "1d";
    if (CR === "1d") { const day = etDay(B[B.length - 1][0]); B = B.filter(b => etDay(b[0]) === day); }
    if (P > 0 && B.length) { const L = B[B.length - 1]; if (daily || Date.now() - L[0] < 36e5) B[B.length - 1] = [L[0], L[1], Math.max(L[2], P), Math.min(L[3], P), P, L[5]]; }
    if (B.length < 2) return;
    const base = CR === "1d" && d.pc > 0 ? d.pc : B[0][1] || B[0][4], baseLab = CR === "1d" ? "prior close" : CRS.find(x => x[0] === CR)[1] + " start";
    const vb = H * 0.2, top = 10, bot = H - vb - 4, c = B.map(b => b[4]); let lo = Math.min(...B.map(b => b[3]), base), hi = Math.max(...B.map(b => b[2]), base);
    const X = i => 2 + i / (B.length - 1) * (W - 4), Y = v => top + (hi - v) / ((hi - lo) || 1) * (bot - top);
    // pre-market / after-hours shading (intraday only)
    if (!daily) { g.fillStyle = col("--line"); g.globalAlpha = 0.3; const bw = (W - 4) / (B.length - 1); B.forEach((b, i) => { const m = etMin(b[0]); if (m < 570 || m >= 960) g.fillRect(X(i) - bw / 2, top, bw + 0.5, bot - top); }); g.globalAlpha = 1; }
    // volume
    const vmax = Math.max(...B.map(b => b[5] || 0)); if (vmax > 0) { const bw = Math.max(1, (W - 4) / B.length - 0.5); B.forEach((b, i) => { if (!b[5]) return; g.fillStyle = (b[4] >= b[1] ? col("--up") : col("--down")); g.globalAlpha = 0.35; const h = b[5] / vmax * vb; g.fillRect(X(i) - bw / 2, H - h, bw, h); }); g.globalAlpha = 1; }
    // base line
    g.strokeStyle = col("--amber"); g.globalAlpha = 0.7; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(0, Y(base)); g.lineTo(W, Y(base)); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    // area + line
    const lc = c[c.length - 1] >= base ? col("--up") : col("--down");
    g.beginPath(); c.forEach((v, i) => i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))); g.strokeStyle = lc; g.lineWidth = 1.5; g.stroke();
    g.lineTo(X(c.length - 1), bot); g.lineTo(X(0), bot); g.closePath(); const gr = g.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, lc + "40"); gr.addColorStop(1, lc + "00"); g.fillStyle = gr; g.fill();
    // high / low labels
    const ih = B.reduce((m, b, i) => b[2] > B[m][2] ? i : m, 0), il = B.reduce((m, b, i) => b[3] < B[m][3] ? i : m, 0);
    const lab = (i, v, up) => { const x = Math.max(18, Math.min(W - 18, X(i))), y = Y(v); g.fillStyle = col("--dim"); g.textAlign = "center"; g.fillText(v.toFixed(2), x, up ? y - 3 : y + 10); g.textAlign = "left"; };
    lab(ih, B[ih][2], true); lab(il, B[il][3], false);
    g.fillStyle = col("--amber"); g.fillText(`${baseLab} ${base.toFixed(2)} · ${fmtPct(c[c.length - 1] / base - 1, 1)}`, 2, Math.min(bot - 2, Math.max(top + 8, Y(base) - 3)));
    g.beginPath(); g.arc(X(c.length - 1), Y(c[c.length - 1]), 2.5, 0, 7); g.fillStyle = lc; g.fill();
    CHV[s] = { B, base, baseLab, daily };
  }

  // ---------- charts ----------
  const DATA = {}; let range = lsGet("soxx_trio_rng") || "1d", open = lsGet("soxx_trio") !== "closed", loadAt = 0, loadErr = "";
  async function load() {
    loadAt = Date.now();
    if (demo) { loadErr = ""; SY.forEach(([s], i) => { if (!DATA[s] || DATA[s].demo !== range) DATA[s] = demoBars(s, i); }); return; }
    const p = fredProxy(); if (!p) { loadErr = "Add the Worker URL to load charts."; return; }
    const iv = CIV[range] || "1m";
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
      if (range !== "1d" && range !== "5d") continue;
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
    const daily = CIV[range] === "1d", intra = range === "1d" || range === "5d" || range === "1mo";
    // extended-hours shading
    if (intra) { g.fillStyle = col("--line"); g.globalAlpha = 0.35;
      B.forEach((b, i) => { const m = etMin(b[0]); if (m < 570 || m >= 960) g.fillRect(X(i) - (W - ax) / n / 2, top, (W - ax) / n + 0.5, bot - top); }); g.globalAlpha = 1; }
    // volume (bottom 18%)
    const vmx = Math.max(...B.map(b => b[5] || 0)); if (vmx > 0) { const bw = Math.max(1, (W - ax) / n - 0.6); B.forEach((b, i) => { if (!b[5]) return; const h = b[5] / vmx * (bot - top) * 0.18; g.fillStyle = b[4] >= b[1] ? col("--up") : col("--down"); g.globalAlpha = 0.3; g.fillRect(X(i) - bw / 2, bot - h, bw, h); }); g.globalAlpha = 1; }
    // grid and axis
    g.strokeStyle = col("--line"); g.fillStyle = col("--mute"); g.lineWidth = 1;
    for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4, y = Y(v); g.globalAlpha = 0.5; g.beginPath(); g.moveTo(0, y); g.lineTo(W - ax, y); g.stroke(); g.globalAlpha = 1; g.fillText(v.toFixed(2), W - ax + 4, y + 3); }
    // prior close
    if (d.pc > 0) { const y = Y(d.pc); g.strokeStyle = col("--amber"); g.setLineDash([4, 4]); g.beginPath(); g.moveTo(0, y); g.lineTo(W - ax, y); g.stroke(); g.setLineDash([]); g.fillStyle = col("--amber"); g.fillText("prior close", 4, y - 3); }
    // price: candles for daily bars, line with area for intraday
    const lastP = B[n - 1][4], upc = lastP >= (range === "1d" && d.pc ? d.pc : B[0][4]), lc = upc ? col("--up") : col("--down");
    if (daily || n <= 160) { const bw = Math.max(1, (W - ax) / n * 0.65); B.forEach((b, i) => { const cu = b[4] >= b[1], cc = cu ? col("--up") : col("--down"); g.strokeStyle = cc; g.fillStyle = cc; g.beginPath(); g.moveTo(X(i), Y(b[2])); g.lineTo(X(i), Y(b[3])); g.stroke(); const y1 = Y(Math.max(b[1], b[4])), y2 = Y(Math.min(b[1], b[4])); g.fillRect(X(i) - bw / 2, y1, bw, Math.max(1, y2 - y1)); }); }
    else { g.beginPath(); B.forEach((b, i) => i ? g.lineTo(X(i), Y(b[4])) : g.moveTo(X(i), Y(b[4])));
      g.strokeStyle = lc; g.lineWidth = 1.5; g.stroke();
      g.lineTo(X(n - 1), bot); g.lineTo(X(0), bot); g.closePath(); const gr = g.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, lc + "33"); gr.addColorStop(1, lc + "00"); g.fillStyle = gr; g.fill(); g.lineWidth = 1; }
    { const ih = B.reduce((m, b, i) => b[2] > B[m][2] ? i : m, 0), il = B.reduce((m, b, i) => b[3] < B[m][3] ? i : m, 0); g.fillStyle = col("--dim"); g.textAlign = "center";
      g.fillText("H " + B[ih][2].toFixed(2), Math.max(24, Math.min(W - ax - 24, X(ih))), Y(B[ih][2]) - 3); g.fillText("L " + B[il][3].toFixed(2), Math.max(24, Math.min(W - ax - 24, X(il))), Y(B[il][3]) + 11); g.textAlign = "left"; }
    // VWAP of the regular session of the last day
    const day = etDay(B[n - 1][0]); let pv = 0, vv = 0; g.beginPath(); let stt = false; if (!intra || range === "1mo") { pv = NaN; }
    B.forEach((b, i) => { const m = etMin(b[0]); if (!isFinite(pv) || etDay(b[0]) !== day || m < 570 || m >= 960 || !b[5]) return; const tp = (b[2] + b[3] + b[4]) / 3; pv += tp * b[5]; vv += b[5]; const y = Y(pv / vv); stt ? g.lineTo(X(i), y) : g.moveTo(X(i), y); stt = true; });
    if (stt) { g.strokeStyle = col("--violet"); g.lineWidth = 1; g.globalAlpha = 0.8; g.stroke(); g.globalAlpha = 1; }
    // last price tag
    const y = Y(lastP); g.fillStyle = lc; g.fillRect(W - ax, y - 7, ax, 14); g.fillStyle = col("--bg"); g.fillText(lastP.toFixed(2), W - ax + 4, y + 3);
    g.beginPath(); g.arc(X(n - 1), y, 2.5, 0, 7); g.fillStyle = lc; g.fill();
    // time labels
    g.fillStyle = col("--mute"); g.textAlign = "center"; const stp = Math.max(1, Math.round(n / 4));
    for (let i = 0; i < n; i += stp) g.fillText(new Date(B[i][0]).toLocaleString("en-US", daily || range === "1mo" ? { timeZone: "America/New_York", month: "short", day: "numeric" } : range === "5d" ? { timeZone: "America/New_York", weekday: "short" } : { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }), X(i), H - 3);
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
    $("trioCtl").innerHTML = (open ? [["1d", "1 day · 1m"], ["5d", "5 days · 5m"], ["1mo", "1 month · 30m"], ["6mo", "6 months · daily"], ["1y", "1 year · daily"]].map(([k, l]) => `<button data-trr="${k}" class="${range === k ? "on" : ""}">${l}</button>`).join("") : "") + `<button id="trioTg">${open ? "Hide charts ▲" : "Show charts ▼"}</button>`;
    $("trioBody").classList.toggle("hide", !open);
    const a = loadAt ? Math.round((Date.now() - loadAt) / 1000) : null;
    $("trioNote").innerHTML = !open ? "" : loadErr ? `<span class="down">${esc(loadErr)}</span>` : `Shaded: pre-market, after-hours and overnight. Dashed: prior close. Violet: VWAP (regular session). Bottom bars: volume. H / L: high and low of the range. Bars reload every minute${a != null ? ` (last ${a}s ago)` : ""}; the newest price is added live.`;
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
  (async () => { await Promise.all([load(), loadCards()]); renderCards(); drawAll(); ctl(); })();
  setInterval(async () => { try { await loadCards(); } catch (e) { } }, 30000);
  setInterval(() => { try { renderCards(); } catch (e) { } }, 1000);
  setInterval(() => { try { liveAppend(); drawAll(); ctl(); } catch (e) { } }, 5000);
  setInterval(async () => { try { const miss = SY.some(([x]) => !DATA[x]); if (miss ? Date.now() - loadAt > 8000 : Date.now() - loadAt > 58000) { await load(); drawAll(); renderCards(); } } catch (e) { } }, 4000);
})();
