/* SOXX Sniper · Whale watch
   Tracks the best and worst SOXL traders on Hyperliquid (xyz:SOXL perpetual), live.
   Wallet list: SOXL trader study of Oct 28, 2026 (full SOXL profit from Hyperdash; 248 wallets studied).
   Positions: Hyperliquid info API (clearinghouseState, dex "xyz"), every minute, also when the tab is in the background.
   Top-trader moves: the real fills of the top 20 wallets (userFills / userFillsByTime), merged into one move per
   wallet, side and action when the fills are less than 15 minutes apart. So a trader who adds to a short in
   many small orders shows as one growing move with the right time.
   Alerts: top-trader moves of $50K or more (and every $100K more); worst-wallet position changes against the size at the
   last alert (so slow adds are caught); a large position near liquidation.
   Depends on globals from index.html: $, Q, FUND, alert1, fmtPx, fmtPct, esc, lsGet, lsSet. */
(function () {
  "use strict";
  // [address, group (B = best, W = worst), SOXL profit $, SOXL trades, win rate %, Hyperdash cohort]
  const LIST = [["0x024294c53a69c1e6b39810b3fac87385752fffa1","B",816922,295,42,"Extremely Profitable"],["0xbb475febf78b528f4f0d4ae1a12541406565199c","B",327741,60,51.7,"Extremely Profitable"],["0xbd697846b0911baeba002a56bdc16f1f332d45fb","B",257584,96,41.7,"Rekt"],["0x9dead8fffcbf130e7658f672d2c081d91178d617","B",228553,6,100,"Extremely Profitable"],["0xda3768e9299e1fd81708ec030dac5ea37125f7b5","B",211500,36,47.2,"Rekt"],["0x8bd30fc805e672e1d978138ecbedcb48479ce275","B",202636,5,60,"Very Profitable"],["0xfc27136e42af1732ddc9ce2605ea9bff1b959d9d","B",110328,80,38.8,"Extremely Profitable"],["0x3b2e0b95acd47d987c1abdf42967fd82d469bdbb","B",98782,43,60.5,"Very Profitable"],["0x90e56dc997fea87c8463d661e621b1e7fd5181af","B",90533,60,55,"Very Profitable"],["0xec85bc052ec5b6d6cb2b40f5caa45e39b61a77fe","B",67178,10,30,"Very Unprofitable"],["0x177019594ba3913d416ab1a8f3e5527d4c2b2837","B",54572,2415,50.4,"Profitable"],["0xa38f19c4ccbcfd64cff676d72c436f7e6239dccf","B",49333,55,67.3,"Very Profitable"],["0xd33c704c68518e527bdcb36f7966c80edcffbdf2","B",40319,75,62.7,"Very Profitable"],["0x37f7ff1864f5d5cba2b63592656049f2d7d06fb4","B",40027,6,50,"Profitable"],["0x421183f04d68d0c2c68e27f07ccf84cd8746b9ef","B",37272,3,33.3,"Very Profitable"],["0x6d9d3438d8ad0506c74d0b91c68fa6b8f58154e6","B",37005,5,100,"Profitable"],["0x0b1ace05eb9ef1c3a1951b763700ecad24f27741","B",35729,6229,57.2,"Extremely Profitable"],["0x7717a7a245d9f950e586822b8c9b46863ed7bd7e","B",33448,71,63.4,"Extremely Profitable"],["0xb45bacc19c5f71ca8ba4134b0bbe6f4a1e9a5b11","B",26524,42,61.9,"Very Profitable"],["0x1886d6d9b05f11e9db19ba6f84811bb80d4c6582","B",22491,4,100,"Unprofitable"],["0xda411866ef8da115945db1c4987f44cb02c5d3f1","W",-1679857,5,20,"Rekt"],["0x4bcc092a156905788bf2a1a59e5968623957210d","W",-547814,482,57.3,"Very Profitable"],["0xd52936fa285cfa500440e31355c0b28f4b740729","W",-522826,11025,40.4,"Rekt"],["0xfd4224606069dd88fec92093a27591008263fda5","W",-90051,72,44.4,"Very Unprofitable"],["0xe724acd020fbd65ddb42a0f05dcfb65489480320","W",-80456,10,50,"Unprofitable"],["0x7f5653978d3f1b9716140bb7304c7e4650ae50f6","W",-62676,24,33.3,"Unprofitable"],["0xfc667adba8d4837586078f4fdcdc29804337ca06","W",-59080,16,56.3,"Extremely Profitable"],["0x25773676902085225ae5751075e4161369334897","W",-58715,1811,45.6,"Extremely Profitable"],["0xe9ffe7698f46f96f980f2877e18c43f5b4165903","W",-52483,34,44.1,"Rekt"],["0x7cee351d68e21f2bf1adf8161bd1598a80d6fc93","W",-44249,20,35,"Rekt"]];
  const COIN = "xyz:SOXL", DEX = "xyz", API = "https://api.hyperliquid.xyz/info";
  const MIN_EV = 50000;          // position changes smaller than $50K do not make an event
  const MIN_MOVE = 10000;        // top-trader moves smaller than $10K are not shown in the top 3
  const GAP = 15 * 60000;        // fills closer than this join the same move
  const card = $("whaleCard"); if (!card) return;

  const css = `
#whaleCard .wwtabs{display:flex;gap:4px;flex-wrap:wrap}
.wwp{display:inline-block;font-size:10px;padding:1px 6px;border-radius:99px;text-transform:uppercase;letter-spacing:.05em;font-weight:600}
.wwp.l{background:color-mix(in srgb,var(--up) 18%,transparent);color:var(--up)}.wwp.s{background:color-mix(in srgb,var(--down) 18%,transparent);color:var(--down)}
.wwp.f{background:var(--panel2);color:var(--dim)}
#whaleCard .wwch{font-size:11px;white-space:nowrap}
#whaleCard .wwev{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 12px;font-size:13px;margin-top:6px}
#whaleCard .wwev .t{font-family:var(--mono);font-size:11px;color:var(--dim);white-space:nowrap}
.wwhot{color:var(--amber)}
#whaleCard .wwnote{font-size:12px;color:var(--dim);margin-top:8px}
.wwtop{display:flex;flex-direction:column;gap:8px;min-width:0}
.wwtop .hd{display:flex;justify-content:space-between;gap:8px;align-items:baseline;flex-wrap:wrap}
.wwtop .hd .label{margin:0}
.wwm{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:4px 10px;align-items:center;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2)}
.wwm.new{border-color:var(--amber);box-shadow:0 0 0 1px color-mix(in srgb,var(--amber) 40%,transparent)}
.wwm .rk{font-family:var(--mono);font-weight:600;font-size:13px;padding:3px 7px;border-radius:8px;background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent);white-space:nowrap}
.wwm .tx{font-size:13px;line-height:1.35;min-width:0}.wwm .tx b.s{color:var(--down)}.wwm .tx b.l{color:var(--up)}
.wwm .tx .sub{font-family:var(--mono);font-size:11px}
.wwm .ag{font-family:var(--mono);font-size:12px;color:var(--dim);text-align:right;white-space:nowrap}
.wwage.bad{color:var(--down)}.wwage.ok{color:var(--dim)}
`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  // ---------- state ----------
  const W = {}; LIST.forEach(([a, g, pnl, tr, wr, coh], i) => { W[a] = { a, g, pnl, tr, wr, coh, rank: g === "B" ? i + 1 : i - 19, pos: null }; });
  const NB = LIST.filter(x => x[1] === "B").length, NW = LIST.length - NB;
  const load = (k, d) => { try { return JSON.parse(lsGet(k) || "null") || d; } catch (e) { return d; } };
  let anchor = load("soxx_ww_anchor", {});      // worst wallets: size at the last event
  let EV = load("soxx_ww_ev", []);              // worst-wallet events
  let MV = load("soxx_ww_mv", []);              // top-trader moves (from fills)
  let CUR = load("soxx_ww_cur", {});
  const ORD = {};                                // per wallet: open SOXL orders {at, list}            // per wallet: time of the newest fill we have
  let tryAt = 0, mark = NaN, lastAt = 0, fillAt = 0, err = "", tab = "B", busy = 0, limited = 0;
  const short = a => a.slice(0, 6) + "…" + a.slice(-4);
  const usd = x => { const a = Math.abs(x); return (x < 0 ? "−" : "") + "$" + (a >= 1e6 ? (a / 1e6).toFixed(2) + "M" : a >= 1e3 ? Math.round(a / 1e3) + "K" : Math.round(a)); };
  const sh = x => Math.round(Math.abs(x)).toLocaleString("en-US");
  const agoT = t => { const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 60 ? s + "s ago" : s < 3600 ? Math.round(s / 60) + " min ago" : s < 86400 ? (s / 3600).toFixed(1) + " h ago" : Math.round(s / 86400) + " d ago"; };
  const clock = t => new Date(t).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  async function hl(body) {
    const c = new AbortController(), to = setTimeout(() => c.abort(), 12000);
    try {
      const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: c.signal });
      if (r.status === 429) { limited = Date.now(); throw new Error("Hyperliquid rate limit"); }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally { clearTimeout(to); }
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const save = () => { try { lsSet("soxx_ww_anchor", JSON.stringify(anchor)); lsSet("soxx_ww_ev", JSON.stringify(EV.slice(0, 40))); lsSet("soxx_ww_mv", JSON.stringify(MV.slice(0, 300))); lsSet("soxx_ww_cur", JSON.stringify(CUR)); } catch (e) { } };

  // ---------- top-trader fills → moves ----------
  function kindOf(f) {
    const s0 = +f.startPosition, d = f.dir || "", q = +f.sz * (f.side === "B" ? 1 : -1), s1 = s0 + q;
    if (/Long > Short|Short > Long/.test(d)) return { k: "flip", side: s1 > 0 ? "long" : "short" };
    if (/Open Long/.test(d)) return { k: Math.abs(s0) > 1e-9 ? "add" : "open", side: "long" };
    if (/Open Short/.test(d)) return { k: Math.abs(s0) > 1e-9 ? "add" : "open", side: "short" };
    if (/Close Long/.test(d)) return { k: Math.abs(s1) < 1e-9 ? "close" : "cut", side: "long" };
    if (/Close Short/.test(d)) return { k: Math.abs(s1) < 1e-9 ? "close" : "cut", side: "short" };
    return null;
  }
  function ingest(a, fills) {
    fills = fills.filter(f => f.coin === COIN).sort((x, y) => x.time - y.time);
    for (const f of fills) {
      const t = +f.time; if (CUR[a] && t <= CUR[a].t && CUR[a].tids && CUR[a].tids.includes(f.tid)) continue;
      const kd = kindOf(f); if (!kd) continue;
      const px = +f.px, q = +f.sz * (f.side === "B" ? 1 : -1), s1 = +f.startPosition + q;
      // join the last move of this wallet when it is the same action and side, and close in time
      const grp = kd.k === "open" || kd.k === "add" ? "grow" : kd.k === "cut" || kd.k === "close" ? "shrink" : "flip";
      const m = MV.find(x => x.a === a);
      if (m && m.grp === grp && m.side === kd.side && t - m.t1 <= GAP && grp !== "flip") {
        m.sz += Math.abs(q); m.usd += Math.abs(q) * px; m.t1 = t; m.end = s1; m.k = m.k === "open" ? "open" : kd.k === "close" ? "close" : m.k;
        if (kd.k === "close") m.k = "close";
        m.px = m.usd / m.sz; m.n = (m.n || 1) + 1; m.fresh = Date.now();
      } else {
        MV.unshift({ a, grp, k: kd.k, side: kd.side, sz: Math.abs(q), usd: Math.abs(q) * px, px, t0: t, t1: t, start: +f.startPosition, end: s1, n: 1, fresh: Date.now() });
      }
    }
    if (fills.length) { const t = fills[fills.length - 1].time; CUR[a] = { t, tids: fills.filter(f => f.time === t).map(f => f.tid) }; }
    MV.sort((x, y) => y.t1 - x.t1); MV = MV.slice(0, 300);
  }
  const verb = m => m.k === "flip" ? `flipped to <b class="${m.side === "long" ? "l" : "s"}">${m.side}</b>` :
    m.k === "open" ? `opened a <b class="${m.side === "long" ? "l" : "s"}">${m.side}</b>` :
    m.k === "add" ? `added to the <b class="${m.side === "long" ? "l" : "s"}">${m.side}</b>` :
    m.k === "cut" ? `cut the <b class="${m.side === "long" ? "l" : "s"}">${m.side}</b>` : `closed the <b class="${m.side === "long" ? "l" : "s"}">${m.side}</b>`;
  const moveTxt = (m, P) => `${verb(m)} · ${m.grp === "shrink" ? (m.side === "long" ? "sold" : "bought back") : m.side === "long" ? "bought" : "sold"} ${usd(m.usd)} (${sh(m.sz)} sh) at ${fmtPx(m.px)}${m.n > 1 ? ` in ${m.n} orders over ${Math.max(1, Math.round((m.t1 - m.t0) / 60000))} min` : ""} · now ${Math.abs(m.end) < 1e-9 ? "flat" : (m.end > 0 ? "long " : "short ") + usd(Math.abs(m.end) * (P > 0 ? P : m.px))}`;
  const plain = s => s.replace(/<[^>]+>/g, "");
  const moveAlerted = {};
  function moveAlerts(P) {
    for (const m of MV.slice(0, 40)) {
      if (m.usd < MIN_EV || Date.now() - m.t1 > 2 * 3600000) continue;
      const w = W[m.a]; if (!w) continue;
      const step = Math.floor((m.usd - MIN_EV) / 100000), key = `wwm:${m.a}:${m.t0}:${step}`;
      if (moveAlerted[key]) continue; moveAlerted[key] = 1;
      try { alert1(key, 864e5, `🐋 Top #${w.rank} SOXL trader (${usd(w.pnl)} on SOXL) ${plain(moveTxt(m, P))} · ${agoT(m.t1)}`, FUND, w.rank <= 10 || m.k === "flip" || m.k === "open"); } catch (e) { }
    }
  }

  // ---------- polling: every minute, also in a background tab ----------
  async function pollFills() {
    const best = Object.values(W).filter(w => w.g === "B").sort((x, y) => x.rank - y.rank);
    let inits = 0, ok = 0;
    for (const w of best) {
      if (Date.now() - limited < 60000) break;
      try {
        const c = CUR[w.a];
        if (!c || Date.now() - c.t > 3 * 86400000) {
          if (inits >= 6) continue;          // first load: newest 2000 fills, at most 6 wallets per minute (rate limit)
          inits++; const f = await hl({ type: "userFills", user: w.a, aggregateByTime: true });
          ingest(w.a, (f || []).filter(x => x.coin === COIN)); if (!CUR[w.a]) CUR[w.a] = { t: Date.now() - 3 * 86400000 + 60000, tids: [] };
        } else {
          const f = await hl({ type: "userFillsByTime", user: w.a, startTime: c.t, aggregateByTime: true });
          ingest(w.a, f || []);
          if (f && f.length >= 2000) CUR[w.a] = { t: Math.max(c.t, f[f.length - 1].time), tids: [] }; // more to read next minute
        }
        ok++;
      } catch (e) { if (limited) break; }
      await sleep(80);
    }
    if (ok) fillAt = Date.now();
  }
  async function pollOrders() {
    const pend = Object.values(W).filter(w => w.g === "B" && !CUR[w.a]).length;
    const L = Object.values(W).sort((x, y) => ((ORD[x.a] || {}).at || 0) - ((ORD[y.a] || {}).at || 0)).slice(0, pend ? 4 : 15);
    for (const w of L) {
      if (Date.now() - limited < 60000) break;
      try {
        const o = await hl({ type: "frontendOpenOrders", user: w.a, dex: DEX });
        ORD[w.a] = { at: Date.now(), list: (o || []).filter(x => x.coin === COIN).map(x => ({ side: x.side === "B" ? 1 : -1, px: +(x.isTrigger ? x.triggerPx : x.limitPx) || +x.limitPx, sz: +x.sz, ro: !!x.reduceOnly || !!x.isPositionTpsl, trig: !!x.isTrigger, type: x.orderType || "", cond: x.triggerCondition || "", t: x.timestamp })) };
      } catch (e) { if (limited) break; }
      await sleep(60);
    }
  }
  // what an order does to the wallet's position
  function ordRole(w, o) {
    const pz = w.pos ? w.pos.szi : 0;
    if (o.ro || (pz && Math.sign(o.side) !== Math.sign(pz) && o.sz <= Math.abs(pz) * 1.0001)) return pz > 0 ? "close long" : pz < 0 ? "close short" : "close";
    if (pz && Math.sign(o.side) !== Math.sign(pz)) return "flip";
    return pz ? (pz > 0 ? "add long" : "add short") : (o.side > 0 ? "open long" : "open short");
  }
  function ordAgg(g) {
    const P = mark > 0 ? mark : (Q[FUND] && Q[FUND].c) || NaN, o = { buy: 0, sell: 0, add: 0, close: 0, n: 0, w: 0, stops: 0 };
    Object.values(W).filter(w => w.g === g).forEach(w => { const L = (ORD[w.a] || {}).list || []; if (L.length) o.w++;
      L.forEach(x => { const v = x.sz * (x.px || P); o.n++; if (x.side > 0) o.buy += v; else o.sell += v; const r = ordRole(w, x); if (/close/.test(r)) o.close += v; else o.add += v; if (x.trig) o.stops++; }); });
    return o;
  }
  // liquidation pain: the 1% price band with the most tracked long $ (below) and short $ (above)
  function pain() {
    const P = mark > 0 ? mark : (Q[FUND] && Q[FUND].c) || NaN; if (!isFinite(P)) return null;
    const bins = {}; Object.values(W).forEach(w => { const p = w.pos; if (!p || !p.szi || !p.lq) return; const side = p.szi > 0 ? "L" : "S";
      if ((side === "L" && p.lq >= P) || (side === "S" && p.lq <= P) || Math.abs(p.lq / P - 1) > 0.4) return;
      const b = Math.round(Math.log(p.lq / P) / Math.log(1.01)), k = side + b, x = bins[k] || (bins[k] = { side, usd: 0, n: 0, pw: 0 }); const v = Math.abs(p.szi) * P; x.usd += v; x.n++; x.pw += p.lq * v; });
    const top = side => Object.values(bins).filter(x => x.side === side).sort((a, z) => z.usd - a.usd)[0];
    const f = x => x ? { p: x.pw / x.usd, usd: x.usd, n: x.n, d: x.pw / x.usd / P - 1 } : null;
    return { P, long: f(top("L")), short: f(top("S")) };
  }
  // size-weighted average price of the close orders (take profit or stop), per side, for a group
  function closeAvg(g) {
    const P = mark > 0 ? mark : (Q[FUND] && Q[FUND].c) || NaN, r = { long: { sz: 0, pv: 0, n: 0, w: new Set(), tp: 0, sl: 0 }, short: { sz: 0, pv: 0, n: 0, w: new Set(), tp: 0, sl: 0 } };
    Object.values(W).filter(w => w.g === g && w.pos && w.pos.szi).forEach(w => {
      const side = w.pos.szi > 0 ? "long" : "short", L = ((ORD[w.a] || {}).list || []).filter(o => /close/.test(ordRole(w, o)));
      L.forEach(o => { const x = r[side]; x.sz += o.sz; x.pv += o.sz * o.px; x.n++; x.w.add(w.a); const good = side === "long" ? o.px > P : o.px < P; good ? x.tp += o.sz * o.px : x.sl += o.sz * o.px; });
    });
    const f = x => x.sz ? { px: x.pv / x.sz, usd: x.pv, n: x.n, wallets: x.w.size, tp: x.tp, sl: x.sl, d: isFinite(P) ? x.pv / x.sz / P - 1 : NaN } : null;
    return { long: f(r.long), short: f(r.short) };
  }
  window.wwCloseAvg = closeAvg;
  window.wwPain = pain;
  window.wwOrders = ordAgg;

  async function poll() {
    if (busy && Date.now() - busy < 55000) return; busy = tryAt = Date.now();
    try {
      const m = await hl({ type: "metaAndAssetCtxs", dex: DEX });
      const i = (m[0].universe || []).findIndex(u => u.name === COIN); if (i >= 0) mark = +m[1][i].markPx;
      let ok = 0; const list = Object.keys(W);
      for (let k = 0; k < list.length; k += 5) {         // 5 at a time: all 30 in a few seconds
        await Promise.all(list.slice(k, k + 5).map(async a => {
          try {
            const cs = await hl({ type: "clearinghouseState", user: a, dex: DEX });
            const p = (cs.assetPositions || []).map(x => x.position).find(x => x.coin === COIN);
            W[a].pos = p ? { szi: +p.szi, ep: +p.entryPx, lev: p.leverage ? +p.leverage.value : null, lq: p.liquidationPx ? +p.liquidationPx : null, u: +p.unrealizedPnl || 0 } : { szi: 0 };
            ok++;
          } catch (e) { }
        }));
      }
      if (!ok) throw new Error("no answer from Hyperliquid");
      err = ""; lastAt = Date.now(); detect();
      render();
      await pollFills(); moveAlerts(mark); await pollOrders();
    } catch (e) { err = e.message || "error"; }
    save(); busy = 0; render();
  }

  // ---------- worst wallets: change against the size at the last event ----------
  function detect() {
    const P = mark > 0 ? mark : (Q[FUND] && Q[FUND].c) || NaN, now = Date.now();
    for (const w of Object.values(W)) {
      if (!w.pos) continue;
      const p = w.pos;
      if (p.szi && p.lq && isFinite(P) && Math.abs(p.szi) * P >= 500000) {
        const d = Math.abs(P / p.lq - 1);
        if (d <= 0.03) try { alert1(`wwlq:${w.a}:${new Date().toISOString().slice(0, 10)}`, 6 * 3600000, `⚠️ ${usd(Math.abs(p.szi) * P)} ${p.szi > 0 ? "long" : "short"} (${w.g === "B" ? "top" : "worst"} #${w.rank}) is ${(d * 100).toFixed(1)}% from liquidation at ${fmtPx(p.lq)} · forced ${p.szi > 0 ? "selling" : "buying"} can speed up the move`, FUND, true); } catch (e) { }
      }
      if (w.g !== "W") continue;
      const o = anchor[w.a], s1 = p.szi;
      if (o == null) { anchor[w.a] = s1; continue; }
      const s0 = o; if (!isFinite(P)) continue;
      const d$ = Math.abs(s1 - s0) * P, side = x => x > 0 ? "long" : "short";
      let txt = null, kind = null;
      if (s0 === 0 && s1 !== 0 && Math.abs(s1) * P >= MIN_EV) { kind = "open"; txt = `opened a ${usd(Math.abs(s1) * P)} ${side(s1)} @ ${fmtPx(p.ep)}`; }
      else if (s0 !== 0 && s1 === 0 && Math.abs(s0) * P >= MIN_EV) { kind = "close"; txt = `closed a ${usd(Math.abs(s0) * P)} ${side(s0)}`; }
      else if (s0 !== 0 && s1 !== 0 && Math.sign(s0) !== Math.sign(s1)) { kind = "flip"; txt = `flipped ${side(s0)} → ${side(s1)} (${usd(Math.abs(s1) * P)})`; }
      else if (s0 !== 0 && Math.abs(s1) > Math.abs(s0) && d$ >= MIN_EV) { kind = "add"; txt = `added ${usd(d$)} to the ${side(s1)} (now ${usd(Math.abs(s1) * P)})`; }
      else if (s0 !== 0 && s1 !== 0 && Math.abs(s1) < Math.abs(s0) && d$ >= MIN_EV) { kind = "cut"; txt = `cut ${usd(d$)} of the ${side(s1)} (now ${usd(Math.abs(s1) * P)})`; }
      else if (s0 === 0 && s1 === 0) continue;
      if (txt) {
        anchor[w.a] = s1;
        EV.unshift({ t: now, a: w.a, g: w.g, k: kind, txt, px: P }); EV = EV.slice(0, 40);
        try { alert1(`ww:${w.a}:${kind}:${Math.round(s1)}`, 600000, `🐋 Worst #${w.rank} SOXL trader (${usd(w.pnl)} on SOXL) ${txt} · $SOXL perp ${fmtPx(P)} (a losing wallet: often a fade signal)`, FUND, false); } catch (e) { }
      }
    }
  }

  // ---------- summary (also used by the headline and the decision read) ----------
  function summary() {
    const P = mark > 0 ? mark : (Q[FUND] && Q[FUND].c) || NaN, grp = g => Object.values(W).filter(w => w.g === g && w.pos);
    const agg = L => { const o = { n: L.length, longs: 0, shorts: 0, L: 0, S: 0 }; L.forEach(w => { const v = w.pos.szi * P; if (w.pos.szi > 0) { o.longs++; o.L += v; } else if (w.pos.szi < 0) { o.shorts++; o.S -= v; } }); o.net = o.L - o.S; return o; };
    const b = agg(grp("B")), w = agg(grp("W"));
    const liqs = Object.values(W).filter(x => x.pos && x.pos.szi && x.pos.lq).map(x => ({ p: x.pos.lq, usd: Math.abs(x.pos.szi) * P, side: x.pos.szi > 0 ? "long" : "short", w: x }));
    const nearL = liqs.filter(x => x.side === "long" && x.p < P && x.usd >= 250000).sort((a, z) => z.p - a.p)[0] || null;
    const nearS = liqs.filter(x => x.side === "short" && x.p > P && x.usd >= 250000).sort((a, z) => a.p - z.p)[0] || null;
    return { P, b, w, nearL, nearS, ok: !!lastAt };
  }
  window.wwSummary = summary;
  window.wwFlag = function () {
    const s = summary(); if (!s.ok || !isFinite(s.P)) return null;
    const bias = (s.b.L + s.b.S) ? s.b.net / (s.b.L + s.b.S) : 0;
    if (Math.abs(bias) < 0.4 || s.b.L + s.b.S < 500000) return null;
    return `Top SOXL traders on Hyperliquid are net ${bias > 0 ? "long" : "short"} ${usd(Math.abs(s.b.net))} (${s.b.shorts} short, ${s.b.longs} long)` + (s.w.n && Math.sign(s.w.net) === -Math.sign(s.b.net) && Math.abs(s.w.net) > 250000 ? `; the worst wallets lean the other way` : "");
  };
  const topMoves = n => MV.filter(m => W[m.a] && W[m.a].g === "B" && m.usd >= MIN_MOVE).slice(0, n);
  window.wwHeadline = function () {
    const m = topMoves(1)[0]; if (!m || Date.now() - m.t1 > 45 * 60000) return null;
    return `Whale: top #${W[m.a].rank} SOXL trader ${plain(moveTxt(m, mark))}`;
  };
  window.wwTopMoves = topMoves;

  // ---------- render ----------
  const pill = s => s > 0 ? `<span class="wwp l">long</span>` : s < 0 ? `<span class="wwp s">short</span>` : `<span class="wwp f">flat</span>`;
  function ageHtml() {
    const ago = lastAt ? Math.round((Date.now() - lastAt) / 1000) : null;
    return err && (!lastAt || ago > 90) ? `<span class="wwage bad">${esc(err)} · retrying every minute</span>` : ago == null ? "loading…" :
      `<span class="wwage ${ago > 90 ? "bad" : "ok"}"><span class="livedot"></span>updated ${ago < 90 ? ago + "s" : Math.round(ago / 60) + " min"} ago · next in ${Math.max(0, 60 - (ago % 60))}s</span>`;
  }
  function renderTop() {
    const el = $("wwTop"); if (!el) return;
    const s = summary(), M = topMoves(3), wait = Object.values(W).filter(w => w.g === "B" && !CUR[w.a]).length;
    el.innerHTML = `<div class="hd"><div class="label">🐋 Last 3 moves · top 20 SOXL traders</div><span class="sub">${ageHtml()}</span></div>` +
      (M.length ? M.map(m => { const w = W[m.a]; return `<div class="wwm ${Date.now() - m.t1 < 10 * 60000 ? "new" : ""}"><span class="rk" title="${esc(w.coh)} · ${w.tr} SOXL trades · ${w.wr}% win">Top #${w.rank}</span>
        <div class="tx">${moveTxt(m, s.P)}<div class="sub"><a href="https://hyperdash.com/address/${m.a}" target="_blank" rel="noopener">${short(m.a)}</a> · ${usd(w.pnl)} SOXL profit · ${clock(m.t1)} ET</div></div><span class="ag">${agoT(m.t1)}</span></div>`; }).join("")
        : `<div class="sub">${wait ? `Reading the trade history of the top wallets (${NB - wait} of ${NB} done)…` : "No SOXL trades of $10K or more by the top 20 in the last 3 days."}</div>`) +
      (s.ok ? `<div class="sub">Top 20 now: <b class="${s.b.net > 0 ? "up" : s.b.net < 0 ? "down" : ""}">${s.b.net > 0 ? "net long" : s.b.net < 0 ? "net short" : "flat"} ${usd(Math.abs(s.b.net))}</b> · Worst ${NW}: <b class="${s.w.net > 0 ? "up" : s.w.net < 0 ? "down" : ""}">${s.w.net > 0 ? "net long" : s.w.net < 0 ? "net short" : "flat"} ${usd(Math.abs(s.w.net))}</b></div>` : "") +
      (() => { const c = closeAvg("B"), t = (x, side) => x ? `${side === "short" ? "Shorts cover" : "Longs sell"} at <b>${fmtPx(x.px)}</b> avg <span class="sub">(${fmtPct(x.d, 1)}, size-weighted, ${usd(x.usd)} in ${x.n} order${x.n > 1 ? "s" : ""} from ${x.wallets} wallet${x.wallets > 1 ? "s" : ""}${x.tp && x.sl ? ` · ${usd(x.tp)} take-profit, ${usd(x.sl)} stop` : x.sl ? " · stops" : " · take-profit"})</span>` : "";
        const a = [t(c.short, "short"), t(c.long, "long")].filter(Boolean); return a.length ? `<div class="sub">Top 20 close orders: ${a.join(" · ")}</div>` : ""; })() +
      (() => { const b = ordAgg("B"), w = ordAgg("W"); return b.n + w.n ? `<div class="sub">Resting orders · Top: buy ${usd(b.buy)} / sell ${usd(b.sell)} (${usd(b.add)} to add, ${usd(b.close)} to close) · Worst: buy ${usd(w.buy)} / sell ${usd(w.sell)} · <a href="#whaleCard" data-wwgo="O">see orders</a></div>` : ""; })();
  }
  function render() {
    renderTop();
    const s = summary(), P = s.P;
    $("wwSub").innerHTML = ageHtml() + (isFinite(P) ? ` · perp mark ${fmtPx(P)}` : "");
    const tile = (k, v, sub, c) => `<div class="st"><div class="k">${k}</div><div class="v ${c || ""}">${v}</div><div class="s">${sub || ""}</div></div>`;
    const lean = o => !(o.L + o.S) ? "flat" : o.net > 0 ? "net long" : "net short";
    const m0 = topMoves(1)[0];
    $("wwTiles").innerHTML = !s.ok ? "" :
      tile(`Top ${NB} traders · net`, `${lean(s.b)} ${usd(Math.abs(s.b.net))}`, `${s.b.shorts} short ${usd(s.b.S)} · ${s.b.longs} long ${usd(s.b.L)}`, s.b.net > 0 ? "up" : s.b.net < 0 ? "down" : "") +
      tile(`Worst ${NW} traders · net`, `${lean(s.w)} ${usd(Math.abs(s.w.net))}`, `${s.w.shorts} short ${usd(s.w.S)} · ${s.w.longs} long ${usd(s.w.L)}`, s.w.net > 0 ? "up" : s.w.net < 0 ? "down" : "") +
      tile("Smart vs losing money", Math.sign(s.b.net) && Math.sign(s.b.net) === -Math.sign(s.w.net) ? "Opposite sides" : "Same side", Math.sign(s.b.net) === -Math.sign(s.w.net) ? "the setup the tracker looks for" : "no clear disagreement", Math.sign(s.b.net) === -Math.sign(s.w.net) ? "wwhot" : "") +
      tile("Big long liquidation below", s.nearL ? fmtPx(s.nearL.p) : "--", s.nearL ? `${usd(s.nearL.usd)} · ${fmtPct(s.nearL.p / P - 1, 1)}` : "none ≥ $250K", "down") +
      tile("Big short liquidation above", s.nearS ? fmtPx(s.nearS.p) : "--", s.nearS ? `${usd(s.nearS.usd)} · ${fmtPct(s.nearS.p / P - 1, 1)}` : "none ≥ $250K", "up") +
      tile("Last top-trader move", m0 ? `Top #${W[m0.a].rank}` : "--", m0 ? `${plain(verb(m0))} ${usd(m0.usd)} · ${agoT(m0.t1)}` : "waiting for a trade");
    $("wwTabs").innerHTML = [["B", `Top ${NB}`], ["W", `Worst ${NW}`], ["E", `Moves (${MV.filter(m => m.usd >= MIN_MOVE).length + EV.length})`], ["O", `Open orders (${Object.values(ORD).reduce((a, o) => a + o.list.length, 0)})`]].map(([k, l]) => `<button data-wwtab="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("");
    if (tab === "O") {
      const rows = Object.values(W).filter(w => ((ORD[w.a] || {}).list || []).length).sort((a, z) => (a.g === z.g ? a.rank - z.rank : a.g === "B" ? -1 : 1));
      const seen = Object.keys(ORD).length;
      $("wwBody").innerHTML = (rows.length ? `<div class="tw"><table class="tbl"><tr><th class="l">Wallet</th><th class="l">Now</th><th class="l">Order</th><th>Price</th><th>vs mark</th><th>Shares</th><th>Value</th><th class="l">What it does</th></tr>` +
        rows.map(w => ((ORD[w.a].list).slice().sort((x, y) => y.px - x.px)).map((o, i) => { const v = o.sz * (o.px || P), r = ordRole(w, o);
          return `<tr><td class="l">${i ? "" : `<b class="${w.g === "B" ? "up" : "down"}">${w.g === "B" ? "Top" : "Worst"} #${w.rank}</b> <a href="https://hyperdash.com/address/${w.a}" target="_blank" rel="noopener">${short(w.a)}</a>`}</td><td class="l">${i ? "" : (w.pos ? pill(w.pos.szi) + (w.pos.szi ? " " + usd(Math.abs(w.pos.szi) * P) : "") : "")}</td>
            <td class="l"><b class="${o.side > 0 ? "up" : "down"}">${o.side > 0 ? "Buy" : "Sell"}</b> ${o.trig ? `<span class="wwhot">${esc(o.type || "trigger")}</span>` : esc(o.type || "limit")}${o.ro ? ' <span class="sub">reduce-only</span>' : ""}</td><td>${fmtPx(o.px)}</td><td>${isFinite(P) && o.px ? fmtPct(o.px / P - 1, 1) : "--"}</td><td>${sh(o.sz)}</td><td>${usd(v)}</td><td class="l ${/close/.test(r) ? "" : "wwhot"}">${r}</td></tr>`; }).join("")).join("") + `</table></div>` : `<div class="sub">${seen ? "No open SOXL orders from the tracked wallets right now." : "Reading open orders…"}</div>`) +
        `<div class="wwnote">Open orders come from Hyperliquid for all ${NB + NW} wallets (about half of them each minute). "Close" orders (reduce-only, or opposite to the position and not larger) take profit or cut risk; "add" and "open" orders grow or start a position. Stop and take-profit triggers show in amber.</div>`;
      return;
    }
    if (tab === "E") {
      const L = [...MV.filter(m => m.usd >= MIN_MOVE && W[m.a]).map(m => ({ t: m.t1, a: m.a, g: "B", h: moveTxt(m, P) })), ...EV.map(e => ({ t: e.t, a: e.a, g: e.g, h: esc(e.txt) + ` <span class="sub">at ${fmtPx(e.px)}</span>` }))].sort((x, y) => y.t - x.t).slice(0, 30);
      $("wwBody").innerHTML = L.length ? `<div class="wwev">${L.map(e => `<span class="t">${clock(e.t)}</span><span><b class="${e.g === "B" ? "up" : "down"}">${e.g === "B" ? "Top" : "Worst"} #${W[e.a] ? W[e.a].rank : "?"}</b> <a href="https://hyperdash.com/address/${e.a}" target="_blank" rel="noopener">${short(e.a)}</a> ${e.h}</span>`).join("")}</div>` : `<div class="sub">No moves yet.</div>`;
      return;
    }
    const L = Object.values(W).filter(w => w.g === tab).sort((a, z) => a.rank - z.rank);
    $("wwBody").innerHTML = `<div class="tw"><table class="tbl"><tr><th>#</th><th class="l">Wallet</th><th>SOXL profit</th><th>Trades</th><th>Win</th><th class="l">Now</th><th>Size</th><th>Entry</th><th>Lev</th><th>Liq</th><th>To liq</th><th>uPnL</th><th class="l">Orders</th><th class="l">Last move</th></tr>` +
      L.map(w => { const p = w.pos || {}, v = p.szi ? Math.abs(p.szi) * P : 0, dl = p.lq && P ? p.lq / P - 1 : NaN;
        const m = w.g === "B" ? MV.find(x => x.a === w.a) : null, e = w.g === "W" ? EV.find(x => x.a === w.a && Date.now() - x.t < 24 * 3600000) : null;
        const last = m ? `${plain(verb(m))} ${usd(m.usd)} <span class="sub">${agoT(m.t1)}</span>` : e ? `${esc(e.txt)} <span class="sub">${agoT(e.t)}</span>` : '<span class="sub">--</span>';
        return `<tr><td>${w.rank}</td><td class="l"><a href="https://hyperdash.com/address/${w.a}" target="_blank" rel="noopener" title="${w.a} · ${esc(w.coh)}">${short(w.a)}</a></td><td class="${w.pnl > 0 ? "up" : "down"}">${usd(w.pnl)}</td><td>${w.tr.toLocaleString()}</td><td>${w.wr}%</td><td class="l">${w.pos ? pill(p.szi) : '<span class="sub">…</span>'}</td><td>${v ? usd(v) : "--"}</td><td>${p.szi ? fmtPx(p.ep) : "--"}</td><td>${p.lev ? p.lev + "×" : "--"}</td><td>${p.lq ? fmtPx(p.lq) : "--"}</td><td class="${isFinite(dl) && Math.abs(dl) < 0.05 ? "wwhot" : ""}">${isFinite(dl) ? fmtPct(dl, 1) : "--"}</td><td class="${p.u > 0 ? "up" : p.u < 0 ? "down" : ""}">${p.szi ? usd(p.u) : "--"}</td><td class="l wwch">${(() => { const L = (ORD[w.a] || {}).list || []; if (!L.length) return ORD[w.a] ? '<span class="sub">none</span>' : '<span class="sub">…</span>'; const b = L.filter(x => x.side > 0).reduce((a, x) => a + x.sz * (x.px || P), 0), sl = L.filter(x => x.side < 0).reduce((a, x) => a + x.sz * (x.px || P), 0); const C = L.filter(o => /close/.test(ordRole(w, o))), cs = C.reduce((t, o) => t + o.sz, 0); return `${L.length} · <span class="up">buy ${usd(b)}</span> / <span class="down">sell ${usd(sl)}</span>${cs ? ` · close avg <b>${fmtPx(C.reduce((t, o) => t + o.sz * o.px, 0) / cs)}</b>` : ""}`; })()}</td><td class="l wwch">${last}</td></tr>`; }).join("") + `</table></div>`;
  }
  card.addEventListener("click", e => { const b = e.target.closest("[data-wwtab]"); if (b) { tab = b.dataset.wwtab; render(); } });
  document.addEventListener("click", e => { const g = e.target.closest("[data-wwgo]"); if (g) { e.preventDefault(); tab = g.dataset.wwgo; render(); card.scrollIntoView({ behavior: "smooth", block: "start" }); } });

  render(); poll();
  // every minute, visible or not. A watchdog also runs a poll if one was missed (for example after the computer sleeps).
  setInterval(poll, 60000);
  setInterval(() => { try { if (Date.now() - lastAt > 75000 && Date.now() - tryAt > 60000) poll(); render(); } catch (e) { } }, 5000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - lastAt > 60000) poll(); });
})();
