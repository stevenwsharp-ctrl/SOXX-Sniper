# SOXX Sniper

A live, self-learning dashboard for **SOXL** (Direxion Daily Semiconductor Bull 3X) and the 30 stocks of the NYSE Semiconductor Index that SOXL tracks.

Live site: https://stevenwsharp-ctrl.github.io/SOXX-Sniper/

> **Not investment advice.** All signals, odds and expectations are statistical estimates from past price action. They do not predict the future.

---

## What it does

### Main page order (most useful first)
1. **Market strip:** $SOXL, the 30-stock index, the real **SOX, Nasdaq, S&P 500 and Dow levels with point changes**, VIX, the 10-year yield (in basis points) and Bitcoin.
2. **After-hours / pre-market banner** (only outside regular hours).
3. **Index cards:** the weighted index (% and ≈ SOX points), implied SOXL, SOXL actual ($ and %), and the tracking gap.
4. **Post kit and live alerts** (see below).
5. **Decision read**, then **Movers**, then the **30 holding tiles**.
6. Liquidity map, cross-market table (now with a **Day chg** column), sessions, extended hours, price flow, rule finder, macro, news, and the memory sections.

### Post kit (for X and StockTwits)
Five updates that the page writes again every few seconds from live data. Each shows its character count and has **Post on X**, **StockTwits** (copies the text and opens $SOXL on StockTwits) and **Copy**:
- **Market pulse:** SOXL price and change, $SOX points, the index and 3× implied move, breadth, fear and greed, and the current read.
- **Top movers:** the top 3 gainers and losers in the index.
- **Who's driving $SOXL:** the stocks that add or remove the most **$SOX points** today.
- **Levels to watch:** the next levels above and below, with the touch odds in 30 minutes, and the liquidity flush level.
- **After-hours / pre-market** (outside regular hours) or **Smart money** (during regular hours).

**Add link** puts a link to the live page on each post. **Download SOXL card** saves a 1200 × 675 image for a post. The chips open the live $cashtag feeds on X and StockTwits.

### Live alerts
The page watches the market every 5 seconds and writes a post-ready alert when:
- SOXL moves ±2% in 15 minutes, or makes a new high or low of the day.
- The 30-stock index crosses ±1, 2 or 3%, or a top-10 holding crosses ±3 or 5%.
- SOXL moves ±1, 2, 3 or 5% in after-hours or pre-market.
- The tracking gap is 0.6% or more, or large prints are $3M or more net in 5 minutes.
- Fear and greed is 25 or less, or 75 or more, or the VIX is up 10% or more.

Only the largest threshold that is crossed makes an alert. Select **Alerts: on** to also get browser notifications (the browser asks for permission once).

### Live tracking
- **After-hours and pre-market banner** at the top, with the live price and the change in $ and % since the close.
- **All 30 holdings** as live tiles, colored by % change. Each tile shows the stock's weight, its contribution to the index, and its next likely price level.
- **Weighted index**, **implied SOXL** (3× the index), **SOXL actual**, and the **tracking gap** between them.
- **Cross-market table** (24h / day / 1h / 30m): Dow (DIA), S&P 500 (SPY), Nasdaq 100 (QQQ), SOXX, SOXL, SOXS, Bitcoin, Ethereum, and total crypto market cap, with alignment and beta-ladder order.
- **Live macro proxies:** oil (USO), bonds (TLT, IEF, SHY), credit (HYG, LQD), and the consumer (XLY, XLP, card lenders).
- **News**, scored live by topic and sentiment.

### Stock pages (made for following these names on X)
Click any tile, or SOXL, SOXS, SOXX, QQQ, SPY or DIA in the market tables. Each stock has its own link (for example `#/s/NVDA`), so you can share or bookmark it.
- Live price, pre-market and after-hours price, and a 1-day or 5-day chart with the extended hours shaded.
- **Effect on SOXL:** weight, index points today, the share of SOXL's move, and the learned correlation, beta and lead.
- **Peers** in its group (AI compute, memory, equipment, analog, foundry, RF), with relative strength against the semis index.
- **Key levels** with touch odds, tick-rule order flow, fundamentals, analyst ratings, the last 4 earnings (beat or miss), and the next earnings date.
- **Live company news**, scored for sentiment.
- **Share tools:** a written summary, **Post on X**, **Copy summary**, a downloadable **share card** image (1200 × 675), and links to the live $cashtag feeds on X and StockTwits.

### Analysis
- **Decision read:** a stance (lean up / lean down / neutral), the market regime, a favored price threshold, and flags. It combines all the inputs below, with weights.
- **Liquidity map:** the next likely SOXL price thresholds, with the odds of a touch within 30 minutes and an estimated time.
- **Fear and greed composite** (0–100) from up to 12 live inputs.
- **Positioning flow:** SOXL versus SOXS money flow, tick-rule order flow, and large prints (≥ $250k).
- **Macro, bonds, funding, consumer credit, debt ratios, oil, and semis fundamentals** (FRED and Finnhub).
- **Sessions:** today's session map, gap playbook, time-of-day profile, overnight versus intraday returns, and the Smart Money Index.
- **Rule finder:** 15 market-structure hypotheses (leveraged-ETF rebalancing, market makers, retail at the open, after-hours traders, institutions), tested on 2 years of history with out-of-sample validation. Only rules that pass influence the decision.
- **Flow map and expected price flow:** who moves SOXL now, and what the validated rules expect for each part of the day.

