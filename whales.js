/* SOXX Sniper · Whale watch
   Tracks the best and worst SOXL traders on Hyperliquid (xyz:SOXL perpetual), live.
   Wallet list: SOXL trader study of Oct 28, 2026 (full SOXL profit from Hyperdash; 248 wallets studied).
   Positions: Hyperliquid info API (clearinghouseState, dex "xyz"), every minute while the page is visible.
   Alerts: when a top wallet opens, closes, flips, adds or cuts; when a large position is near liquidation.
   Depends on globals from index.html: $, Q, FUND, alert1, fmtPx, fmtPct, esc, lsGet, lsSet. */
(function () {
  "use strict";
  // [address, group (B = best, W = worst), SOXL profit $, SOXL trades, win rate %, Hyperdash cohort]
  const LIST = [["0x024294c53a69c1e6b39810b3fac87385752fffa1","B",816922,295,42,"Extremely Profitable"],["0xbb475febf78b528f4f0d4ae1a12541406565199c","B",327741,60,51.7,"Extremely Profitable"],["0xbd697846b0911baeba002a56bdc16f1f332d45fb","B",257584,96,41.7,"Rekt"],["0x9dead8fffcbf130e7658f672d2c081d91178d617","B",228553,6,100,"Extremely Profitable"],["0xda3768e9299e1fd81708ec030dac5ea37125f7b5","B",211500,36,47.2,"Rekt"],["0x8bd30fc805e672e1d978138ecbedcb48479ce275","B",202636,5,60,"Very Profitable"],["0xfc27136e42af1732ddc9ce2605ea9bff1b959d9d","B",110328,80,38.8,"Extremely Profitable"],["0x3b2e0b95acd47d987c1abdf42967fd82d469bdbb","B",98782,43,60.5,"Very Profitable"],["0x90e56dc997fea87c8463d661e621b1e7fd5181af","B",90533,60,55,"Very Profitable"],["0xec85bc052ec5b6d6cb2b40f5caa45e39b61a77fe","B",67178,10,30,"Very Unprofitable"],["0x177019594ba3913d416ab1a8f3e5527d4c2b2837","B",54572,2415,50.4,"Profitable"],["0xa38f19c4ccbcfd64cff676d72c436f7e6239dccf","B",49333,55,67.3,"Very Profitable"],["0xd33c704c68518e527bdcb36f7966c80edcffbdf2","B",40319,75,62.7,"Very Profitable"],["0x37f7ff1864f5d5cba2b63592656049f2d7d06fb4","B",40027,6,50,"Profitable"],["0x421183f04d68d0c2c68e27f07ccf84cd8746b9ef","B",37272,3,33.3,"Very Profitable"],["0x6d9d3438d8ad0506c74d0b91c68fa6b8f58154e6","B",37005,5,100,"Profitable"],["0x0b1ace05eb9ef1c3a1951b763700ecad24f27741","B",35729,6229,57.2,"Extremely Profitable"],["0x7717a7a245d9f950e586822b8c9b46863ed7bd7e","B",33448,71,63.4,"Extremely Profitable"],["0xb45bacc19c5f71ca8ba4134b0bbe6f4a1e9a5b11","B",26524,42,61.9,"Very Profitable"],["0x1886d6d9b05f11e9db19ba6f84811bb80d4c6582","B",22491,4,100,"Unprofitable"],["0xda411866ef8da115945db1c4987f44cb02c5d3f1","W",-1679857,5,20,"Rekt"],["0x4bcc092a156905788bf2a1a59e5968623957210d","W",-547814,482,57.3,"Very Profitable"],["0xd52936fa285cfa500440e31355c0b28f4b740729","W",-522826,11025,40.4,"Rekt"],["0xfd4224606069dd88fec92093a27591008263fda5","W",-90051,72,44.4,"Very Unprofitable"],["0xe724acd020fbd65ddb42a0f05dcfb65489480320","W",-80456,10,50,"Unprofitable"],["0x7f5653978d3f1b9716140bb7304c7e4650ae50f6","W",-62676,24,33.3,"Unprofitable"],["0xfc667adba8d4837586078f4fdcdc29804337ca06","W",-59080,16,56.3,"Extremely Profitable"],["0x25773676902085225ae5751075e4161369334897","W",-58715,1811,45.6,"Extremely Profitable"],["0xe9ffe7698f46f96f980f2877e18c43f5b4165903","W",-52483,34,44.1,"Rekt"],["0x7cee351d68e21f2bf1adf8161bd1598a80d6fc93","W",-44249,20,35,"Rekt"]];
  const COIN = "xyz:SOXL", DEX = "xyz", API = "https://api.hyperliquid.xyz/info";
  const MIN_EV = 50000;          // ignore changes smaller than $50K
  const card = $("whaleCard"); if (!card) return;

  const css = `
#whaleCard .wwtabs{display:flex;gap:4px;flex-wrap:wrap}
#whaleCard .wwp{display:inline-block;font-size:10px;padding:1px 6px;border-radius:99px;text-transform:uppercase;letter-spacing:.05em;font-weight:600}
#whaleCard .wwp.l{background:color-mix(in srgb,var(--up) 18%,transparent);color:var(--up)}#whaleCard .wwp.s{background:color-mix(in srgb,var(--down) 18%,transparent);color:var(--down)}
#whaleCard .wwp.f{background:var(--panel2);color:var(--dim)}
#whaleCard .wwch{font-size:11px;white-space:nowrap}
#whaleCard .wwev{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 12px;font-size:13px;margin-top:6px}
#whaleCard .wwev .t{font-family:var(--mono);font-size:11px;color:var(--dim);white-space:nowrap}
#whaleCard .wwhot{color:var(--amber)}
#whaleCard .wwnote{font-size:12px;color:var(--dim);margin-top:8px}
`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  // ---------- state ----------
  const W = {}; LIST.forEach(([a, g, pnl, tr, wr, coh], i) => { W[a] = { a, g, pnl, tr, wr, coh, rank: g === "B" ? i + 1 : i - 19, pos: null }; });
  let prev = {}; try { prev = JSON.parse(lsGet("soxx_ww") || "{}") || {}; } catch (e) { }
  let EV = []; try { EV = JSON.parse(lsGet("soxx_ww_ev") || "[]") || []; } catch (e) { }
  let mark = NaN, lastAt = 0, err = "", tab = "B", busy = false;
  const short = a => a.slice(0, 6) + "…" + a.slice(-4);
  const usd = x => { const a = Math.abs(x); return (x < 0 ? "−" : "") + "$" + (a >= 1e6 ? (a / 1e6).toFixed(2) + "M" : a >= 1e3 ? Math.round(a / 1e3) + "K" : Math.round(a)); };
  const hl = body => fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function poll() {
    if (busy) return; busy = true;
    try {
      const m = await hl({ type: "metaAndAssetCtxs", dex: DEX });
      const i = (m[0].universe || []).findIndex(u => u.name === COIN); if (i >= 0) mark = +m[1][i].markPx;
      let ok = 0;
      for (const a of Object.keys(W)) {
        try {
          const cs = await hl({ type: "clearinghouseState", user: a, dex: DEX });
          const p = (cs.assetPositions || []).map(x => x.position).find(x => x.coin === COIN);
          W[a].pos = p ? { szi: +p.szi, ep: +p.entryPx, lev: p.leverage ? +p.leverage.value : null, lq: p.liquidationPx ? +p.liquidationPx : null, u: +p.unrealizedPnl || 0 } : { szi: 0 };
          ok++;
        } catch (e) { }
        await sleep(120);
      }
      if (!ok) throw new Error("no answer from Hyperliquid");
      err = ""; lastAt = Date.now(); detect();
    } catch (e) { err = e.message || "error"; }
    busy = false; render();
  }

  // ---------- change detection and alerts ----------
  function detect() {
    const P = mark > 0 ? mark : (Q[FUND] && Q[FUND].c) || NaN, now = Date.now();
    for (const w of Object.values(W)) {
      if (!w.pos) continue;
      const o = prev[w.a], s1 = w.pos.szi, s0 = o ? o.szi : null;
      if (s0 != null && isFinite(P)) {
        const d$ = Math.abs(s1 - s0) * P, side = x => x > 0 ? "long" : "short";
        let txt = null, kind = null;
        if (s0 === 0 && s1 !== 0 && Math.abs(s1) * P >= MIN_EV) { kind = "open"; txt = `opened a ${usd(Math.abs(s1) * P)} ${side(s1)} @ ${fmtPx(w.pos.ep)}`; }
        else if (s0 !== 0 && s1 === 0 && Math.abs(s0) * P >= MIN_EV) { kind = "close"; txt = `closed a ${usd(Math.abs(s0) * P)} ${side(s0)}`; }
        else if (s0 !== 0 && s1 !== 0 && Math.sign(s0) !== Math.sign(s1)) { kind = "flip"; txt = `flipped ${side(s0)} → ${side(s1)} (${usd(Math.abs(s1) * P)})`; }
        else if (s0 !== 0 && Math.abs(s1) > Math.abs(s0) * 1.25 && d$ >= MIN_EV) { kind = "add"; txt = `added ${usd(d$)} to the ${side(s1)} (now ${usd(Math.abs(s1) * P)})`; }
        else if (s0 !== 0 && s1 !== 0 && Math.abs(s1) < Math.abs(s0) * 0.75 && d$ >= MIN_EV) { kind = "cut"; txt = `cut ${usd(d$)} of the ${side(s1)} (now ${usd(Math.abs(s1) * P)})`; }
        if (txt) {
          const who = `${w.g === "B" ? "Top" : "Worst"} #${w.rank} SOXL trader (${usd(w.pnl)} on SOXL)`;
          EV.unshift({ t: now, a: w.a, g: w.g, k: kind, txt, px: P }); EV = EV.slice(0, 40);
          const hot = w.g === "B" && (kind === "flip" || kind === "open" || w.rank <= 10);
          try { alert1(`ww:${w.a}:${kind}:${Math.round(s1)}`, 600000, `🐋 ${who} ${txt} · $SOXL perp ${fmtPx(P)}${w.g === "W" ? " (a losing wallet: often a fade signal)" : ""}`, FUND, hot); } catch (e) { }
        }
      }
      // near liquidation: large positions only
      const p = w.pos; if (p.szi && p.lq && isFinite(P) && Math.abs(p.szi) * P >= 500000) {
        const d = Math.abs(P / p.lq - 1);
        if (d <= 0.03) try { alert1(`wwlq:${w.a}:${new Date().toISOString().slice(0, 10)}`, 6 * 3600000, `⚠️ ${usd(Math.abs(p.szi) * P)} ${p.szi > 0 ? "long" : "short"} (${w.g === "B" ? "top" : "worst"} #${w.rank}) is ${(d * 100).toFixed(1)}% from liquidation at ${fmtPx(p.lq)} · forced ${p.szi > 0 ? "selling" : "buying"} can speed up the move`, FUND, true); } catch (e) { }
      }
      prev[w.a] = { szi: w.pos.szi, t: now };
    }
    try { lsSet("soxx_ww", JSON.stringify(prev)); lsSet("soxx_ww_ev", JSON.stringify(EV)); } catch (e) { }
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
  window.wwHeadline = function () {
    const e = EV.find(x => x.g === "B" && Date.now() - x.t < 45 * 60000 && x.k !== "cut"); if (!e) return null;
    const w = W[e.a]; return `Whale: top #${w.rank} SOXL trader ${e.txt}`;
  };

  // ---------- render ----------
  const pill = s => s > 0 ? `<span class="wwp l">long</span>` : s < 0 ? `<span class="wwp s">short</span>` : `<span class="wwp f">flat</span>`;
  function render() {
    const s = summary(), P = s.P;
    const ago = lastAt ? Math.round((Date.now() - lastAt) / 1000) : null;
    $("wwSub").innerHTML = err ? `<span class="down">${esc(err)}</span>` : ago == null ? "loading positions…" : `<span class="livedot"></span>positions ${ago < 90 ? ago + " s" : Math.round(ago / 60) + " min"} ago · perp mark ${fmtPx(P)}`;
    const tile = (k, v, sub, c) => `<div class="st"><div class="k">${k}</div><div class="v ${c || ""}">${v}</div><div class="s">${sub || ""}</div></div>`;
    const lean = o => !(o.L + o.S) ? "flat" : o.net > 0 ? "net long" : "net short";
    const e0 = EV[0];
    $("wwTiles").innerHTML = !s.ok ? "" :
      tile("Top 20 traders", `${lean(s.b)} ${usd(Math.abs(s.b.net))}`, `${s.b.shorts} short · ${s.b.longs} long`, s.b.net > 0 ? "up" : s.b.net < 0 ? "down" : "") +
      tile("Worst 10 traders", `${lean(s.w)} ${usd(Math.abs(s.w.net))}`, `${s.w.shorts} short · ${s.w.longs} long`, s.w.net > 0 ? "up" : s.w.net < 0 ? "down" : "") +
      tile("Smart vs losing money", Math.sign(s.b.net) && Math.sign(s.b.net) === -Math.sign(s.w.net) ? "Opposite sides" : "Same side", Math.sign(s.b.net) === -Math.sign(s.w.net) ? "the setup the tracker looks for" : "no clear disagreement", Math.sign(s.b.net) === -Math.sign(s.w.net) ? "wwhot" : "") +
      tile("Big long liquidation below", s.nearL ? fmtPx(s.nearL.p) : "--", s.nearL ? `${usd(s.nearL.usd)} · ${fmtPct(s.nearL.p / P - 1, 1)}` : "none ≥ $250K", "down") +
      tile("Big short liquidation above", s.nearS ? fmtPx(s.nearS.p) : "--", s.nearS ? `${usd(s.nearS.usd)} · ${fmtPct(s.nearS.p / P - 1, 1)}` : "none ≥ $250K", "up") +
      tile("Last whale move", e0 ? `${e0.g === "B" ? "Top" : "Worst"} #${W[e0.a].rank}` : "--", e0 ? `${esc(e0.txt)} · ${Math.round((Date.now() - e0.t) / 60000)} min ago` : "waiting for a change");
    $("wwTabs").innerHTML = [["B", "Top 20"], ["W", "Worst 10"], ["E", `Moves (${EV.length})`]].map(([k, l]) => `<button data-wwtab="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("");
    if (tab === "E") {
      $("wwBody").innerHTML = EV.length ? `<div class="wwev">${EV.slice(0, 25).map(e => `<span class="t">${new Date(e.t).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span><span><b class="${e.g === "B" ? "up" : "down"}">${e.g === "B" ? "Top" : "Worst"} #${W[e.a] ? W[e.a].rank : "?"}</b> <a href="https://hyperdash.com/address/${e.a}" target="_blank" rel="noopener">${short(e.a)}</a> ${esc(e.txt)} <span class="sub">at ${fmtPx(e.px)}</span></span>`).join("")}</div>` : `<div class="sub">No moves yet. The page records a move when a tracked wallet opens, closes, flips, adds or cuts by $50K or more.</div>`;
      return;
    }
    const L = Object.values(W).filter(w => w.g === tab).sort((a, z) => a.rank - z.rank);
    $("wwBody").innerHTML = `<div class="tw"><table class="tbl"><tr><th>#</th><th class="l">Wallet</th><th>SOXL profit</th><th>Trades</th><th>Win</th><th class="l">Now</th><th>Size</th><th>Entry</th><th>Lev</th><th>Liq</th><th>To liq</th><th>uPnL</th><th class="l">Since last look</th></tr>` +
      L.map(w => { const p = w.pos || {}, v = p.szi ? Math.abs(p.szi) * P : 0, dl = p.lq && P ? p.lq / P - 1 : NaN, e = EV.find(x => x.a === w.a && Date.now() - x.t < 24 * 3600000);
        return `<tr><td>${w.rank}</td><td class="l"><a href="https://hyperdash.com/address/${w.a}" target="_blank" rel="noopener" title="${w.a} · ${esc(w.coh)}">${short(w.a)}</a></td><td class="${w.pnl > 0 ? "up" : "down"}">${usd(w.pnl)}</td><td>${w.tr.toLocaleString()}</td><td>${w.wr}%</td><td class="l">${w.pos ? pill(p.szi) : '<span class="sub">…</span>'}</td><td>${v ? usd(v) : "--"}</td><td>${p.szi ? fmtPx(p.ep) : "--"}</td><td>${p.lev ? p.lev + "×" : "--"}</td><td>${p.lq ? fmtPx(p.lq) : "--"}</td><td class="${isFinite(dl) && Math.abs(dl) < 0.05 ? "wwhot" : ""}">${isFinite(dl) ? fmtPct(dl, 1) : "--"}</td><td class="${p.u > 0 ? "up" : p.u < 0 ? "down" : ""}">${p.szi ? usd(p.u) : "--"}</td><td class="l wwch">${e ? `${esc(e.txt)} <span class="sub">${Math.round((Date.now() - e.t) / 60000)}m</span>` : '<span class="sub">no change</span>'}</td></tr>`; }).join("") + `</table></div>`;
  }
  card.addEventListener("click", e => { const b = e.target.closest("[data-wwtab]"); if (b) { tab = b.dataset.wwtab; render(); } });

  render(); poll();
  setInterval(() => { if (!document.hidden || Date.now() - lastAt > 180000) poll(); }, 60000);
  setInterval(() => { try { if (lastAt) render(); } catch (e) { } }, 10000);
})();
