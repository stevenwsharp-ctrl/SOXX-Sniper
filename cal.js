/* cal.js · shared NYSE market calendar (SOXX Sniper, LETF Sniper; same file in both repos; council edits only).
   Council, Nov 15 2026 (LETF agent request): one list of market holidays and 1:00 pm ET early closes for every page,
   so a page does not treat Thanksgiving as a trading day or Nov 27 as a full day.
   2026-2027: NYSE Group release of Dec 23 2025. 2028: from the NYSE holiday rules (Jan 1 2028 is a Saturday: no holiday);
   check against the NYSE release when it is out. Load it in <head>, before the page scripts.
   NYSE.hol: holidays (market closed). NYSE.half: early-close days (regular session 9:30-13:00 ET, extended hours to 17:00 ET).
   NYSE.sessEnd(d): end of the regular session in ET minutes (960, or 780 on an early-close day). NYSE.sessLen(d): its length. */
(function (g) {
  const hol = new Set([
    "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
    "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
    "2028-01-17", "2028-02-21", "2028-04-14", "2028-05-29", "2028-06-19", "2028-07-04", "2028-09-04", "2028-11-23", "2028-12-25"]);
  const half = new Set(["2026-11-27", "2026-12-24", "2027-11-26", "2028-07-03", "2028-11-24"]);
  const sessEnd = d => half.has(d) ? 780 : 960, sessLen = d => sessEnd(d) - 570;
  const NYSE = { hol, half, isHol: d => hol.has(d), isHalf: d => half.has(d), sessEnd, sessLen, until: "2028-12-31" };
  g.NYSE = NYSE; if (typeof module !== "undefined" && module.exports) module.exports = NYSE;
})(typeof window !== "undefined" ? window : globalThis);
