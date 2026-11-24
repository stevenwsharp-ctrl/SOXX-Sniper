// Human Factor test: robustness, and that the flow score finds the place money goes into and the place it leaves.
// Usage: node tests/hf.test.mjs   (from the soxx-sniper folder)
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path";
const DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ctx = { console, Math, Date, JSON, Intl, Promise, setTimeout: () => 0, setInterval: () => 0 }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, "hf.js"), "utf8"), ctx, { filename: "hf.js" });
const HF = ctx.HF; let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("  FAIL", m); } else console.log("  ok  ", m); };
let seed = 7; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }, g = () => Math.sqrt(-2 * Math.log(R())) * Math.cos(2 * Math.PI * R());
const DAY = 864e5, t0 = Date.UTC(2026, 4, 1, 13, 30);
// daily bars; drift d per day for the last k days, with closes near the high (buyers) or low (sellers), and volume × vm
function daily(n, d = 0, k = 0, vm = 1) { let p = 100; return Array.from({ length: n }, (_, i) => { const late = i >= n - k, o = p, e = g() * 0.012 + (late ? d : 0); p *= Math.exp(e);
  const h = Math.max(o, p) * (1 + Math.abs(g()) * 0.004), l = Math.min(o, p) * (1 - Math.abs(g()) * 0.004), c = late && d ? (d > 0 ? h - (h - l) * 0.1 : l + (h - l) * 0.1) : p;
  return [t0 + i * DAY, o, h, l, c, 1e6 * (late ? vm : 1) * (1 + Math.abs(g()) * 0.3)]; }); }
const P = HF.places.map(p => p.t), D = { SPY: { bars: daily(130) }, "^VIX": { bars: daily(130).map(b => [b[0], 18, 19, 17, 18 + g(), 0]) } };
P.forEach(t => D[t] = { bars: daily(130) });
D.SMH = { bars: daily(130, 0.02, 6, 2.2) };   // money pours into semis for 6 days, on loud volume
D.XLU = { bars: daily(130, -0.02, 6, 2.0) };  // and leaves utilities
console.log("1. Robustness");
for (const x of [{}, { SPY: { bars: [] } }, { SPY: { bars: daily(130) } }, { ...D, SMH: { bars: daily(130).map((b, i) => i === 60 ? [b[0], NaN, NaN, NaN, NaN, 0] : b) } }]) { try { HF.compute(x, {}); HF.backtest(x); } catch (e) { ok(false, "threw: " + e.message); } }
ok(HF.compute({}, {}) === null, "no SPY data: no result");
console.log("2. Finds the flow");
const X = HF.compute(D, {}); ok(!!X && X.rows.length === 20, "20 places scored");
const by = {}; X.rows.forEach(r => by[r.t] = r);
ok(by.SMH.med > 0.5 && by.SMH.low > 0.3, `semis inflow seen (week ${Math.round(by.SMH.med * 100)}, today ${Math.round(by.SMH.low * 100)})`);
ok(by.XLU.med < -0.5, `utilities outflow seen (week ${Math.round(by.XLU.med * 100)})`);
ok(X.byB[0].t === "SMH", "semis are #1 on the blend (the bull)"); ok(X.byB[X.byB.length - 1].t === "XLU", "utilities are last");
ok(by.SMH.lab === "Pouring in" || by.SMH.lab === "Fresh money", "semis label: " + by.SMH.lab);
ok(X.rows.every(r => r.low >= -1 && r.low <= 1 && r.med >= -1 && r.med <= 1 && r.high >= -1 && r.high <= 1), "scores stay in −1…1");
ok(X.mood >= -100 && X.mood <= 100 && typeof X.moodLab === "string", `mood ${X.mood} (${X.moodLab})`);
console.log("3. Random data: no strong flow");
const N = { SPY: { bars: daily(130) } }; P.forEach(t => N[t] = { bars: daily(130) }); const Y = HF.compute(N, {});
const strong = Y.rows.filter(r => Math.abs(r.med) > 0.85).length; ok(strong <= 2, `few extreme week scores on random data (${strong} of 20)`);
const bt = HF.backtest(N); ok(!bt || (bt.d1[0] >= 20 && bt.d1[1] / bt.d1[0] > 0.25 && bt.d1[1] / bt.d1[0] < 0.75), "backtest on random data near chance" + (bt ? ` (${Math.round(bt.d1[1] / bt.d1[0] * 100)}% of ${bt.d1[0]})` : ""));
// 4. Pre-market base (Nov 24 2026 fix): the chart meta holds the close BEFORE the last session; the move must use the last close
{ console.log("4. Pre-market base");
  const D2 = { SPY: { bars: daily(130) }, "^VIX": D["^VIX"] }; P.forEach(t => D2[t] = { bars: daily(130) });
  const lastS = D2.SMH.bars[129], lastSpy = D2.SPY.bars[129], pmT = lastS[0] + DAY - 4 * 36e5;   // next day, 5:30 am ET
  const bars = (px0, k) => Array.from({ length: 20 }, (_, i) => { const p = px0 * (1 + k * i / 19); return [pmT + i * 3e5, p, p * 1.001, p * 0.999, p, 1e4]; });
  const I = { SMH: { bars: bars(lastS[4], -0.04), meta: { prevClose: lastS[4] * 0.9 } }, SPY: { bars: bars(lastSpy[4], 0), meta: { prevClose: lastSpy[4] * 0.95 } } };
  const r = HF.compute(D2, I, pmT + 20 * 3e5).rows.find(x => x.t === "SMH");
  ok(r.retT < -0.03 && r.retT > -0.05, `semis down 4% in pre-market read as ${(r.retT * 100).toFixed(2)}% (not a gain vs the older close)`);
  ok(r.low < 0, `today score is negative (${Math.round(r.low * 100)})`); }
