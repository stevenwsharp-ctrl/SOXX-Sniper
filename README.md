# SOXX Sniper

A live, self-learning dashboard for **SOXL** (Direxion Daily Semiconductor Bull 3X) and the 30 stocks of the NYSE Semiconductor Index that SOXL tracks.

Live site: https://stevenwsharp-ctrl.github.io/SOXX-Sniper/

> **Not investment advice.** All signals, odds and expectations are statistical estimates from past price action. They do not predict the future.

---

## What it does

### Heartbeat ring
The small ring in the header spins all the time. Its color shows that data is arriving: **green = live** (new data in the last 10 s during market hours, 45 s at other times), **amber = slow or reconnecting**, **red = stale**, **violet = demo**. It spins faster when more updates arrive, and a ripple shows each new update. Hover over it to see the time since the last update, updates per minute and latency. A watchdog turns the dot red by itself if the page stops working.

### Contact
The footer has a link to a **Contact page** (`#/contact`) with the email address, a **Copy email** button and a short form. The form opens the visitor's email app with the message filled in; the site does not send or store anything.

### Light and dark mode
Select **☀ / ☾** in the header. The page uses your device setting first and remembers your choice. Charts change color with the theme; the share card image stays dark on purpose.

### Index details
Select any item in the market strip (Semis 30, SOX, Nasdaq, S&P 500, Dow, VIX, 10-year yield, Bitcoin) to open its panel: a 1-day, 5-day or 1-month chart, and:
- **Semis 30 and SOX:** breadth, the leading and lagging groups (AI compute, memory, equipment, analog, foundry, RF), each group's move in SOX points, and the share of the move from the top 5 stocks.
- **S&P 500, Nasdaq and Dow:** all 11 sectors (sector ETFs), sector breadth, risk appetite (discretionary vs staples), growth vs defense (tech vs utilities), and the largest member stocks.
- **VIX:** the term structure (9 days, 30 days, 3 months, 6 months) and the implied daily move for the S&P and for SOXL.
- **10-year yield:** the yield curve (3 months, 5, 10 and 30 years) and what it means for chip valuations.
- **Bitcoin:** Ethereum, total crypto market cap and crypto fear and greed.

### Live chart and big-move radar (made for large moves)
A candle chart for SOXL near the top of the page, and on every stock page. It updates every 15 seconds from the Worker, and every second from live trades. Everything is calculated in the browser from real-time prices:
- **Candles:** 1, 5 or 15 minutes; Today or 5 days; pre-market and after-hours shaded. Point at a bar to see its open, high, low, close, volume, VWAP and EMA.
- **VWAP with ±1σ and ±2σ bands** (from 9:30; from 4:00 before the open). **EMA 9 and EMA 21.**
- **Automatic Fibonacci:** 23.6%, 38.2%, 50%, 61.8% and 78.6% retracements and 127.2% / 161.8% extensions on the day's swing, in the direction of the swing.
- **Key levels:** prior-day high, low and close; pre-market high and low; 30-minute opening range.
- **Volume pane:** bars turn amber at 2× the session's normal volume.
- **Big-move radar:** big-move pressure (0–100), **relative volume** at this time of day (against the last 4 sessions, with the projected day volume), today's range against the **14-day ATR** and the room left, the distance from VWAP in σ, the opening-range breakout, the last 5-minute volume burst, the EMA/VWAP trend, and the nearest Fib level.
- **History check:** on past days with a gap, first 30 minutes or first hour like today's, how often SOXL closed 5% or more from the prior close, and in which direction.
- The Fib, VWAP-band, pre-market and opening-range levels also feed the liquidity map, the "Levels to watch" post and new alerts: relative volume 2×, range larger than ATR, VWAP ±2σ, opening-range breakout and 5-minute volume burst of 3×.

### The 100-case view
In the Track record card, each rule that passed its out-of-sample test shows its last 100 cases: win rate, average and total SOXL move in the rule's direction, worst drawdown, longest losing run, an equity curve and the last 10 results. A real edge still loses often; read each rule as a batch of 100.

### Fresh news and stock alerts
- **Fresh news** (main page): headlines for SOXL and all 30 stocks from Google News and Yahoo Finance, searched every minute (each group of 10 stocks every 3 minutes), newest first. Each headline is tagged with its stocks (with logos) and its tone. Filter by stock, by your watched stocks, or show strong headlines only. New headlines get a **NEW** badge.
- **Stock pages:** the news list searches again every 60 seconds while the page is open (it also adds Finnhub company news every 3 minutes when you have a key). The status shows when it last checked.
- **🔔 Alerts for each stock** (on its page): every new headline, strong headlines only, price above or below a level, a day move of ±X%, or a pre-market / after-hours move of ±X%. Alerts go to the alert list (ready to post), and to browser notifications when **Notifications** is on. Your settings stay in this browser.

### Stock logos and real-time tiles
- Each stock has its logo (StockTwits logo service, then Financial Modeling Prep, then a lettered badge).
- Outside regular hours, all 30 tiles update with pre-market, after-hours and overnight prices, with a **PM / AH / ON** badge that shows the move since the close.

