/* SOXX Sniper · Crowd psychology: the rational and the irrational side of SOXL.
   Behavioral finance gives patterns that repeat because people repeat them. This module measures each one from live data,
   says what it means, feeds it to the signal web (which learns how much each is worth), and studies how SOXL reacts to news.
     1. News: rational or not? For each scored headline: the first 30 minutes (the reaction), then the next 4 hours.
        Continuation = the market under-reacted (slow digestion, drift); reversal = it over-reacted (emotion, then correction).
        The study grows in this browser; live, a fresh big headline gets the learned expectation.
     2. Moves without news: a big move with no headline behind it is liquidity / emotion, and tends to snap back.
     3. Herding on StockTwits: when nearly everyone is bullish (or bearish), the crowd is usually late (contrarian).
     4. Attention spikes: message volume far above normal marks a crowded, emotional moment.
     5. Disposition effect: people sell winners too soon and hold losers, hoping to get back to even. Trapped holders'
        average entry above price = supply on any rally ("get me out at breakeven"); trapped shorts below = squeeze fuel.
     6. Capitulation and euphoria: an extreme move in σ, with fear (or greed) and a volume / chatter spike, often marks the end
        of the move, not the start (loss aversion and FOMO peak there).
     7. Round numbers: people anchor on $X0 / $X5 prices; orders cluster there, so they act as magnets and walls.
   Uses: Q, FUND, FRESH, socStats, fmtPx, fmtPct, etInfo, phaseAt, wwPositions, Web. */
