/* Terms of use, disclaimer and privacy page (#/terms), shared by SOXX Sniper and LETF Sniper. */
(function () {
  "use strict";
  const NAME = /LETF/i.test(document.title) ? "LETF Sniper" : "SOXX Sniper", MAIL = "sniperdesk@proton.me", UPDATED = "October 30, 2026";
  const wrap = document.querySelector(".wrap"); if (!wrap) return;
  const v = document.createElement("div"); v.id = "termsView"; v.style.display = "none";
  v.innerHTML = `<div class="sv-top"><button id="tmBack">← Back</button></div>
  <section class="card tmc"><div class="label">Terms of use · disclaimer · privacy</div><h2 style="margin:6px 0 4px">${NAME}: read this before you use the site</h2><p class="sub">Last updated ${UPDATED}. By using this site you agree to these terms.</p>
  <h3>1. Not investment advice</h3>
  <p>${NAME} is a data and education tool. Nothing on this site is investment, financial, legal or tax advice, and nothing is a recommendation or an offer to buy or sell any security, ETF, option, perpetual future or crypto asset. The operator is not a registered investment adviser, broker-dealer or financial planner, and has no fiduciary duty to you. Talk to a licensed professional before you make decisions about your money.</p>
  <h3>2. High risk</h3>
  <p>Leveraged and inverse ETFs (for example SOXL and SOXS) reset every day and can lose most of their value quickly, even when the index moves in your favor over time. Options, perpetual futures and crypto can lose more than you put in. Only trade money you can afford to lose.</p>
  <h3>3. Data can be late, wrong or missing</h3>
  <p>Prices, positions, orders, news, social posts and option data come from third-party sources that are not official for this use (for example Finnhub, Yahoo Finance, Nasdaq.com, StockTwits, Hyperliquid, Hyperdash, Google News and FRED). They can be delayed, wrong, incomplete or stop without notice. Calculations (forecasts, odds, max pain, setups, expected value, profiles, ranks) are statistical estimates with errors. Always check prices with your broker before you trade.</p>
  <h3>4. Past results do not predict future results</h3>
  <p>Track records, hit rates, "units", back-tests and trader profiles describe the past only. A rule or a person that was right before can be wrong next time. Small samples can look good by luck.</p>
  <h3>5. Third parties and public information</h3>
  <p>Wallet addresses and trades on Hyperliquid are public on-chain data. StockTwits usernames and posts are public. The site does not try to identify any person behind a wallet or a username. Labels such as "best", "worst", "fade" or "most +EV" are statistics from public data, not statements about any person's skill, character or honesty. If you want a public username or wallet removed from the site, write to ${MAIL}.</p>
  <h3>6. No affiliation</h3>
  <p>${NAME} is independent. It is not affiliated with, sponsored or endorsed by Direxion, BlackRock/iShares, Nasdaq, Cboe, StockTwits, X, Hyperliquid, Hyperdash, TradingView, Yahoo or any company shown. All trademarks and fund names belong to their owners and are used only to identify them.</p>
  <h3>7. Your responsibility; no warranty; limit of liability</h3>
  <p>You alone are responsible for your trades and their results. The site is provided "as is" and "as available", without any warranty, including accuracy, availability, merchantability or fitness for a purpose. To the maximum extent allowed by law, the operator is not liable for any direct, indirect, incidental or consequential loss, including trading losses or lost profits, that comes from using or not being able to use the site. If a law does not allow this limit, the operator's total liability is limited to the amount you paid for the site in the last 3 months.</p>
  <h3>8. Subscriptions</h3>
  <p>Paid plans (when offered) renew until you cancel. You can cancel at any time; access continues until the end of the paid period. A paid plan buys access to the tool, not advice or results. Features can change. Payments are handled by the payment provider; the site never sees or stores your card details.</p>
  <h3>9. Privacy</h3>
  <p>The site has no accounts and no tracking cookies. Your settings, stars, alerts and learned data are kept only in your own browser (local storage). Your browser connects directly to the data sources listed above and to a proxy (Cloudflare Worker) that only passes data requests; it does not store personal data. The contact form opens your own email app; the site does not send or keep your message. You can clear everything with your browser's "clear site data".</p>
  <h3>10. Acceptable use</h3>
  <p>Do not use the site to break the law, to manipulate markets, or to harass anyone. Do not copy or resell the site's content or code without permission. Shared screenshots must keep the site name.</p>
  <h3>11. Changes and contact</h3>
  <p>These terms can change; the date at the top shows the last change. Questions: <a href="mailto:${MAIL}">${MAIL}</a>.</p>
  </section>`;
  const foot = wrap.querySelector("footer"); wrap.insertBefore(v, foot || null);
  const st = document.createElement("style"); st.textContent = `.tmc h3{font-size:14px;margin:14px 0 4px}.tmc p{font-size:13px;line-height:1.6;margin:0;color:var(--ink)}.ftdis{font-size:11px;color:var(--mute);margin-top:6px;line-height:1.5}`; document.head.appendChild(st);
  if (foot) { const d = document.createElement("div"); d.className = "ftdis"; d.innerHTML = `<a href="#/terms">Terms of use, disclaimer and privacy</a> · Not investment advice. Leveraged products are high risk. Data can be late or wrong. Not affiliated with any fund, exchange or data source shown.`; foot.appendChild(d); }
  const views = () => ["mainView", "fundView", "stockView", "contactView"].map(id => document.getElementById(id)).filter(Boolean);
  let prev = null;
  function apply() {
    if (/^#\/terms/.test(location.hash)) { views().forEach(x => { if (x.style.display !== "none") prev = x.id; x.style.display = "none"; }); v.style.display = "block"; document.title = "Terms · " + NAME; window.scrollTo(0, 0); }
    else if (v.style.display !== "none") { v.style.display = "none"; }
  }
  window.addEventListener("hashchange", () => setTimeout(apply, 0)); setTimeout(apply, 0);
  document.getElementById("tmBack").onclick = () => { if (history.length > 1) history.back(); else location.hash = "#/"; };
})();
