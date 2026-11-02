/* SOXX Sniper · "Same setups on every site" for SOXL, SOXS and SOXX (agree.js): the lab's 24 h / 48 h / 7 d setups converted to each
   fund through its leverage, and every live read the three sites published for SOXX, side by side. */
(function () {
  "use strict";
  if (!window.Agree) return;
  const anchor = document.getElementById("hubCard") || document.getElementById("ndxCard") || document.getElementById("stanceCard"); if (!anchor) return;
  const c = document.createElement("section"); c.className = "card"; c.id = "agCard"; c.style.margin = "0 0 12px"; anchor.after(c);
  const st = document.createElement("style"); st.textContent = `#agCard table{width:100%;border-collapse:collapse;font:12px var(--mono)}#agCard th,#agCard td{padding:3px 6px;border-bottom:1px solid var(--line);text-align:right}#agCard th{color:var(--dim);font-weight:600}#agCard .L{color:var(--up)}#agCard .S{color:var(--down)}#agCard .note{font-size:11.5px;color:var(--dim);margin:4px 0}#agCard .ag3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}@media(max-width:1100px){#agCard .ag3{grid-template-columns:1fr}}`; document.head.appendChild(st);
  async function draw() { await Agree.load(); const px = s => typeof Q === "object" && Q[s] && Q[s].c > 0 ? Q[s].c : null;
    c.innerHTML = `<details open><summary class="label" style="cursor:pointer">Same setups on every site · SOXL, SOXS and SOXX (LETF Sniper and Cohort Sniper show these exact numbers)</summary>
      <div class="ag3" style="margin-top:6px">${[["SOXL", 3], ["SOXS", -3], ["SOXX", 1]].map(([s, L]) => `<div>${Agree.html("SOXX", { L, px: px(s), s })}</div>`).join("")}</div>
      ${Agree.table("SOXX", [["SOXL", "SOXX", 3]])}</details>`; }
  setTimeout(draw, 8000); setInterval(() => { if (!document.hidden) draw(); }, 60000);
})();
