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
//        GET https://<your-worker>.workers.dev/social?t=SOXL           (latest StockTwits messages with bull/bear tags)
//        GET https://<your-worker>.workers.dev/social?t=SOXL&max=123   (older messages, for the caller track record)
//        GET https://<your-worker>.workers.dev/news?t=NVDA&q=Nvidia    (fresh headlines: Google News + Yahoo Finance, newest first)
//        GET https://<your-worker>.workers.dev/news?t=SOXL,NVDA,AMD&q=SOXL|Nvidia|AMD   (one feed for many stocks)

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
        regularClose: m.regularMarketPrice, prevClose: m.chartPreviousClose ?? m.previousClose, src: "yahoo" };
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
          regularClose: d.Last, prevClose: d.PreviousClose, src: "stocktwits" };
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
          regularClose: d.last, prevClose: d.previous_close, src: "stocktwits" };
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
  if (s && s.price > 0 && (!q || s.time > (q.time || 0) + 1000)) return { ...s, regularClose: (q && q.regularClose) || s.regularClose, prevClose: (q && q.prevClose) || s.prevClose, alt: q ? { src: q.src, price: q.price, time: q.time } : null };
  if (q && s && s.price > 0) return { ...q, alt: { src: s.src, price: s.price, time: s.time } };
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
  for (const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1], tag = n => { const r = b.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)<\\/${n}>`)); return r ? xmlText(r[1]) : ""; };
    let title = tag("title"), source = tag("source") || src;
    if (src === "google") { const i = title.lastIndexOf(" - "); if (i > 20) { source = source || title.slice(i + 3); title = title.slice(0, i); } }
    const at = Date.parse(tag("pubDate")) || 0, url = tag("link");
    if (title && url) out.push({ title: title.slice(0, 300), url, src: source === "google" ? "Google News" : source === "yahoo" ? "Yahoo Finance" : source, at, via: src });
  }
  return out;
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
    if (url.pathname === "/news") {
      const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
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
