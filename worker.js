// SOXX Sniper - FRED proxy (Cloudflare Worker, free plan)
// Keeps your FRED API key secret and lets your GitHub Pages site read FRED data.
// Secrets/variables to set in Cloudflare:
//   FRED_KEY      (secret)   your free key from https://fred.stlouisfed.org/docs/api/api_key.html
//   ALLOW_ORIGIN  (variable) your site origin, e.g. https://stevenwsharp-ctrl.github.io
//   POLYGON_KEY   (secret)   your free key from https://massive.com (formerly Polygon.io)
// Calls: GET https://<your-worker>.workers.dev/fred?ids=DGS10,DGS2&limit=60
//        GET https://<your-worker>.workers.dev/hist?t=SOXL&mult=5&span=minute&from=2026-01-02&to=2026-03-31
//        GET https://<your-worker>.workers.dev/ext?t=SOXL,NVDA        (live pre-market / after-hours / overnight prices; newest of Yahoo and StockTwits)
//        GET https://<your-worker>.workers.dev/chart?t=NVDA&range=1d&interval=1m   (intraday chart with extended hours)
//        GET https://<your-worker>.workers.dev/chart?t=NVDA&range=1y&interval=1d   (daily bars for trend and inflection points)
//        GET https://<your-worker>.workers.dev/holders?t=NVDA          (funds that hold, buy and sell; insiders; analyst target)
//        GET https://<your-worker>.workers.dev/holders?t=NVDA&lite=1   (summary only, for the index scan)
//        GET https://<your-worker>.workers.dev/econ                    (US economic calendar this week and next, with forecasts)
//        GET https://<your-worker>.workers.dev/social?t=SOXL           (latest StockTwits messages with bull/bear tags)
//        GET https://<your-worker>.workers.dev/social?t=SOXL&max=123   (older messages, for the caller track record)
//        GET https://<your-worker>.workers.dev/news?t=NVDA&q=Nvidia    (fresh headlines: Google News + Yahoo Finance, newest first)
//        GET https://<your-worker>.workers.dev/news?t=SOXL,NVDA,AMD&q=SOXL|Nvidia|AMD   (one feed for many stocks)
//        GET https://<your-worker>.workers.dev/maxpain?t=SOXL           (options max pain, call wall and put wall for the next 4 expiries)
//        GET https://<your-worker>.workers.dev/ghref?r=owner/repo&b=data  (newest commit of a public branch; Cohort Sniper uses it to load new data fast)
//        GET https://<your-worker>.workers.dev/letf/list               (LETF Sniper: every US leveraged / inverse ETF, parsed; refreshed every 12 h)
//        GET https://<your-worker>.workers.dev/letf/quotes             (LETF Sniper: live quotes for all funds and their underlyings, about every 10 s)

const ALLOW = new Set([
  "DFF","CPIAUCSL","CPILFESL","UNRATE","A191RL1Q225SBEA","ICSA","UMCSENT","NFCI","T10YIE",
  "DGS3MO","DGS2","DGS10","DGS30","T10Y2Y","T10Y3M","BAMLH0A0HYM2","BAMLC0A0CM",
  "SOFR","IORB","RRPONTSYD","WRESBAL","WALCL","WTREGEN",
  "DRCCLACBS","CORCCACBS","TDSP","TOTALSL","GFDEGDQ188S","DCOILWTICO"
]);
const TTL_MS = 20 * 60 * 1000;      // cache each series for 20 minutes
const memo = new Map();             // per-isolate cache: id|limit -> {t, obs}