### The Sniper read, track record and Pro
- **The Sniper read** (under the market strip): SOXL, the current read, the next level with its odds, the crowd game and run/squeeze risk, with a Post button.
- **Track record:** how many forecasts the page graded, its calibration score, direction hit rate, sessions studied and rules that passed out-of-sample tests.
- **SOXX Sniper Pro (early access):** what is live now and what is planned, with a button to the Contact page (topic set to paid access).

### Main page order (most useful first)
1. **Market strip:** $SOXL, the 30-stock index, the real **SOX, Nasdaq, S&P 500 and Dow levels with point changes**, VIX, the 10-year yield (in basis points) and Bitcoin.
2. **After-hours / pre-market banner** (only outside regular hours).
3. **Index cards:** the weighted index (% and ≈ SOX points), implied SOXL, SOXL actual ($ and %), and the tracking gap.
4. **Post kit and live alerts** (see below). Select **Hide posts** to collapse the posts; the alerts stay visible.
5. **Decision read**, then **Game theory**, **Movers**, **Social pulse**, the **30 holding tiles**, and **Big money**.
6. Liquidity map, cross-market table (now with a **Day chg** column), sessions, extended hours, price flow, rule finder, macro, news, and the memory sections.

### Post kit (for X and StockTwits)
Five updates that the page writes again every few seconds from live data. Each shows its character count and has **Post on X**, **StockTwits** (copies the text and opens $SOXL on StockTwits) and **Copy**:
- **Market pulse:** SOXL price and change, $SOX points, the index and 3× implied move, breadth, fear and greed, and the current read.
- **Top movers:** the top 3 gainers and losers in the index.
- **Who's driving $SOXL:** the stocks that add or remove the most **$SOX points** today.
- **Levels to watch:** the next levels above and below, with the touch odds in 30 minutes, and the liquidity flush level.
- **After-hours / pre-market** (outside regular hours) or **Smart money** (during regular hours).
- **Game theory read:** the crowd game state, run and squeeze risk, the tested best response, forced flows and focal levels.

**Add link** puts a link to the live page on each post. **Download SOXL card** saves a 1200 × 675 image for a post. The chips open the live $cashtag feeds on X and StockTwits.

### Live alerts
The page watches the market every 5 seconds and writes a post-ready alert when:
- SOXL moves ±2% in 15 minutes, or makes a new high or low of the day.
- The 30-stock index crosses ±1, 2 or 3%, or a top-10 holding crosses ±3 or 5%.
- SOXL moves ±1, 2, 3 or 5% in after-hours or pre-market.
- The tracking gap is 0.6% or more, or large prints are $3M or more net in 5 minutes.
- Fear and greed is 25 or less, or 75 or more, or the VIX is up 10% or more.
- Run risk or squeeze risk is 70 or more, or StockTwits message volume spikes to 2× its normal pace.

Only the largest threshold that is crossed makes an alert. Select **Alerts: on** to also get browser notifications (the browser asks for permission once).

