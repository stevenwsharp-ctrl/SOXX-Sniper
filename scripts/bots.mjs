// Paper trading bots · SOXX Sniper. Three bots trade only what Schwab can trade (US stocks and ETFs), long only
// (bearish ideas go through inverse funds, as in a cash account), with LIMIT entries, 5–30 minute holds and the
// same bet size every time (1 unit = $1,000). No real orders: this is a test bench that learns.
//   spot   plain stocks and 1× ETFs (SH and PSQ for bearish days)
//   letf   2× and 3× leveraged and inverse funds only
//   both   all of them
// How it learns
//   1. Six entry ideas on 1-minute bars (breakout of the opening range or the day high with volume, trend pull-back
//      to EMA 21, VWAP snap-back from −2σ, RSI turn up from 25, a volume burst, a squeeze break).
//   2. Every signal is also traded on paper by all 15 entry/exit versions of its idea ("shadow" trades): limit 0.25,
//      0.5 or 1 ATR under the signal price (alive 5 minutes, the trade exists only if price touches it); exits:
//      limit target 3 ATR with a stop past the last swing low · target 6 ATR with that stop · target 6 ATR with a
//      4-ATR stop · a runner (trail 3 ATR once 3 ATR up, stop past the swing low) · no stop and no target (time exit).
//      Stops and time exits are market orders (cost: half the spread). Every trade ends within 30 minutes, and all
//      trades end at 15:59 ET.
//   3. Each version keeps a score (mean return per filled trade, by market class and by half hour of the day).
//      The bots choose by Thompson sampling: a version with a good record is chosen often, a new one is tried
//      sometimes, a version that clearly loses (30+ trades, 90% upper bound < 0) is benched.
//   4. Before each day the bots replay the last 7 days of 1-minute bars (Yahoo), so they start with a record.
//   5. Each bot trade gets a grade (A–F): result in ATRs, how much of the best price it kept, how far it went
//      against the entry. Big swings of the day (8+ ATR in 30 minutes) are listed with "caught" or "missed".
// Output (branch "bots"): bots.json (the dashboard), state.json (the memory).
// Usage: node scripts/bots.mjs <outDir> [auto|prep|mock]
import fs from "fs";
import { execSync } from "child_process";

const OUT = process.argv[2] || "out", MODE = process.argv[3] || "auto", MOCK = MODE === "mock" || !!process.env.BOTS_MOCK;
const UNIT = 1000, MAXPOS = 3, CLS_COST = { S: 0.0003, L: 0.0006 };
const SPOT = ["NVDA", "AMD", "AVGO", "MU", "TSM", "ARM", "MRVL", "INTC", "QCOM", "AMAT", "LRCX", "SMCI", "PLTR", "TSLA", "META", "AAPL", "MSFT", "AMZN", "GOOGL", "COIN", "MSTR", "HOOD", "BE", "SOXX", "SMH", "QQQ", "SPY", "IWM", "SH", "PSQ"];
const LEVX = { SOXL: 3, SOXS: -3, TQQQ: 3, SQQQ: -3, SPXL: 3, SPXS: -3, TNA: 3, TZA: -3, TECL: 3, TECS: -3, FAS: 3, FAZ: -3, LABU: 3, LABD: -3, USD: 2, NVDL: 2, NVD: -2, TSLL: 2, TSLQ: -2, AMDL: 2, MSTU: 2, MSTZ: -2, CONL: 2, PLTU: 2, NVDU: 2, AVL: 2 };
const LEV = Object.keys(LEVX);
const BOTS = { spot: { name: "Spot only", u: SPOT }, letf: { name: "2× and 3× funds only", u: LEV }, both: { name: "Spot + 2×/3× funds", u: [...SPOT, ...LEV] } };
const ALL = [...new Set([...SPOT, ...LEV])], cls = s => LEVX[s] ? "L" : "S";
const IDEAS = { brk: "Breakout (opening range or day high, with volume)", pull: "Trend pull-back to EMA 21", vrev: "VWAP snap-back from −2σ", rsi: "RSI turn up from 25", mom: "Volume burst (ride the move)", sqz: "Squeeze break" };
const KS = [0.25, 0.5, 1], PLANS = { t3s: "target 3 ATR · stop past swing low", t6s: "target 6 ATR · stop past swing low", t6a: "target 6 ATR · 4-ATR stop", run: "runner: trail 3 ATR · stop past swing low", tim: "no stop, no target · time exit" };
const MAXHOLD = 30, ALIVE = 5;
const io = { r: (f, d) => { try { return JSON.parse(fs.readFileSync(`${OUT}/${f}`, "utf8")); } catch (e) { return d; } }, w: (f, v) => { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(`${OUT}/${f}`, JSON.stringify(v)); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- time (US Eastern) ----------
const ETF = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "numeric", hourCycle: "h23", weekday: "short" });
const et = t => { const p = Object.fromEntries(ETF.formatToParts(new Date(t)).map(x => [x.type, x.value])); return { d: `${p.year}-${p.month}-${p.day}`, m: +p.hour * 60 + +p.minute, wd: p.weekday }; };
const bucket = m => Math.max(0, Math.min(12, Math.floor((m - 570) / 30)));   // 0 = 9:30–10:00 … 12 = 15:30–16:00
const bname = b => { const m = 570 + b * 30, f = x => `${Math.floor(x / 60) > 12 ? Math.floor(x / 60) - 12 : Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}`; return `${f(m)}–${f(m + 30)}`; };

