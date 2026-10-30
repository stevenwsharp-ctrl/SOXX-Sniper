/* SOXX Sniper · Game theory trend and track record
   Records the crowd-game score, run risk, squeeze risk and the SOXL price every minute while the page is open
   (pre-market, regular session and after-hours). Then it compares each prediction with what SOXL really did
   in the next 30 minutes, and learns from it:
   - hit rate and correlation of the prediction,
   - a learned slope (expected 30-minute move per point of score), so "expected next 30 min" improves with data,
   - the average result after each state (Cooperation, Standoff, Defection).
   Depends on globals from index.html: $, Q, FUND, renderGame, phaseAt, fmtPx, fmtPct, lsGet, lsSet, demo. */
(function () {
  "use strict";
  const host = $("gtTrend"); if (!host || typeof renderGame !== "function") return;
  const H = 30;                                   // minutes ahead that a prediction is checked
  let LOG = []; try { LOG = JSON.parse(lsGet("soxx_gtlog") || "[]") || []; } catch (e) { LOG = []; }
  let G = null, rng = lsGet("soxx_gtrng") || "1d", lastAt = 0;
  const orig = renderGame;
  // keep the newest game-theory read; the page calls renderGame with it
  renderGame = function (D) { try { if (D && D.GT) G = D.GT; } catch (e) { } return orig.apply(this, arguments); };

  const css = `
#gtTrend{margin-top:14px}
#gtTrend .gth{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
#gtTrend .gth .label{margin:0}
#gtTrend .gtc{position:relative;height:300px;margin-top:8px}
#gtTrend canvas{width:100%;height:100%;display:block}
#gtTrend .tip{position:absolute;top:2px;left:8px;font-family:var(--mono);font-size:11px;background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:3px 7px;display:none;pointer-events:none;white-space:nowrap;z-index:2}
#gtTrend .leg{display:flex;flex-wrap:wrap;gap:12px;font-family:var(--mono);font-size:11px;margin-top:6px;color:var(--dim)}
#gtTrend .leg i{display:inline-block;width:12px;height:3px;border-radius:2px;margin-right:5px;vertical-align:middle}
#gtCtl button{padding:4px 9px;font-size:11px}#gtCtl button.on{border-color:var(--accent);color:var(--accent)}
`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const col = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim();

  // prediction from the read: crowd score and the run/squeeze balance (−1 … +1)
  const pred = x => Math.max(-1, Math.min(1, 0.6 * x.s + 0.4 * (x.u - x.d) / 100));
  function record() {
    if (!G || !isFinite(G.coop) || demo) return;
    const P = Q[FUND] && Q[FUND].c, ph = phaseAt(Date.now()); if (!(P > 0) || ph === "closed") return;
    const t = Math.floor(Date.now() / 60000) * 60000; if (LOG.length && LOG[LOG.length - 1].t >= t) return;
    LOG.push({ t, p: +P.toFixed(4), s: +G.coop.toFixed(3), d: G.down, u: G.up });
    // keep 1-minute points for 3 days, then one point per 5 minutes, for 30 days
    const cut3 = Date.now() - 3 * 864e5, cut30 = Date.now() - 30 * 864e5;
    LOG = LOG.filter(x => x.t >= cut30 && (x.t >= cut3 || (x.t / 60000) % 5 === 0));
    try { lsSet("soxx_gtlog", JSON.stringify(LOG)); } catch (e) { LOG = LOG.slice(-6000); }
  }
  // pair each point with the price H minutes later (same session gap allowed up to H+5 min)
  function pairs() {
    const out = []; let j = 0;
    for (let i = 0; i < LOG.length; i++) {
      const a = LOG[i], tt = a.t + H * 60000; while (j < LOG.length && LOG[j].t < tt) j++;
      if (j >= LOG.length) break; const b = LOG[j]; if (b.t - tt > 5 * 60000) continue;
      out.push({ t: a.t, x: pred(a), y: b.p / a.p - 1, st: a.s >= 0.35 ? "C" : a.s <= -0.35 ? "D" : "S" });
    }
    return out;
  }
  function learn() {
    const P = pairs(), n = P.length; if (n < 30) return { n };
    const mx = P.reduce((s, p) => s + p.x, 0) / n, my = P.reduce((s, p) => s + p.y, 0) / n;
    let sxy = 0, sxx = 0, syy = 0; P.forEach(p => { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; });
    const corr = sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN, k = sxx ? sxy / sxx : 0;
    const strong = P.filter(p => Math.abs(p.x) >= 0.25), hit = strong.length ? strong.filter(p => Math.sign(p.y) === Math.sign(p.x)).length / strong.length : NaN;
    const by = {}; P.forEach(p => { const b = by[p.st] || (by[p.st] = { n: 0, y: 0, up: 0 }); b.n++; b.y += p.y; if (p.y > 0) b.up++; });
    // trust: shrink the learned slope when the sample is small (pairs overlap, so the real sample is smaller)
    const eff = n / H, trust = Math.min(1, eff / 40) * (isFinite(corr) && corr > 0 ? 1 : 0.5);
    return { n, corr, k, kUse: k * trust, hit, hitN: strong.length, by, trust };
  }
  window.gtLearn = learn;

  function draw() {
    const cv = $("gtCv"); if (!cv) return; const W = cv.clientWidth, Hh = cv.clientHeight, r = window.devicePixelRatio || 1; if (!W) return;
    cv.width = W * r; cv.height = Hh * r; const g = cv.getContext("2d"); g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, W, Hh);
    g.font = "10px JetBrains Mono, ui-monospace, Menlo, monospace";
    const span = rng === "5d" ? 5 * 864e5 : rng === "30d" ? 30 * 864e5 : 864e5;
    let L = LOG.filter(x => x.t >= Date.now() - span);
    if (rng === "1d" && L.length < 5) L = LOG.slice(-600);
    if (L.length < 3) { g.fillStyle = col("--dim"); g.fillText("Recording… the trend shows after a few minutes with live prices (pre-market, regular session or after-hours).", 8, 18); window.__gtH = null; return; }
    const Lr = learn(), pmap = new Map(pairs().map(p => [p.t, p]));
    const ax = 52, top = 6, mid = Math.round(Hh * 0.5), bot = Hh - 16, n = L.length;
    const X = i => (i + 0.5) * (W - ax) / n;
    // panel 1: SOXL price with background by state
    let lo = Math.min(...L.map(x => x.p)), hi = Math.max(...L.map(x => x.p)); const pad = (hi - lo) * 0.08 || hi * 0.005; lo -= pad; hi += pad;
    const Y1 = v => top + (hi - v) / (hi - lo) * (mid - 10 - top);
    L.forEach((x, i) => { g.fillStyle = x.s >= 0.35 ? col("--up") : x.s <= -0.35 ? col("--down") : "transparent"; if (g.fillStyle !== "transparent") { g.globalAlpha = 0.1; g.fillRect(X(i) - (W - ax) / n / 2, top, (W - ax) / n + 0.5, mid - 10 - top); g.globalAlpha = 1; } });
    g.strokeStyle = col("--ink"); g.lineWidth = 1.4; g.beginPath(); L.forEach((x, i) => i ? g.lineTo(X(i), Y1(x.p)) : g.moveTo(X(i), Y1(x.p))); g.stroke();
    g.fillStyle = col("--mute"); [lo + pad, hi - pad].forEach(v => g.fillText(fmtPx(v), W - ax + 4, Y1(v) + 3)); g.fillText("SOXL", 4, top + 10);
    // panel 2: predicted vs actual next-30-minute move (%), and the crowd score
    const Y2top = mid + 4, Y2bot = bot; const pv = L.map(x => (Lr.kUse || 0.01) * pred(x)), av = L.map(x => { const p = pmap.get(x.t); return p ? p.y : NaN; });
    const mm = Math.max(0.004, ...pv.map(Math.abs), ...av.filter(isFinite).map(Math.abs)) * 1.1;
    const Y2 = v => Y2top + (mm - v) / (2 * mm) * (Y2bot - Y2top);
    g.strokeStyle = col("--line"); g.beginPath(); g.moveTo(0, Y2(0)); g.lineTo(W - ax, Y2(0)); g.stroke();
    g.fillStyle = col("--mute"); g.fillText(fmtPct(mm, 1), W - ax + 4, Y2(mm) + 8); g.fillText("0%", W - ax + 4, Y2(0) + 3); g.fillText(fmtPct(-mm, 1), W - ax + 4, Y2(-mm) - 2);
    g.fillText("next 30 min: predicted vs actual", 4, Y2top + 10);
    // actual as bars
    av.forEach((v, i) => { if (!isFinite(v)) return; g.fillStyle = v >= 0 ? col("--up") : col("--down"); g.globalAlpha = 0.45; const y0 = Y2(0), y1 = Y2(v); g.fillRect(X(i) - Math.max(1, (W - ax) / n * 0.4), Math.min(y0, y1), Math.max(1, (W - ax) / n * 0.8), Math.abs(y1 - y0)); g.globalAlpha = 1; });
    // predicted as a line
    g.strokeStyle = col("--accent"); g.lineWidth = 1.6; g.beginPath(); pv.forEach((v, i) => i ? g.lineTo(X(i), Y2(v)) : g.moveTo(X(i), Y2(v))); g.stroke();
    // crowd score (scaled to the same panel)
    g.strokeStyle = col("--violet"); g.lineWidth = 1; g.setLineDash([3, 3]); g.beginPath(); L.forEach((x, i) => { const y = Y2(x.s * mm); i ? g.lineTo(X(i), y) : g.moveTo(X(i), y); }); g.stroke(); g.setLineDash([]);
    // time labels
    g.fillStyle = col("--mute"); g.textAlign = "center"; const stp = Math.max(1, Math.round(n / 5));
    for (let i = 0; i < n; i += stp) g.fillText(new Date(L[i].t).toLocaleString("en-US", rng === "1d" ? { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" } : { timeZone: "America/New_York", month: "short", day: "numeric" }), X(i), Hh - 3);
    g.textAlign = "left";
    window.__gtH = { L, X, n, ax, W, pv, av };
  }
  function render() {
    const Lr = learn(), now = G && isFinite(G.coop) ? pred({ s: G.coop, d: G.down, u: G.up }) : NaN;
    const by = Lr.by || {}, bl = k => by[k] && by[k].n >= 20 ? `${fmtPct(by[k].y / by[k].n, 2)} avg, ${Math.round(by[k].up / by[k].n * 100)}% up (n=${by[k].n})` : "needs data";
    const tile = (k, v, s, c) => `<div class="st"><div class="k">${k}</div><div class="v ${c || ""}">${v}</div><div class="s">${s || ""}</div></div>`;
    $("gtStats").innerHTML =
      tile("Expected next 30 min", isFinite(now) && Lr.n >= 30 ? fmtPct(Lr.kUse * now, 2) : "--", Lr.n >= 30 ? `learned from ${Lr.n} checks · trust ${Math.round(Lr.trust * 100)}%` : `${Lr.n || 0} of 30 checks needed`, isFinite(now) && Lr.n >= 30 ? (Lr.kUse * now > 0 ? "up" : "down") : "") +
      tile("Hit rate (strong calls)", isFinite(Lr.hit) ? Math.round(Lr.hit * 100) + "%" : "--", Lr.hitN ? `direction right in ${Lr.hitN} calls with |score| ≥ 0.25` : "no strong calls yet", isFinite(Lr.hit) ? (Lr.hit >= 0.55 ? "up" : Lr.hit < 0.48 ? "down" : "") : "") +
      tile("Prediction vs actual", isFinite(Lr.corr) ? "r = " + Lr.corr.toFixed(2) : "--", isFinite(Lr.corr) ? (Lr.corr > 0.1 ? "the read has an edge" : Lr.corr < -0.1 ? "the read is backwards: fade it" : "no clear edge yet") : "correlation of predicted and real move", isFinite(Lr.corr) ? (Lr.corr > 0.1 ? "up" : Lr.corr < -0.1 ? "down" : "") : "") +
      tile("After Cooperation", bl("C").split(",")[0], bl("C").split(",").slice(1).join(","), "") +
      tile("After Defection", bl("D").split(",")[0], bl("D").split(",").slice(1).join(","), "") +
      tile("After Standoff", bl("S").split(",")[0], bl("S").split(",").slice(1).join(","), "");
    $("gtCtl").innerHTML = [["1d", "1 day"], ["5d", "5 days"], ["30d", "30 days"]].map(([k, l]) => `<button data-gtr="${k}" class="${rng === k ? "on" : ""}">${l}</button>`).join("");
    $("gtNote").innerHTML = Lr.n >= 30 ? `The page learns: the expected move uses the slope it measured (${(Lr.k * 100).toFixed(2)}% per point of score) scaled by trust. ${isFinite(Lr.corr) && Lr.corr < -0.1 ? "<b>Right now the crowd read has worked backwards — treat strong calls as a fade.</b>" : ""}` : "The page records the read every minute while it is open and checks each one 30 minutes later. Keep the page open during the session to build the record.";
    draw();
  }
  host.innerHTML = `<div class="gth"><div class="label">Trend · crowd score, and predicted vs actual (next 30 min)</div><div class="row" id="gtCtl"></div></div>
    <div class="stiles" id="gtStats" style="margin-top:8px"></div>
    <div class="gtc"><canvas id="gtCv"></canvas><div class="tip" id="gtTip"></div></div>
    <div class="leg"><span><i style="background:var(--ink)"></i>SOXL (green/red background: Cooperation/Defection)</span><span><i style="background:var(--accent)"></i>Predicted 30-min move</span><span><i style="background:var(--up)"></i><i style="background:var(--down);margin-left:-3px"></i>Actual 30-min move</span><span><i style="background:var(--violet)"></i>Crowd score (dashed)</span></div>
    <div class="sub" id="gtNote" style="margin-top:6px"></div>`;
  host.addEventListener("click", e => { const b = e.target.closest("[data-gtr]"); if (b) { rng = b.dataset.gtr; lsSet("soxx_gtrng", rng); render(); } });
  const cv = $("gtCv"), tip = $("gtTip");
  cv.addEventListener("mousemove", e => { const h = window.__gtH; if (!h) return; const rc = cv.getBoundingClientRect(), i = Math.floor((e.clientX - rc.left) / ((h.W - h.ax) / h.n)), x = h.L[i]; if (!x) { tip.style.display = "none"; return; }
    tip.textContent = `${new Date(x.t).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ${fmtPx(x.p)} · score ${x.s >= 0 ? "+" : ""}${x.s.toFixed(2)} · run ${x.d} / squeeze ${x.u} · predicted ${fmtPct(h.pv[i], 2)} · actual ${isFinite(h.av[i]) ? fmtPct(h.av[i], 2) : "not yet"}`; tip.style.display = "block"; });
  cv.addEventListener("mouseleave", () => tip.style.display = "none");
  window.addEventListener("resize", draw);
  setInterval(() => { try { record(); if (Date.now() - lastAt > 15000) { lastAt = Date.now(); render(); } } catch (e) { } }, 5000);
  setTimeout(render, 1500);
})();
