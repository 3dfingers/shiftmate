"use strict";
// ShiftMate (phone version) - pure logic, no screen code. Exposed as window.Core.
// All instants are UTC milliseconds. Wall-clock times are "YYYY-MM-DD" + "HH:MM" in an IANA zone.
(function () {
  const MIN = 60e3, HOUR = 3600e3, DAY = 86400e3;
  const STUDENT_LIMIT_MIN = 20 * 60;

  // ------------------------------------------------------------ time zones
  const fmtCache = {};
  function partsFmt(tz) {
    return (fmtCache[tz] ??= new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }));
  }
  /** Offset of `tz` from UTC at instant `ms`, in ms (BST = +3600000). */
  function tzOffset(ms, tz) {
    const p = {};
    for (const x of partsFmt(tz).formatToParts(new Date(ms))) p[x.type] = +x.value;
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
  }
  /**
   * Wall-clock time in `tz` -> UTC ms, handling daylight saving:
   *  - a time that happens twice (clocks go back): the first one;
   *  - a time that doesn't exist (clocks go forward): moved forward by the gap.
   */
  function localToUtc(date, time, tz) {
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    const wall = Date.UTC(y, m - 1, d, hh, mm);
    const cands = [...new Set([tzOffset(wall - DAY, tz), tzOffset(wall + DAY, tz)])]
      .map((off) => wall - off)
      .filter((c) => wall - c === tzOffset(c, tz));
    if (cands.length) return { ms: Math.min(...cands), note: cands.length > 1 ? "twice" : null };
    return { ms: wall - tzOffset(wall - DAY, tz), note: "gap" };
  }
  /** UTC ms -> "YYYY-MM-DD" in tz. */
  function ymd(ms, tz) { return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(ms)); }
  function addDays(d, n) { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function mondayOf(d) { return addDays(d, -((new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7)); }
  /** Monday 00:00 -> next Monday 00:00 in tz, for the week containing instant ms. */
  function weekBounds(ms, tz) {
    const mon = mondayOf(ymd(ms, tz));
    return { start: localToUtc(mon, "00:00", tz).ms, end: localToUtc(addDays(mon, 7), "00:00", tz).ms, monday: mon };
  }

  // ------------------------------------------------------------ shifts
  /** Work out UTC start/end from what the user typed. End at/before start = ends next day. */
  function resolveShift(date, start, end, tz) {
    const endDate = end <= start ? addDays(date, 1) : date;
    const s = localToUtc(date, start, tz), e = localToUtc(endDate, end, tz);
    const warnings = [];
    for (const [r, t, d] of [[s, start, date], [e, end, endDate]]) {
      if (r.note === "gap") warnings.push(`${t} doesn't exist on ${d} (clocks go forward), so it was moved forward an hour.`);
      if (r.note === "twice") warnings.push(`${t} happens twice on ${d} (clocks go back); using the first one.`);
    }
    return { startUtc: s.ms, endUtc: e.ms, overnight: endDate !== date, minutes: Math.round((e.ms - s.ms) / MIN), warnings };
  }
  const live = (s) => s.status !== "cancelled";
  const overlapMin = (a0, a1, b0, b1) => Math.max(0, Math.round((Math.min(a1, b1) - Math.max(a0, b0)) / MIN));
  function minutesInRange(shifts, from, to, excludeId) {
    return shifts.filter((s) => live(s) && s.id !== excludeId).reduce((a, s) => a + overlapMin(s.startUtc, s.endUtc, from, to), 0);
  }
  /**
   * Students: refuse a shift that would push any week (Mon-Sun, their zone) over 20h.
   * Returns null if OK, or a message. Overnight shifts over Sunday midnight count in both weeks.
   */
  function checkWeeklyLimit(profile, shifts, cand, excludeId) {
    if (profile.type !== "student") return null;
    let w = weekBounds(cand.startUtc, profile.tz);
    while (w.start < cand.endUtc) {
      const existing = minutesInRange(shifts, w.start, w.end, excludeId);
      const added = overlapMin(cand.startUtc, cand.endUtc, w.start, w.end);
      if (existing + added > STUDENT_LIMIT_MIN) {
        const h = (m) => +(m / 60).toFixed(2);
        return `Students can work at most 20 hours a week. You already have ${h(existing)}h in the week starting ` +
          `${fmtDate(w.monday)}, and this shift adds ${h(added)}h, which would make ${h(existing + added)}h. ` +
          `You have ${h(Math.max(0, STUDENT_LIMIT_MIN - existing))}h left that week.`;
      }
      w = weekBounds(w.end + HOUR, profile.tz);
    }
    return null;
  }
  function fmtDate(d) {
    return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(d + "T12:00:00Z"));
  }
  /** Labels for a shift: early, overnight, conflict, back_to_back, unconfirmed. */
  function flags(s, all, gapMin = 60) {
    const f = [];
    if (s.start < "07:00") f.push("early");
    if (s.end <= s.start) f.push("overnight");
    if (live(s)) {
      for (const o of all) {
        if (o.id === s.id || !live(o)) continue;
        if (o.startUtc < s.endUtc && s.startUtc < o.endUtc) { if (!f.includes("conflict")) f.push("conflict"); }
        else {
          const gap = o.startUtc >= s.endUtc ? o.startUtc - s.endUtc : s.startUtc - o.endUtc;
          if (gap < gapMin * MIN && !f.includes("back_to_back")) f.push("back_to_back");
        }
      }
    }
    if (s.status === "unconfirmed") f.push("unconfirmed");
    return f;
  }

  // ------------------------------------------------------------ calendar (.ics)
  const icsDate = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const icsText = (t) => String(t ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  function fold(line) {
    // RFC 5545: lines longer than 75 bytes continue on the next line, starting with a space.
    const out = [];
    let cur = "", bytes = 0;
    for (const ch of line) {
      const b = new TextEncoder().encode(ch).length;
      if (bytes + b > 74) { out.push(cur); cur = " "; bytes = 1; }
      cur += ch; bytes += b;
    }
    out.push(cur);
    return out.join("\r\n");
  }
  function remLabel(m) {
    if (m % 1440 === 0) return `${m / 1440} day${m > 1440 ? "s" : ""}`;
    if (m % 60 === 0) return `${m / 60} hour${m > 60 ? "s" : ""}`;
    return `${m} minutes`;
  }
  /** One calendar file containing the given shifts, each with its reminders as alerts. */
  function buildIcs(shifts, employerName, nowMs) {
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ShiftMate//Phone//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    for (const s of shifts) {
      const place = employerName(s) || s.role || "Shift";
      const title = `${place}${s.role && employerName(s) ? ` (${s.role})` : ""}`;
      lines.push("BEGIN:VEVENT",
        `UID:shiftmate-${s.uid}@shiftmate.app`,
        `DTSTAMP:${icsDate(nowMs)}`,
        `DTSTART:${icsDate(s.startUtc)}`,
        `DTEND:${icsDate(s.endUtc)}`,
        `SUMMARY:${icsText("Shift: " + title)}`);
      if (s.address) lines.push(`LOCATION:${icsText(s.address)}`);
      const desc = [s.status === "unconfirmed" ? "Not confirmed yet." : "", s.notes ? "Prep: " + s.notes : "", "Added by ShiftMate."].filter(Boolean).join("\n");
      lines.push(`DESCRIPTION:${icsText(desc)}`, "STATUS:" + (s.status === "unconfirmed" ? "TENTATIVE" : "CONFIRMED"));
      for (const m of [...new Set(s.reminders || [])].sort((a, b) => b - a)) {
        lines.push("BEGIN:VALARM", "ACTION:DISPLAY",
          `DESCRIPTION:${icsText(`Your shift at ${place} starts in ${remLabel(m)}`)}`,
          `TRIGGER:-PT${m}M`, "END:VALARM");
      }
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    return lines.map(fold).join("\r\n") + "\r\n";
  }

  window.Core = { MIN, HOUR, DAY, STUDENT_LIMIT_MIN, tzOffset, localToUtc, ymd, addDays, mondayOf, weekBounds,
    resolveShift, minutesInRange, checkWeeklyLimit, flags, buildIcs, remLabel, overlapMin };
})();
