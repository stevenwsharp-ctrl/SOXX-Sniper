// SOXX Sniper - FRED proxy (Cloudflare Worker, free plan)
// Keeps your FRED API key secret and lets your GitHub Pages site read FRED data.
// Secrets/variables to set in Cloudflare:
//   FRED_KEY      (secret)   your free key from https://fred.stlouisfed.org/docs/api/api_key.html
//   ALLOW_ORIGIN  (variable) your site origin, e.g. https://stevenwsharp-ctrl.github.io
//   POLYGON_KEY   (secret)   your free key from https://massive.com (formerly Polygon.io)
// Calls: GET https://<your-worker>.workers.dev/fred?ids=DGS10,DGS2&limit=60
//        GET https://<your-worker>.workers.dev/hist?t=SOXL&mult=5&span=minute&from=2026-01-02&to=2026-03-31
//        GET https://<your-worker>.workers.dev/ext?t=SOXL,NVDA        (live pre-market / after-hours prices)
//        GET https://<your-worker>.workers.dev/chart?t=NVDA&range=1d&interval=1m   (intraday chart with extended hours)

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
const EXT_TTL_MS = 8000;
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
async function extQuote(t) {
  const hit = extMemo.get(t);
  if (hit && Date.now() - hit.at < EXT_TTL_MS) return hit.q;
  const q = (await yahooQuote(t)) || (t.startsWith("^") ? null : await nasdaqQuote(t));
  if (q) extMemo.set(t, { at: Date.now(), q });
  return q;
}

const chartMemo = new Map();
async function yahooChart(t, range, interval) {
  const k = [t, range, interval].join("|"), hit = chartMemo.get(k);
  if (hit && Date.now() - hit.at < (interval === "1m" ? 20000 : 60000)) return hit.body;
  for (const host of ["query1", "query2"]) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?interval=${interval}&range=${range}&includePrePost=true`, { headers: UA });
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
      const list = (url.searchParams.get("t") || "").toUpperCase().split(",").map(s => s.trim()).filter(s => /^\^?[A-Z][A-Z.\-]{0,7}$/.test(s)).slice(0, 24);
      const quotes = {};
      await Promise.all(list.map(async t => { const q = await extQuote(t); if (q) quotes[t] = q; }));
      return new Response(JSON.stringify({ t: Date.now(), quotes }), { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }
    if (url.pathname === "/chart") {
      const t = (url.searchParams.get("t") || "").toUpperCase();
      const range = ["1d", "5d", "1mo"].includes(url.searchParams.get("range")) ? url.searchParams.get("range") : "1d";
      const interval = ["1m", "2m", "5m", "15m", "30m", "60m"].includes(url.searchParams.get("interval")) ? url.searchParams.get("interval") : "1m";
      const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
      if (!/^\^?[A-Z][A-Z.\-]{0,8}$/.test(t)) return json({ status: "error", error: "bad ticker" }, 400);
      return json(await yahooChart(t, range, interval));
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
