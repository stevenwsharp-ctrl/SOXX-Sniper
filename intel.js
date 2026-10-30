/* SOXX Sniper · intelligence card: the semis basket (smart vs fools on the SOXX holdings' perps), spot buying/selling of the
   best and worst SOXL traders, and the nightly leveraged-ETF rebalance / market-maker study. Uses basket.js and whales.js. */
(function () {
  "use strict";
  const HL = "https://api.hyperliquid.xyz/info";
  const post = b => fetch(HL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => { if (r.status === 429) throw new Error("429"); if (!r.ok) throw new Error(r.status); return r.json(); });
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const usd = n => { const a = Math.abs(n); return (n < 0 ? "-$" : "$") + (a >= 1e9 ? (a / 1e9).toFixed(2) + "B" : a >= 1e6 ? (a / 1e6).toFixed(2) + "M" : a >= 1e3 ? (a / 1e3).toFixed(1) + "K" : Math.round(a)); };
  const pxf = p => !p ? "–" : p >= 1000 ? p.toLocaleString(undefined, { maximumFractionDigits: 0 }) : p >= 1 ? p.toFixed(2) : p.toPrecision(4);
  const ago = t => { const m = Math.max(1, Math.round((Date.now() - t) / 6e4)); return m < 60 ? m + "m" : Math.round(m / 60) + "h"; };
  const anchor = document.getElementById("whaleCard"); if (!anchor) return;
  const card = document.createElement("section"); card.className = "card"; card.id = "intelCard"; card.style.marginBottom = "12px";
  card.innerHTML = `<details open id="inBk"><summary class="label" style="cursor:pointer">Semis basket · smart vs fools on the SOXX holdings (Hyperliquid perps)</summary><div id="inBkBody"></div></details>
    <details open id="inSp" style="margin-top:12px"><summary class="label" style="cursor:pointer">Spot · what the best and worst SOXL traders buy, sell and hold</summary><div id="inSpNote" class="bk-f" style="font-size:12px;margin:4px 0"></div><div id="inSpBody"></div></details>
    <details open id="inRb" style="margin-top:12px"><summary class="label" style="cursor:pointer">Nightly rebalance · market makers · after-hours</summary><div id="inRbBody"></div></details>`;
  anchor.after(card);
  const css = document.createElement("style");
  css.textContent = `#intelCard summary{list-style:none}#intelCard summary::before{content:"▾ ";color:var(--mute)}#intelCard details:not([open]) summary::before{content:"▸ "}
#intelCard .sp table{width:100%;border-collapse:collapse;font:12px var(--mono)}#intelCard .sp th,#intelCard .sp td{padding:3px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
#intelCard .sp th{color:var(--dim);font-size:11px}#intelCard .sp td:first-child,#intelCard .sp th:first-child,#intelCard .sp td.tl{text-align:left}`;
  document.head.appendChild(css);

  /* ---------- basket ---------- */
  async function basket() {
    const D = await Basket.load(); const live = s => { try { return Q && Q[s] && Q[s].c || null; } catch (e) { return null; } };
    document.getElementById("inBkBody").innerHTML = Basket.html(D ? Basket.compute(D, { px: live }) : null);
  }

  /* ---------- lab share + rebalance ---------- */
  function shareLab() {
    try {
      const st = typeof ST !== "undefined" && ST ? ST : (typeof sessStats === "function" && typeof SESS !== "undefined" && SESS.length ? sessStats() : null);
      if (!st || !st.rebal) return null;
      const out = { at: Date.now(), n: st.n, first: st.first, last: st.last, rebal: st.rebal,
        rules: (st.rules || []).map(r => ({ id: r.id, title: r.title, r: r.full && isFinite(r.full.r) ? r.full.r : null, oos: r.oos && isFinite(r.oos.r) ? r.oos.r : null, verdict: r.verdict, who: r.who })) };
      localStorage.setItem("soxx_lab_share", JSON.stringify(out)); return out;
    } catch (e) { return null; }
  }
  function rebal() {
    let rb = null;
    try { const lf = letfFlow(todaySess()); if (lf && isFinite(lf.idx)) rb = Basket.rebalance(lf.idx, typeof LETF_AUM !== "undefined" ? LETF_AUM : null); } catch (e) { }
    document.getElementById("inRbBody").innerHTML = Basket.knowledge(rb, shareLab() || Basket.lab());
  }

  /* ---------- spot ---------- */
  const FILLS = {}, BAL = {}; let SPM = null, spmT = 0, HOLD = 0, spT = 0;
  const start = () => Date.now() - 7 * 864e5;
  window.wwRawFills = (a, f, init) => { if (!Array.isArray(f)) return; const s = start(), cur = FILLS[a];
    FILLS[a] = { t: Date.now(), f: (init || !cur ? f : cur.f.concat(f)).filter(x => x.time >= s) }; };
  async function meta() {
    if (SPM && Date.now() - spmT < 60000) return;
    try { const [m, ctxs] = await post({ type: "spotMetaAndAssetCtxs" }); const tok = {}; m.tokens.forEach(t => tok[t.index] = t.name); const by = {}; ctxs.forEach(c => by[c.coin] = c);
      const o = {}; m.universe.forEach(u => { const c = by[u.name] || {}, px = +c.markPx || +c.midPx || 0, pv = +c.prevDayPx || 0;
        o[u.name] = { base: tok[u.tokens[0]], quote: tok[u.tokens[1]], px, ch: pv ? (px / pv - 1) * 100 : null, vol: +c.dayNtlVlm || 0 }; }); SPM = o; spmT = Date.now(); } catch (e) { if (/429/.test(e.message)) HOLD = Date.now() + 60000; }
  }
  const baseOf = c => SPM && SPM[c] ? SPM[c].base : String(c).includes("/") ? String(c).split("/")[0] : null;
  const pairOf = tok => { if (!SPM) return null; let b = null; for (const p of Object.values(SPM)) if (p.base === tok && /^USD/.test(p.quote || "") && (!b || p.vol > b.vol)) b = p; return b; };
  // whales.js reads the best wallets every minute and hands us their fills; we read the worst wallets and all spot balances, slowly.
  async function pull() {
    if (Date.now() < HOLD || (window.wwHlLimited && wwHlLimited()) || document.hidden) return;
    await meta(); const L = window.wwList ? wwList() : []; let n = 0;
    for (const w of L.filter(w => w.g === "W")) {
      if (n >= 3 || Date.now() < HOLD) break; const F = FILLS[w.a];
      if (F && Date.now() - F.t < 300000) continue;
      try { if (!F) { wwRawFills(w.a, await post({ type: "userFills", user: w.a, aggregateByTime: true }), true); n++; }
        else { const last = F.f.reduce((m, x) => Math.max(m, x.time), start()); wwRawFills(w.a, await post({ type: "userFillsByTime", user: w.a, startTime: last + 1, aggregateByTime: true }), false); } }
      catch (e) { if (/429/.test(e.message)) { HOLD = Date.now() + 60000; break; } }
      await new Promise(r => setTimeout(r, 700));
    }
    let k = 0;
    for (const w of L.slice().sort((a, b) => ((BAL[a.a] || {}).t || 0) - ((BAL[b.a] || {}).t || 0))) {
      if (k >= 5 || Date.now() < HOLD) break; if (BAL[w.a] && Date.now() - BAL[w.a].t < 600000) continue;
      try { const j = await post({ type: "spotClearinghouseState", user: w.a }); BAL[w.a] = { t: Date.now(), b: j && j.balances || [] }; k++; } catch (e) { if (/429/.test(e.message)) { HOLD = Date.now() + 60000; break; } }
      await new Promise(r => setTimeout(r, 400));
    }
    spT = Date.now(); spot();
  }
  function spot() {
    const L = window.wwList ? wwList() : [], grp = {}; L.forEach(w => grp[w.a] = w.g === "B" ? "g" : "b");
    const now = Date.now(), T = {}; let nF = 0;
    const row = t => T[t] = T[t] || { tok: t, g24: 0, g7: 0, b24: 0, b7: 0, gB: new Set(), gS: new Set(), bB: new Set(), bS: new Set(), gH: 0, bH: 0, gHn: 0, bHn: 0 };
    for (const [a, F] of Object.entries(FILLS)) { const g = grp[a]; if (!g) continue; nF++;
      F.f.forEach(x => { const c = String(x.coin); if (!(c.startsWith("@") || c.includes("/"))) return; const t = baseOf(c); if (!t) return;
        const r = row(t), v = +x.sz * +x.px * (x.side === "B" ? 1 : -1), age = now - x.time; r[g + "7"] += v; (v > 0 ? r[g + "B"] : r[g + "S"]).add(a); if (age <= 864e5) r[g + "24"] += v; }); }
    let nB = 0;
    for (const [a, B] of Object.entries(BAL)) { const g = grp[a]; if (!g) continue; nB++;
      B.b.forEach(b => { if (/^USD/.test(b.coin)) return; const p = pairOf(b.coin); if (!p || !p.px) return; const v = +b.total * p.px; if (v < 100) return; const r = row(b.coin); r[g + "H"] += v; r[g + "Hn"]++; }); }
    const list = Object.values(T).filter(r => Math.abs(r.g7) + Math.abs(r.b7) + r.gH + r.bH >= 1000).sort((a, b) => (Math.abs(b.g7) + Math.abs(b.b7) + (b.gH + b.bH) / 4) - (Math.abs(a.g7) + Math.abs(a.b7) + (a.gH + a.bH) / 4)).slice(0, 20);
    const sig = r => { const g = Math.sign(Math.round(r.g7 / 1000)), b = Math.sign(Math.round(r.b7 / 1000));
      return g > 0 && b < 0 ? ["up", "Smart accumulate · fools sell"] : g < 0 && b > 0 ? ["down", "Smart distribute · fools buy"] : g > 0 && b > 0 ? ["", "Both buying"] : g < 0 && b < 0 ? ["", "Both selling"] : g > 0 ? ["up", "Smart buying"] : g < 0 ? ["down", "Smart selling"] : b > 0 ? ["down", "Fools buying"] : b < 0 ? ["up", "Fools selling"] : ["", "Holding"]; };
    const $v = v => v ? `<span class="${v > 0 ? "up" : "down"}">${v > 0 ? "+" : ""}${usd(v)}</span>` : `<span style="color:var(--mute)">0</span>`;
    const nb = Object.values(T).reduce((a, r) => a + r.g7, 0), nf = Object.values(T).reduce((a, r) => a + r.b7, 0);
    const top = SPM ? Object.values(SPM).filter(p => /^USD/.test(p.quote || "") && p.vol > 0).sort((a, b) => b.vol - a.vol).slice(0, 10) : [];
    const totV = SPM ? Object.values(SPM).reduce((a, p) => a + (/^USD/.test(p.quote || "") ? p.vol : 0), 0) : 0, up = top.filter(p => p.ch > 0).length;
    document.getElementById("inSpNote").innerHTML = `Spot fills (7 days) and spot balances of the 20 best and 20 worst SOXL traders (${nF} with fills, ${nB} with balances loaded so far; the first full read takes a few minutes to stay inside Hyperliquid's rate limit). Hyperliquid has no spot chip stocks: SOXL, SOXX and the holdings trade here only as perps (see the basket above). Spot shows the same traders' risk appetite in crypto. When the best SOXL traders sell spot and raise cash while the worst ones buy, that often comes before risk-off days in high-beta chips. ${spT ? `Updated ${ago(spT)} ago.` : ""}`;
    document.getElementById("inSpBody").innerHTML = `<div class="bk-sum bk">
      <div><span class="bk-f">Best traders · net spot 7d</span><b class="${nb >= 0 ? "bk-L" : "bk-S"}">${nb >= 0 ? "+" : ""}${usd(nb)}</b>${nb >= 0 ? "buying" : "selling"}</div>
      <div><span class="bk-f">Worst traders · net spot 7d</span><b class="${nf >= 0 ? "bk-L" : "bk-S"}">${nf >= 0 ? "+" : ""}${usd(nf)}</b>${nf >= 0 ? "buying" : "selling"}</div>
      <div><span class="bk-f">Hyperliquid spot volume 24h</span><b>${usd(totV)}</b>${up}/${top.length} top pairs up</div>
      ${top.slice(0, 4).map(p => `<div><span class="bk-f">spot ${esc(p.base)}</span><b>${pxf(p.px)}</b><span class="${p.ch >= 0 ? "bk-L" : "bk-S"}">${p.ch != null ? (p.ch >= 0 ? "+" : "") + p.ch.toFixed(2) + "%" : "–"}</span> · ${usd(p.vol)}</div>`).join("")}</div>
      ${list.length ? `<div class="sp" style="overflow-x:auto"><table><thead><tr><th>Token</th><th>Price</th><th>24h</th><th>Best net 24h</th><th>Best net 7d</th><th>Worst net 24h</th><th>Worst net 7d</th><th>Best hold</th><th>Worst hold</th><th>Signal</th></tr></thead><tbody>${list.map(r => { const p = pairOf(r.tok), s = sig(r);
        return `<tr><td><b>${esc(r.tok)}</b></td><td>${p ? pxf(p.px) : "–"}</td><td>${p && p.ch != null ? `<span class="${p.ch >= 0 ? "up" : "down"}">${p.ch >= 0 ? "+" : ""}${p.ch.toFixed(2)}%</span>` : "–"}</td><td>${$v(r.g24)}</td><td>${$v(r.g7)} <span style="color:var(--mute)">${r.gB.size}↑ ${r.gS.size}↓</span></td><td>${$v(r.b24)}</td><td>${$v(r.b7)} <span style="color:var(--mute)">${r.bB.size}↑ ${r.bS.size}↓</span></td><td>${r.gH ? usd(r.gH) + ` <span style="color:var(--mute)">${r.gHn}</span>` : "–"}</td><td>${r.bH ? usd(r.bH) + ` <span style="color:var(--mute)">${r.bHn}</span>` : "–"}</td><td class="tl ${s[0]}">${s[1]}</td></tr>`; }).join("")}</tbody></table></div>`
        : `<div style="color:var(--mute);font-size:12px">No spot trades or holdings of $1K+ loaded yet.</div>`}`;
  }

  basket(); rebal(); spot();
  setInterval(basket, 120000); setInterval(rebal, 60000);
  setTimeout(pull, 20000); setInterval(pull, 60000);
})();
