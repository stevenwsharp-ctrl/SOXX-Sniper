/* SOXX Sniper · page order: what a SOXL trader needs first goes to the top.
   1. Price now: the SOXL strip, the live Hyperliquid bar, extended hours, the weighted index vs SOXL.
   2. The call: the Sniper read, the decision read, the setups (15 min to 7 days), the market stance, the big-move radar.
   3. The action: charts, volume flow, news, trapped traders, whales, max pain, the paper bots.
   4. Research and background (lower): the knowledge hub, the capex cycle, links, the semis basket, psychology, game theory …
   Cards that other scripts add later are put in place too (the order is checked again when a card appears). */
(function () {
  "use strict";
  // the same file on LETF Sniper: the scanner, the movers and the watchlist first; the spider web and the hub after them
  const LETF = !!document.getElementById("scanCard");
  const M = LETF ? document.getElementById("scanCard").parentElement : document.getElementById("mainView"); if (!M) return;
  const TOP = LETF ? ["#mStrip", "#edgeBar", "#mvCards", "#scanCard", ".grid2:not(#proofRow)", "#watchCard"] : ["#topRow", "#hlBar", "#extBar", ".hero", "#readCard", ".decision", "#agCard", "#stanceCard", "#radarCard", "#trioCard", "#volCard", "#freshCard", "#trapCard", "#whaleCard", "#painCard", "#botCard", "#moversCard", "#ndxCard"];
  const LOW = LETF ? ["#webCard", "#hubCard", "#postKit", "#proofRow"] : ["#hubCard", "#capexCard", "#meshCard", "#intelCard", "#psyCard", "#gameCard", "#postKit", "#socialCard", "#callersCard", "#proofRow"];
  const rank = (el, i) => { for (let k = 0; k < TOP.length; k++) if (el.matches(TOP[k])) return k; for (let k = 0; k < LOW.length; k++) if (el.matches(LOW[k])) return 5000 + k; return 1000 + i; };
  let busy = false;
  function apply() { if (busy) return; const C = [...M.children], want = C.map((el, i) => ({ el, r: rank(el, i) })).sort((a, b) => a.r - b.r).map(x => x.el);
    if (want.every((el, i) => el === C[i])) return; busy = true; const y = scrollY; want.forEach(el => M.appendChild(el)); if (y < 50) scrollTo(0, y); busy = false; }
  let t = null; new MutationObserver(() => { if (busy) return; clearTimeout(t); t = setTimeout(apply, 250); }).observe(M, { childList: true });
  [300, 1500, 4000, 9000].forEach(ms => setTimeout(apply, ms));
})();
