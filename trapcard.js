/* SOXX Sniper · Trapped longs vs shorts on the SOXL perp (Hyperliquid xyz:SOXL), from Cohort Sniper's data job:
   specialists.json (top 30 holders: size, side, unrealized P&L, cohort, skill) and levels.json (entry, leverage,
   liquidation price, each trader's usual loss cut). Refresh every 10 minutes; the pressure goes to the signal web
   (trap.pressure) and to the Sniper read (window.TRAPSIG). Uses: Trapped (trapped.js), Web, PERPCTX (stance.js), Q. */
(function () {
  "use strict";
  const anchor = document.getElementById("whaleCard"); if (!anchor || !window.Trapped) return;
  const card = document.createElement("section"); card.className = "card"; card.id = "trapCard"; card.style.marginBottom = "12px";
  card.innerHTML = `<div class="label">Trapped longs vs shorts · SOXL perp, top 30 holders · how deep, past their stop, near liquidation</div><div id="trapBody"><div class="note">Loading the holder files…</div></div>`;
  anchor.before(card);
  const st = document.createElement("style"); st.textContent = `#trapCard table{width:100%;border-collapse:collapse;font:12px var(--mono)}#trapCard th,#trapCard td{padding:3px 6px;border-bottom:1px solid var(--line);text-align:right}#trapCard th{color:var(--dim);font-weight:600}#trapCard .L{color:var(--up)}#trapCard .S{color:var(--down)}#trapCard .note{font-size:11.5px;color:var(--dim);margin:4px 0}`; document.head.appendChild(st);
  const RAW = "https://raw.githubusercontent.com/stevenwsharp-ctrl/Hyperdash-Cohort-Tracker/data/";
  let SP = null, LV = null, at = 0;
  async function tick() {
    if (document.hidden && at) return;
    if (Date.now() - at > 10 * 6e4) { const k = Math.floor(Date.now() / 6e5);
      try { const [a, b] = await Promise.all([fetch(RAW + "specialists.json?t=" + k).then(r => r.ok ? r.json() : null), fetch(RAW + "levels.json?t=" + k).then(r => r.ok ? r.json() : null)]);
        if (a && a.m) SP = a.m["XYZ:SOXL"] || SP; if (b && b.m) LV = b.m["XYZ:SOXL"] || LV; at = Date.now(); } catch (e) { } }
    const P = window.PERPCTX || {}, px = P.SOXL && P.SOXL.px || (typeof Q === "object" && Q.SOXL && Q.SOXL.c) || null;
    const T = SP && SP.holders && px ? Trapped.analyze(SP.holders, LV && LV.h, px) : null, I = Trapped.signals(T);
    try { if (window.Web) I.forEach(([id, v, lab]) => Web.emit(id, "SOXL", v, lab)); } catch (e) { }
    window.TRAPSIG = { at: Date.now(), T, I };
    document.getElementById("trapBody").innerHTML = SP ? Trapped.html(T, { px: v => "$" + v.toFixed(2), title: `SOXL perp at $${px ? px.toFixed(2) : "–"}${SP.t ? ", holders as of " + new Date(SP.t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}` }) : `<div class="note">The holder files did not load. They come from Cohort Sniper's data job.</div>`;
  }
  setTimeout(tick, 6000); setInterval(tick, 60000);
})();
