import fs from "node:fs"; import vm from "node:vm";
// First Breaths (fb.js) test: no throws on odd input, no false edge on random walks, edge found on persistent series.
// Usage: node tests/fb.test.mjs   (from the soxx-sniper folder)
import path from "node:path";
const file = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "fb.js");
const el = () => ({ style: {}, className: "", id: "", addEventListener() { }, appendChild() { }, remove() { }, isConnected: false, innerHTML: "", querySelector: () => null });
const store = {};
const ctx = { console, Math, Date, JSON, Intl, Promise, setTimeout: () => 0, setInterval: () => 0, requestAnimationFrame: () => 0, addEventListener() { }, MutationObserver: class { observe() { } },
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
  document: { head: el(), body: el(), createElement: el, getElementById: () => null, querySelector: () => null, addEventListener() { }, hidden: false }, CSS: { escape: s => s } };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync(file, "utf8"), ctx);
const FB = ctx.FB;
let seed = 7; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }, g = () => Math.sqrt(-2 * Math.log(R())) * Math.cos(2 * Math.PI * R());
function walk(n, sd, rho = 0, drift = 0) { let p = 100, pr = 0; const t0 = Date.UTC(2026, 9, 1, 0, 0); return Array.from({ length: n }, (_, i) => { const o = p, e = rho * pr + g() * sd + drift; pr = e; p *= Math.exp(e);
  return [t0 + i * 6e4, o, Math.max(o, p) * (1 + Math.abs(g()) * sd * 0.4), Math.min(o, p) * (1 - Math.abs(g()) * sd * 0.4), p, Math.round(1000 * Math.exp(g() * 0.6 + Math.abs(e) / sd * 0.3))]; }); }
function run(label, mk, runs = 20) {
  const T = {}; let nF = 0, nB = 0;
  for (let k = 0; k < runs; k++) { const B = mk(); nB += B.length;
    for (const [tf, ms, H] of [["1m", 6e4, 15], ["5m", 3e5, 6]]) { const BB = tf === "1m" ? B : FB.agg(B, ms); const { P, F } = FB.scan(BB, { crypto: true }); nF += F.length;
      for (const f of F) { const o = FB.outcome(P, f, H, ms); if (!o || !o.done) continue; const key = f.type + " " + f.id; const x = T[key] = T[key] || [0, 0]; x[0]++; x[1] += o.hit; } } }
  console.log(`\n${label}: ${nF} breaths on ${nB} 1m bars (${(nF / nB * 60).toFixed(1)} per hour of 1m bars, both time frames)`);
  Object.entries(T).sort().forEach(([k, [n, h]]) => console.log(`  ${k.padEnd(18)} n ${String(n).padStart(5)}  hit ${(h / n * 100).toFixed(1)}%  z ${((h - n / 2) / Math.sqrt(n / 4)).toFixed(1)}`));
  return T;
}
// robustness
for (const B of [[], walk(10, 0.001), Array.from({ length: 300 }, (_, i) => [i * 6e4, 100, 100, 100, 100, 0]), walk(400, 0.001).map((b, i) => i === 200 ? [b[0], NaN, NaN, NaN, NaN, 0] : b)]) { try { FB.scan(B, {}); } catch (e) { console.log("THREW", e.message); process.exitCode = 1; } }
console.log("robustness ok");
const rw = run("Random walk (no edge should show: hit ~50%)", () => walk(3000, 0.001));
run("Trending, persistent (continuation should win)", () => walk(3000, 0.001, 0.25));
run("Mean-reverting (reversal should win)", () => walk(3000, 0.001, -0.25));
// false alarm guard: on random walks no breath kind should be far from 50%
let bad = 0; for (const [k, [n, h]] of Object.entries(rw)) if (n >= 200 && Math.abs((h - n / 2) / Math.sqrt(n / 4)) > 4) { bad++; console.log("  bias on random walk:", k); }
// reliability shrinkage
const r0 = FB.rel("ZZZ", "stock", "r.div|rev|1m"); console.log("\nprior reliability with no data:", r0.p.toFixed(2), r0.tier);
if (bad) { console.log("FAIL: a breath shows a false edge on random walks"); process.exitCode = 1; } else console.log("PASS: no false edge on random walks");