// 5. Crypto: daily bars at 00:00 UTC with a live last bar; the base must not be that live bar
{ console.log("5. Crypto base");
  const D3 = { SPY: { bars: daily(130) }, "^VIX": D["^VIX"] }; P.forEach(t => D3[t] = { bars: daily(130) });
  const lastSpy = D3.SPY.bars[129], pmT = Date.UTC(2026, 10, 24, 11), day0 = Date.UTC(2026, 10, 24);
  const live = 100 * 0.97, B = D3["BTC-USD"].bars.map((b, i) => [day0 - (129 - i) * DAY, b[1], b[2], b[3], i === 129 ? live : 100, b[5]]);
  B[129][2] = 101; B[129][3] = 96; D3["BTC-USD"] = { bars: B };
  const bars = (px0, k) => Array.from({ length: 20 }, (_, i) => { const p = px0 * (1 + k * i / 19); return [pmT + i * 3e5, p, p * 1.001, p * 0.999, p, 1e4]; });
  const I = { "BTC-USD": { bars: bars(100, -0.03), meta: { prevClose: 100 } }, SPY: { bars: bars(lastSpy[4], 0), meta: { prevClose: lastSpy[4] } } };
  const r = HF.compute(D3, I, pmT + 20 * 3e5).rows.find(x => x.t === "BTC-USD");
  ok(r.retT < -0.025, `bitcoin down 3% today read as ${(r.retT * 100).toFixed(2)}%`); }
// 6. Quiet ETFs in pre-market (Nov 24 2026): 1-2 trades still count; no trade today = 0, never yesterday's move
{ console.log("6. Quiet ETFs");
  const D4 = { SPY: { bars: daily(130) }, "^VIX": D["^VIX"] }; P.forEach(t => D4[t] = { bars: daily(130) });
  D4.XLC.bars[129][4] = D4.XLC.bars[128][4] * 1.04;   // yesterday +4%
  D4.XLB.bars[129][4] = D4.XLB.bars[128][4] * 1.04;
  const lastSpy = D4.SPY.bars[129], pmT = lastSpy[0] + DAY - 4 * 36e5, yT = lastSpy[0] + 2 * 36e5;
  const bars = (t, px0, k, n) => Array.from({ length: n }, (_, i) => { const p = px0 * (1 + k * i / Math.max(1, n - 1)); return [t + i * 3e5, p, p * 1.001, p * 0.999, p, 1e4]; });
  const xc = D4.XLC.bars[129][4], xb = D4.XLB.bars[129][4];
  const I = { SPY: { bars: bars(pmT, lastSpy[4], -0.01, 20), meta: {} },
    XLC: { bars: bars(pmT, xc * 0.99, 0, 2), meta: { prevClose: xc / 1.04 } },          // 2 trades today, -1%
    XLB: { bars: bars(yT, xb / 1.04, 0.04, 20), meta: { prevClose: xb / 1.04 / 1.04 } } }; // only yesterday's bars
  const X = HF.compute(D4, I, pmT + 20 * 3e5), by = {}; X.rows.forEach(r => by[r.t] = r);
  ok(Math.abs(by.XLC.retT + 0.01) < 0.002, `2 trades today: XLC ${(by.XLC.retT * 100).toFixed(2)}% (want -1%, not yesterday's +4%)`);
  ok(by.XLB.none && by.XLB.retT === 0 && by.XLB.low === 0, `no trade today: XLB ${by.XLB.none ? "no trades yet" : (by.XLB.retT * 100).toFixed(2) + "%"}`); }
// 7. A live trade newer than the 5-minute bars is used (quiet ETF, Yahoo bars lag)
{ console.log("7. Live trade");
  const D5 = { SPY: { bars: daily(130) }, "^VIX": D["^VIX"] }; P.forEach(t => D5[t] = { bars: daily(130) });
  const lastSpy = D5.SPY.bars[129], pmT = lastSpy[0] + DAY - 4 * 36e5, xc = D5.XLC.bars[129][4], uu = D5.UUP.bars[129][4];
  const bars = (t, px0, n) => Array.from({ length: n }, (_, i) => [t + i * 3e5, px0, px0 * 1.001, px0 * 0.999, px0, 1e4]);
  const I = { SPY: { bars: bars(pmT, lastSpy[4], 20), meta: {} }, XLC: { bars: bars(pmT, xc, 2), meta: {}, live: { p: xc * 0.99, t: pmT + 30 * 6e4 } },
    UUP: { bars: [], meta: {}, live: { p: uu * 0.995, t: pmT + 40 * 6e4 } } };
  const X = HF.compute(D5, I, pmT + 45 * 6e4), by = {}; X.rows.forEach(r => by[r.t] = r);
  ok(Math.abs(by.XLC.retT + 0.01) < 0.001, `XLC uses the newer live trade: ${(by.XLC.retT * 100).toFixed(2)}%`);
  ok(!by.UUP.none && Math.abs(by.UUP.retT + 0.005) < 0.001, `UUP with only a live trade: ${(by.UUP.retT * 100).toFixed(2)}%`); }
console.log(fails ? `${fails} FAILED` : "all passed"); process.exit(fails ? 1 : 0);