### Game theory (the crowd as players)
- **Crowd game (prisoner's dilemma):** in a sell-off, each holder gains by selling first. The score (−1 to +1) shows whether players now sell first ("defection") or hold and buy ("cooperation"). It uses breadth, order flow, SOXL vs SOXS money, large prints, the speed of the move and StockTwits mood.
- **Run risk and squeeze risk (0–100):** the odds of a cascade down or up. They add the speed of the move, the leveraged-ETF flow near the close, the VIX and how near a crowded level is.
- **Payoff matrix:** for 7 situations (gap up, gap down, a strong first 30 minutes, an after-hours move, a strong last hour, a big up day, a big down day), it tests on SOXL history whether following or fading the crowd paid. The row that applies now is marked, and a t-value of 2 or more is an edge.
- **Players:** what retail, market makers, leveraged ETFs (forced players), institutions, insiders and SOXS holders do now, and their likely strategy.
- **Focal points:** round numbers, the prior close, and the high and low of the day, where orders cluster.
- The game score has a small weight (0.08) in the decision read. Strong results add flags.

### Social pulse
- The latest 30 **StockTwits** messages for SOXL, SOXS, SOXX, NVDA, AMD, AVGO, MU or TSM, with bullish and bearish tags, the bull share, the pace (messages per hour), spikes and watchers.
- **Learning:** the page records SOXL's daily bull share. After 30 days, it shows the relation to the next day's SOXL return.
- **X:** X does not give free read access (reading posts costs money per post), so the X buttons open the live $cashtag search on X.

### Big money (funds, insiders, analysts)
- For each of the 30 stocks: institutional ownership, the net change in fund shares last quarter, how many funds bought or sold, new and sold-out positions, insider buying or selling in 3 months, analyst buy share, the average price target and its upside, the trend (50-day and 200-day averages), and the latest inflection point.
- Index-weighted totals at the top. The page loads one stock every 4 seconds and keeps the data for 12 hours.

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
- **Consensus:** analysts (buy/hold/sell and the price target), funds, insiders, StockTwits mood, news tone and trend, with a plain-language game-theory read (for example, a crowded consensus).
- **Trend and inflection points:** price vs the 20, 50 and 200-day averages, RSI, the 52-week range, and dated events from the last 90 days (crosses of the 50 and 200-day averages, golden and death crosses, RSI 70/30, new 52-week highs and lows, big moves, heavy volume).
- **Funds:** the largest holders, the biggest buyers and sellers, new positions, sold-out positions, and the latest insider trades.
- **Social pulse** for that stock.
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

### Attunement (self-calibration)
- Each minute, the page gives odds that SOXL touches its 6 nearest levels within 30 minutes, then scores the result. It now scores in **all sessions**: regular hours, pre-market, after-hours and overnight (only while SOXL trades). Each session has its own table and its own volatility scale. Select **Regular** or **Extended hrs** on the card.
- **Corrected odds:** the page corrects the raw model odds with its own scored history (a monotone curve, shrunk toward the raw odds when a bucket has fewer than about 15 forecasts). For example, if levels with raw odds of 0–10% were touched 35% of the time, a 5% level shows about 20%. The table always shows the raw model, so you can see how well it does.
- Outside regular hours, volatility comes from the actual moves of the last 90 minutes (all sessions).

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
| StockTwits quotes, via the Worker | no | A second source for pre-market and after-hours prices, and the only free source here for **overnight** prices (8 pm–4 am ET, 24-hour venues). The Worker keeps the quote with the newest trade time. | About 5 s |
| Yahoo Finance (Nasdaq.com as a backup), via the Worker | no | Live pre-market and after-hours prices, index levels (SOX, Dow, S&P 500, Nasdaq, VIX, 10Y), stock-page charts, daily bars for trend, volume, 52-week range | About 15–20 s |
| Nasdaq.com, via the Worker | no | Fund holdings (13F), insider trades (Form 4), analyst price targets | Quarterly / daily; cached 6–12 h |
| StockTwits, via the Worker | no | Latest messages with bullish/bearish tags | About 60 s |
| Google News and Yahoo Finance RSS, via the Worker | no | Fresh headlines for each stock | Every 60 s (cached 60 s) |

Yahoo Finance and Nasdaq.com do not officially support these data addresses, so they can change. If they stop, the banner shows an error, and **System health** shows "Extended-hours prices ✕".

---

## Limits
- **Finnhub free:** 60 calls per minute and 50 websocket symbols. The site uses 49 symbols and stays under 55 calls per minute.
- **Price freshness:** during regular hours, prices come live from the Finnhub websocket. Outside regular hours, the site asks the Worker every 5 seconds for SOXL, NVDA, AMD and AVGO (and the open stock page), and every 20 seconds for the other symbols. The Worker compares Yahoo and StockTwits and returns the newest trade; the banner shows both. StockTwits regular-hours quotes have a 15-minute delay, so they are used only when they are newer.
- **Worker limits:** Cloudflare's free plan allows 50 outgoing calls for each request. The Worker uses Yahoo for at most 14 symbols per request and the StockTwits batch for the rest, so a request never needs more than about 40 calls.
- **Worker requests:** the Cloudflare free plan allows 100,000 Worker requests per day. Each open page uses about 12 requests per minute outside regular hours. If many people use the site at the same time, upgrade the Worker plan or increase the poll interval in `startExt()`.
- **Index values:** the market strip shows the real SOX, Nasdaq, S&P 500, Dow, VIX and 10-year levels from Yahoo Finance through the Worker (about every 20 s). The cross-market table still uses the ETFs (DIA, SPY, QQQ), because Finnhub gives them live. Without the Worker, the strip shows SOXX in place of SOX.
- **SOX points:** a stock's points = its index contribution × the SOX prior close. The 30-stock index is an estimate, so its SOX points are shown with "≈" and can differ a little from the real SOX.
- **Holdings and weights:** from the iShares SOXX holdings file (Oct 19, 2026). Update the `HOLDINGS` list in `index.html` after each quarterly rebalance.
- **Leveraged-ETF assets:** `LETF_AUM` in `index.html` holds approximate values for SOXL and SOXS. Update them from direxion.com when they change.
- **Smart money:** no free source shows institutional orders directly. The Smart Money Index and large prints are proxies.
- **Consumer credit:** no free source gives consumer credit scores in real time. The site uses the Fed's delinquency, charge-off and debt-service data, plus live market signals.
- **13F filings** are quarterly and come up to 45 days after the quarter ends, so fund data shows positions, not today's trading.
- **StockTwits** can limit or block requests from Cloudflare. If it does, the social panel shows the error, and the links to StockTwits still work.
- **X (Twitter):** no free read access, so the site cannot show X posts. It opens X searches instead.
- **Game theory** results are statistical tests on past SOXL days. A small sample (n under 15) is marked "Too few days".
- **Recording:** the memory bank learns only while the page is open. Raw price bars older than 400 days are deleted to control storage; the learned knowledge stays permanently.
