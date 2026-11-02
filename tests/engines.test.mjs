// Engine test suite: robustness, false alarms on random data, and power on data with a real pattern.
// Usage: node tests/engines.test.mjs [runs]   (from the soxx-sniper folder)
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path";
const DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), ".."), RUNS = +process.argv[2] || 30;
const store = {}; const ctx = { console, Math, Date, JSON, Intl, Promise, setTimeout: () => 0, setInterval: () => 0, clearInterval: () => 0, fetch: async () => ({ ok: false, json: async () => ({}) }),
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } }, document: { title: "test", getElementById: () => null, querySelector: () => null, createElement: () => ({ style: {} }), head: { appendChild() { } }, hidden: false, addEventListener() { } }, getComputedStyle: () => ({ getPropertyValue: () => "" }) };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ["vflow.js", "rhythm.js", "pb.js", "markov.js", "matrix.js", "rollover.js", "planner.js", "liquid.js", "trapped.js", "hub.js"]) vm.runInContext(fs.readFileSync(path.join(DIR, f), "utf8"), ctx, { filename: f });
const W = ctx; let seed = 12345; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }, g = () => Math.sqrt(-2 * Math.log(R())) * Math.cos(2 * Math.PI * R());
const walk = (n, ms, sd, rho = 0) => { let p = 100, pr = 0; const now = Math.floor(Date.now() / ms) * ms; return Array.from({ length: n }, (_, i) => { const o = p, e = rho * pr + g() * sd; pr = e; p *= Math.exp(e); return [now - (n - 1 - i) * ms, o, Math.max(o, p) * (1 + Math.abs(g()) * sd * 0.3), Math.min(o, p) * (1 - Math.abs(g()) * sd * 0.3), p, 1000 * (1 + Math.abs(g()))]; }); };
let fails = 0; const ok = (c, msg) => { if (!c) { fails++; console.log("  FAIL", msg); } };
// 1. robustness: odd inputs must not throw
console.log("1. Robustness (empty, short, flat, NaN inputs)");
const odd = [null, [], walk(10, 36e5, 0.01), Array.from({ length: 500 }, (_, i) => [i * 36e5, 100, 100, 100, 100, 0]), walk(500, 36e5, 0.01).map((b, i) => i === 250 ? [b[0], NaN, NaN, NaN, NaN, 0] : b)];
for (const [name, fn] of [["Markov.analyze", b => W.Markov.analyze(b)], ["Matrix.kalman", b => W.Matrix.kalman(b)], ["Matrix.dirac", b => W.Matrix.dirac(b)], ["Rollover.analyze", b => W.Rollover.analyze(b)], ["PB.analyze", b => W.PB.analyze(b, { tf: "1h" })], ["Rhythm.analyze", b => W.Rhythm.analyze(b, { win: 400 })], ["Planner.run", b => W.Planner.run("t", { "1h": b })], ["VFlow.analyze", b => W.VFlow.analyze(b)]])
  odd.forEach((b, i) => { try { fn(b); } catch (e) { ok(false, `${name} threw on odd input #${i}: ${e.message}`); } });
try { W.Trapped.analyze(null, null, 0); W.Liquid.signals(null); W.Hub.report({ eng: "x", z: NaN }); W.Hub.summary(); } catch (e) { ok(false, "helpers threw: " + e.message); }
console.log("   done");
// 2. false alarms on random walks, 3. power on a persistent series (returns with autocorrelation 0.15)
console.log(`2./3. False alarms on ${RUNS} random walks vs detections on ${RUNS} persistent series (hourly, 200 days)`);
const T = { markov: [0, 0], kalman: [0, 0], diracSpin: [0, 0], diracSpeed: [0, 0], rollover: [0, 0], plannerProven: [0, 0], rhythmWave: [0, 0] };
for (let k = 0; k < RUNS; k++) for (const [j, rho] of [[0, 0], [1, 0.15]]) {
  const B = walk(4800, 36e5, 0.01, rho), M = W.Markov.analyze(B), K = W.Matrix.kalman(B), D = W.Matrix.dirac(B), RO = W.Rollover.analyze(B), RH = W.Rhythm.analyze(B, { win: 400 });
  if (M && M.pass) T.markov[j]++; if (K && K.pass) T.kalman[j]++; if (D && D.Ws.z >= 2) T.diracSpin[j]++; if (D && D.Wg.z >= 2) T.diracSpeed[j]++; if (RO && RO.dir) T.rollover[j]++; if (RH && RH.freq && RH.freq.trust > 0) T.rhythmWave[j]++;
  if (k < Math.min(RUNS, 12)) { const P = W.Planner.run("hubtest:t" + k, { "1h": B, "4h": W.Planner.agg(B, 144e5) }); if (Object.values(P.tf).some(x => x.pick)) T.plannerProven[j]++; } }
console.log("   engine            false alarms (random)   detections (persistent)");
for (const [k, [a, b]] of Object.entries(T)) { const n = k === "plannerProven" ? Math.min(RUNS, 12) : RUNS; console.log(`   ${k.padEnd(18)} ${(a + "/" + n).padStart(8)} = ${String(Math.round(a / n * 100)).padStart(3)}%        ${(b + "/" + n).padStart(8)} = ${String(Math.round(b / n * 100)).padStart(3)}%`);
  ok(a / n <= (k === "plannerProven" ? 0.25 : 0.12), `${k}: too many false alarms (${a}/${n})`); }
ok(T.markov[1] / RUNS >= 0.5, "Markov should find persistence in most persistent series");
// 4. knowledge hub: the false-discovery check
console.log("4. Knowledge hub · Benjamini–Hochberg on 300 null tests + 15 real effects (z ≈ 4)");
const L = []; for (let i = 0; i < 300; i++) L.push({ key: "n" + i, z: g() }); for (let i = 0; i < 15; i++) L.push({ key: "r" + i, z: 4 + g() * 0.5 });
const P = W.Hub.bh(L, 0.1), tp = [...P].filter(k => k[0] === "r").length, fp = P.size - tp, naive = L.filter(f => f.z >= 1.645 && f.key[0] === "n").length;
console.log(`   proven ${P.size}: ${tp} real, ${fp} false (false share ${P.size ? Math.round(fp / P.size * 100) : 0}%); without the check, z ≥ 1.645 would pass ${naive} null tests`);
ok(tp >= 12, "BH should keep most real effects"); ok(fp / Math.max(1, P.size) <= 0.25, "BH false share too high");
console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED"); process.exit(fails ? 1 : 0);