(function () {
  "use strict";
  const anchor = document.getElementById("radarCard") || document.getElementById("intelCard"); if (!anchor) return;
  const card = document.createElement("section"); card.className = "card"; card.id = "psyCard"; card.style.marginBottom = "12px";
  card.innerHTML = `<details open><summary class="label" style="cursor:pointer">Crowd psychology · the rational and irrational side of SOXL</summary><div id="psyNow"></div><div id="psyNews"></div></details>`;
  anchor.before(card);
  const st = document.createElement("style");
  st.textContent = `#psyCard table{width:100%;border-collapse:collapse;font:12px var(--mono)}#psyCard th,#psyCard td{padding:4px 6px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}#psyCard th{color:var(--dim);font-size:11px}#psyCard summary{list-style:none}#psyCard .nt{font-size:12px;color:var(--dim);line-height:1.5;margin:6px 0}
    #psyCard .nwrap{overflow-x:auto}#psyCard .ntab{min-width:640px}#psyCard .ntab td{padding:7px 8px;vertical-align:top}
    #psyCard .ntab td.tm{white-space:nowrap;color:var(--dim);width:1%}#psyCard .ntab td.num{white-space:nowrap;text-align:right;width:1%}#psyCard .ntab th.num{text-align:right}
    #psyCard .ntab td.vd{white-space:nowrap;color:var(--dim);width:1%}
    #psyCard a.hl,#psyCard a.hl:visited{color:var(--ink);text-decoration:none;font:500 13.5px/1.35 var(--sans);display:block}
    #psyCard a.hl:hover{color:var(--accent);text-decoration:underline;text-underline-offset:3px}
    #psyCard .hs{font:11px var(--mono);color:var(--mute);margin-top:2px}`;
  document.head.appendChild(st);
  const lsG = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const c1 = v => Math.max(-1, Math.min(1, v)), esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cl = v => v > 0.05 ? "up" : v < -0.05 ? "down" : "";

  // ---------- SOXL perp candles (15m, 10 days): the price path around each headline, around the clock ----------
  let C = null, cT = 0;
  async function candles() {
    if (C && Date.now() - cT < 5 * 6e4) return C;
    try { const r = await fetch("https://api.hyperliquid.xyz/info", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "candleSnapshot", req: { coin: "xyz:SOXL", interval: "15m", startTime: Date.now() - 10 * 864e5, endTime: Date.now() } }) });
      if (r.ok) { const j = await r.json(); C = j.map(x => ({ t: x.t, o: +x.o, h: +x.h, l: +x.l, c: +x.c, v: +x.v })); cT = Date.now(); } } catch (e) { }
    return C;
  }
  const pxAt = t => { if (!C) return null; let k = -1; for (let i = 0; i < C.length; i++) { if (C[i].t <= t) k = i; else break; } return k < 0 ? null : C[k].c; };

  // ---------- 1. news reaction study (grows in this browser) ----------
  let NL = lsG("soxx_psy_news", []);   // {k, t (ms), s, h, url, p0, p30, p240}
  function logNews() {
    const F = (typeof FRESH !== "undefined" ? FRESH : []).filter(n => Math.abs(n.s || 0) >= 0.35 && (n.syms || []).some(s => s === "SOXL" || s === "SOXX" || s === "SOXS" || /^(NVDA|AMD|AVGO|MU|INTC|TSM|QCOM|ASML|MRVL|AMAT|LRCX|KLAC|TXN|ARM)$/.test(s)));
    const have = new Set(NL.map(x => x.k));
    F.forEach(n => { if (have.has(n.k) || n.t * 1000 < Date.now() - 9 * 864e5) return; NL.push({ k: n.k, t: n.t * 1000, s: n.s, h: n.h, url: n.url, syms: (n.syms || []).slice(0, 3) }); });
    NL.forEach(x => { if (x.p0 == null) x.p0 = pxAt(x.t); if (x.p30 == null && Date.now() - x.t > 30 * 6e4) x.p30 = pxAt(x.t + 30 * 6e4); if (x.p240 == null && Date.now() - x.t > 4 * 36e5) x.p240 = pxAt(x.t + 4 * 36e5); });
    NL = NL.filter(x => Date.now() - x.t < 90 * 864e5).slice(-1500); lsS("soxx_psy_news", NL);
  }
  function newsStudy() {
    const D = NL.filter(x => x.p0 && x.p30 && x.p240), out = { n: D.length, cont: 0, rev: 0, withNews: 0, against: 0, big: { n: 0, cont: 0 } };
    D.forEach(x => { const r1 = x.p30 / x.p0 - 1, r2 = x.p240 / x.p30 - 1; if (Math.abs(r1) < 0.003) return;
      if (Math.sign(r1) === Math.sign(x.s)) out.withNews++; else out.against++;           // did the first reaction match the headline's tone?
      if (Math.sign(r2) === Math.sign(r1)) out.cont++; else out.rev++;                      // did it keep going or snap back?
      if (Math.abs(r1) >= 0.02) { out.big.n++; if (Math.sign(r2) === Math.sign(r1)) out.big.cont++; } });
    const m = out.cont + out.rev; out.contR = m ? out.cont / m : null; out.toneR = out.withNews + out.against ? out.withNews / (out.withNews + out.against) : null; out.bigR = out.big.n ? out.big.cont / out.big.n : null;
    return out;
  }

  // ---------- everything live ----------
  async function run() {
    await candles(); logNews();
    const q = Q[FUND], P = q && q.c > 0 ? q.c : C && C.length ? C[C.length - 1].c : NaN; if (!(P > 0) || !C || C.length < 40) return;
    const now = Date.now(), I = [], add = (id, nm, v, read, why) => { if (isFinite(v)) I.push({ id, nm, v: c1(v), read, why }); };
    const N = newsStudy();
    // normal 1-hour move on the perp (last 10 days)
    const r1h = C.slice(-960).map((x, i, a) => i >= 4 ? Math.abs(x.c / a[i - 4].c - 1) : NaN).filter(isFinite), nrm = r1h.length ? r1h.reduce((a, x) => a + x, 0) / r1h.length : 0.02;
    const p1h = pxAt(now - 36e5), mv1 = p1h ? P / p1h - 1 : 0, z1 = nrm ? mv1 / nrm : 0;
    // 1. fresh news and its learned follow-through
    const fresh = NL.filter(x => now - x.t < 4 * 36e5).sort((a, b) => Math.abs(b.s) - Math.abs(a.s))[0];
    if (fresh && fresh.p0) { const r = P / fresh.p0 - 1, contR = N.contR != null && N.n >= 10 ? N.contR : 0.55;
      add("psy.news-follow", "Fresh headline · learned follow-through", Math.sign(r || fresh.s) * (contR - 0.5) * 4, `"${esc(fresh.h.slice(0, 80))}" (tone ${fresh.s > 0 ? "+" : ""}${fresh.s.toFixed(2)}), SOXL ${fmtPct(r, 1)} since`, N.n >= 10 ? `After headlines, SOXL kept going ${Math.round(N.contR * 100)}% of the time (${N.n} studied): ${N.contR > 0.55 ? "the market under-reacts here, so the first move tends to continue" : N.contR < 0.45 ? "the market over-reacts here, so the first move tends to fade" : "no clear pattern yet"}.` : "Markets usually under-react to real news (it takes hours to digest) and over-react to dramatic headlines. The study builds up as headlines arrive."); }
    // 2. a big move with no headline behind it
    const newsIn1h = NL.some(x => now - x.t < 90 * 6e4);
    if (Math.abs(z1) >= 2 && !newsIn1h) add("psy.no-news-move", "Big move with no news (snap-back)", -Math.sign(mv1) * Math.min(1, (Math.abs(z1) - 1.5) / 2), `SOXL ${fmtPct(mv1, 1)} in 1h = ${z1.toFixed(1)}× a normal hour, no headline`, "Moves without news come from order flow, stops and emotion, not new information. Studies of stock returns find they tend to reverse; moves with news tend to continue.");
    // 3 + 4. herding and attention on StockTwits
    try { const S = socStats(FUND); if (S && isFinite(S.bull) && S.tagged >= 15) { const b = S.bull;
      if (b >= 0.75 || b <= 0.3) add("psy.herd", "Herding on StockTwits (contrarian)", -(b - 0.5) * 3, `${Math.round(b * 100)}% bullish of ${S.tagged} tagged posts`, b >= 0.75 ? "Nearly everyone is bullish. When the crowd is this one-sided, most who wanted to buy have bought; the marginal buyer is gone. Crowds are usually late at extremes." : "Nearly everyone is bearish. Capitulating crowds have usually already sold; the selling pressure is spent.");
      if (S.spike) add("psy.attention", "Attention spike (emotional crowd)", -Math.sign(mv1 || (b - 0.5)) * 0.6, `${Math.round(S.rate)} posts/h vs ${Math.round(S.avg)} normal`, "Attention-driven buying (and selling) is impulsive: people trade what is in front of them. Moves made in attention spikes often give back part of the move once the attention fades."); } } catch (e) { }
    // 5. disposition effect: trapped holders' breakeven
    try { const Ps = window.wwPositions ? wwPositions() : []; let tl = 0, tlx = 0, ts = 0, tsx = 0;
      Ps.forEach(p => { const v = Math.abs(p.szi) * P; if (p.szi > 0 && p.ep > P) { tl += v; tlx += v * p.ep; } if (p.szi < 0 && p.ep < P) { ts += v; tsx += v * p.ep; } });
      const be = tl ? tlx / tl : null, bs = ts ? tsx / ts : null;
      if (tl >= 2e5 || ts >= 2e5) { const lean = (ts - tl) / Math.max(tl + ts, 1);
        add("psy.trapped", "Trapped holders (disposition effect)", lean, `${tl ? `trapped longs $${(tl / 1e6).toFixed(2)}M, breakeven ${fmtPx(be)}` : ""}${tl && ts ? " · " : ""}${ts ? `trapped shorts $${(ts / 1e6).toFixed(2)}M, breakeven ${fmtPx(bs)}` : ""}`, "People hold losers hoping to get back to even, then sell at breakeven. Underwater longs above = supply on any rally near their entry. Underwater shorts below = buyers in a hurry if price rises (squeeze fuel)."); } } catch (e) { }
    // 6. capitulation / euphoria
    { const pc = q && q.pc > 0 ? q.pc : null, day = pc ? P / pc - 1 : 0, dz = nrm ? day / (nrm * 2.8) : 0; let sp = false, b = NaN; try { const S = socStats(FUND); sp = S && S.spike; b = S ? S.bull : NaN; } catch (e) { }
      if (Math.abs(dz) >= 2.5) add("psy.climax", dz < 0 ? "Capitulation (loss aversion peaks)" : "Euphoria (FOMO peaks)", -Math.sign(dz) * Math.min(1, (Math.abs(dz) - 2) / 3) * (sp ? 1 : 0.6), `SOXL ${fmtPct(day, 1)} today = ${Math.abs(dz).toFixed(1)}σ${sp ? ", chatter spike" : ""}${isFinite(b) ? `, ${Math.round(b * 100)}% bullish` : ""}`, dz < 0 ? "Losses hurt about twice as much as gains feel good. When the pain gets extreme, people sell everything at once: the selling runs out and price often bounces. It is not a reason to buy on its own: wait for the first higher low." : "Fear of missing out peaks at the end of a run: the last buyers pay the most. Extreme up days often stall or give back part of the move."); }
    // 7. round numbers
    { const step = P >= 50 ? 5 : P >= 20 ? 1 : 0.5, rn = Math.round(P / step) * step, d = (P - rn) / P;
      if (Math.abs(d) <= 0.006) add("psy.round", "Round-number magnet", 0, `${fmtPx(rn)} is ${fmtPct(-d, 2)} away`, "People anchor on round prices: limit orders, stops and profit targets cluster there. Price is often pulled to a round number, then stalls at it on the first touch."); }

    // feed the web: each behavioral reading is a node, so its real value is learned
    try { if (window.Web) I.forEach(x => { if (x.v) Web.emit(x.id, "SOXL", x.v, "Psychology · " + x.nm); }); } catch (e) { }
    window.PSY = { I, N };
    document.getElementById("psyNow").innerHTML = I.length ? `<table><tr><th>Pattern now</th><th>Lean</th><th>Reading</th><th>Why people do this</th></tr>${I.map(x => `<tr><td><b>${x.nm}</b></td><td class="${cl(x.v)}">${x.v > 0.05 ? "▲ up" : x.v < -0.05 ? "▼ down" : "–"}</td><td>${x.read}</td><td style="color:var(--dim)">${x.why}</td></tr>`).join("")}</table>`
      : `<div class="nt">No crowd extreme right now: no fresh big headline, no unexplained big move, StockTwits not one-sided, no trapped-holder cluster and no climax. Calm crowds are the rational state; the patterns above show up when emotion takes over.</div>`;
    const recent = NL.filter(x => x.p0).sort((a, b) => b.t - a.t).slice(0, 8);
    document.getElementById("psyNews").innerHTML = `<div class="label" style="margin-top:10px">News: rational or irrational? · how SOXL reacted to semis headlines</div>
      <div class="nt">${N.n ? `Studied ${N.n} headlines. First 30 minutes went the way of the headline's tone ${N.toneR != null ? Math.round(N.toneR * 100) + "%" : "–"} of the time (rational: the market reads the news). Then over the next 4 hours the move <b>continued ${N.contR != null ? Math.round(N.contR * 100) : "–"}%</b> / reversed ${N.contR != null ? 100 - Math.round(N.contR * 100) : "–"}%${N.bigR != null ? `; after big first reactions (2%+) it continued ${Math.round(N.bigR * 100)}% of ${N.big.n}` : ""}. Continuation = under-reaction (the news is digested slowly); reversal = over-reaction (emotion, then correction).` : "The study starts with the headlines on this page and grows every day it is open."}</div>
      ${recent.length ? `<div class="nwrap"><table class="ntab"><tr><th>When</th><th>Headline</th><th class="num">Tone</th><th class="num">First 30 min</th><th class="num">Next 4h</th><th>Verdict</th></tr>${recent.map(x => { const r1 = x.p30 ? x.p30 / x.p0 - 1 : null, r2 = x.p240 && x.p30 ? x.p240 / x.p30 - 1 : null;
        const v = r1 == null ? "waiting" : Math.abs(r1) < 0.003 ? "ignored (priced in?)" : r2 == null ? (Math.sign(r1) === Math.sign(x.s) ? "reacted with the news" : "reacted against the news") : Math.sign(r2) === Math.sign(r1) ? "continued: under-reaction" : "reversed: over-reaction";
        const ago = Date.now() - x.t, agoT = ago < 36e5 ? Math.max(1, Math.round(ago / 6e4)) + " min ago" : ago < 864e5 ? Math.round(ago / 36e5) + " h ago" : Math.round(ago / 864e5) + " d ago", src = x.src || x.source || "";
        return `<tr><td class="tm">${new Date(x.t).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</td><td><a class="hl" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.h.length > 160 ? x.h.slice(0, 157) + "…" : x.h)}</a><div class="hs">${src ? esc(src) + " · " : ""}${agoT}</div></td><td class="num ${cl(x.s)}">${x.s > 0 ? "+" : ""}${x.s.toFixed(2)}</td><td class="num ${cl(r1 || 0)}">${r1 == null ? "–" : fmtPct(r1, 1)}</td><td class="num ${cl(r2 || 0)}">${r2 == null ? "–" : fmtPct(r2, 1)}</td><td class="vd">${v}</td></tr>`; }).join("")}</table></div>` : ""}
      <div class="nt">Prices: the SOXL perp on Hyperliquid, which trades around the clock, so headlines at night and on weekends count too. "Ignored" can mean the news was already in the price (rational) or that nobody cared yet.</div>`;
  }
  setTimeout(() => run().catch(e => console.warn("psych", e)), 9000); setInterval(() => { if (!document.hidden) run().catch(e => console.warn("psych", e)); }, 60000);
})();
