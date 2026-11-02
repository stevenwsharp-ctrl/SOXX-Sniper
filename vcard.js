/* SOXX Sniper · Volume flow card: LETF Sniper's chart (candles, volume profile with POC / value area / HVN / LVN, VWAP ±σ,
   EMA 9/21, volume) for SOXL, SOXS and SOXX, with 9 time frames and an extended-hours switch, plus the volume reading
   (vflow.js). Every 5 minutes the volume reading of all three funds, intraday (5 days, 5-minute bars) and daily (1 year),
   goes to the signal web as vol.* (intraday) and vold.* (daily) nodes; window.VOLSIG feeds the Sniper read.
   Data: the Worker's /chart (Yahoo, extended hours included on intraday bars). Uses: VFlow, Web, Q, fredProxy. */
(function () {
  "use strict";
  const anchor = document.getElementById("trioCard"); if (!anchor || !window.VFlow) return;
  const card = document.createElement("section"); card.className = "card"; card.id = "volCard"; card.style.marginBottom = "12px";
  anchor.after(card);
  const SY = ["SOXL", "SOXS", "SOXX", "QQQ"], VV = [["1d", "1D · 1m", "1d", "1m"], ["5d", "5D · 5m", "5d", "5m"], ["1mo", "1M · 30m", "1mo", "30m"], ["3mo", "3M · 1h", "3mo", "60m"], ["6mo", "6M · day", "6mo", "1d"], ["ytd", "YTD · day", "1y", "1d"], ["1y", "1Y · day", "1y", "1d"], ["2y", "2Y · day", "2y", "1d"], ["5y", "5Y · week", "5y", "1wk"]];
  const lsG = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const O = Object.assign({ sym: "SOXL", view: "5d", vp: true, vwap: true, ema: true, ext: true }, lsG("soxx_vf", {})), save = () => lsS("soxx_vf", O);
  const daily = v => ["6mo", "ytd", "1y", "2y", "5y"].includes(v), C = {};   // C[sym|view] = { at, bars, err }
  const st = document.createElement("style");
  st.textContent = `#volCard .vfbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}#volCard .vfbar button{font:12px var(--mono);padding:3px 9px;border-radius:7px;border:1px solid var(--line);background:transparent;color:var(--dim);cursor:pointer}
    #volCard .vfbar button.on{color:var(--ink);border-color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,transparent)}#volCard .vfsep{width:1px;height:18px;background:var(--line);margin:0 2px}
    #volCard .vfwrap{position:relative;height:440px}#volCard .vftip{position:absolute;top:6px;left:8px;display:none;font:11.5px var(--mono);background:var(--panel2);border:1px solid var(--line);border-radius:7px;padding:3px 8px;color:var(--ink);pointer-events:none;white-space:nowrap}
    #volCard .vfleg{display:flex;flex-wrap:wrap;gap:4px 14px;font:11px var(--mono);color:var(--dim);margin:6px 0}#volCard .vfleg i{display:inline-block;width:10px;height:3px;margin-right:5px;vertical-align:middle}
    @media(max-width:640px){#volCard .vfwrap{height:340px}}`;
  document.head.appendChild(st);
  const bars = async (s, r, i) => { const p = typeof fredProxy === "function" ? fredProxy() : ""; if (!p) return { err: "Add the Worker URL in Settings" };
    try { const j = await (await fetch(`${p}/chart?t=${s}&range=${r}&interval=${i}`)).json(); if (j.status !== "ok") return { err: j.error || "chart error" };
      return { bars: (j.bars || []).filter(b => b[1] != null && b[2] != null && b[3] != null && b[4] != null).map(b => [b[0], b[1], b[2], b[3], b[4], b[5] || 0]) }; } catch (e) { return { err: "The Worker did not answer /chart" }; } };
  async function load(s, v, force) {
    const k = s + "|" + v, x = C[k], V = VV.find(q => q[0] === v), ttl = daily(v) ? 30 * 6e4 : v === "1d" ? 6e4 : 5 * 6e4; if (!force && x && Date.now() - x.at < ttl) return x;
    let r = await bars(s, V[2], V[3]); if (v === "5y" && (!r.bars || r.bars.length < 30)) r = await bars(s, "2y", "1wk");   // older Worker: no 5y range
    return C[k] = { at: Date.now(), bars: r.bars || (x && x.bars) || null, err: r.err || "" };
  }
  function view(s, v) { const x = C[s + "|" + v]; if (!x || !x.bars) return null; let B = x.bars;
    if (v === "ytd") { const t0 = Date.UTC(new Date().getFullYear(), 0, 1), Y = B.filter(b => b[0] >= t0); B = Y.length >= 5 ? Y : B.slice(-20); }
    if (!daily(v) && !O.ext) { const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23" }), R = B.filter(b => { const p = f.formatToParts(new Date(b[0])), m = +p.find(q => q.type === "hour").value * 60 + +p.find(q => q.type === "minute").value; return m >= 570 && m < 960; }); if (R.length >= 10) B = R; }
    if (v === "1d") { const day = new Date(B[B.length - 1][0]).toLocaleDateString("en-CA", { timeZone: "America/New_York" }), T = B.filter(b => new Date(b[0]).toLocaleDateString("en-CA", { timeZone: "America/New_York" }) === day); if (T.length >= 15) B = T; }
    return B; }
  let H = null;
  function render() {
    const s = O.sym, v = O.view, B = view(s, v), px = typeof Q === "object" && Q[s] && Q[s].c > 0 ? Q[s].c : null, A = B && B.length >= 40 ? VFlow.analyze(B, { px }) : null;
    card.innerHTML = `<div class="label">Volume flow · candles, volume profile, VWAP and the volume reading</div>
      <div class="vfbar">${SY.map(x => `<button data-vfs="${x}" class="${x === s ? "on" : ""}">${x}</button>`).join("")}<span class="vfsep"></span>${VV.map(([k, l]) => `<button data-vfv="${k}" class="${k === v ? "on" : ""}">${l}</button>`).join("")}</div>
      <div class="vfbar">${[["vp", "Volume profile"], ["vwap", "VWAP ±σ"], ["ema", "EMA 9/21"]].map(([k, l]) => `<button data-vfo="${k}" class="${O[k] ? "on" : ""}">${l}</button>`).join("")}${daily(v) ? "" : `<button data-vfo="ext" class="${O.ext ? "on" : ""}" title="Show pre-market (4:00–9:30 ET) and after-hours (4:00–8:00 pm ET) bars">Ext. hours</button>`}</div>
      <div class="vfwrap"><canvas></canvas><div class="vftip"></div></div>
      <div class="vfleg">${O.vp ? `<span><i style="background:var(--accent)"></i>value area (70% of volume) · POC = most traded price</span><span><i style="background:var(--violet,#9b6bff)"></i>HVN: high volume, a floor or ceiling</span><span><i style="background:var(--amber)"></i>LVN: thin, price moves fast</span>` : ""}${O.vwap && !daily(v) ? `<span><i style="background:var(--amber)"></i>VWAP ±1σ ±2σ</span>` : ""}${O.ema ? `<span><i style="background:var(--up)"></i>EMA 9</span><span><i style="background:var(--down)"></i>EMA 21</span>` : ""}${!daily(v) && O.ext ? `<span>shaded = extended hours</span>` : ""}</div>
      <div id="vfRead">${A ? VFlow.html(A, `${s}, ${VV.find(q => q[0] === v)[1]}`) : ""}</div>`;
    const cv = card.querySelector("canvas"), x = C[s + "|" + v];
    H = VFlow.draw(cv, B, { px, vp: O.vp, vwap: O.vwap && !daily(v), ema: O.ema, err: x && x.err });
    const tip = card.querySelector(".vftip");
    cv.onmousemove = e => { if (!H) return; const r = cv.getBoundingClientRect(), xx = e.clientX - r.left, i = Math.floor((xx - H.pl) / ((H.pr - H.pl) / H.n)), b = H.B[i]; if (!b) { tip.style.display = "none"; return; }
      const t = new Date(b[0]).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: daily(v) ? "numeric" : undefined, hour: daily(v) ? undefined : "numeric", minute: daily(v) ? undefined : "2-digit" }), w = H.vw && H.vw[i], f = q => q >= 100 ? q.toFixed(2) : q.toFixed(3), vol = b[5] >= 1e6 ? (b[5] / 1e6).toFixed(1) + "M" : b[5] >= 1e3 ? (b[5] / 1e3).toFixed(1) + "K" : b[5];
      tip.innerHTML = `${t} · O ${f(b[1])} H ${f(b[2])} L ${f(b[3])} C <b>${f(b[4])}</b> · V ${vol}${w && !daily(v) ? ` · VWAP ${f(w[0])}` : ""}`; tip.style.display = "block"; tip.style.left = Math.min(Math.max(4, xx - 160), r.width - tip.offsetWidth - 4) + "px"; };
    cv.onmouseleave = () => { tip.style.display = "none"; };
  }
  card.addEventListener("click", async e => { const a = e.target.closest("[data-vfs]"), b = e.target.closest("[data-vfv]"), c = e.target.closest("[data-vfo]");
    if (a) O.sym = a.dataset.vfs; else if (b) O.view = b.dataset.vfv; else if (c) O[c.dataset.vfo] = !O[c.dataset.vfo]; else return;
    save(); render(); await load(O.sym, O.view); render(); });
  window.addEventListener("resize", () => { clearTimeout(render.t); render.t = setTimeout(render, 150); });
  // the volume reading of all three funds, intraday and daily, to the signal web
  async function signals() {
    if (document.hidden) return; const out = [];
    for (const s of SY) for (const [v, pre, lab] of [["5d", "vol.", "Volume"], ["1y", "vold.", "Volume (daily)"]]) {
      await load(s, v); const B = view(s, v); if (!B || B.length < 40) continue; const A = VFlow.analyze(B);
      if (A) A.I.forEach(([id, val, l]) => { const nid = pre + id.split(".")[1], nl = l.replace("Volume ·", lab + " ·"); out.push([nid, s, val, nl]); try { if (window.Web) Web.emit(nid, s, val, nl); } catch (e) { } }); }
    window.VOLSIG = { at: Date.now(), I: out };
  }
  render(); load(O.sym, O.view).then(render);
  setTimeout(signals, 20000); setInterval(signals, 5 * 6e4);
  setInterval(() => { if (!document.hidden && (O.view === "1d" || O.view === "5d")) load(O.sym, O.view, true).then(render); }, 60000);
})();
