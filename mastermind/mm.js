/* Mastermind Investor · ask about any trade, get a thesis and the points that matter.
   One question ("I am about to go long on BE") → the market is found (coin, stock perp, spot token, stock, fund), the side and
   horizon are read from the words, and every source the three trackers keep is brought together:
   - Hyperdash cohorts on the perp: the six PnL cohorts and the five size cohorts, smart money vs fools, and how the gap moved
   - spot: taker buying vs selling and big trades on Hyperliquid spot (when the token trades there)
   - the bet lab: what it is (industry, size, age), life cycle (stage, distance from the high), vs its peers, the 24 h / 48 h / 7 d
     setups, and what holding with no stop and no target usually does (drawdown, best point)
   - intraday setups (15 min to end of day) from 5-minute bars, the spider web's forecast, the knowledge hub's proven findings,
     every site's live read, trapped traders, funding, liquidity, news, earnings, leveraged funds on it
   - engines run on demand on its hourly bars: trade planner, Markov memory, Kalman trend, Dirac spin, 4 pm roll-over
   Each piece is scored for and against the asked side, weighted by how well that kind of evidence has held up (smart money
   and the lab setups count most), and turned into a verdict, a thesis, a plan (limit entry, target, wrong-if) and a list of
   points to consider. Nothing here is advice: it is what the data and the tests say. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id), esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const RAW = "https://raw.githubusercontent.com/stevenwsharp-ctrl/Hyperdash-Cohort-Tracker/data/", c1 = v => Math.max(-1, Math.min(1, v));
  const lsG = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const pc = (v, d) => v == null || !isFinite(v) ? "–" : (v >= 0 ? "+" : "") + (v * 100).toFixed(d == null ? 1 : d) + "%", usd = n => { if (n == null || !isFinite(n)) return "–"; const a = Math.abs(n); return (n < 0 ? "-$" : "$") + (a >= 1e9 ? (a / 1e9).toFixed(2) + "B" : a >= 1e6 ? (a / 1e6).toFixed(1) + "M" : a >= 1e3 ? (a / 1e3).toFixed(0) + "K" : Math.round(a)); };
  const fx = v => v == null || !isFinite(v) ? "–" : v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v >= 10 ? v.toFixed(2) : v >= 1 ? v.toFixed(3) : v.toPrecision(4);
  const proxy = () => { try { return (localStorage.getItem("soxx_fred_proxy") || "").trim().replace(/\/+$/, ""); } catch (e) { return ""; } };
  // theme
  $("themeBtn").onclick = () => { const t = document.documentElement.dataset.theme === "light" ? "dark" : "light"; document.documentElement.dataset.theme = t; try { localStorage.setItem("soxx_theme", t); } catch (e) { } };
  // keep the search bar at the very top: the index strip goes under it
  setTimeout(() => { const ix = $("idxStrip"), q = $("q"); if (ix && q) q.closest(".card").after(ix); }, 50);
  // ---------- data (cached) ----------
  const D = {}; async function get(name, ttl) { const x = D[name]; if (x && Date.now() - x.at < ttl) return x.j; try { const r = await fetch(RAW + name + "?t=" + Math.floor(Date.now() / 3e5)); if (r.ok) { D[name] = { at: Date.now(), j: await r.json() }; return D[name].j; } } catch (e) { } return x ? x.j : null; }
  const hl = b => fetch("https://api.hyperliquid.xyz/info", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => r.ok ? r.json() : null).catch(() => null);
  let LT = null, INS = null, LAB = null;
  async function base() { [LT, INS] = await Promise.all([get("latest.json", 5 * 6e4), get("instruments.json", 6 * 36e5)]); LAB = await Agree.load(); buildIndex(); }
  // ---------- what can be searched ----------
  let IDX = [];   // { k: search key, s: symbol, n: name, coin (HL key), u (underlying), kind }
  function buildIndex() {
    const M = new Map(), add = (s, o) => { s = String(s || "").toUpperCase(); if (!s) return; const x = M.get(s) || { s, coins: [], n: "" }; if (o.coin && !x.coins.includes(o.coin)) x.coins.push(o.coin); if (o.n && !x.n) x.n = o.n; if (o.fund) x.fund = o.fund; if (o.u) x.u = o.u; M.set(s, x); };
    if (LT && LT.ctx) for (const c in LT.ctx) { const s = c.split(":").pop(); add(s.replace(/^K(?=[A-Z]{3,})/, ""), { coin: c }); add(s, { coin: c }); }
    if (INS && INS.m) for (const [c, I] of Object.entries(INS.m)) { if (I.u && I.u.s) add(I.u.s, { coin: c, n: I.u.n, u: I.u.s }); (I.lev || []).forEach(f => add(f.s, { n: f.n, fund: { L: (f.x || 1) * (f.d || 1), u: I.u && I.u.s || c.split(":").pop() } })); }
    IDX = [...M.values()];
  }
  const STOP = new Set("I A AM AN AND ARE AS AT BE_ BY DO FOR GO GOING HOW IF IN INTO IS IT ME MY OF ON OR SO THE THIS TO UP WE WHAT WHEN WITH YOU ABOUT LONG SHORT BUY SELL ABOUT TODAY WEEK SWING SCALP NOW SHOULD WOULD COULD CALLS PUTS ENTER EXIT HOLD TRADE POSITION THINKING PLAN WANT".split(" "));
  function parse(q) {
    const t = " " + q.toLowerCase() + " ", side = /\b(long|buy|calls?|bull|bullish|add|accumulate)\b/.test(t) ? 1 : /\b(short|sell|puts?|bear|bearish|fade|dump)\b/.test(t) ? -1 : 0;
    const hz = /\b(scalp|minutes?|15 ?m|30 ?m)\b/.test(t) ? "scalp" : /\b(today|intraday|day ?trade|end of day|eod)\b/.test(t) ? "day" : /\b(weekend|week|swing|days?|7 ?d)\b/.test(t) ? "swing" : /\b(month|long term|invest|hold)\b/.test(t) ? "long" : "all";
    const toks = (q.match(/\$?[A-Za-z][A-Za-z0-9.\-]{0,9}/g) || []).map(x => x.replace(/^\$/, ""));
    const cand = []; for (const tk of toks) { const u = tk.toUpperCase(), dollar = q.includes("$" + tk), caps = tk === u && tk.length >= 1;
      const hit = IDX.find(x => x.s === u); if (hit && (dollar || (!STOP.has(u) && (caps || u.length >= 2)))) cand.push({ x: hit, score: (dollar ? 3 : 0) + (caps ? 2 : 0) + (hit.coins.length ? 1 : 0) }); }
    if (!cand.length) { const words = q.toLowerCase().split(/\W+/).filter(w => w.length >= 4); const hit = IDX.find(x => x.n && words.some(w => x.n.toLowerCase().split(/\W+/).includes(w))); if (hit) cand.push({ x: hit, score: 1 }); }
    cand.sort((a, b) => b.score - a.score); return { side, hz, m: cand[0] ? cand[0].x : null, alt: cand.slice(1, 4).map(c => c.x.s) };
  }
  // ---------- gather ----------
  const COH = [["extremely_profitable", "Extremely profitable"], ["very_profitable", "Very profitable"], ["profitable", "Profitable"], ["unprofitable", "Unprofitable"], ["very_unprofitable", "Very unprofitable"], ["rekt", "Rekt"]];
  function cohorts(coin) { if (!LT || !LT.m || !LT.m[coin]) return null; const m = LT.m[coin], P = LT.pnl, Z = LT.size, bias = r => { if (!r) return null; const [lt, st, L, S] = r, n = L + S, tc = lt + st; return { b: tc ? 0.6 * (n ? (L - S) / n : 0) + 0.4 * (lt - st) / tc : 0, L, S, tr: tc }; };
    const p = P.map((c, i) => ({ id: c.id, n: c.label, ...bias(m.p[i]) })), s = Z.map((c, i) => ({ id: c.id, n: c.label, ...bias(m.s[i]) }));
    const ag = ids => { let L = 0, S = 0, lt = 0, st = 0; ids.forEach(id => { const i = P.findIndex(c => c.id === id); if (i >= 0 && m.p[i]) { lt += m.p[i][0]; st += m.p[i][1]; L += m.p[i][2]; S += m.p[i][3]; } }); const n = L + S, tc = lt + st; return { b: tc ? 0.6 * (n ? (L - S) / n : 0) + 0.4 * (lt - st) / tc : 0, n }; };
    const sm = ag(["extremely_profitable", "very_profitable"]), fo = ag(["unprofitable", "very_unprofitable", "rekt"]); let tL = 0, tS = 0; m.s.forEach(r => { tL += r[2]; tS += r[3]; });
    return { p, s, sm, fo, gap: (sm.b - fo.b) / 2, tr: LT.tr && LT.tr[coin], crowd: tL + tS ? (tL - tS) / (tL + tS) : null, tL, tS }; }
  async function gather(m) {
    const coins = m.coins.slice().sort((a, b) => ((LT.ctx[b] || {}).v || 0) - ((LT.ctx[a] || {}).v || 0)), coin = coins[0] || null, sym = m.fund ? m.fund.u : m.s, ctx = coin ? LT.ctx[coin] : null;
    const G = { m, coin, coins, sym, ctx, fund: m.fund, name: m.n || (window.Tax && coin ? (Tax.tag(coin).n || "") : ""), tag: window.Tax ? Tax.tag(coin || sym) : {} };
    const [SP, LV, SF, NW, CX] = await Promise.all([get("specialists.json", 10 * 6e4), get("levels.json", 10 * 6e4), get("spotflow.json", 5 * 6e4), get("news.json", 5 * 6e4), get("context.json", 30 * 6e4)]);
    G.coh = coin ? cohorts(coin) : null;
    G.trap = coin && SP && SP.m && SP.m[coin] && window.Trapped ? Trapped.analyze(SP.m[coin].holders, LV && LV.m && LV.m[coin] && LV.m[coin].h, ctx && ctx.px) : null;
    const tok = SF && SF.tokens ? (SF.tokens[sym] || SF.tokens["U" + sym] || null) : null; G.spot = tok ? { k: SF.tokens[sym] ? sym : "U" + sym, ...tok } : null;
    G.spotWh = SF && SF.whales && G.spot ? SF.whales.filter(w => !w.mm && (w.top || []).some(t => t[0] === G.spot.k)).map(w => ({ a: w.a, v: (w.top.find(t => t[0] === G.spot.k) || [])[1] || 0 })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 5) : [];
    G.news = NW && NW.items ? NW.items.filter(n => (n.c || []).some(c => c === coin || c.split(":").pop() === sym) || sym.length >= 3 && n.h !== n.h.toUpperCase() && new RegExp("(\\$|\\b)" + sym.replace(/[.*+?^${}()|[\]\\]/g, "") + "\\b").test(n.h)).sort((a, b) => b.t - a.t).slice(0, 6) : [];
    G.earn = CX && CX.earnings ? CX.earnings[sym] || null : null;
    G.lev = INS && INS.m ? Object.values(INS.m).filter(I => I.u && I.u.s === sym).flatMap(I => I.lev || []) : [];
    G.uName = INS && INS.m ? (Object.values(INS.m).find(I => I.u && I.u.s === sym) || {}).u : null;
    // setups shared with the trackers (lab + intraday), the spider web, the hub, every site's live read
    try { await Agree.intra(sym); } catch (e) { }
    G.lab = LAB ? Agree.setups(sym, 1, ctx && ctx.px) : null; G.prof = G.lab ? G.lab.P : null;
    G.intra = (() => { try { const C = lsG("intra_v1", {}), b = Agree.baseOf(sym), k = b ? b.k : "Y:" + sym; return C[k] ? C[k].v : null; } catch (e) { return null; } })();
    G.web = (() => { try { const a = coin ? coin.split(":").pop() : sym; return window.Web ? (Web.forecast(a, 24) || Web.forecast(sym, 24)) : null; } catch (e) { return null; } })();
    G.reads = Agree.reads(sym).concat(sym !== (coin || "").split(":").pop() ? Agree.reads((coin || "").split(":").pop()) : []);
    G.hub = window.Hub ? Hub.findings().filter(f => f.mkt === sym || f.mkt === (coin || "").split(":").pop() || (G.prof && f.mkt === G.prof.ind)) : [];
    // engines on its hourly bars (one request)
    if (coin) { const k = await hl({ type: "candleSnapshot", req: { coin: (LT.ctx[coin] && LT.ctx[coin].n) || (coin.includes(":") ? coin.split(":")[0].toLowerCase() + ":" + coin.split(":")[1] : coin), interval: "1h", startTime: Date.now() - 200 * 864e5, endTime: Date.now() } });
      if (Array.isArray(k) && k.length >= 300) { const B = k.map(b => [b.t, +b.o, +b.h, +b.l, +b.c, +b.v]); G.bars = B;
        try { G.plan = Planner.run("mm:" + sym, { "1h": B, "4h": Planner.agg(B, 144e5) }); } catch (e) { } try { G.mk = Markov.analyze(B); } catch (e) { } try { G.K = Matrix.kalman(B); G.Di = Matrix.dirac(B); } catch (e) { } try { G.ro = Rollover.analyze(B); } catch (e) { } } }
    if (!G.bars && proxy()) { try { const j = await (await fetch(`${proxy()}/chart?t=${encodeURIComponent(/\.X$/.test(sym) ? sym.replace(/\.X$/, "-USD") : sym)}&range=1y&interval=60m`)).json(); if (j.status === "ok") G.bars = j.bars.filter(b => b[4] != null && b[2] != null && b[3] != null).map(b => [b[0], b[1], b[2], b[3], b[4], b[5] || 0]); } catch (e) { } }
    return G;
  }
  // ---------- price targets, time frames and confidence ----------
  // From this market's own hourly history: for every start in the last ~180 days, what a trade on your side did within each
  // time frame with no stop and no target. Target 1 = the typical best point (half the trades got there), target 2 = the
  // best point 1 trade in 5 reached, "wrong if" = the room 80% of the winning trades needed. Confidence = how often target 1
  // (or 2) was touched BEFORE the wrong-if level within the time frame (the base rate here), then tilted by today's evidence
  // (at most ±15 points; the tilt is a judgment, not a tested number).
  function hoursToEod(crypto) { const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(new Date()).map(x => [x.type, x.value]));
    const m = +p.hour * 60 + +p.minute, end = crypto ? 1440 : 960; let h = (end - m) / 60; if (h < 0.75) h += crypto ? 24 : 24; return Math.max(0.75, h); }
  function targets(G, side, tilt) {
    const B = G.bars; if (!B || B.length < 300) return null; const n = B.length, crypto = (G.tag && G.tag.cls === "Crypto") || /\.X$/.test(G.sym), px = (G.ctx && G.ctx.px) || B[n - 1][4];
    const eod = hoursToEod(crypto), TF = [["4 hours", 4]].concat(eod >= 3 && Math.abs(eod - 4) > 1 ? [["Until end of day", eod]] : []).concat([["24 hours", 24], ["48 hours", 48], ["7 days", 168]])   /* hourly bars: 3+ hours, so a target and a stop are not inside the same bar */, q = (a, p) => { if (!a.length) return null; const z = a.slice().sort((x, y) => x - y); return z[Math.min(z.length - 1, Math.max(0, Math.floor(p * (z.length - 1))))]; };
    const t0 = B[n - 1][0] - 180 * 864e5, out = [];
    for (const [lab, h] of TF) { const S = [], step = Math.max(1, Math.round(h / 6));
      for (let i = 0; i < n - 1; i += step) { if (B[i][0] < t0) continue; const tEnd = B[i][0] + h * 36e5; if (tEnd > B[n - 1][0]) break; const e0 = B[i][4]; let j = i, mae = 0, mfe = 0; const path = [];
        while (j + 1 < n && B[j + 1][0] <= tEnd) { j++; const up = side > 0 ? B[j][2] / e0 - 1 : 1 - B[j][3] / e0, dn = side > 0 ? B[j][3] / e0 - 1 : 1 - B[j][2] / e0; mfe = Math.max(mfe, up); mae = Math.min(mae, dn); path.push([up, dn]); }
        if (!path.length) continue; S.push({ mfe, mae, r: side > 0 ? B[j][4] / e0 - 1 : 1 - B[j][4] / e0, path }); }
      if (S.length < 30) continue;
      const T1 = q(S.map(x => x.mfe), 0.5), T2 = q(S.map(x => x.mfe), 0.8), win = S.filter(x => x.r > 0).map(x => x.mae), W = win.length >= 10 ? q(win, 0.2) : q(S.map(x => x.mae), 0.3);
      if (!(T1 > 0) || !(W < 0)) continue;
      const first = T => S.reduce((a, x) => { for (const [up, dn] of x.path) { if (dn <= W && up >= T) return a + 0.5; if (dn <= W) return a; if (up >= T) return a + 1; } return a; }, 0) / S.length;   /* both inside one bar: the order is unknown, count half */
      const p1 = first(T1), p2 = first(T2), adj = p => Math.max(0.02, Math.min(0.98, p + (tilt >= 0 ? (1 - p) * tilt : p * tilt) * 0.3));
      out.push({ lab, h, n: S.length, t1: px * (1 + side * T1), t2: px * (1 + side * T2), w: px * (1 - side * Math.abs(W)), lim: px * (1 - side * Math.abs(W) * 0.25), T1, T2, W, p1, p2, c1: adj(p1), c2: adj(p2), until: Date.now() + h * 36e5 }); }
    return { px, side, rows: out };
  }
  // ---------- judge ----------
  function judge(G, side) {
    const E = [], add = (name, v, w, note, grp) => { if (v == null || !isFinite(v) || Math.abs(v) < 0.02) return; E.push({ name, v: c1(v), w, note, grp }); };
    const C = G.coh; if (C) { add("Smart money vs fools (Hyperdash cohorts)", C.gap * 1.6, 2, `profitable cohorts ${pc(C.sm.b, 0)} vs losing cohorts ${pc(C.fo.b, 0)}; the one system that held up in the 40-day backtest (best over 2–7 days)`, "Cohorts");
      if (C.tr && C.tr["24h"]) add("Smart money adding (24 h)", c1(C.tr["24h"][0] / 25), 0.6, `the gap moved ${C.tr["24h"][0] > 0 ? "+" : ""}${C.tr["24h"][0]} points in 24 h`, "Cohorts");
      if (C.crowd != null && Math.abs(C.crowd) > 0.1) add("Crowd lean (all traders, faded)", -C.crowd, 0.3, `all traders are ${C.crowd > 0 ? "long" : "short"}-heavy (${pc(C.crowd, 0)})`, "Cohorts"); }
    const S = G.lab && G.lab.out; if (S) [[7, "7 days", 1.5], [2, "48 h", 1.2], [1, "24 h", 1]].forEach(([h, l, w]) => { const x = S[h]; if (x && x.side) add(`Lab setup · ${l}`, x.side * Math.min(1, Math.abs(x.lean) * 3), w, (x.why || []).join(", "), "Lab"); });
    const I = G.intra && G.intra.out; if (I) [["15m", "15 min"], ["30m", "30 min"], ["1h", "1 hour"], ["4h", "4 hours"], ["eod", "end of day"]].forEach(([k, l]) => { const x = I[k]; if (x && x.side) add(`Intraday setup · ${l}`, x.side * Math.min(1, Math.abs(x.lean) * 2), 0.5, (x.why || []).join(", "), "Intraday"); });
    if (G.web) add("Spider web forecast (24 h)", (G.web.p - 0.5) * 4, G.web.ready ? 1 : 0.3, `P(up) ${Math.round(G.web.p * 100)}%${G.web.ready ? "" : " (still learning)"}`, "Spider web");
    if (G.trap) add("Trapped traders", G.trap.P, 0.8, `trapped longs ${usd(G.trap.L.usd)} vs shorts ${usd(G.trap.S.usd)}`, "Positioning");
    const f = G.ctx && G.ctx.f; if (f != null) add("Funding (the paid side)", -f * 24 * 365 / 0.3, 0.4, `${(f * 24 * 365 * 100).toFixed(1)}%/yr, ${f > 0 ? "longs pay shorts" : "shorts pay longs"}`, "Positioning");
    const P = G.prof; if (P) { if (P.stage === 2 || P.stage === 4) add("Life cycle stage", P.stage === 2 ? 0.6 : -0.6, 0.5, P.stage === 2 ? "stage 2: advancing" : "stage 4: declining", "Life cycle");
      if (P.relZ != null) add("Vs its peers (30 days)", P.relZ / 2, 0.4, `${P.relZ > 0 ? "ahead of" : "behind"} ${P.grp || "its industry"} by ${Math.abs(P.relZ).toFixed(1)}σ`, "Peers"); }
    if (G.spot && G.spot.W && G.spot.W["4h"]) { const w = G.spot.W["4h"], net = w[0] - w[1], tot = w[0] + w[1]; if (tot > 0) add("Spot taker flow (4 h)", net / tot * 2, 0.5, `buyers ${usd(w[0])} vs sellers ${usd(w[1])}`, "Spot"); }
    const R = G.reads.filter(([, r]) => r.side); if (R.length) add("Live reads of the three trackers", R.reduce((s, [, r]) => s + r.side, 0) / R.length, 0.5, R.map(([src, r]) => `${src.split(" · ").pop()} ${r.side > 0 ? "long" : "short"}`).join(", "), "Trackers");
    if (G.plan) Object.entries(G.plan.tf).forEach(([tf, x]) => { if (x.plan && x.plan.proven) add(`Trade planner · ${tf} (proven rule)`, x.plan.side, 0.8, `limit ${fx(x.plan.limit)}`, "Engines"); });
    if (G.mk && G.mk.pass && G.mk.sig.next) add("Markov memory", G.mk.sig.next, 0.4, G.mk.verdict, "Engines");
    if (G.K && G.K.pass) add("Kalman trend (tested)", c1(G.K.W.sign * G.K.t / 3), 0.4, `t ${G.K.t.toFixed(1)}`, "Engines");
    const sw = E.reduce((s, e) => s + e.w, 0), score = sw ? E.reduce((s, e) => s + e.v * e.w, 0) / sw : 0;
    return { E, score, side: side || Math.sign(score) || 1, asked: side };
  }
  // ---------- answer ----------
  function answer(G, J, q) {
    const sd = J.side, sn = sd > 0 ? "long" : "short", sup = J.score * sd, E = J.E.slice().sort((a, b) => Math.abs(b.v * b.w) - Math.abs(a.v * a.w)), pro = E.filter(e => e.v * sd > 0), con = E.filter(e => e.v * sd < 0);
    const vrd = !E.length ? ["No read", "", "Almost no data on this market yet."] : sup >= 0.25 ? ["Strong support for going " + sn, "L"] : sup >= 0.08 ? ["Leans your way: " + sn, "L"] : sup > -0.08 ? ["Mixed: no edge either way", "A"] : sup > -0.25 ? ["Leans against going " + sn, "S"] : ["Strong evidence against going " + sn, "S"];
    const px = G.ctx && G.ctx.px, H = q.hz, pickH = H === "scalp" ? ["intra", "1h"] : H === "day" ? ["intra", "eod"] : H === "long" ? ["lab", 7] : H === "swing" ? ["lab", 7] : ["lab", 2];
    const lab = G.lab && G.lab.out, intra = G.intra && G.intra.out, setup = pickH[0] === "lab" ? lab && lab[pickH[1]] : intra && intra[pickH[1]], useSetup = setup && setup.side === sd ? setup : null;
    const exL = G.prof && G.prof.ex ? G.prof.ex[pickH[0] === "lab" ? pickH[1] : 1] : null, ex = exL ? exL[sd > 0 ? "L" : "S"] : null;
    const sideTxt = q.side ? "" : ` (you did not say a side, so this reads the side the evidence favors: ${sn})`;
    const t1 = `${esc(G.m.s)}${G.name ? " (" + esc(G.name) + ")" : ""}${G.tag && G.tag.ind ? ", " + esc(G.tag.ind) : ""}${G.prof && G.prof.stage ? `, stage ${G.prof.stage}` : ""}${G.prof && G.prof.athD != null ? `, ${pc(G.prof.athD, 0)} from its all-time high` : ""}.`;
    const t2 = pro.length ? `For ${sn}: ${pro.slice(0, 3).map(e => e.name.toLowerCase()).join("; ")}.` : "", t3 = con.length ? `Against: ${con.slice(0, 3).map(e => e.name.toLowerCase()).join("; ")}.` : "";
    const t4 = useSetup ? `The ${pickH[0] === "lab" ? (pickH[1] === 7 ? "7-day" : pickH[1] === 2 ? "48-hour" : "24-hour") : (pickH[1] === "eod" ? "end-of-day" : pickH[1])} setup agrees: limit entry ${fx(useSetup.lim)}, target ${fx(useSetup.tgt)}, wrong if ${fx(useSetup.wrong)}.` : setup && setup.side === -sd ? `The tested setup for this horizon points the other way (${setup.side > 0 ? "long" : "short"}).` : "No tested setup for this horizon right now: if you go, use a limit order, not a market order.";
    // points to consider
    const P = [];
    if (G.earn) P.push(`<b>Earnings ${esc(G.earn.d)}${G.earn.tm ? " " + esc(G.earn.tm) : ""}</b> (estimate ${esc(G.earn.est)}): a gap can jump past any stop.`);
    if (ex) P.push(`Held with no stop and no target, a ${sn} here usually goes <b class="S">${pc(ex.mae50)}</b> against you on the way (worst 10%: ${pc(ex.mae90)}) and is up <b class="L">${pc(ex.mfe50)}</b> at its best (top 10%: ${pc(ex.mfe90)}). Size so that the worst-10% drawdown is money you can sit through.${ex.winMae80 != null ? ` 80% of winning holds never went past ${pc(ex.winMae80)}: a stop inside that kills winners.` : ""}`);
    if (G.coh && Math.sign(G.coh.gap) === -sd && Math.abs(G.coh.gap) >= 0.1) P.push(`<b>Smart money is on the other side</b>: profitable cohorts ${pc(G.coh.sm.b, 0)}, losing cohorts ${pc(G.coh.fo.b, 0)}. In the backtest this was the most reliable signal.`);
    if (G.coh && Math.sign(G.coh.gap) === sd && Math.abs(G.coh.gap) >= 0.1) P.push(`Smart money is with you (gap ${(G.coh.gap * 100).toFixed(0)}): the most reliable signal in the backtest, strongest over 2–7 days.`);
    if (G.trap) { const T = G.trap, mine = sd > 0 ? T.L : T.S, other = sd > 0 ? T.S : T.L; if (mine.usd > other.usd * 1.5 && mine.usd > 2e5) P.push(`<b>${sd > 0 ? "Longs" : "Shorts"} are already trapped</b> (${usd(mine.usd)}, break-even wall near ${fx(mine.be)}): they sell into bounces there.`);
      if (other.usd > mine.usd * 1.5 && other.usd > 2e5) P.push(`Trapped ${sd > 0 ? "shorts" : "longs"} (${usd(other.usd)}) are fuel for your side${other.liq10 ? `; ${usd(other.liq10)} of them liquidate within 10%` : ""}.`); }
    if (G.ctx && G.ctx.f != null) { const ann = G.ctx.f * 24 * 365 * sd; P.push(ann > 0.1 ? `Funding costs you about ${(ann * 100).toFixed(0)}%/yr to hold a ${sn} on the perp.` : ann < -0.05 ? `Funding pays you about ${(-ann * 100).toFixed(0)}%/yr to hold this ${sn} on the perp.` : `Funding is small (${(G.ctx.f * 24 * 365 * 100).toFixed(1)}%/yr).`); }
    if (G.coh && G.coh.crowd != null && Math.sign(G.coh.crowd) === sd && Math.abs(G.coh.crowd) > 0.3) P.push(`The crowd is crowded on your side (${pc(G.coh.crowd, 0)} of all traders' money): crowded trades unwind fast.`);
    if (G.prof && G.prof.stage === 4 && sd > 0) P.push(`It is in stage 4 (falling 150-day average, price below it): longs fight the trend.`); if (G.prof && G.prof.stage === 2 && sd < 0) P.push(`It is in stage 2 (rising trend): shorts fight the trend.`);
    if (G.ctx && G.ctx.v != null && G.ctx.v < 2e6) P.push(`Thin market: ${usd(G.ctx.v)} traded in 24 h on the perp. Use small size and limit orders.`);
    if (G.fund) P.push(`${esc(G.m.s)} is a ${G.fund.L > 0 ? "+" : ""}${G.fund.L}× fund on ${esc(G.fund.u)}: leveraged funds lose value in choppy markets (volatility decay); hold them for days, not months.`);
    if (!G.fund && G.lev.length) { const ls = G.lev.filter(f => (f.x || 1) * (f.d || 1) * sd > 0).slice(0, 4); if (ls.length) P.push(`Funds for a ${sn} on ${esc(G.sym)}: ${ls.map(f => `${esc(f.s)} (${(f.x || 1) * (f.d || 1) > 0 ? "+" : ""}${(f.x || 1) * (f.d || 1)}×)`).join(", ")}.`); }
    if (G.news.length) P.push(`Latest news: ${G.news.slice(0, 2).map(n => `<a href="${esc(n.url || "#")}" target="_blank" rel="noopener">${esc(n.h)}</a> (${Math.round((Date.now() - n.t) / 36e5)} h ago)`).join(" · ")}`);
    if (!G.coin) P.push(`No Hyperliquid market for ${esc(G.sym)}: no Hyperdash cohorts, trapped traders or funding for it. The read uses its chart and the lab only.`);
    // evidence bars
    const ev = E.map(e => { const w = Math.abs(e.v) * 50, me = e.v * sd > 0; return `<div>${esc(e.name)}<div class="note" style="margin:0">${esc(e.note || "")}</div></div><div class="bar"><i style="${e.v >= 0 ? "left:50%" : "right:50%"};width:${w}%;background:var(--${me ? "up" : "down"})"></i></div><div class="${me ? "L" : "S"}" style="font-family:var(--mono);font-size:12px">${me ? "for" : "against"} ${Math.abs(e.v).toFixed(2)} × weight ${e.w}</div>`; }).join("");
    const cohT = G.coh ? `<div class="tw"><table><tr><th class="l">Cohort (PnL)</th><th>Bias</th><th>Long $</th><th>Short $</th><th>Traders</th></tr>${G.coh.p.map(c => `<tr><td class="l">${esc(c.n)}</td><td class="${c.b > 0 ? "L" : "S"}">${pc(c.b, 0)}</td><td>${usd(c.L)}</td><td>${usd(c.S)}</td><td>${c.tr || "–"}</td></tr>`).join("")}<tr><th class="l">Cohort (size)</th><th></th><th></th><th></th><th></th></tr>${G.coh.s.map(c => `<tr><td class="l">${esc(c.n)}</td><td class="${c.b > 0 ? "L" : "S"}">${pc(c.b, 0)}</td><td>${usd(c.L)}</td><td>${usd(c.S)}</td><td>${c.tr || "–"}</td></tr>`).join("")}</table></div>
      <div class="note">Gap (smart − fools) ${(G.coh.gap * 100).toFixed(0)} → smart money ${G.coh.gap >= 0 ? "long" : "short"}.${G.coh.tr ? " Gap change: " + ["4h", "24h", "7d"].filter(k => G.coh.tr[k]).map(k => `${k} ${G.coh.tr[k][0] > 0 ? "+" : ""}${G.coh.tr[k][0]}`).join(", ") + "." : ""}</div>` : `<div class="note">No Hyperdash cohort data (no Hyperliquid perp for ${esc(G.sym)}).</div>`;
    const spotT = G.spot ? `<div class="tw"><table><tr><th class="l">Spot ${esc(G.spot.k)}</th>${["15m", "1h", "4h", "24h"].map(w => `<th>${w}</th>`).join("")}</tr><tr><td class="l">Taker buy − sell</td>${["15m", "1h", "4h", "24h"].map(w => { const x = G.spot.W[w]; return `<td class="${x && x[0] >= x[1] ? "L" : "S"}">${x ? usd(x[0] - x[1]) : "–"}</td>`; }).join("")}</tr></table></div>${G.spotWh.length ? `<div class="note">Biggest spot traders who take a side: ${G.spotWh.map(w => `${w.a.slice(0, 6)}… <span class="${w.v > 0 ? "L" : "S"}">${usd(w.v)}</span>`).join(" · ")}</div>` : ""}` : `<div class="note">Not traded on Hyperliquid spot.</div>`;
    const u = G.fund ? G.fund.u : G.sym, L = G.fund ? G.fund.L : 1;
    const TT = targets(G, sd, Math.max(-0.5, Math.min(0.5, sup))), bestR = TT && TT.rows.length ? TT.rows.slice().sort((a, b) => b.c1 * b.T1 - a.c1 * a.T1)[0] : null;
    $("ans").innerHTML = `<section class="card"><div class="label">Your question · ${esc(q.text)}</div>
        <div class="verdict ${vrd[1]}">${esc(vrd[0])}</div>${bestR ? `<div class="thesis" style="margin-bottom:6px"><b>Best ${sn} plan:</b> limit ${sd > 0 ? "buy" : "sell"} near ${fx(bestR.lim)}, target ${fx(bestR.t1)} (${pc(sd * bestR.T1)}) within ${esc(bestR.lab.toLowerCase())}, <b class="${bestR.c1 >= 0.55 ? "L" : bestR.c1 < 0.4 ? "S" : "A"}">${Math.round(bestR.c1 * 100)}% confidence</b> it gets there before ${fx(bestR.w)} (wrong if). Stretch target ${fx(bestR.t2)} at ${Math.round(bestR.c2 * 100)}%.</div>` : ""}<div class="thesis">${t1} ${t2} ${t3} ${t4}${sideTxt}</div>
        <ul class="pts">${P.map(p => `<li>${p}</li>`).join("")}</ul>
        <div class="note">Score ${(sup >= 0 ? "+" : "")}${sup.toFixed(2)} for your side from ${E.length} pieces of evidence (−1 … +1). Weights: smart money and the lab's tested setups count most; untested signals count least. This is what the data and the tests say, not advice.</div></section>
      ${(() => { const T = TT; if (!T || !T.rows.length) return ""; const tm = t => new Date(t).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
        const set = h => { const L = G.lab && G.lab.out, I = G.intra && G.intra.out, x = h <= 1 ? I && I["1h"] : h <= 4 ? I && I["4h"] : h < 24 ? I && I.eod : h <= 24 ? L && L[1] : h <= 48 ? L && L[2] : L && L[7]; return !x || !x.side ? '<span class="note">no tested setup</span>' : x.side === sd ? '<b class="L">agrees</b>' : '<b class="S">points the other way</b>'; };
        const cc = p => `<b class="${p >= 0.55 ? "L" : p < 0.4 ? "S" : "A"}">${Math.round(p * 100)}%</b>`;
        return `<section class="card"><div class="label">Price targets and time frames · going ${sn} from ${fx(T.px)}</div><div class="tw"><table><tr><th class="l">Time frame</th><th title="A limit order a little better than now">Limit entry</th><th>Target 1</th><th title="How often target 1 was reached before the wrong-if level, on this market, tilted by today's evidence">Confidence</th><th>Target 2</th><th>Confidence</th><th title="80% of winning trades never went past this level">Wrong if</th><th>Hold until</th><th class="l">Tested setup</th></tr>
          ${T.rows.map(r => `<tr><td class="l">${esc(r.lab)}</td><td>${fx(r.lim)}</td><td class="${sd > 0 ? "L" : "S"}"><b>${fx(r.t1)}</b> <span class="note">${pc(sd * r.T1)}</span></td><td>${cc(r.c1)} <span class="note">base ${Math.round(r.p1 * 100)}%</span></td><td class="${sd > 0 ? "L" : "S"}">${fx(r.t2)} <span class="note">${pc(sd * r.T2)}</span></td><td>${cc(r.c2)}</td><td>${fx(r.w)} <span class="note">${pc(-Math.abs(r.W) * 1)}</span></td><td>${tm(r.until)}</td><td class="l">${set(r.h)}</td></tr>`).join("")}</table></div>
          <div class="note">For 15 minutes to 1 hour, use the intraday rows of the setups table below. From ${esc(G.m.s)}'s own hourly history (about 180 days): target 1 is where half of all ${sn} trades got to at their best within the time frame, target 2 where 1 in 5 got to; "wrong if" is the room 80% of the winning trades needed. <b>Confidence</b> = how often the target was touched before the wrong-if level (the base rate on this market), tilted by today's evidence score (${(sup >= 0 ? "+" : "")}${sup.toFixed(2)}, at most ±15 points; the tilt is a judgment, not a tested number). A tested setup that agrees makes a time frame stronger; one that points the other way is a warning.</div></section>`; })()}
      <section class="card"><div class="label">Setups · 15 min to 7 days (the same numbers all three trackers show)</div><div class="tw">${Agree.html(u, { L, px: px || (G.intra && G.intra.px), s: G.m.s })}</div></section>
      <div class="grid"><section class="card"><div class="label">Evidence · for and against going ${sn}</div><div class="ev">${ev || '<div class="note">No evidence yet.</div>'}</div></section>
        <section class="card"><div class="label">Hyperdash cohorts · futures (perp ${esc(G.coin || "–")})</div>${cohT}</section>
        <section class="card"><div class="label">Spot</div>${spotT}${G.trap ? `<div class="label" style="margin-top:10px">Trapped traders (top holders)</div>${Trapped.html(G.trap, { px: fx, usd })}` : ""}</section>
        <section class="card"><div class="label">What it is · life cycle · peers</div>${G.prof ? `<div class="note" style="font-size:13px;color:var(--ink)">${esc(G.prof.cls || "")} · ${esc(G.prof.ind || "")} · ${esc(G.prof.cap || "")} · listed ${G.prof.yr || "?"} · ${G.prof.ageHL != null ? G.prof.ageHL + " days on Hyperliquid" : ""}</div>
          <table><tr><td class="l">Trend stage</td><td>${G.prof.stage || "–"} ${["", "(base)", "(advance)", "(top)", "(decline)"][G.prof.stage || 0]}</td></tr><tr><td class="l">From its all-time high</td><td>${pc(G.prof.athD, 0)}</td></tr><tr><td class="l">30 days · vs its peers</td><td>${pc(G.prof.r30)} · ${G.prof.relZ != null ? (G.prof.relZ >= 0 ? "+" : "") + G.prof.relZ.toFixed(1) + "σ" : "–"}</td></tr><tr><td class="l">Its industry, 30 days</td><td>${pc(G.prof.grpR30)}</td></tr><tr><td class="l">Beta to its market</td><td>${G.prof.beta != null ? G.prof.beta.toFixed(2) : "–"}</td></tr></table>` : `<div class="note">Not in the daily lab yet.</div>`}
          ${G.web ? `<div class="label" style="margin-top:10px">Spider web</div>${Web.forecastHtml((G.coin || G.sym).split(":").pop()) || ""}` : ""}
          ${G.plan ? `<div class="label" style="margin-top:10px">Engines on its hourly bars</div><div class="note">${G.mk ? "Markov: " + esc(G.mk.verdict) + ". " : ""}${G.K ? `Kalman trend t ${G.K.t.toFixed(1)}${G.K.pass ? " (tested)" : " (not proven)"}. ` : ""}${G.Di ? `Dirac mass ${G.Di.aNow.toFixed(2)} (${G.Di.aNow < G.Di.aAll - 0.04 ? "light: moves run" : G.Di.aNow > G.Di.aAll + 0.04 ? "heavy: chop" : "normal"}). ` : ""}${G.ro ? `4 pm roll-over: ${G.ro.dir ? (G.ro.dir > 0 ? "day's side continues" : "day's side reverses") : "no proven edge"}.` : ""}</div>` : ""}
          ${G.hub.length ? `<div class="label" style="margin-top:10px">Knowledge hub · tests on this market</div><div class="note">${G.hub.sort((a, b) => b.z - a.z).slice(0, 6).map(f => `${esc(f.eng)} · ${esc(f.rule)} ${esc(f.h)}: z ${f.z.toFixed(1)}`).join("<br>")}</div>` : ""}</section></div>
      ${G.plan ? `<section class="card"><div class="label">Trade planner · ${esc(G.m.s)} (1 hour and 4 hour, limit entries)</div><div class="tw">${Planner.html(G.plan, { px: fx })}</div></section>` : ""}
      ${q.alt.length ? `<div class="note">Did you mean ${q.alt.map(a => `<a href="#" data-q="${esc(a)}">${esc(a)}</a>`).join(", ")}?</div>` : ""}`;
  }
  // ---------- ask ----------
  async function ask(text) {
    if (!text.trim()) return; const qi = $("qi"); qi.value = text; $("ans").innerHTML = `<section class="card"><div class="note">Reading cohorts, the lab, the spider web and every tracker…</div></section>`;
    if (!IDX.length) await base(); const q = { text, ...parse(text) };
    if (!q.m) { $("ans").innerHTML = `<section class="card"><div class="verdict A">Market not found</div><div class="note">Try the ticker, for example "NVDA", "HYPE", "SOXL" or "$BE". The search knows every Hyperliquid market, every stock with leveraged funds and every leveraged fund.</div></section>`; return; }
    const G = await gather(q.m), J = judge(G, q.side); answer(G, J, q);
    const R = lsG("mm_recent", []).filter(x => x !== text); R.unshift(text); lsS("mm_recent", R.slice(0, 8)); examples();
    try { history.replaceState(null, "", "#q=" + encodeURIComponent(text)); } catch (e) { }
  }
  $("q").onsubmit = e => { e.preventDefault(); ask($("qi").value); };
  document.addEventListener("click", e => { const a = e.target.closest("[data-q]"); if (a) { e.preventDefault(); ask(a.dataset.q); window.scrollTo(0, 0); } });
  function examples() { const R = lsG("mm_recent", []), ex = R.length ? R : ["I am about to go long on BE", "short HYPE for the weekend?", "NVDA swing", "SOXL today", "BTC long"]; $("qex").innerHTML = (R.length ? '<span class="note" style="margin:4px 4px 0 0">Recent:</span>' : "") + ex.map(x => `<button data-q="${esc(x)}">${esc(x)}</button>`).join(""); }
  // suggestions while typing
  const dl = document.createElement("datalist"); dl.id = "mmlist"; document.body.appendChild(dl); $("qi").setAttribute("list", "mmlist");
  $("qi").addEventListener("input", () => { const w = ($("qi").value.split(/\s+/).pop() || "").replace(/^\$/, "").toUpperCase(); if (w.length < 1 || !IDX.length) return; dl.innerHTML = IDX.filter(x => x.s.startsWith(w) || (x.n && x.n.toUpperCase().includes(w) && w.length >= 3)).slice(0, 12).map(x => `<option value="${esc($("qi").value.replace(/\S*$/, "") + x.s)}">${esc(x.n || "")}</option>`).join(""); });
  // ---------- front page ----------
  async function home() {
    await base(); const L = Agree.lab(); let h = "";
    if (L && L.prof) { const P = Object.entries(L.prof), best = (hz, d) => P.filter(([, p]) => p.setups && p.setups[hz] && p.setups[hz].side === d).sort((a, b) => Math.abs(b[1].setups[hz].lean) - Math.abs(a[1].setups[hz].lean)).slice(0, 6);
      const tb = (hz, d) => `<table><tr><th class="l ${d > 0 ? "L" : "S"}">${d > 0 ? "Long" : "Short"}</th><th>Price</th><th>Limit entry</th><th>Target</th><th>Wrong if</th></tr>${best(hz, d).map(([c, p]) => { const x = p.setups[hz]; return `<tr><td class="l"><a href="#" data-q="${esc((d > 0 ? "long " : "short ") + p.s)}">${esc(p.s)}</a> <span class="note">${esc(p.ind || "")}</span></td><td>${fx(p.px)}</td><td>${fx(x.lim)}</td><td class="${d > 0 ? "L" : "S"}">${fx(x.tgt)}</td><td>${fx(x.wrong)}</td></tr>`; }).join("") || '<tr><td colspan="5" class="note">none</td></tr>'}</table>`;
      h += `<section class="card"><div class="label">Best setups now · from the daily lab (as of ${esc(L.asOf)}) · select one for the full thesis</div><div class="grid">${[[2, "Next 48 hours"], [7, "Next 7 days"]].map(([hz, l]) => `<div><div class="note"><b>${l}</b></div><div class="tw">${tb(hz, 1)}</div><div class="tw" style="margin-top:6px">${tb(hz, -1)}</div></div>`).join("")}</div></section>`; }
    h += `<section class="card"><div class="label">🧠 Knowledge hub · what is proven across the three trackers</div><div id="mmHub"></div></section>
      <section class="card"><div class="label">🕸 Spider web · every signal and how they link</div><div id="mmWeb"></div></section>
      <section class="card"><div class="label">The trackers</div><div class="grid"><div><b><a href="../">SOXX Sniper</a></b><div class="note">SOXL, SOXS and the semiconductor index: live read, whales, volume flow, trade planner, liquidity.</div></div><div><b><a href="https://stevenwsharp-ctrl.github.io/Hyperdash-Cohort-Tracker/">Cohort Sniper</a></b><div class="note">Every Hyperliquid market: smart money vs fools, Outlook (24 h / 48 h / 7 d), the bet lab, trapped traders.</div></div><div><b><a href="https://stevenwsharp-ctrl.github.io/LETF-Sniper/">LETF Sniper</a></b><div class="note">Every US leveraged and inverse fund: live movers, volume profile, one setup per underlying.</div></div></div></section>`;
    $("home").innerHTML = h; try { Hub.mount($("mmHub")); } catch (e) { } try { Web.render($("mmWeb"), { h: 420, working: true }); } catch (e) { }
  }
  examples(); home().then(() => { const m = location.hash.match(/q=([^&]+)/); if (m) ask(decodeURIComponent(m[1])); }); setInterval(() => { if (!document.hidden) home(); }, 10 * 6e4);
})();
