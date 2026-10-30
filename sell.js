/* Pricing, founding-member offer and share tools (same file on SOXX Sniper and LETF Sniper).
   To start charging: paste your checkout link (Stripe Payment Link, Gumroad, Lemon Squeezy, Ko-fi…) into SELL.pay.
   Until then, the buttons open the contact page with "Subscription / paid access" selected. */
(function () {
  "use strict";
  const isLetf = /LETF/i.test(document.title);
  const SELL = {
    name: isLetf ? "LETF Sniper" : "SOXX Sniper",
    price: "$5", per: "/month", later: "$12/month after the beta", yearly: "$49/year",
    pay: "",                                   // ← your checkout link goes here
    url: location.origin + location.pathname,
    pro: isLetf ? [
      "Every US leveraged and inverse ETF (750+) scanned every 12 seconds",
      "Level-to-level setups on every fund: volume profile, HVN/LVN, structure, trend, momentum",
      "Underlying vs fund tracking, leverage decay cost, sister funds",
      "Alerts for big moves, 15-minute bursts, volume surges and extended hours",
      "Ready-to-post updates for X and StockTwits"
    ] : [
      "Last 3 moves of the top 20 SOXL traders on Hyperliquid, every minute, with profiles of each trader",
      "Max pain on both sides: options (SOXL, SOXS) and liquidation clusters",
      "Run and squeeze odds with a live track record (predicted vs actual)",
      "StockTwits caller tracker with the EV of following each poster",
      "Pro charts on every stock: channels, Fibonacci, long/short setups, alert lines",
      "Alerts and ready-to-post updates for X and StockTwits"
    ],
    free: isLetf ? ["Live scanner (top movers)", "Fund pages with charts", "Light and dark mode"] : ["Live SOXL, SOXX and SOXS prices", "Index tracker of the 30 stocks", "News and the market strip"]
  };
  const css = `
.sribbon{display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;padding:8px 14px;margin:0 0 12px;border-radius:12px;font-size:13px;
  background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 22%,var(--panel)),color-mix(in srgb,var(--violet) 22%,var(--panel)));border:1px solid var(--line)}
.sribbon b{color:var(--ink)}.sribbon a.cta{padding:5px 12px;font-size:12px}.sribbon .x{background:none;border:0;color:var(--dim);cursor:pointer;font-size:15px;padding:0 4px}
.sprice{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:10px}
.stier{border:1px solid var(--line);border-radius:14px;padding:14px 16px;background:var(--panel2);display:flex;flex-direction:column;gap:6px}
.stier.pro{border-color:var(--accent);box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 35%,transparent),0 10px 30px color-mix(in srgb,var(--accent) 12%,transparent)}
.stier h4{margin:0;font-size:15px;display:flex;justify-content:space-between;align-items:center}
.stier .pp{font-family:var(--mono);font-size:30px;font-weight:700}.stier .pp span{font-size:13px;color:var(--dim);font-weight:400}
.stier ul{margin:4px 0 6px;padding-left:18px;font-size:13px;line-height:1.5}
.stier .badge{font-family:var(--mono);font-size:10px;padding:2px 8px;border-radius:99px;background:var(--accent);color:#fff;letter-spacing:.05em}
.sshare{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const buy = () => SELL.pay ? `<a class="cta" href="${SELL.pay}" target="_blank" rel="noopener">Lock in ${SELL.price}${SELL.per}</a>` : `<a class="cta" href="#/contact?pro">Lock in ${SELL.price}${SELL.per}</a>`;
  // ribbon
  const wrap = document.querySelector(".wrap"), hdr = wrap && wrap.querySelector("header");
  let hide = false; try { hide = localStorage.getItem("sell_rib") === "x"; } catch (e) { }
  if (hdr && !hide) {
    const r = document.createElement("div"); r.className = "sribbon"; r.id = "sRib";
    r.innerHTML = `<span>🎯 <b>${SELL.name} Pro is free during the beta.</b> Founding members keep <b>${SELL.price}${SELL.per}</b> for life (${SELL.later}).</span>${buy()}<button class="x" title="Hide" aria-label="Hide">✕</button>`;
    hdr.after(r); r.querySelector(".x").onclick = () => { r.remove(); try { localStorage.setItem("sell_rib", "x"); } catch (e) { } };
  }
  // pricing card
  const card = document.getElementById("proCard");
  if (card) {
    const share = encodeURIComponent(isLetf ? `Found a free scanner for every leveraged ETF: big movers, volume-profile setups and alerts, live.` : `This free $SOXL dashboard shows the top Hyperliquid whales' moves every minute, max pain on both sides and squeeze odds. Live.`);
    card.innerHTML = `<div class="label">${SELL.name} Pro · founding members</div>
      <h3 style="margin:4px 0 0">Everything live. One price, locked for life.</h3>
      <div class="sprice">
        <div class="stier"><h4>Free</h4><div class="pp">$0</div><ul>${SELL.free.map(x => `<li>${x}</li>`).join("")}</ul></div>
        <div class="stier pro"><h4>Pro <span class="badge">FOUNDING</span></h4><div class="pp">${SELL.price}<span>${SELL.per} · or ${SELL.yearly}</span></div>
          <ul>${SELL.pro.map(x => `<li>${x}</li>`).join("")}</ul>${buy()}<span class="sub">Free during the beta. ${SELL.later.replace(/^\$/, "Later $")} for new members. Cancel any time.</span></div>
      </div>
      <div class="sshare"><a class="chiplink" href="https://x.com/intent/tweet?text=${share}&url=${encodeURIComponent(SELL.url)}" target="_blank" rel="noopener">Share on X</a><a class="chiplink" href="https://stocktwits.com" target="_blank" rel="noopener" id="sStCopy">Share on StockTwits</a><a class="chiplink" href="#/contact?pro">Questions? Write to me</a></div>
      <div class="sub" style="margin-top:6px">Not investment advice. Data from public sources; it can be late or wrong.</div>`;
    const sc = document.getElementById("sStCopy"); if (sc) sc.addEventListener("click", () => { try { navigator.clipboard.writeText(decodeURIComponent(share) + " " + SELL.url); } catch (e) { } });
  }
  window.SELL = SELL;
})();