// ---------- data ----------
// Yahoo often answers 429 to cloud servers without a session: get a cookie and a "crumb" first, as a browser does
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"; let YC = null;
async function ysess() { if (YC) return YC; try { const r = await fetch("https://fc.yahoo.com/", { headers: { "user-agent": UA }, redirect: "manual" }); const ck = (r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get("set-cookie") || ""]).map(x => x.split(";")[0]).filter(Boolean).join("; ");
    const c = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", { headers: { "user-agent": UA, cookie: ck } }); const crumb = c.ok ? (await c.text()).trim() : ""; YC = { ck, crumb }; console.log(`yahoo session: cookie ${ck ? "yes" : "no"}, crumb ${crumb ? "yes" : "no"}`); } catch (e) { YC = { ck: "", crumb: "" }; } return YC; }
let FAILS = 0; async function http(url0) { const Y = await ysess(); let url = url0 + (Y.crumb ? "&crumb=" + encodeURIComponent(Y.crumb) : "");
  for (let i = 0; i < 4; i++) { if (i % 2) url = url.replace("query1.", "query2."); else url = url.replace("query2.", "query1."); try { const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json,*/*", ...(Y.ck ? { cookie: Y.ck } : {}) } }); if (r.status === 404) return null; if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 120)); return await r.json(); } catch (e) { if (i === 3) { if (FAILS++ < 3) console.error("yahoo:", url.split("?")[0].split("/").pop(), e.message); return null; } await sleep(2000 * (i + 1)); } } }
async function httpOld(url) { for (let i = 0; i < 3; i++) { try { const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", accept: "application/json,*/*" } }); if (r.status === 404) return null; if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 120)); return await r.json(); } catch (e) { if (i === 2) { if (FAILS++ < 3) console.error("yahoo:", url.split("?")[0].split("/").pop(), e.message); return null; } await sleep(1500 * (i + 1)); } } }
async function chart(sym, range) {
  if (MOCK) return mockBars(sym, range);
  const j = await http(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1m&range=${range}&includePrePost=false`);
  const r = j && j.chart && j.chart.result && j.chart.result[0]; if (!r || !r.timestamp) return null; const q = r.indicators.quote[0], B = [];
  r.timestamp.forEach((t, i) => { const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i]; if ([o, h, l, c].some(v => v == null || !(v > 0))) return; const e = et(t * 1000); if (e.m < 570 || e.m >= 960) return; B.push([t * 1000, o, h, l, c, q.volume[i] || 0]); });
  return { B, prev: r.meta && r.meta.chartPreviousClose };
}
async function pool(items, n, f) { const out = new Array(items.length); let k = 0; await Promise.all(Array.from({ length: n }, async () => { while (k < items.length) { const i = k++; out[i] = await f(items[i], i); } })); return out; }
let MS = 7; function mockBars(sym, range) { const days = range === "7d" ? 5 : 1, B = []; let px = 50 + (sym.charCodeAt(0) % 40) * 3, s = [...sym].reduce((a, c) => a * 31 + c.charCodeAt(0), MS) % 2147483647; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const now = Date.now(), d0 = Math.floor(now / 864e5) * 864e5; const vol = (LEVX[sym] ? 0.0016 : 0.0008);
  for (let d = days - 1; d >= 0; d--) { const base = d0 - d * 864e5 + 14.5 * 36e5; let drift = (R() - 0.5) * 0.0004; for (let i = 0; i < 390; i++) { const t = base + i * 6e4; if (range === "1d" && t > now - 6e4 && !process.env.BOTS_MOCK_FULL) break; if (i % 60 === 0) drift = (R() - 0.5) * 0.0005; const o = px; px *= Math.exp(drift + (R() - 0.5) * vol * 2 + (R() < 0.01 ? (R() - 0.4) * vol * 12 : 0)); B.push([t, o, Math.max(o, px) * (1 + R() * vol * 0.5), Math.min(o, px) * (1 - R() * vol * 0.5), px, Math.round(1e4 * (1 + R() * 3) * (i < 30 || i > 360 ? 2 : 1))]); } }
  return { B, prev: B.length ? B[0][1] : null }; }
const byDay = B => { const D = new Map(); B.forEach(b => { const d = et(b[0]).d; if (!D.has(d)) D.set(d, []); D.get(d).push(b); }); return D; };

// ---------- features of one day's bars (arrays) ----------
function feats(B) {
  const n = B.length, c = B.map(b => b[4]), h = B.map(b => b[2]), l = B.map(b => b[3]), o = B.map(b => b[1]), v = B.map(b => b[5]);
  const tr = B.map((b, i) => i ? Math.max(b[2], c[i - 1]) - Math.min(b[3], c[i - 1]) : b[2] - b[3]), atr = [], e9 = [], e21 = [], rsi = [], vw = [], vsd = [], rv = [];
  let a = 0, x9 = c[0], x21 = c[0], up = 0, dn = 0, pv = 0, vv = 0, m2 = 0, nv = 0;
  for (let i = 0; i < n; i++) { a = i < 14 ? (a * i + tr[i]) / (i + 1) : a + (tr[i] - a) / 14; atr.push(Math.max(a, c[i] * 0.0002));
    x9 += (c[i] - x9) * 0.2; x21 += (c[i] - x21) / 11; e9.push(x9); e21.push(x21);
    const d = i ? c[i] - c[i - 1] : 0; up = i < 14 ? (up * i + Math.max(d, 0)) / (i + 1) : up + (Math.max(d, 0) - up) / 14; dn = i < 14 ? (dn * i + Math.max(-d, 0)) / (i + 1) : dn + (Math.max(-d, 0) - dn) / 14; rsi.push(dn ? 100 - 100 / (1 + up / dn) : 100);
    const tp = (h[i] + l[i] + c[i]) / 3, w = v[i] || 1; pv += tp * w; vv += w; const mu = pv / vv; nv++; m2 += (tp - mu) ** 2; vw.push(mu); vsd.push(Math.sqrt(m2 / nv) || atr[i]);
    const s5 = v.slice(Math.max(0, i - 4), i + 1).reduce((p, q) => p + q, 0), base = i >= 15 ? v.slice(0, i - 4).reduce((p, q) => p + q, 0) / Math.max(1, i - 4) * 5 : null; rv.push(base ? s5 / base : 1); }
  const orH = n >= 15 ? Math.max(...h.slice(0, 15)) : null, orL = n >= 15 ? Math.min(...l.slice(0, 15)) : null;
  return { n, c, h, l, o, v, atr, e9, e21, rsi, vw, vsd, rv, orH, orL };
}
function signals(F, i, m) {
  if (i < 20 || m < 575 || m > 930) return [];   // 9:35–15:30 only: a 5–30 minute trade needs room
  const { c, h, l, o, atr, e9, e21, rsi, vw, vsd, rv } = F, S = [];
  const dayH = Math.max(...h.slice(0, i)), lvl = Math.max(F.orH || 0, dayH);
  if (i >= 15 && c[i] > lvl && c[i - 1] <= lvl && rv[i] >= 1.3) S.push("brk");
  if (e9[i] > e21[i] && e9[i] > e9[i - 3] && l[i] <= e21[i] && c[i] > e21[i] && c[i] > o[i]) S.push("pull");
  if ((c[i] - vw[i]) / vsd[i] < -2 && c[i] > o[i]) S.push("vrev");
  if (rsi[i - 1] < 25 && rsi[i] >= 25) S.push("rsi");
  if (c[i] - c[i - 5] > 2.5 * atr[i] && rv[i] >= 2) S.push("mom");
  const rg = Math.max(...h.slice(i - 20, i)) - Math.min(...l.slice(i - 20, i)), dayR = (Math.max(...h.slice(0, i)) - Math.min(...l.slice(0, i))) / Math.max(1, i / 20);
  if (i >= 40 && rg < 0.6 * dayR && c[i] > Math.max(...h.slice(i - 20, i))) S.push("sqz");
  return S;
}

// ---------- one order / trade, step by step (the same code for shadow trades, bot trades and the replay) ----------
function newOrder(sym, idea, k, plan, F, i, t, extra) {
  const a = F.atr[i], lim = F.c[i] - k * a, swing = Math.min(...F.l.slice(Math.max(0, i - 9), i + 1)) - 0.1 * a;
  return { sym, idea, k, plan, cl: cls(sym), t0: t, lim, a, swing, ap: a / F.c[i], st: "open", age: 0, b: bucket(et(t).m), ...extra };
}
function step(o, bar, last) {   // bar = [t, o, h, l, c, v]; returns true when the order or trade is finished
  const [t, op, hi, lo, cl] = bar;
  if (o.st === "open") { o.age++; if (lo <= o.lim) { o.fill = Math.min(op, o.lim); o.tf = t; o.st = "in"; o.hold = 0; o.mx = hi; o.mn = lo;
      o.stop = o.plan === "t6a" ? o.fill - 4 * o.a : o.plan === "tim" ? null : (o.swing < o.fill - 0.5 * o.a ? o.swing : o.fill - 2 * o.a);
      o.tgt = o.plan === "t3s" ? o.fill + 3 * o.a : o.plan === "t6s" || o.plan === "t6a" ? o.fill + 6 * o.a : null;
      if (o.stop != null && lo <= o.stop && cl < o.fill) return exit(o, t, Math.min(o.stop, cl), "stop");   // the worst case inside the fill bar
      if (last) return exit(o, t, cl, "close"); return false; }
    if (o.age >= ALIVE || last) { o.st = "cancel"; return true; } return false; }
  o.hold++; o.mx = Math.max(o.mx, hi); o.mn = Math.min(o.mn, lo);
  if (o.plan === "run" && o.mx >= o.fill + 3 * o.a) o.stop = Math.max(o.stop == null ? -Infinity : o.stop, o.mx - 3 * o.a);
  if (o.stop != null && lo <= o.stop) return exit(o, t, Math.min(op, o.stop), o.plan === "run" && o.stop > o.fill ? "trail" : "stop");
  if (o.tgt != null && hi >= o.tgt) return exit(o, t, Math.max(op, o.tgt), "target");
  if (o.hold >= MAXHOLD || last) return exit(o, t, cl, last ? "close" : "time");
  return false;
}
function exit(o, t, px, why) { const mkt = why !== "target"; o.st = "done"; o.tx = t; o.px = px; o.why = why; o.r = px / o.fill - 1 - (mkt ? CLS_COST[o.cl] : 0); o.mfe = o.mx / o.fill - 1; o.mae = o.mn / o.fill - 1; o.min = Math.max(1, Math.round((t - o.tf) / 6e4)); return true; }
function grade(o) {   // result in ATRs (60%), share of the best price kept (20%), entry quality (20%)
  const g = o.r / o.ap, cap = o.mfe > 0 ? Math.max(-1, Math.min(1, (o.px / o.fill - 1) / o.mfe)) : 0, ent = 1 - Math.min(2, -o.mae / (3 * o.ap)), sc = 0.6 * Math.max(-1, Math.min(1, g / 3)) + 0.2 * cap + 0.2 * ent;
  return { sc: +sc.toFixed(2), L: sc >= 0.55 ? "A" : sc >= 0.3 ? "B" : sc >= 0.05 ? "C" : sc >= -0.2 ? "D" : "F", atr: +g.toFixed(2), cap: +cap.toFixed(2) }; }

// ---------- the memory: scores of every version ----------
const key = (cl, idea, k, plan) => `${cl}|${idea}|${k}|${plan}`;
function rec(S, o) { const r = o.r; for (const kk of [key(o.cl, o.idea, o.k, o.plan), key(o.cl, o.idea, o.k, o.plan) + "@" + o.b, `${o.cl}|*@${o.b}`, `${o.cl}|${o.idea}|*`]) { const x = S.arms[kk] || (S.arms[kk] = { n: 0, s: 0, q: 0, w: 0 }); x.n++; x.s += r; x.q += r * r; if (r > 0) x.w++; if (x.n > 3000) { const f = 3000 / x.n; x.n = 3000; x.s *= f; x.q *= f; x.w *= f; } } }
function tries(S, o) { const kk = key(o.cl, o.idea, o.k, o.plan), x = S.tr[kk] || (S.tr[kk] = [0, 0]); x[0]++; if (o.fill != null) x[1]++; }
const stat = x => { if (!x || !x.n) return { n: 0, m: 0, sd: 0.003 }; const m = x.s / x.n, sd = Math.sqrt(Math.max(1e-8, x.q / x.n - m * m)); return { n: x.n, m, sd: Math.max(sd, 1e-4), w: x.w / x.n }; };
function score(S, cl, idea, k, plan, b) { const A = stat(S.arms[key(cl, idea, k, plan)]), B = stat(S.arms[key(cl, idea, k, plan) + "@" + b]), n0 = 15;
  const m = (A.n * A.m + B.n * B.m * 1.5) / (A.n + B.n * 1.5 + n0); const n = A.n + n0; return { m, se: A.sd / Math.sqrt(n), n: A.n, benched: A.n >= 30 && A.m + 1.28 * A.sd / Math.sqrt(A.n) < 0 }; }
const randn = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
function choose(S, cl, idea, b) { let best = null; for (const k of KS) for (const p of Object.keys(PLANS)) { const s = score(S, cl, idea, k, p, b); if (s.benched && Math.random() > 0.05) continue; const draw = s.m + s.se * randn(); if (!best || draw > best.draw) best = { k, p, draw, s }; } return best; }

// ---------- the engine over one symbol's day ----------
let BT = false;
function emptyState() { return { v: 2, arms: {}, tr: {}, seeded: {}, bots: Object.fromEntries(Object.keys(BOTS).map(k => [k, { orders: [], trades: [], days: {} }])), shadow: [], swings: {}, last: {}, live: {} }; }
// process bar i of the day (bars 0..i known). shadowOnly: the replay of past days (no bot trades).
function onBar(S, sym, F, B, i, shadowOnly, last) {
  const bar = B[i], t = bar[0], m = et(t).m;
  // 1. orders and trades already running
  S.shadow = S.shadow.filter(o => { if (o.sym !== sym) return true; const done = step(o, bar, last); if (done) { tries(S, o); if (o.st === "done") rec(S, o); } return !done; });
  if (!shadowOnly) for (const [bk, bot] of Object.entries(S.bots)) bot.orders = bot.orders.filter(o => { if (o.sym !== sym) return true; const done = step(o, bar, last); if (done && o.st === "done") { const g = grade(o); bot.trades.push({ sym, idea: o.idea, k: o.k, plan: o.plan, t0: o.t0, tf: o.tf, tx: o.tx, fill: +o.fill.toFixed(4), px: +o.px.toFixed(4), r: +o.r.toFixed(5), usd: +(UNIT * o.r).toFixed(2), why: o.why, min: o.min, mfe: +o.mfe.toFixed(5), mae: +o.mae.toFixed(5), g, sig: o.sig, explore: o.explore || 0, bt: BT ? 1 : 0 }); } return !done; });
  if (last) return;
  // 2. new signals on this closed bar
  const sg = signals(F, i, m); if (!sg.length) return;
  for (const idea of sg) { for (const k of KS) for (const p of Object.keys(PLANS)) S.shadow.push(newOrder(sym, idea, k, p, F, i, t));
    if (shadowOnly) continue;
    for (const [bk, bot] of Object.entries(S.bots)) { if (!BOTS[bk].u.includes(sym)) continue; if (bot.orders.length >= MAXPOS || bot.orders.some(o => o.sym === sym)) continue;
      const ch = choose(S, cls(sym), idea, bucket(m)); if (!ch) continue; const explore = ch.s.n < 30 || ch.s.m <= 0; if (ch.draw <= 0 && Math.random() > 0.25) continue;   // most bad draws skip; a quarter still trade (learning)
      bot.orders.push(newOrder(sym, idea, ch.k, ch.p, F, i, t, { sig: +F.c[i].toFixed(4), explore: explore ? 1 : 0, exp: +ch.s.m.toFixed(5) })); }
  }
}
// big swings of the day: 8+ ATR up inside 30 minutes, low first (what a long-only bot could catch)
function swings(F, B) { const out = []; let i = 0; while (i < F.n - 5) { let best = null; for (let j = i + 1; j < Math.min(F.n, i + 30); j++) { const up = F.h[j] - F.l[i]; if (up >= 8 * F.atr[i] && (!best || up > best.up)) best = { j, up }; } if (best) { out.push({ t0: B[i][0], t1: B[best.j][0], from: F.l[i], to: F.h[best.j], pct: +(F.h[best.j] / F.l[i] - 1).toFixed(4) }); i = best.j + 1; } else i++; } return out; }

// ---------- replay of past days (seeds the memory) ----------
async function prep(S) {
  const today = et(Date.now()).d; let n = 0;
  const data = await pool(ALL, 3, async s => [s, await chart(s, "7d")]);
  // day by day, all symbols minute by minute together: the bots trade the past as they would have (walk-forward: each
  // choice uses only what was learned before that minute), and every shadow trade feeds the memory
  const DAYS = {}; for (const [sym, d] of data) { if (!d || !d.B.length) continue; for (const [day, B] of byDay(d.B)) if (B.length >= 100) (DAYS[day] = DAYS[day] || {})[sym] = B; }
  const marketOpenToday = !["Sat", "Sun"].includes(et(Date.now()).wd) && et(Date.now()).m < 961;
  for (const day of Object.keys(DAYS).sort()) { if (S.seeded["D:" + day] || (day >= today && !MOCK && marketOpenToday)) continue;
    const syms = Object.keys(DAYS[day]), FF = {}, ptr = {}; syms.forEach(s => { FF[s] = feats(DAYS[day][s]); ptr[s] = 0; }); for (const b of Object.values(S.bots)) b.orders = [];
    const ts = [...new Set(syms.flatMap(s => DAYS[day][s].map(b => b[0])))].sort((a, b) => a - b); BT = true;
    for (const t of ts) for (const s of syms) { const B = DAYS[day][s], i = ptr[s]; if (i < B.length && B[i][0] === t) { onBar(S, s, FF[s], B, i, false, i === B.length - 1); ptr[s]++; } }
    BT = false; S.shadow = []; for (const b of Object.values(S.bots)) b.orders = []; S.seeded["D:" + day] = 1; n += syms.length; }
  const keep = Object.keys(S.seeded).sort().slice(-40); S.seeded = Object.fromEntries(keep.map(k => [k, 1]));
  console.log(`replayed ${n} symbol-days · data for ${data.filter(([, d]) => d && d.B.length).length} of ${ALL.length} symbols · ${data.reduce((p, [, d]) => p + (d ? d.B.length : 0), 0)} bars`);
}

// ---------- the dashboard file ----------
function report(S, note) {
  const today = et(Date.now()).d, R = { at: Date.now(), today, unit: UNIT, note, bots: {}, ideas: IDEAS, plans: PLANS, arms: [], times: {}, swings: [], live: S.live };
  for (const [bk, bot] of Object.entries(S.bots)) {
    const T = bot.trades, LV = T.filter(x => !x.bt), BK = T.filter(x => x.bt), td = LV.filter(x => et(x.tx).d === today), sum = a => a.reduce((p, x) => p + x.usd, 0), win = a => a.length ? a.filter(x => x.r > 0).length / a.length : null;
    const days = {}; T.forEach(x => { const d = et(x.tx).d; (days[d] = days[d] || []).push(x); });
    const curve = Object.keys(days).sort().map(d => [d, +sum(days[d]).toFixed(2), days[d].length, days[d].every(x => x.bt) ? 1 : 0]);
    const gr = {}; T.slice(-200).forEach(x => gr[x.g.L] = (gr[x.g.L] || 0) + 1);
    const byIdea = {}; T.slice(-300).forEach(x => { const z = byIdea[x.idea] || (byIdea[x.idea] = { n: 0, usd: 0, w: 0 }); z.n++; z.usd += x.usd; if (x.r > 0) z.w++; });
    R.bots[bk] = { name: BOTS[bk].name, u: BOTS[bk].u, today: { n: td.length, usd: +sum(td).toFixed(2), win: win(td), min: td.length ? td.reduce((p, x) => p + x.min, 0) / td.length : null },
      all: { n: LV.length, usd: +sum(LV).toFixed(2), win: win(LV), min: LV.length ? LV.reduce((p, x) => p + x.min, 0) / LV.length : null, units: +(sum(LV) / UNIT).toFixed(3) },
      bt: { n: BK.length, usd: +sum(BK).toFixed(2), win: win(BK), min: BK.length ? BK.reduce((p, x) => p + x.min, 0) / BK.length : null, units: +(sum(BK) / UNIT).toFixed(3), days: new Set(BK.map(x => et(x.tx).d)).size, best: BK.length ? BK.reduce((a, x) => x.usd > a.usd ? x : a) : null, worst: BK.length ? BK.reduce((a, x) => x.usd < a.usd ? x : a) : null, pf: (() => { const g = BK.filter(x => x.usd > 0).reduce((p, x) => p + x.usd, 0), l = -BK.filter(x => x.usd < 0).reduce((p, x) => p + x.usd, 0); return l ? +(g / l).toFixed(2) : null; })() },
      last50: { n: Math.min(50, T.length), usd: +sum(T.slice(-50)).toFixed(2), win: win(T.slice(-50)) }, curve, grades: gr, byIdea,
      open: bot.orders.map(o => ({ sym: o.sym, idea: o.idea, k: o.k, plan: o.plan, st: o.st, lim: +o.lim.toFixed(4), fill: o.fill != null ? +o.fill.toFixed(4) : null, stop: o.stop != null ? +o.stop.toFixed(4) : null, tgt: o.tgt != null ? +o.tgt.toFixed(4) : null, t0: o.t0, tf: o.tf || null, last: S.live[o.sym] || null })),
      trades: T.slice(-60).reverse() };
  }
  for (const cl of ["S", "L"]) for (const idea of Object.keys(IDEAS)) for (const k of KS) for (const p of Object.keys(PLANS)) { const x = stat(S.arms[key(cl, idea, k, p)]), tr = S.tr[key(cl, idea, k, p)] || [0, 0]; if (x.n) R.arms.push({ cl, idea, k, plan: p, n: x.n, m: +x.m.toFixed(5), w: +(x.w || 0).toFixed(3), t: +(x.m / (x.sd / Math.sqrt(x.n))).toFixed(2), fill: tr[0] ? +(tr[1] / tr[0]).toFixed(2) : null, benched: x.n >= 30 && x.m + 1.28 * x.sd / Math.sqrt(x.n) < 0 }); }
  for (const cl of ["S", "L"]) R.times[cl] = Array.from({ length: 13 }, (_, b) => { const x = stat(S.arms[`${cl}|*@${b}`]); return { b, name: bname(b), n: x.n, m: +x.m.toFixed(5), w: x.n ? +x.w.toFixed(3) : null }; });
  const all = Object.values(S.bots).flatMap(b => b.trades.filter(x => et(x.tx).d === today));
  for (const [sym, L] of Object.entries(S.swings)) L.forEach(w => { const hit = all.filter(x => x.sym === sym && x.tf >= w.t0 - 5 * 6e4 && x.tf <= w.t1 && x.r > 0); R.swings.push({ sym, ...w, caught: hit.length, usd: +hit.reduce((p, x) => p + x.usd, 0).toFixed(2) }); });
  R.swings.sort((a, b) => b.pct - a.pct); R.swings = R.swings.slice(0, 30);
  return R;
}
let lastPush = 0;
function save(S, note, force) {
  for (const b of Object.values(S.bots)) if (b.trades.length > 4000) b.trades = b.trades.slice(-4000);
  io.w("state.json", S); io.w("bots.json", report(S, note));
  if (!process.env.REMOTE || (!force && Date.now() - lastPush < 110000)) return; lastPush = Date.now();
  try { execSync(`cd ${OUT} && git add -A && (git commit -q --amend -m "bots $(date -u +%FT%TZ)" 2>/dev/null || git commit -q -m "bots $(date -u +%FT%TZ)") && git push -f -q "$REMOTE" HEAD:bots`, { stdio: "inherit", shell: "/bin/bash" }); } catch (e) { console.error("push failed", e.message); }
}

// ---------- main ----------
async function main() {
  const S0 = io.r("state.json", {}), S = Object.assign(emptyState(), S0.v === 2 ? S0 : {});   // v2: the bots also trade the replay (a new memory) S.shadow = S.shadow || []; S.live = S.live || {};
  for (const k of Object.keys(BOTS)) S.bots[k] = Object.assign({ orders: [], trades: [], days: {} }, S.bots[k] || {});
  await prep(S); save(S, "replayed the last 7 days", true);
  const t0 = Date.now(), maxMin = +(process.env.MAX_MIN || 340), today = et(Date.now()).d;
  const open = () => { const e = et(Date.now()); return !["Sat", "Sun"].includes(e.wd) && e.m >= 570 && e.m < 963; };
  // started before the open (the morning run): wait for 9:30 ET
  { const e = et(Date.now()); if (MODE !== "prep" && !MOCK && !["Sat", "Sun"].includes(e.wd) && e.m < 570 && e.m >= 570 - 150) { console.log(`waiting ${570 - e.m} min for the open`); await sleep((570 - e.m) * 6e4 - (Date.now() % 6e4) + 5000); } }
  if (MODE === "prep" || (!open() && !MOCK)) { console.log("market closed: replay only"); save(S, "market closed: replay only", true); return; }
  // a new day: orders from an earlier day are gone (all trades end at 15:59)
  for (const b of Object.values(S.bots)) b.orders = b.orders.filter(o => et(o.t0).d === today); if (S.day !== today) { S.swings = {}; S.last = {}; S.shadow = []; S.day = today; }
  const C = {};   // today's bars per symbol
  for (let loop = 0; ; loop++) {
    const now = Date.now(), e = et(now);
    const got = await pool(ALL, 6, async s => [s, await chart(s, "1d")]);
    for (const [sym, d] of got) { if (!d || !d.B.length) continue; const B = d.B.filter(b => et(b[0]).d === today && (b[0] + 6e4 <= now || MOCK)); if (!B.length) continue; C[sym] = B;
      S.live[sym] = +B[B.length - 1][4].toFixed(4); const F = feats(B), from = S.last[sym] == null ? 0 : B.findIndex(b => b[0] > S.last[sym]); if (from < 0) continue;
      const isLast = i => et(B[i][0]).m >= 959;
      for (let i = from; i < B.length; i++) onBar(S, sym, F, B, i, from === 0 && i < B.length - 3 && S.last[sym] == null && loop === 0 && !MOCK ? true : false, isLast(i));
      S.last[sym] = B[B.length - 1][0]; S.swings[sym] = swings(F, B); }
    save(S, `live · ${e.d} ${Math.floor(e.m / 60)}:${String(e.m % 60).padStart(2, "0")} ET`);
    if (MOCK || e.m >= 961 || (now - t0) / 6e4 > maxMin) break;
    await sleep(Math.max(5000, 60000 - (Date.now() - now)));
  }
  save(S, "stopped", true);
}
main().catch(e => { console.error(e); process.exit(1); });