### Memory bank (learns 24 hours a day)
- **Regular hours:** learns how each stock's 1-minute moves relate to SOXL (correlation, beta, lead), and scores its own forecasts so it can tune itself ("attunement").
- **Pre-market and after-hours:** learns the same links separately, because off-hours moves are bigger per dollar traded.
- **Overnight and weekends:** records crypto, and learns how overnight crypto moves relate to SOXL's opening gap.
- Stored in the browser (IndexedDB). It stays after you close the tab or restart. Use **Export backup** and **Import backup** to keep a copy or to move it to a different device.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | The complete website (one file). |
| `worker.js` | Cloudflare Worker. It keeps the FRED and Massive keys secret and lets the site read their data. It is not part of the GitHub site; deploy it to Cloudflare. |
| `README.md` | This file. |

---

## Setup

### 1. Website (GitHub Pages)
1. Put `index.html` in the root of the repository.
2. Go to **Settings → Pages**. Set **Deploy from a branch**, branch **main**, folder **/ (root)**, then select **Save**.
3. Open the site after 1–2 minutes.

To test it on your computer first, run this command in the folder that has `index.html`, then open http://localhost:8000:

```
python3 -m http.server 8000
```

### 2. Finnhub key (live prices, news, fundamentals)
1. Get a free key at https://finnhub.io/register.
2. On the site, select **API key**, paste the key, and select **Save and connect**.

The key stays in your browser only (localStorage). It is not in the repository.

### 3. Cloudflare Worker (FRED data and price history)
1. Get a free FRED key at https://fredaccount.stlouisfed.org/apikeys.
2. Get a free Massive key (formerly Polygon.io) at https://massive.com.
3. In Cloudflare, create a Worker (**Workers & Pages → Create → Start with Hello World**). Name it, for example, `soxx-sniper-fred`.
4. Select **Edit code**, replace all the code with `worker.js`, and select **Deploy**.
5. In **Settings → Variables and Secrets**, add:

   | Name | Type | Value |
   |---|---|---|
   | `FRED_KEY` | Secret | your FRED key |
   | `POLYGON_KEY` | Secret | your Massive key |
   | `ALLOW_ORIGIN` | Text | `https://stevenwsharp-ctrl.github.io` |

6. Open `https://<your-worker>.workers.dev/health`. It must show `{"ok":true,"key":true,"hist":true}`.
7. When you get a new `worker.js`, open the Worker, select **Edit code**, replace all the code, and select **Deploy** again. You do not need to change the variables.
8. On the site, select **API key** and paste the Worker URL (without `/health`) into the FRED proxy field.

On the first visit, the site loads about 2 years of 5-minute SOXL bars. This takes about 3 minutes; keep the tab in front during that time.

### Demo mode
Select **Demo mode** in the API key box to see every panel with simulated data. Demo mode does not save anything to the real memory bank.

---

## Data sources

| Source | Key | Used for | Speed |
|---|---|---|---|
| Finnhub (free) | yes | Prices (websocket), quotes, news, fundamentals, analyst ratings, earnings calendar | Live |
| Coinbase | no | BTC and ETH prices | Live |
| CoinGecko | no | Total crypto market cap | About 1 min |
| alternative.me | no | Crypto Fear & Greed | Daily |
| FRED, via the Worker | yes | Yields, credit spreads, funding, liquidity, macro, consumer credit, debt ratios, oil | Daily to quarterly |
| Massive (Polygon), via the Worker | yes | 2 years of 5-minute bars with extended hours | End of day |
| Yahoo Finance (Nasdaq.com as a backup), via the Worker | no | Live pre-market and after-hours prices, index levels (SOX, Dow, S&P 500, Nasdaq, VIX, 10Y), stock-page charts, volume, 52-week range | About 15–20 s |

Yahoo Finance and Nasdaq.com do not officially support these data addresses, so they can change. If they stop, the banner shows an error, and **System health** shows "Extended-hours prices ✕".

---

## Limits
- **Finnhub free:** 60 calls per minute and 50 websocket symbols. The site uses 49 symbols and stays under 55 calls per minute.
- **Index values:** the market strip shows the real SOX, Nasdaq, S&P 500, Dow, VIX and 10-year levels from Yahoo Finance through the Worker (about every 20 s). The cross-market table still uses the ETFs (DIA, SPY, QQQ), because Finnhub gives them live. Without the Worker, the strip shows SOXX in place of SOX.
- **SOX points:** a stock's points = its index contribution × the SOX prior close. The 30-stock index is an estimate, so its SOX points are shown with "≈" and can differ a little from the real SOX.
- **Holdings and weights:** from the iShares SOXX holdings file (Oct 19, 2026). Update the `HOLDINGS` list in `index.html` after each quarterly rebalance.
- **Leveraged-ETF assets:** `LETF_AUM` in `index.html` holds approximate values for SOXL and SOXS. Update them from direxion.com when they change.
- **Smart money:** no free source shows institutional orders directly. The Smart Money Index and large prints are proxies.
- **Consumer credit:** no free source gives consumer credit scores in real time. The site uses the Fed's delinquency, charge-off and debt-service data, plus live market signals.
- **Recording:** the memory bank learns only while the page is open. Raw price bars older than 400 days are deleted to control storage; the learned knowledge stays permanently.