function corsHeaders(req, env) {
  const origin = req.headers.get("Origin") || "";
  const allowed = env.ALLOW_ORIGIN ? env.ALLOW_ORIGIN.split(",").map(s => s.trim()) : ["*"];
  const allow = allowed.includes("*") ? "*" : (allowed.includes(origin) ? origin : allowed[0]);
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

async function getSeries(id, limit, key) {
  const k = id + "|" + limit, hit = memo.get(k);
  if (hit && Date.now() - hit.t < TTL_MS) return { obs: hit.obs, cached: true };
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}` +
    `&api_key=${key}&file_type=json&sort_order=desc&limit=${limit}`;
  const r = await fetch(url, { cf: { cacheTtl: 900, cacheEverything: true } });
  if (!r.ok) {
    if (hit) return { obs: hit.obs, stale: true };
    let msg = "";
    try { const e = await r.json(); msg = e.error_message || ""; } catch (e) {}
    return { error: r.status, message: msg };
  }
  const j = await r.json();
  const obs = (j.observations || [])
    .filter(o => o.value !== "." && o.value !== "")
    .map(o => [o.date, Number(o.value)]);
  memo.set(k, { t: Date.now(), obs });
  return { obs };
}

// ---- price history (Massive, formerly Polygon.io; free Basic plan: 5 calls/min, 2 years, includes extended hours)
const HIST_TICKERS = new Set(["SOXL", "SOXS", "SOXX", "QQQ", "SPY"]);
const HIST_TTL_MS = 6 * 60 * 60 * 1000;
const histMemo = new Map();
const BASES = ["https://api.massive.com", "https://api.polygon.io"];

async function getHist(t, mult, span, from, to, key) {
  const k = [t, mult, span, from, to].join("|"), hit = histMemo.get(k);
  if (hit && Date.now() - hit.t < HIST_TTL_MS) return hit.body;
  let last = { status: "error", error: "no response" };
  for (const base of BASES) {
    const url = `${base}/v2/aggs/ticker/${t}/range/${mult}/${span}/${from}/${to}` +
      `?adjusted=true&sort=asc&limit=50000&apiKey=${key}`;
    let r;
    try { r = await fetch(url); } catch (e) { last = { status: "error", error: String(e) }; continue; }
    let j = {};
    try { j = await r.json(); } catch (e) {}
    if (r.status === 429) return { status: "rate", error: "rate limit (5 calls per minute)" };
    if (!r.ok) { last = { status: "error", code: r.status, error: j.error || j.message || "" }; if (r.status === 401 || r.status === 403) return last; continue; }
    const bars = (j.results || []).map(b => [b.t, b.o, b.h, b.l, b.c, b.v]);
    const body = { status: "ok", t, from, to, count: bars.length, bars };
    histMemo.set(k, { t: Date.now(), body });
    return body;
  }
  return last;
}

// ---- live extended-hours quotes (pre-market and after-hours). Free sources, no key:
//      Yahoo Finance chart data first, Nasdaq.com as a backup. Unofficial endpoints: they can change.
const extMemo = new Map();
const EXT_TTL_MS = 4000;
const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36", "Accept": "application/json, text/plain, */*" };

async function yahooQuote(t) {
  for (const host of ["query1", "query2"]) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?interval=1m&range=1d&includePrePost=true`, { headers: UA });
      if (!r.ok) continue;
      const j = await r.json();
      const res = j && j.chart && j.chart.result && j.chart.result[0];
      if (!res || !res.timestamp) continue;
      const ts = res.timestamp, q = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
      let i = ts.length - 1;
      while (i >= 0 && (q.close == null || q.close[i] == null)) i--;
      if (i < 0) continue;
      const m = res.meta || {}, tp = m.currentTradingPeriod || {}, t0 = ts[i];
      const inP = p => p && t0 >= p.start && t0 < p.end;
      const session = inP(tp.pre) ? "pre" : inP(tp.regular) ? "regular" : inP(tp.post) ? "post" : "closed";
      return { t, price: q.close[i], time: t0 * 1000, vol: (q.volume && q.volume[i]) || 0, session,
        regularClose: m.regularMarketPrice, regTime: (m.regularMarketTime || 0) * 1000, prevClose: m.chartPreviousClose ?? m.previousClose, src: "yahoo" };
    } catch (e) {}
  }
  return null;
}
async function nasdaqQuote(t) {
  for (const cls of ["etf", "stocks"]) {
    try {
      const r = await fetch(`https://api.nasdaq.com/api/quote/${t}/info?assetclass=${cls}`, { headers: { ...UA, "Origin": "https://www.nasdaq.com", "Referer": "https://www.nasdaq.com/" } });
      if (!r.ok) continue;
      const j = await r.json(), d = j && j.data;
      if (!d || !d.primaryData) continue;
      const num = s => Number(String(s || "").replace(/[$,]/g, ""));
      const price = num(d.primaryData.lastSalePrice);
      if (!(price > 0)) continue;
      const ms = String(d.marketStatus || "").toLowerCase();
      return { t, price, time: Date.now(), vol: 0, session: ms.includes("after") ? "post" : ms.includes("pre") ? "pre" : ms.includes("open") ? "regular" : "closed",
        regularClose: num(d.secondaryData && d.secondaryData.lastSalePrice) || null, prevClose: null, src: "nasdaq" };
    } catch (e) {}
  }
  return null;
}
// StockTwits quote service: one call for many symbols, with pre-market / after-hours / overnight prices.
const stqMemo = new Map();
function etParse(dt, off) {
  if (!dt) return 0;
  const o = Number(off), sign = o < 0 ? "-" : "+", hh = String(Math.abs(o)).padStart(2, "0");
  const ms = Date.parse(String(dt).replace(" ", "T") + (isFinite(o) ? `${sign}${hh}:00` : "Z"));
  return isFinite(ms) ? ms : 0;
}
async function stQuotes(list) {
  const syms = list.filter(t => !t.startsWith("^") && !t.includes("-USD"));
  if (!syms.length) return {};
  const k = syms.join(","), hit = stqMemo.get(k);
  if (hit && Date.now() - hit.at < EXT_TTL_MS) return hit.q;
  const out = {};
  try {
    const r = await fetch(`https://ql.stocktwits.com/batch?symbols=${encodeURIComponent(k)}`, { headers: { ...UA, "Origin": "https://stocktwits.com", "Referer": "https://stocktwits.com/" } });
    if (r.ok) {
      const j = await r.json();
      for (const t of syms) {
        const d = j[t];
        if (!d || d.Outcome !== "Success") continue;
        const xt = etParse(d.ExtendedHoursDateTime, d.UTCOffset), rt = etParse(d.DateTime, d.UTCOffset);
        const useX = d.ExtendedHoursPrice > 0 && xt >= rt;
        const type = String(d.ExtendedHoursType || "").toLowerCase();
        out[t] = { t, price: useX ? d.ExtendedHoursPrice : d.Last, time: useX ? xt : rt, vol: 0,
          session: useX ? (type.includes("pre") ? "pre" : type.includes("over") ? "overnight" : "post") : "regular",
          regularClose: d.Last, regTime: rt, prevClose: d.PreviousClose, src: "stocktwits" };
      }
    }
  } catch (e) {}
  stqMemo.set(k, { at: Date.now(), q: out });
  return out;
}
// StockTwits symbol endpoint (price v2): includes the overnight session (8 pm - 4 am ET). One call per symbol,
// so it is used only for the first symbols of each request (SOXL first).
const st2Memo = new Map();
async function stQuoteV2(t) {
  const hit = st2Memo.get(t);
  if (hit && Date.now() - hit.at < EXT_TTL_MS) return hit.q;
  let q = null;
  try {
    const r = await fetch(`https://api.stocktwits.com/api/2/symbols/with_price/${encodeURIComponent(t)}.json?enable_price_v2=true&limit=1`, { headers: { ...UA, "Referer": "https://stocktwits.com/" } });
    if (r.ok) {
      const j = await r.json(), d = j && j.symbol && j.symbol.price_data;
      if (d) {
        const x = d.extended_hours, rt = Date.parse(d.timestamp) || 0, xt = x ? Date.parse(x.timestamp) || 0 : 0;
        const useX = x && x.price > 0 && xt >= rt, ty = String((x && x.session_type) || "").toUpperCase();
        q = { t, price: useX ? x.price : d.last, time: useX ? xt : rt, vol: 0,
          session: useX ? (ty.includes("OVERNIGHT") ? "overnight" : ty.includes("PRE") ? "pre" : "post") : "regular",
          regularClose: d.last, regTime: rt, prevClose: d.previous_close, src: "stocktwits" };
      }
    }
  } catch (e) {}
  st2Memo.set(t, { at: Date.now(), q });
  return q;
}
async function stAll(list) {
  const st = await stQuotes(list);
  const main = list.filter(t => !t.startsWith("^") && !t.includes("-USD")).slice(0, 10);
  const v2 = await Promise.all(main.map(stQuoteV2));
  main.forEach((t, i) => { const q = v2[i]; if (q && q.price > 0 && (!st[t] || q.time > st[t].time)) st[t] = q; });
  return st;
}
// Cloudflare free plan: at most 50 outgoing calls per request. Yahoo (up to 2 calls) is used for at most 14 symbols;
// the other symbols use the StockTwits batch, and Nasdaq is a backup only when StockTwits has no quote.
async function extQuote(t, st, useYahoo) {
  const hit = extMemo.get(t);
  let q = hit && Date.now() - hit.at < EXT_TTL_MS ? hit.q : null;
  if (!q && useYahoo) {
    q = (await yahooQuote(t)) || (t.startsWith("^") || (st && st[t]) ? null : await nasdaqQuote(t));
    if (q) extMemo.set(t, { at: Date.now(), q });
  }
  // keep the quote with the newest trade time
  const s = st && st[t];
  // regular close: from the source with the newest regular-session trade (Yahoo's regularMarketPrice can lag by an hour)
  const rc = (a, b) => { const A = a && a.regularClose > 0 ? a : null, B = b && b.regularClose > 0 ? b : null; if (!A || !B) return (A || B || {}).regularClose || null; return (A.regTime || 0) >= (B.regTime || 0) ? A.regularClose : B.regularClose; };
  if (s && s.price > 0 && (!q || s.time > (q.time || 0) + 1000)) return { ...s, regularClose: rc(s, q), prevClose: (q && q.prevClose) || s.prevClose, alt: q ? { src: q.src, price: q.price, time: q.time } : null };
  if (q && s && s.price > 0) return { ...q, regularClose: rc(q, s), alt: { src: s.src, price: s.price, time: s.time } };
  return q;
}

