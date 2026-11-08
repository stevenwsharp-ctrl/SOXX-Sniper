/* Mastermind · EV governor and the four agents. The scorecard (ev.json) rules every scored part of the three trackers
   (mute / cut / back / watch); the agents' notes (agents/*.md on the same branch) say what each agent changed and why. */
(function () {
  "use strict";
  const home = document.getElementById("home"); if (!home) return;
  const c = document.createElement("section"); c.className = "card"; c.id = "evCard"; home.before(c);
  const RAW = "https://raw.githubusercontent.com/stevenwsharp-ctrl/Hyperdash-Cohort-Tracker/ev/", NAMES = { soxx: "SOXX Sniper", cohort: "Cohort Sniper", letf: "LETF Sniper" };
  const AG = [["soxx", "SOXX agent"], ["cohort", "Cohort agent"], ["letf", "LETF agent"], ["council", "Council (the 4th agent)"]];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, x => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[x]));
  const pc = (v, u) => !isFinite(v) ? "–" : u === "pct" ? (v >= 0 ? "+" : "") + v.toFixed(2) + "%" : u === "usd" ? (v >= 0 ? "+$" : "−$") + Math.abs(v).toFixed(2) : (v >= 0 ? "+" : "") + (v * 100).toFixed(2) + "%";
  const COL = { mute: "var(--down)", cut: "var(--amber)", back: "var(--up)", watch: "var(--dim)" };
  let open = "council";
  async function load() {
    let E = null, N = {}; try { E = await (await fetch(RAW + "ev.json?t=" + Math.floor(Date.now() / 6e5))).json(); } catch (e) { }
    await Promise.all(AG.map(async ([k]) => { try { const r = await fetch(RAW + "agents/" + k + ".md?t=" + Math.floor(Date.now() / 6e5)); if (r.ok) N[k] = await r.text(); } catch (e) { } }));
    if (!E) { c.innerHTML = `<div class="label">⚖️ EV governor · 4 agents</div><div class="note">The first scorecard comes after the next US close.</div>`; return; }
    const T = E.trackers, row = i => `<tr><td class="l"><span style="display:inline-block;min-width:46px;font-weight:700;color:${COL[i.status]}">${i.status.toUpperCase()}</span></td><td class="l" style="white-space:normal">${esc(i.desc)}${i.changed ? ` <span class="A">(was ${esc(i.prev)})</span>` : ""}</td><td>${i.n}</td><td class="${i.ev > 0 ? "L" : "S"}">${pc(i.ev, i.unit)}</td><td>${isFinite(i.z) ? i.z.toFixed(1) : "–"}</td></tr>`;
    const box = k => { const x = T[k]; if (!x || !x.items) return `<div class="note">${NAMES[k]}: ${esc(x && x.err || "no data")}</div>`; const s = x.summary, top = x.items.filter(i => i.status !== "watch").sort((a, b) => (a.status === "mute" ? 0 : a.status === "cut" ? 1 : 2) - (b.status === "mute" ? 0 : b.status === "cut" ? 1 : 2) || Math.abs(b.z || 0) - Math.abs(a.z || 0)).slice(0, 8);
      return `<div><b>${NAMES[k]}</b> <span class="note">${s.n} scored · <span style="color:${COL.mute}">${s.mute} muted</span> · <span style="color:${COL.cut}">${s.cut} cut</span> · <span style="color:${COL.back}">${s.back} backed</span>${s.changed ? ` · ${s.changed} changed since last time` : ""}</span>
        <div class="tw"><table><tr><th class="l">Ruling</th><th class="l">What</th><th>n</th><th>EV</th><th>z</th></tr>${top.map(row).join("") || '<tr><td class="l note" colspan="5">Nothing proven either way yet.</td></tr>'}</table></div></div>`; };
    const md = s => esc(s).replace(/^### (.*)$/gm, "<b>$1</b>").replace(/^## (.*)$/gm, "<b style='font-size:14px'>$1</b>").replace(/^# (.*)$/gm, "<b style='font-size:15px'>$1</b>").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^- /gm, "• ").replace(/\n/g, "<br>");
    c.innerHTML = `<div class="label">⚖️ EV governor · 4 agents · scorecard ${new Date(E.t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
      <div class="note">After each US close the governor scores every decision, prediction and result of the three trackers. Proven negative expected value is muted at once (the pages read the rulings), negative or decaying is cut to half weight, proven positive is backed. Then three agents (one per tracker) read the scorecard, find out why, and recalibrate the code; the council agent checks their work and passes the lessons between them.</div>
      <div class="grid" style="margin-top:8px">${["soxx", "cohort", "letf"].map(box).join("")}</div>
      <div style="margin-top:10px">${AG.map(([k, l]) => `<button data-ag="${k}" style="${open === k ? "border-color:var(--accent);color:var(--accent)" : ""}">${l}${N[k] ? "" : " · no note yet"}</button>`).join(" ")}</div>
      <div class="note" style="max-height:340px;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:10px;margin-top:6px;color:var(--ink)">${N[open] ? md(N[open].slice(-6000)) : "No note yet: the agents run after each US close (the council about an hour later)."}</div>`;
    c.querySelectorAll("[data-ag]").forEach(b => b.onclick = () => { open = b.dataset.ag; load(); });
  }
  load(); setInterval(load, 15 * 6e4);
})();