const chartMemo = new Map();
async function yahooChart(t, range, interval) {
  const k = [t, range, interval].join("|"), hit = chartMemo.get(k);
  if (hit && Date.now() - hit.at < (interval === "1m" ? 20000 : interval === "1d" || interval === "1wk" ? 3600000 : 60000)) return hit.body;
  for (const host of ["query1", "query2"]) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?interval=${interval}&range=${range}${interval === "1d" || interval === "1wk" ? "" : "&includePrePost=true"}`, { headers: UA });
      if (!r.ok) continue;
      const j = await r.json(), res = j && j.chart && j.chart.result && j.chart.result[0];
      if (!res) continue;
      const ts = res.timestamp || [], q = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {}, m = res.meta || {};
      const bars = [];
      for (let i = 0; i < ts.length; i++) if (q.close && q.close[i] != null) bars.push([ts[i] * 1000, q.open[i], q.high[i], q.low[i], q.close[i], (q.volume && q.volume[i]) || 0]);
      const body = { status: "ok", t, range, interval, bars, meta: {
        price: m.regularMarketPrice, prevClose: m.chartPreviousClose ?? m.previousClose, dayHigh: m.regularMarketDayHigh, dayLow: m.regularMarketDayLow,
        volume: m.regularMarketVolume, hi52: m.fiftyTwoWeekHigh, lo52: m.fiftyTwoWeekLow, name: m.longName || m.shortName || "", exchange: m.fullExchangeName || m.exchangeName || "",
        period: m.currentTradingPeriod || null } };
      chartMemo.set(k, { at: Date.now(), body });
      return body;
    } catch (e) {}
  }
  return { status: "error", error: "chart source did not answer" };
}

// ---- funds and insiders (Nasdaq.com, free, no key; 13F data is quarterly). Unofficial endpoints: they can change.
const holdMemo = new Map();
const HOLD_TTL_MS = 6 * 60 * 60 * 1000;
const NQ = { ...UA, "Origin": "https://www.nasdaq.com", "Referer": "https://www.nasdaq.com/" };
async function nq(path) {
  try {
    const r = await fetch("https://api.nasdaq.com" + path, { headers: NQ, cf: { cacheTtl: 3600, cacheEverything: true } });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.data ? j.data : null;
  } catch (e) { return null; }
}
const nnum = s => { if (s == null) return null; const t = String(s).replace(/[$,%\s]/g, ""); const neg = /^\(.*\)$/.test(t); const v = Number(t.replace(/[()]/g, "")); return isFinite(v) ? (neg ? -v : v) : null; };
const holdRows = d => ((d && d.holdingsTransactions && d.holdingsTransactions.table && d.holdingsTransactions.table.rows) || []).map(r => ({
  name: r.ownerName, date: r.date, held: nnum(r.sharesHeld), chg: nnum(r.sharesChange), pct: r.sharesChangePCT === "New" ? "New" : nnum(r.sharesChangePCT), value: nnum(r.marketValue) }));
function holdSummary(d) {
  if (!d) return null;
  const rowsOf = o => Object.fromEntries(((o && o.rows) || []).map(r => [r.positions, { holders: nnum(r.holders), shares: nnum(r.shares) }]));
  const a = rowsOf(d.activePositions), n = rowsOf(d.newSoldOutPositions), o = d.ownershipSummary || {};
  return {
    instPct: nnum(o.SharesOutstandingPCT && o.SharesOutstandingPCT.value),
    sharesOut: nnum(o.ShareoutstandingTotal && o.ShareoutstandingTotal.value) * 1e6 || null,
    valueM: nnum(o.TotalHoldingsValue && o.TotalHoldingsValue.value),
    inc: a["Increased Positions"] || null, dec: a["Decreased Positions"] || null, held: a["Held Positions"] || null,
    total: a["Total Institutional Shares"] || null, newp: n["New Positions"] || null, sold: n["Sold Out Positions"] || null };
}
async function getHolders(t, lite) {
  const k = t + "|" + (lite ? 1 : 0), hit = holdMemo.get(k);
  if (hit && Date.now() - hit.at < HOLD_TTL_MS) return hit.body;
  const base = `/api/company/${t}/institutional-holdings?type=`;
  const reqs = [nq(`${base}TOTAL&limit=${lite ? 1 : 8}&sortColumn=marketValue&sortOrder=DESC`), nq(`/api/analyst/${t}/targetprice`), nq(`/api/company/${t}/insider-trades?limit=${lite ? 1 : 8}&type=ALL&sortColumn=lastDate&sortOrder=DESC`)];
  if (!lite) reqs.push(
    nq(`${base}INCREASED&limit=5&sortColumn=sharesChange&sortOrder=DESC`), nq(`${base}DECREASED&limit=5&sortColumn=sharesChange&sortOrder=ASC`),
    nq(`${base}NEW&limit=4&sortColumn=sharesChange&sortOrder=DESC`), nq(`${base}SOLDOUT&limit=4&sortColumn=sharesChange&sortOrder=ASC`));
  const [tot, tp, ins, inc, dec, nw, so] = await Promise.all(reqs);
  if (!tot && !tp && !ins) return { status: "error", error: "Nasdaq did not answer" };
  const insRows = rows => Object.fromEntries(((rows) || []).map(r => [r.insiderTrade, { m3: nnum(r.months3), m12: nnum(r.months12) }]));
  const co = tp && tp.consensusOverview, hc = (tp && tp.historicalConsensus) || [];
  const body = { status: "ok", t, at: Date.now(), summary: holdSummary(tot),
    top: lite ? [] : holdRows(tot), buyers: holdRows(inc), sellers: holdRows(dec), newp: holdRows(nw), soldout: holdRows(so),
    insiders: ins ? { trades: insRows(ins.numberOfTrades && ins.numberOfTrades.rows), shares: insRows(ins.numberOfSharesTraded && ins.numberOfSharesTraded.rows),
      recent: lite ? [] : (((ins.transactionTable && ins.transactionTable.table && ins.transactionTable.table.rows) || []).map(r => ({ name: r.insider, rel: r.relation, date: r.lastDate, type: r.transactionType, shares: nnum(r.sharesTraded), price: nnum(r.lastPrice) }))) } : null,
    analysts: co ? { target: co.priceTarget, low: co.lowPriceTarget, high: co.highPriceTarget, buy: co.buy, hold: co.hold, sell: co.sell,
      history: hc.slice(-12).map(h => ({ date: h.z && h.z.date, consensus: h.z && h.z.consensus, buy: h.z && h.z.buy, hold: h.z && h.z.hold, sell: h.z && h.z.sell, price: h.y })) } : null };
  holdMemo.set(k, { at: Date.now(), body });
  return body;
}

// ---- StockTwits public stream (free, no key). Unofficial for this use: it can change or block.
const stMemo = new Map();
async function getSocial(t, max) {
  const key = t + "|" + (max || ""), hit = stMemo.get(key);
  if (hit && Date.now() - hit.at < 45000) return hit.body;
  let body = { status: "error", error: "StockTwits did not answer" };
  try {
    const r = await fetch(`https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(t)}.json${max ? "?max=" + max : ""}`, { headers: { ...UA, "Referer": "https://stocktwits.com/" } });
    if (r.ok) {
      const j = await r.json();
      const msgs = (j.messages || []).map(m => ({ id: m.id, body: String(m.body || "").slice(0, 600), at: Date.parse(m.created_at) || 0,
        user: m.user ? m.user.username : "", followers: m.user ? m.user.followers || 0 : 0, official: !!(m.user && m.user.official),
        sent: m.entities && m.entities.sentiment ? m.entities.sentiment.basic || null : null, likes: m.likes ? m.likes.total || 0 : 0,
        syms: (m.symbols || []).map(x => x.symbol).slice(0, 8) }));
      body = { status: "ok", t, at: Date.now(), watchers: j.symbol ? j.symbol.watchlist_count || null : null, msgs, next: j.cursor && j.cursor.more ? j.cursor.max : null };
    } else body = { status: "error", error: "StockTwits answered " + r.status };
  } catch (e) { body = { status: "error", error: String(e) }; }
  if (body.status === "ok") stMemo.set(key, { at: Date.now(), body });
  else if (hit) return { ...hit.body, stale: true };
  return body;
}

// ---- fresh news (Google News RSS + Yahoo Finance RSS, free, no key). Unofficial for this use: they can change.
const newsMemo = new Map();
const xmlText = s => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/<[^>]+>/g, "").trim();
function rssItems(xml, src) {
  const out = [];
  for (const m of String(xml).matchAll(/<item[^>]*>([\s\S]*?)<\/item>/g)) {
    const b = m[1], tag = n => { const r = b.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)<\\/${n}>`)); return r ? xmlText(r[1]) : ""; };
    let title = tag("title"), source = tag("source") || src;
    if (src === "google") { const i = title.lastIndexOf(" - "); if (i > 20) { source = source || title.slice(i + 3); title = title.slice(0, i); } }
    const at = Date.parse(tag("pubDate")) || 0, url = tag("link");
    if (title && url) out.push({ title: title.slice(0, 300), url, src: source === "google" ? "Google News" : source === "yahoo" ? "Yahoo Finance" : source, at, via: src });
  }
  return out;
}
// Macro headlines: Fed, inflation, jobs, growth, yields, dollar, tariffs and chip export rules, from Google News
// (two focused searches, last 24h) and CNBC's economy and markets feeds. Only headlines about the macro picture are kept.
const MACRO_RE = /\bfed\b|federal reserve|powell|fomc|rate (cut|hike)|interest rate|inflation|\bcpi\b|\bpce\b|\bppi\b|jobs report|payroll|jobless|unemployment|\bgdp\b|recession|economy|economic|treasury|yield|bond|dollar|tariff|trade war|export (control|curb|rule|ban)|chip (export|curb|rule|ban|act)|china|stimulus|deficit|debt ceiling|shutdown|consumer (spending|sentiment|confidence)|retail sales|ism|pmi|wage|housing|oil price|opec/i;
async function getMacroNews(debug) {
  const k = "macro", hit = newsMemo.get(k); if (hit && Date.now() - hit.at < 120000 && !debug) return hit.body;
  const get = u => fetch(u, { headers: { ...UA, Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8" }, cf: { cacheTtl: 90 } }).then(r => r.ok ? r.text() : "").catch(() => "");
  const gq = q => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
  const bq = q => `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&qft=interval%3d%227%22`;
  // many sources: if some block the Worker, the others still fill the list. ?debug=1 shows what each one returned.
  const SRC = [
    ["Google News", gq('(Fed OR "Federal Reserve" OR Powell OR FOMC OR "rate cut" OR inflation OR PCE OR CPI OR "jobs report" OR GDP OR "Treasury yields") when:1d'), "google"],
    ["Google News", gq('(tariffs OR "export controls" OR "chip exports" OR "trade war" OR "bond market" OR "dollar" OR recession OR "government shutdown") economy when:1d'), "google"],
    ["Bing News", bq('Federal Reserve OR inflation OR Treasury yields OR jobs report OR GDP'), "Bing News"],
    ["Bing News", bq('tariffs OR chip export OR bond market OR dollar OR recession economy'), "Bing News"],
    ["CNBC", "https://www.cnbc.com/id/20910258/device/rss/rss.html", "CNBC"],
    ["CNBC", "https://www.cnbc.com/id/10000664/device/rss/rss.html", "CNBC"],
    ["CNBC", "https://www.cnbc.com/id/100003114/device/rss/rss.html", "CNBC"],
    ["CNBC", "https://www.cnbc.com/id/15839135/device/rss/rss.html", "CNBC"],
    ["MarketWatch", "https://feeds.content.dowjones.io/public/rss/mw_topstories", "MarketWatch"],
    ["MarketWatch", "https://feeds.content.dowjones.io/public/rss/mw_marketpulse", "MarketWatch"],
    ["WSJ", "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain", "WSJ"],
    ["WSJ", "https://feeds.content.dowjones.io/public/rss/socialeconomyfeed", "WSJ"],
    ["Yahoo Finance", "https://finance.yahoo.com/news/rssindex", "Yahoo Finance"],
    ["Federal Reserve", "https://www.federalreserve.gov/feeds/press_all.xml", "Federal Reserve"],
    ["Investing.com", "https://www.investing.com/rss/news_14.rss", "Investing.com"],
    ["Investing.com", "https://www.investing.com/rss/news_95.rss", "Investing.com"]
  ];
  const texts = await Promise.all(SRC.map(x => get(x[1])));
  const seen = new Set(), items = [], dbg = [];
  SRC.forEach(([name, u, tag], n) => { const all = rssItems(texts[n], tag); let kept = 0;
    for (const it of all) {
      const fed = tag === "Federal Reserve";
      if ((!fed && !MACRO_RE.test(it.title)) || Date.now() - it.at > 36 * 36e5) continue;
      const key = it.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 70); if (seen.has(key)) continue; seen.add(key); items.push(it); kept++;
    }
    dbg.push({ src: name, url: u.slice(0, 80), bytes: texts[n].length, items: all.length, kept }); });
  items.sort((p, q) => q.at - p.at);
  const body = { status: items.length ? "ok" : "error", error: items.length ? undefined : "news sources did not answer", at: Date.now(), items: items.slice(0, 60) };
  if (debug) body.sources = dbg;
  if (items.length) newsMemo.set(k, { at: Date.now(), body });
  return body;
}
async function getNews(tickers, terms) {
  const k = tickers.join(",") + "|" + terms.join("|"), hit = newsMemo.get(k);
  if (hit && Date.now() - hit.at < 60000) return hit.body;
  const q = terms.length > 1 ? `(${terms.map(t => `"${t}"`).join(" OR ")}) stock when:1d` : `("${terms[0]}" OR ${tickers[0]}) stock when:2d`;
  const [g, y] = await Promise.all([
    fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`, { headers: UA }).then(r => r.ok ? r.text() : "").catch(() => ""),
    fetch(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(tickers.slice(0, 10).join(","))}&region=US&lang=en-US`, { headers: UA }).then(r => r.ok ? r.text() : "").catch(() => "")
  ]);
  const seen = new Set(), items = [];
  for (const it of [...rssItems(g, "google"), ...rssItems(y, "yahoo")]) {
    const key = it.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key); items.push(it);
  }
  items.sort((a, b) => b.at - a.at);
  const body = { status: g || y ? "ok" : "error", error: g || y ? undefined : "news sources did not answer", at: Date.now(), items: items.slice(0, 60) };
  if (g || y) newsMemo.set(k, { at: Date.now(), body });
  return body;
}

// ---- LETF Sniper: the universe of US leveraged and inverse ETFs (Nasdaq ETF screener) and batch quotes (StockTwits) ----
const LETF_BRANDS = ["Direxion","ProShares","GraniteShares","Tradr","T-REX","T-Rex","Defiance","Corgi","Leverage Shares","MicroSectors","Volatility Shares","Kurv","Roundhill","Tuttle","AXS","Bitwise","Valkyrie","Cyber Hornet","Teucrium","Rareview","21Shares","ETRACS","MAX ","USCF","Max "];
const LETF_NAMES = { "SK hynix":"SKHY","Sk Hynix":"SKHY","SK Hynix":"SKHY",Apple:"AAPL",Tesla:"TSLA",Nvidia:"NVDA",NVIDIA:"NVDA",Microsoft:"MSFT",Amazon:"AMZN",Meta:"META",Alphabet:"GOOGL",Google:"GOOGL",Netflix:"NFLX",Palantir:"PLTR",Coinbase:"COIN",MicroStrategy:"MSTR",Broadcom:"AVGO",Intel:"INTC",Micron:"MU",Robinhood:"HOOD",Uber:"UBER",Shopify:"SHOP",Oracle:"ORCL",Salesforce:"CRM",Boeing:"BA",Disney:"DIS","Eli Lilly":"LLY",Rivian:"RIVN",GameStop:"GME",Supermicro:"SMCI","Super Micro":"SMCI",Reddit:"RDDT",SoFi:"SOFI",Roblox:"RBLX",IonQ:"IONQ",Rigetti:"RGTI",Oklo:"OKLO",Alibaba:"BABA",Baidu:"BIDU",CrowdStrike:"CRWD",Affirm:"AFRM",Hims:"HIMS",Circle:"CRCL",SpaceX:"SPCX" };
const LETF_IDX = [[/magnificent ?(7|seven)/i,"MAGS","Magnificent 7"],[/semiconductor|\bSOX\b/i,"SOXX","Semiconductors"],[/memory/i,"DRAM","Memory chips"],[/s&p ?500|\bS&P\b(?! mid| small| reg| oil| bio| hom| retail)/i,"SPY","S&P 500"],[/nasdaq[- ]?100|\bQQQ\b|innovation 100|nasdaq/i,"QQQ","Nasdaq-100"],[/russell ?2000|small[- ]?cap/i,"IWM","Small caps"],[/micro[- ]?cap/i,"IWC","Micro caps"],[/\bdow\b|dow ?30|dow jones/i,"DIA","Dow"],[/mid[- ]?cap/i,"MDY","Mid caps"],[/large[- ]?cap|total u\.?s\.? market/i,"VTI","US market"],[/mega[- ]?cap growth|u\.s\. growth/i,"MGK","Large growth"],[/junior gold/i,"GDXJ","Junior gold miners"],[/gold miners/i,"GDX","Gold miners"],[/copper/i,"CPER","Copper"],[/\bgold\b/i,"GLD","Gold"],[/silver/i,"SLV","Silver"],[/palladium/i,"PALL","Palladium"],[/platinum/i,"PPLT","Platinum"],[/\bcorn\b/i,"CORN","Corn"],[/wheat/i,"WEAT","Wheat"],[/all commodities/i,"DBC","Commodities"],[/20\+? ?(year|yr)|long[- ]term treasur|\bTLT\b/i,"TLT","20+ yr Treasury"],[/7-10 ?year|10 ?year/i,"IEF","10-yr Treasury"],[/investment grade/i,"LQD","Investment-grade bonds"],[/high yield|junk/i,"HYG","High yield"],[/bitcoin|\bBTC\b/i,"BTC.X","Bitcoin"],[/\bether\b|ethereum|\bETH\b/i,"ETH.X","Ether"],[/solana|\bSOL\b/i,"SOL.X","Solana"],[/\bXRP\b/i,"XRP.X","XRP"],[/dogecoin/i,"DOGE.X","Dogecoin"],[/\bsui\b/i,"SUI.X","Sui"],[/crypto/i,"BTC.X","Crypto"],[/crude|\boil\b/i,"USO","Oil"],[/natural gas/i,"UNG","Natural gas"],[/regional bank/i,"KRE","Regional banks"],[/financial|bank/i,"XLF","Financials"],[/biotech/i,"XBI","Biotech"],[/communication/i,"XLC","Communication"],[/technology|\btech\b/i,"XLK","Technology"],[/energy/i,"XLE","Energy"],[/homebuild/i,"ITB","Homebuilders"],[/retail/i,"XRT","Retail"],[/real estate/i,"XLRE","Real estate"],[/mortgage reit/i,"REM","Mortgage REITs"],[/\bmlp\b/i,"AMLP","MLPs"],[/\bbdc\b/i,"BIZD","BDCs"],[/closed-end/i,"CEFS","Closed-end funds"],[/china internet|chinese internet|csi china/i,"KWEB","China internet"],[/china/i,"FXI","China"],[/emerging/i,"EEM","Emerging markets"],[/japan/i,"EWJ","Japan"],[/korea/i,"EWY","Korea"],[/taiwan/i,"EWT","Taiwan"],[/india/i,"INDA","India"],[/brazil/i,"EWZ","Brazil"],[/mexico/i,"EWW","Mexico"],[/ex-u\.?s/i,"VXUS","Ex-US stocks"],[/all world|world stock/i,"ACWI","World stocks"],[/europe|eafe/i,"EFA","Developed markets"],[/fang/i,"FNGS","FANG+"],[/space/i,"UFO","Space"],[/airline|travel/i,"JETS","Airlines and travel"],[/auto industry/i,"CARZ","Autos"],[/aerospace|defense/i,"ITA","Defense"],[/health ?care|pharma/i,"XLV","Health care"],[/utilit/i,"XLU","Utilities"],[/industrial/i,"XLI","Industrials"],[/infrastructure/i,"PAVE","Infrastructure"],[/material/i,"XLB","Materials"],[/consumer discr/i,"XLY","Consumer discretionary"],[/consumer stap/i,"XLP","Consumer staples"],[/transport/i,"IYT","Transports"],[/\bvix\b|volatility/i,"VIXY","VIX futures"],[/cloud|software/i,"IGV","Software"],[/cyber/i,"HACK","Cybersecurity"],[/dollar/i,"UUP","US dollar"],[/\beuro\b/i,"FXE","Euro"],[/\byen\b/i,"FXY","Yen"],[/\bai\b|artificial intel|big data/i,"AIQ","AI"],[/quantum/i,"QTUM","Quantum"],[/uranium|nuclear/i,"URA","Uranium"],[/innovation/i,"ARKK","Innovation"]];
const LETF_STOP = new Set(["ETF","ETN","ETNS","DAILY","LONG","SHORT","BULL","BEAR","US","U.S.","USD","MSCI","FTSE","CSI","NYSE","FANG","ULTRA","TARGET","INDEX","X","II","I","III","IV","TR","AND","OF","THE","SPDR","ADR","REX","T","CORGI","S","P","AI","E","QQQ","SOX","BTC","ETH","SOL","XRP","VIX","K","MAX"]);
const LETF_RE1 = /(?:[Ll]ong|[Ss]hort|[Ii]nverse|[Dd]aily|[Bb]ull|[Bb]ear|[Tt]arget|\d(?:\.\d+)?\s*[xX])\s+([A-Z][A-Z.]{0,5})\b/g, LETF_RE2 = /\b([A-Z][A-Z.]{0,5})\s+(?:[Bb]ull|[Bb]ear|\d(?:\.\d+)?\s*[xX]\b)/g;
function letfParse(sym, name) {
  let n = String(name || "").replace(/\s+/g, " ").trim(), bi = -1;
  for (const b of LETF_BRANDS) { const i = n.indexOf(b); if (i >= 0 && (bi < 0 || i < bi)) bi = i; }
  if (bi > 0) n = n.slice(bi);
  if (/buffer|income|premium|covered|duration|maturity|floating|managed futures|hedged|treasury bill|defined|risk parity|ultra-small|ultra[- ]?short (bond|term|treasury|municipal|government|investment|tax)|ultrashort (bond|treasury|tax)/i.test(n) && !/\d(\.\d+)?\s*x\b|bull|bear/i.test(n)) return null;
  let L = 0, neg = /\b(short|bear|inverse)\b(?!-term)/i.test(n);
  const m = n.match(/(-?\d+(?:\.\d+)?)\s*x\b/i);
  if (m) { L = Math.abs(parseFloat(m[1])); if (m[1].startsWith("-")) neg = true; }
  else if (/ProShares/i.test(n)) {
    neg = false;
    if (/ultrapro short/i.test(n)) { L = 3; neg = true; } else if (/ultrashort/i.test(n)) { L = 2; neg = true; }
    else if (/ultrapro/i.test(n)) L = 3; else if (/\bultra\b/i.test(n)) L = 2; else if (/proshares short\b/i.test(n)) { L = 1; neg = true; }
  } else if (/\binverse\b/i.test(n)) { L = 1; neg = true; }
  if (!L || (!neg && L < 1.2) || L > 5) return null;
  let u = null, kind = "index", lab = null;
  for (const k in LETF_NAMES) if (new RegExp("\\b" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(n)) { u = LETF_NAMES[k]; break; }
  if (!u) for (const re of [LETF_RE1, LETF_RE2]) { re.lastIndex = 0; let x; while ((x = re.exec(n))) { if (!LETF_STOP.has(x[1])) { u = x[1]; break; } } if (u) break; }
  if (u) { kind = "stock"; lab = u; }
  else for (const [re, p, l] of LETF_IDX) if (re.test(n)) { u = p; lab = l; kind = /\.X$/.test(p) ? "crypto" : /USO|UNG|GLD|SLV|GDX|GDXJ|URA|CPER|PALL|PPLT|CORN|WEAT|DBC/.test(p) ? "commodity" : /TLT|IEF|HYG|LQD/.test(p) ? "rates" : p === "VIXY" ? "volatility" : "index"; break; }
  const issuer = (LETF_BRANDS.find(b => n.startsWith(b)) || n.split(" ")[0]).trim();
  return { s: sym, n: n.replace(/\s+/g, " ").slice(0, 90), L: neg ? -L : L, u, kind, lab: lab || n.replace(/^(Direxion Daily|ProShares|GraniteShares|Leverage Shares|Defiance Daily Target|T-REX|T-Rex|Tradr|Corgi|MicroSectors)\s*/i, "").slice(0, 40), iss: issuer };
}
let letfU = null;
async function letfUniverse() {
  if (letfU && Date.now() - letfU.at < 12 * 3600000) return letfU;
  const r = await fetch("https://api.nasdaq.com/api/screener/etf?tableonly=true&download=true", { headers: NQ, cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!r.ok) { if (letfU) return letfU; throw new Error("Nasdaq screener answered " + r.status); }
  const j = await r.json(), rows = (j && j.data && j.data.data && j.data.data.rows) || [];
  const funds = rows.map(x => letfParse(x.symbol, x.companyName)).filter(Boolean);
  // a name shared by 3+ funds is a data error at the source: do not trust its underlying
  const cnt = {}; funds.forEach(f => cnt[f.n] = (cnt[f.n] || 0) + 1);
  funds.forEach(f => { if (cnt[f.n] >= 3 && f.kind === "stock") { f.u = null; f.kind = "unknown"; f.lab = "?"; } });
  letfU = { at: Date.now(), asOf: j && j.data && j.data.dataAsOf, funds };
  return letfU;
}
let letfQ = null;
async function letfQuotes() {
  if (letfQ && Date.now() - letfQ.at < 9000) return letfQ.body;
  const U = await letfUniverse();
  const syms = [...new Set([...U.funds.map(f => f.s), ...U.funds.map(f => f.u).filter(Boolean)])];
  const chunks = []; for (let i = 0; i < syms.length; i += 100) chunks.push(syms.slice(i, i + 100));
  const res = await Promise.all(chunks.slice(0, 30).map(c => fetch(`https://ql.stocktwits.com/batch?symbols=${encodeURIComponent(c.join(","))}`, { headers: { ...UA, "Origin": "https://stocktwits.com", "Referer": "https://stocktwits.com/" } }).then(r => r.ok ? r.json() : {}).catch(() => ({}))));
  const q = {};
  res.forEach(j => { for (const k in j) { const d = j[k]; if (!d || d.Outcome !== "Success") continue;
    const t = Date.parse(d.ISO8601) || etParse(d.DateTime, d.UTCOffset), xt = etParse(d.ExtendedHoursDateTime, d.UTCOffset);
    q[k] = [d.Last, d.PercentChange, d.Volume || 0, d.High, d.Low, d.Open, d.PreviousClose, t, d.ExtendedHoursPrice || null, d.ExtendedHoursPercentChange ?? null, xt || null]; } });
  const body = { status: Object.keys(q).length ? "ok" : "error", at: Date.now(), n: Object.keys(q).length, q };
  if (body.status === "ok") letfQ = { at: Date.now(), body };
  return body;
}

// ---- options max pain (Nasdaq option chain, free, no key; open interest updates once a day) ----
const mpMemo = new Map();
async function getMaxPain(t) {
  const hit = mpMemo.get(t);
  if (hit && Date.now() - hit.at < 30 * 60000) return hit.body;
  const num = s => { const v = Number(String(s == null ? "" : s).replace(/[$,]/g, "")); return isFinite(v) ? v : 0; };
  let rows = [], last = null;
  for (const cls of ["etf", "stocks"]) {
    try {
      const r = await fetch(`https://api.nasdaq.com/api/quote/${t}/option-chain?assetclass=${cls}&limit=3000&fromdate=all&todate=undefined&excode=oprac&callput=callput&money=all&type=all`, { headers: NQ });
      if (!r.ok) continue;
      const j = await r.json(), d = j && j.data;
      if (d && d.table && d.table.rows && d.table.rows.length) { rows = d.table.rows; last = d.lastTrade || null; break; }
    } catch (e) {}
  }
  if (!rows.length) return hit ? { ...hit.body, stale: true } : { status: "error", error: "Nasdaq option chain did not answer" };
  const ex = []; let cur = null;
  for (const x of rows) {
    if (x.expirygroup) { cur = { exp: x.expirygroup, k: [] }; ex.push(cur); continue; }
    if (!cur || x.strike == null) continue;
    cur.k.push({ s: num(x.strike), c: num(x.c_Openinterest), p: num(x.p_Openinterest), cv: num(x.c_Volume), pv: num(x.p_Volume) });
  }
  const out = ex.filter(e => e.k.length).slice(0, 4).map(e => {
    const K = e.k.filter(k => k.s > 0).sort((a, b) => a.s - b.s);
    let best = null, pain = [];
    for (const at of K) {
      let v = 0; for (const k of K) { if (at.s > k.s) v += k.c * (at.s - k.s); if (at.s < k.s) v += k.p * (k.s - at.s); }
      pain.push([at.s, v * 100]); if (!best || v < best.v) best = { s: at.s, v };
    }
    const cOI = K.reduce((a, k) => a + k.c, 0), pOI = K.reduce((a, k) => a + k.p, 0);
    const cw = K.reduce((a, k) => k.c > (a ? a.c : -1) ? k : a, null), pw = K.reduce((a, k) => k.p > (a ? a.p : -1) ? k : a, null);
    return { exp: e.exp, maxPain: best ? best.s : null, payout: best ? best.v * 100 : null, callOI: cOI, putOI: pOI, pcr: cOI ? pOI / cOI : null,
      callWall: cw ? cw.s : null, callWallOI: cw ? cw.c : null, putWall: pw ? pw.s : null, putWallOI: pw ? pw.p : null,
      strikes: K.map(k => [k.s, k.c, k.p]) };
  });
  const body = { status: "ok", t, at: Date.now(), last, expiries: out };
  mpMemo.set(t, { at: Date.now(), body });
  return body;
}

// ---- newest commit of a public GitHub branch, from git refs (no GitHub API quota). Used by Cohort Sniper to see new data fast.
const refMemo = new Map();
async function ghRef(repo, branch) {
  const k = repo + "|" + branch, hit = refMemo.get(k);
  if (hit && Date.now() - hit.at < 8000) return hit.body;
  let body = { status: "error", error: "GitHub did not answer" };
  try {
    const r = await fetch(`https://github.com/${repo}.git/info/refs?service=git-upload-pack`, { headers: { "User-Agent": "git/2.40.0" } });
    if (r.ok) { const t = await r.text(), m = t.match(new RegExp("([0-9a-f]{40}) refs/heads/" + branch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:\\s|\\x00|$)"));
      body = m ? { status: "ok", sha: m[1], at: Date.now() } : { status: "error", error: "branch not found" }; }
    else body = { status: "error", error: "GitHub answered " + r.status };
  } catch (e) { body = { status: "error", error: String(e) }; }
  if (body.status === "ok") refMemo.set(k, { at: Date.now(), body }); else if (hit) return hit.body;
  return body;
}

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(req.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, key: !!env.FRED_KEY, hist: !!env.POLYGON_KEY }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/ext") {
      const list = (url.searchParams.get("t") || "").toUpperCase().split(",").map(s => s.trim()).filter(s => /^\^?[A-Z][A-Z0-9.\-]{0,8}$/.test(s)).slice(0, 24);
      const quotes = {}, st = await stAll(list);
      await Promise.all(list.map(async (t, i) => { const q = await extQuote(t, st, i < 14 || !st[t]); if (q) quotes[t] = q; }));
      return new Response(JSON.stringify({ t: Date.now(), quotes }), { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }
    if (url.pathname === "/chart") {
      const t = (url.searchParams.get("t") || "").toUpperCase();
      const range = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y"].includes(url.searchParams.get("range")) ? url.searchParams.get("range") : "1d";
      const interval = ["1m", "2m", "5m", "15m", "30m", "60m", "1d", "1wk"].includes(url.searchParams.get("interval")) ? url.searchParams.get("interval") : "1m";
      const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
      if (!/^\^?[A-Z][A-Z0-9.\-]{0,8}$/.test(t)) return json({ status: "error", error: "bad ticker" }, 400);
      return json(await yahooChart(t, range, interval));
    }
    if (url.pathname === "/letf/list" || url.pathname === "/letf/quotes") {
      const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
      try {
        if (url.pathname === "/letf/list") { const U = await letfUniverse(); return json({ status: "ok", at: U.at, asOf: U.asOf, n: U.funds.length, funds: U.funds }); }
        return json(await letfQuotes());
      } catch (e) { return json({ status: "error", error: String(e.message || e) }, 502); }
    }
    if (url.pathname === "/maxpain") {
      const t = (url.searchParams.get("t") || "").toUpperCase();
      const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=600" } });
      if (!/^[A-Z][A-Z.\-]{0,7}$/.test(t)) return json({ status: "error", error: "bad ticker" }, 400);
      return json(await getMaxPain(t));
    }
    if (url.pathname === "/ghref") {
      const repo = url.searchParams.get("r") || "", br = url.searchParams.get("b") || "data";
      const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
      if (!/^[\w.-]{1,39}\/[\w.-]{1,100}$/.test(repo) || !/^[\w.\/-]{1,60}$/.test(br)) return json({ status: "error", error: "bad repo" }, 400);
      return json(await ghRef(repo, br));
    }
    if (url.pathname === "/news") {
      const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
      if (url.searchParams.get("macro") === "1") return json(await getMacroNews(url.searchParams.get("debug") === "1"));
      const tickers = (url.searchParams.get("t") || "").toUpperCase().split(",").map(s => s.trim()).filter(s => /^[A-Z][A-Z.\-]{0,7}$/.test(s)).slice(0, 12);
      const terms = (url.searchParams.get("q") || "").split("|").map(s => s.trim()).filter(s => /^[A-Za-z0-9 &.\-]{1,40}$/.test(s)).slice(0, 14);
      if (!tickers.length) return json({ status: "error", error: "bad ticker" }, 400);
      return json(await getNews(tickers, terms.length ? terms : [tickers[0]]));
    }
    if (url.pathname === "/holders" || url.pathname === "/social") {
      const t = (url.searchParams.get("t") || "").toUpperCase();
      const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
      if (!/^[A-Z][A-Z.\-]{0,7}$/.test(t)) return json({ status: "error", error: "bad ticker" }, 400);
      return json(url.pathname === "/holders" ? await getHolders(t, url.searchParams.get("lite") === "1") : await getSocial(t, /^\d{1,15}$/.test(url.searchParams.get("max") || "") ? url.searchParams.get("max") : null));
    }
    if (url.pathname === "/econ") {
      // US economic calendar for this week and next (Forex Factory public feed): time in ET, impact, forecast, previous, actual
      const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=900" } });
      return json(await getEcon());
    }
    if (url.pathname === "/hist") {
      const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
      if (!env.POLYGON_KEY) return json({ status: "error", error: "POLYGON_KEY secret is not set" }, 500);
      const t = (url.searchParams.get("t") || "").toUpperCase();
      const from = url.searchParams.get("from") || "", to = url.searchParams.get("to") || "";
      const mult = Math.max(1, Math.min(Number(url.searchParams.get("mult")) || 5, 60));
      const span = ["minute", "hour", "day"].includes(url.searchParams.get("span")) ? url.searchParams.get("span") : "minute";
      if (!HIST_TICKERS.has(t) || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return json({ status: "error", error: "bad parameters" }, 400);
      return json(await getHist(t, mult, span, from, to, String(env.POLYGON_KEY).trim()));
    }
    if (url.pathname !== "/fred") return new Response("Not found", { status: 404, headers: cors });
    if (!env.FRED_KEY) {
      return new Response(JSON.stringify({ error: "FRED_KEY secret is not set" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" }
      });
    }
    const ids = (url.searchParams.get("ids") || "").split(",").map(s => s.trim()).filter(id => ALLOW.has(id)).slice(0, 40);
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 60, 120));
    const out = {};
    await Promise.all(ids.map(async id => {
      try { out[id] = await getSeries(id, limit, String(env.FRED_KEY).trim()); }
      catch (e) { out[id] = { error: String(e) }; }
    }));
    return new Response(JSON.stringify({ t: Date.now(), series: out }), {
      headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" }
    });
  }
};

// ---- economic calendar ----
async function getEcon() {
  const out = [];
  for (const w of ["thisweek", "nextweek"]) {
    try {
      const r = await fetch(`https://nfs.faireconomy.media/ff_calendar_${w}.json`, { headers: { "User-Agent": "Mozilla/5.0" }, cf: { cacheTtl: 900 } });
      if (!r.ok) continue;
      for (const e of await r.json()) {
        if (e.country !== "USD" || !["High", "Medium"].includes(e.impact)) continue;
        const t = Date.parse(e.date); if (!isFinite(t)) continue;
        const et = new Date(t).toLocaleString("en-CA", { timeZone: "America/New_York", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
        const [d, hm] = et.split(", ");
        out.push({ d, t: hm.replace(/^24/, "00"), n: e.title, i: e.impact === "High" ? 3 : 2, fc: e.forecast || "", pv: e.previous || "", ac: e.actual || "" });
      }
    } catch (e) { }
  }
  // Nasdaq economic calendar (free, no key): US events with actual, consensus and previous, for yesterday to 10 days ahead.
  // Used together with Forex Factory (which often blocks Cloudflare); duplicates are dropped.
  const nq = await nasdaqEcon();
  for (const x of nq) if (!out.some(y => y.d === x.d && y.t === x.t && y.n.toLowerCase().slice(0, 12) === x.n.toLowerCase().slice(0, 12))) out.push(x);
  out.sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));
  return out.length ? { status: "ok", items: out, src: nq.length ? "nasdaq" + (out.length > nq.length ? "+ff" : "") : "ff" } : { status: "error", error: "calendar feeds did not answer" };
}
const econMemo = new Map();
const ECON_HI = /nonfarm|payrolls|unemployment rate|\bcpi\b|consumer price|\bppi\b|producer price|\bpce\b|\bgdp\b(?! sales| price)|fomc|interest rate decision|fed chair|powell|retail sales|ism (manufacturing|services|non-manufacturing) pmi|jolts|average hourly earnings|employment cost/i;
const ECON_MID = /jobless claims|consumer confidence|michigan|durable goods|housing starts|new home sales|existing home|industrial production|ism|pmi|trade balance|personal income|personal spending|gdpnow|10-year note auction|30-year bond auction|fed's |fed (member|governor|president)|beige book|adp|challenger|chicago pmi|empire state|philadelphia fed|crude oil inventories|wholesale inventories|factory orders|construction spending|treasury|note auction|bond auction/i;
async function nasdaqEcon() {
  const out = [], today = new Date(Date.now() - 4 * 36e5);   // close to ET
  const days = []; for (let i = -1; i <= 10; i++) { const d = new Date(today.getTime() + i * 864e5); const wd = d.getUTCDay(); if (wd === 0 || wd === 6) continue; days.push(d.toISOString().slice(0, 10)); }
  await Promise.all(days.map(async d => {
    const hit = econMemo.get(d); if (hit && Date.now() - hit.at < (d <= today.toISOString().slice(0, 10) ? 5 * 6e4 : 60 * 6e4)) { out.push(...hit.items); return; }
    try {
      const r = await fetch(`https://api.nasdaq.com/api/calendar/economicevents?date=${d}`, { headers: NQ }); if (!r.ok) return;
      const j = await r.json(), rows = (j && j.data && j.data.rows) || [], items = [];
      const clean = v => String(v == null ? "" : v).replace(/&nbsp;/g, "").trim();
      for (const x of rows) {
        if (!/united states/i.test(x.country || "")) continue;
        const n = clean(x.eventName), i = ECON_HI.test(n) ? 3 : ECON_MID.test(n) ? 2 : 1; if (i < 2) continue;
        const t = /^\d{1,2}:\d{2}$/.test(clean(x.gmt)) ? clean(x.gmt).padStart(5, "0") : "08:30";   // Nasdaq lists US events in ET
        items.push({ d, t, n, i, fc: clean(x.consensus), pv: clean(x.previous), ac: clean(x.actual), src: "nasdaq" });
      }
      econMemo.set(d, { at: Date.now(), items }); out.push(...items);
    } catch (e) { }
  }));
  return out;
}
