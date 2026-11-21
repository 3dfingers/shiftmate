"use strict";
// ShiftMate - phone version. Everything is stored on this device (localStorage);
// reminders go into the phone's own Calendar so the phone delivers them itself.

const C = window.Core;
const KEY = "shiftmate-data-v1";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DEVICE_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London";
const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
const GBP2 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }); // hourly rates: £11.50
const PRESETS = [1440, 720, 120, 60, 30, 15, 10, 5];

// ---------------------------------------------------------------- data
const blank = () => ({ version: 1, profile: null, settings: { defaultReminders: [60, 15] }, employers: [], shifts: [], nextId: 1 });
function loadData() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    return d && d.version === 1 ? { ...blank(), ...d } : blank();
  } catch (_) { return blank(); }
}
let D = loadData();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(D)); return true; }
  catch (_) { toast("Couldn't save on this phone. Storage may be full or blocked.", true); return false; }
}
const newId = () => D.nextId++;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const tz = () => D.profile?.tz || DEVICE_TZ;
const emp = (s) => D.employers.find((e) => e.id === s.employerId);
const empName = (s) => emp(s)?.name || "";
const placeOf = (s) => empName(s) || s.role || "Shift";
const live = (s) => s.status !== "cancelled";
const sorted = () => [...D.shifts].sort((a, b) => a.startUtc - b.startUtc);
const minutes = (s) => Math.round((s.endUtc - s.startUtc) / C.MIN);

// ---------------------------------------------------------------- icons
const I = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3.1 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', right: '<path d="M9 6l6 6-6 6"/>', left: '<path d="M15 6l-6 6 6 6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5A2.5 2 0 0 0 12 8c-1.4 0-2.5.8-2.5 2s1.1 1.6 2.5 2 2.5.9 2.5 2-1.1 2-2.5 2a2.5 2 0 0 1-2.5-1.5M12 6.5V8M12 16v1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>', check: '<path d="M5 12l5 5 9-10"/>',
  bell: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v5"/>',
  bag: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  palm: '<path d="M12 22V11M12 11C9 7 5 7 3 9M12 11c3-4 7-4 9-2M12 11c-1-4-4-7-7-7M12 11c1-4 4-7 7-7"/>',
  down: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>', up: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  calplus: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;

// ---------------------------------------------------------------- format helpers
const fmt = (ms, z, o) => new Intl.DateTimeFormat("en-GB", { timeZone: z, ...o }).format(new Date(ms));
const fmtTime = (ms, z) => fmt(ms, z, { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s/g, " ").toUpperCase();
const dateOf = (d) => new Date(d + "T12:00:00Z");
const dayName = (d, len = "short") => new Intl.DateTimeFormat("en-GB", { weekday: len, timeZone: "UTC" }).format(dateOf(d));
const monthName = (d) => new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(dateOf(d));
const shortDate = (d) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(dateOf(d));
const hrs = (m) => { const h = Math.floor(m / 60), r = Math.round(m % 60); return r ? `${h}h ${r}m` : `${h}h`; };
const today = () => C.ymd(Date.now(), tz());
const remShort = (m) => (m % 1440 === 0 ? `${m / 1440} day${m > 1440 ? "s" : ""}` : m % 60 === 0 ? `${m / 60} hour${m > 60 ? "s" : ""}` : m > 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`);
const PALETTE = ["c-green", "c-red", "c-violet", "c-teal", "c-amber", "c-blue"];
const colorFor = (t) => { let h = 0; for (const ch of String(t || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; };
const initials = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
function timeText(s) {
  let t = `${fmtTime(s.startUtc, s.tz)} – ${fmtTime(s.endUtc, s.tz)}`;
  if (s.end <= s.start) t += " (+1 day)";
  if (s.tz !== tz()) t += ` ${fmt(s.startUtc, s.tz, { timeZoneName: "short" }).split(" ").pop()}`;
  return t;
}
const FLAGS = { early: ["Early start", "c-amber"], overnight: ["Overnight", "c-violet"], conflict: ["Clash", "c-red"],
  back_to_back: ["Back-to-back", "c-amber"], unconfirmed: ["Unconfirmed", "c-amber"] };
function chips(s) {
  const out = s.status === "cancelled" ? ['<span class="chip c-red">Cancelled</span>'] : [];
  for (const f of C.flags(s, D.shifts)) if (FLAGS[f]) out.push(`<span class="chip ${FLAGS[f][1]}">${FLAGS[f][0]}</span>`);
  if (s.checkedIn) out.push('<span class="chip c-green">Checked in</span>');
  if (live(s) && s.endUtc > Date.now()) {
    if (s.cal === "added") out.push('<span class="chip c-teal">In Calendar</span>');
    if (s.cal === "stale") out.push('<span class="chip c-red">Calendar out of date</span>');
  }
  return out.join("");
}

// ---------------------------------------------------------------- calendar (.ics)
function b64u(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const icsFor = (list) => C.buildIcs(list, empName, Date.now());
/** A link that opens the calendar file; the iPhone then offers "Add to Calendar". */
function calHref(list) {
  const ics = icsFor(list);
  if (navigator.serviceWorker?.controller) return `calendar.ics?d=${b64u(ics)}`; // served by sw.js as text/calendar
  return "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
}
async function shareCalendarFile(list) {
  const name = list.length === 1 ? `shift-${list[0].date}.ics` : "shiftmate-shifts.ics";
  const file = new File([icsFor(list)], name, { type: "text/calendar" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "ShiftMate shifts" }); return true; } catch (e) { if (e.name === "AbortError") return false; }
  }
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(file), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  return true;
}
function markInCalendar(ids) {
  for (const s of D.shifts) if (ids.includes(s.id)) s.cal = "added";
  save();
}
const needsCalendar = () => sorted().filter((s) => live(s) && s.endUtc > Date.now() && s.cal !== "added");

// ---------------------------------------------------------------- state / router
const S = { tab: "home", day: null };
const NAV = { home: ["home", "Home"], schedule: ["cal", "Schedule"], hours: ["chart", "Hours"], settings: ["cog", "Settings"] };

function boot() {
  navigator.storage?.persist?.().catch(() => {});
  if (!D.profile) return showWelcome();
  showApp();
}
function showWelcome() {
  $$(".theme-pick").forEach((el) => (el.innerHTML = themePicker()));
  $("#app").hidden = true;
  $("#welcome").hidden = false;
}
$("#welcome-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target, name = f.name.value.trim();
  if (!name) return ($("#welcome-error").textContent = "Please enter your name.");
  D.profile = { name, type: f.type.value, tz: DEVICE_TZ };
  save();
  showApp();
  toast("Welcome! Tap + to add your first shift.");
});
function showApp() {
  $("#welcome").hidden = true;
  $("#app").hidden = false;
  const t = location.hash.slice(1);
  S.tab = NAV[t] ? t : "home";
  render();
}
window.addEventListener("hashchange", () => {
  const t = location.hash.slice(1);
  if (NAV[t] && t !== S.tab && D.profile) { S.tab = t; render(); scrollTo(0, 0); }
});
function renderNav() {
  for (const a of $$(".nav a")) {
    const [ic, label] = NAV[a.dataset.nav];
    a.innerHTML = `${icon(ic)}<span>${label}</span>`;
    if (a.dataset.nav === S.tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
}
function render() {
  if (!D.profile) return;
  renderNav();
  const v = $("#view");
  v.innerHTML = { home: homeView, schedule: scheduleView, hours: hoursView, settings: settingsView }[S.tab]();
  tick();
}

// ---------------------------------------------------------------- HOME
const nextShift = () => sorted().find((s) => live(s) && s.endUtc > Date.now());
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function homeView() {
  const p = D.profile, now = Date.now();
  const hour = Number(fmt(now, tz(), { hour: "numeric", hour12: false }));
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const nxt = nextShift();
  const upcoming = sorted().filter((s) => live(s) && s.endUtc > now && s !== nxt).slice(0, 8);
  const wk = C.weekBounds(now, tz());
  const used = C.minutesInRange(D.shifts, wk.start, wk.end);
  const weekShifts = D.shifts.filter((s) => live(s) && s.startUtc < wk.end && s.endUtc > wk.start);
  const pay = weekShifts.reduce((a, s) => a + (s.pay ? (s.pay * minutes(s)) / 60 : 0), 0);
  const hasPay = weekShifts.some((s) => s.pay);

  const attention = [];
  const missingCal = needsCalendar();
  if (missingCal.length) attention.push(`<div class="attn"><div class="ic c-teal">${icon("calplus")}</div>
      <div><b>${missingCal.length} shift${missingCal.length > 1 ? "s" : ""} not in your Calendar</b><span>Add ${missingCal.length > 1 ? "them" : "it"} so your iPhone reminds you</span></div>
      <a class="btn sm primary" href="${calHref(missingCal)}" data-cal="${missingCal.map((s) => s.id).join(",")}">Add</a></div>`);
  for (const s of sorted()) {
    if (!live(s) || s.endUtc < now) continue;
    const f = C.flags(s, D.shifts);
    const when = `${placeOf(s)} · ${fmt(s.startUtc, tz(), { weekday: "short", day: "numeric", month: "short" })}, ${timeText(s)}`;
    if (s.status === "unconfirmed") attention.push(attnRow("warn", "c-amber", "Confirm this shift", when, `data-act="confirm" data-id="${s.id}"`, "Confirm", true));
    if (f.includes("conflict")) attention.push(attnRow("warn", "c-red", "Clashes with another shift", when, `data-open="${s.id}"`, "View"));
    if (s.startUtc <= now && !s.checkedIn) attention.push(attnRow("check", "c-green", "Your shift has started", when, `data-act="checkin" data-id="${s.id}"`, "Check in", true));
  }
  const installTip = !isStandalone() ? `<div class="banner"><div class="ic">${icon("phone")}</div><div><b>Add ShiftMate to your Home Screen</b><br>
      <span class="small">${isIOS() ? "In Safari tap <b>Share</b> then <b>Add to Home Screen</b>." : "Use your browser menu → <b>Add to Home screen</b>."} It then opens like an app.</span></div></div>` : "";

  return `
  <header class="head">
    <div class="head-row"><p class="sub">${esc(fmt(now, tz(), { weekday: "long", day: "numeric", month: "long" }))}</p>
      <a class="avatar" href="#settings" aria-label="Settings">${esc(initials(p.name))}</a></div>
    <h1 class="greet">${hello},<br>${esc(p.name.split(" ")[0])}! <span aria-hidden="true">👋</span></h1>
  </header>
  <div class="body">
    <div id="next-card">${nextCard(nxt)}</div>
    ${upcoming.length ? `<div class="sec-title"><h2>Coming up</h2><a href="#schedule" aria-label="Open schedule">${icon("right")}</a></div>
      <div class="hscroll">${upcoming.map((s) => `<button class="mini" data-open="${s.id}">
        <div class="d">${s.date === C.addDays(today(), 1) ? "Tomorrow" : esc(dayName(s.date) + " " + shortDate(s.date))}</div>
        <div class="n">${esc(placeOf(s))}</div><div class="t">${esc(timeText(s))}</div>
        <div class="s-flags">${s.role ? `<span class="chip ${colorFor(s.role)}">${esc(s.role)}</span>` : ""}${chips(s)}</div></button>`).join("")}</div>` : ""}
    <div class="sec-title"><h2>This week</h2><a href="#hours" aria-label="Open hours">${icon("right")}</a></div>
    <div class="card">
      <div class="stats">
        <div class="stat"><div class="ic blue">${icon("clock")}</div><b>${hrs(used)}</b><span>Hours</span></div>
        <div class="stat"><div class="ic violet">${icon("cal")}</div><b>${weekShifts.length}</b><span>Shift${weekShifts.length === 1 ? "" : "s"}</span></div>
        <div class="stat"><div class="ic green">${icon("coin")}</div><b>${hasPay ? GBP.format(pay) : "–"}</b><span>${hasPay ? "Est. pay" : "Add pay rate"}</span></div>
      </div>
      ${p.type === "student" ? limitMeter(used) : ""}
    </div>
    ${attention.length ? `<div class="sec-title"><h2>Needs attention</h2></div><div class="card">${attention.slice(0, 6).join("")}</div>` : ""}
    ${installTip}
    <div class="spacer"></div>
  </div>
  <button class="fab" data-new aria-label="Add shift">${icon("plus")}</button>`;
}
function attnRow(ic, tone, title, sub, attrs, btn, primary) {
  return `<div class="attn"><div class="ic ${tone}">${icon(ic)}</div><div><b>${esc(title)}</b><span>${esc(sub)}</span></div>
    <button class="btn sm ${primary ? "primary" : ""}" ${attrs}>${btn}</button></div>`;
}
function limitMeter(used) {
  const limit = C.STUDENT_LIMIT_MIN, pct = Math.min(100, (used / limit) * 100);
  const cls = used >= limit ? "full" : used >= limit * 0.8 ? "warn" : "";
  return `<div class="limit"><div class="limit-row"><span>${icon("cap")} Student hours</span><span>${hrs(used)} / 20h</span></div>
    <div class="bar ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="20" aria-valuenow="${(used / 60).toFixed(1)}" aria-label="Hours used this week"><i style="width:${pct}%"></i></div>
    <span class="small muted">${used >= limit ? "You've reached your 20-hour limit for this week." : `${hrs(limit - used)} left this week. Resets Monday.`}</span></div>`;
}
function nextCard(s) {
  if (!s) return `<div class="next next-empty"><div class="empty" style="padding:1rem">${icon("cal")}<div><b>No upcoming shifts</b></div>
    <p class="small" style="margin:.3rem 0 .8rem">Add a shift and it can go straight into your Calendar with reminders.</p>
    <button class="btn primary" data-new>${icon("plus")} Add shift</button></div></div>`;
  const liveNow = Date.now() >= s.startUtc;
  const d = C.ymd(s.startUtc, tz());
  const label = d === today() ? "Today" : d === C.addDays(today(), 1) ? "Tomorrow" : dayName(d);
  return `<div class="next ${liveNow ? "live" : ""}" data-open="${s.id}" style="cursor:pointer">
    <div class="next-top"><div class="datebox"><span class="pill">${label}</span><b>${Number(d.slice(8))}</b><small>${dayName(d)}</small></div>
      <div><div class="where">${esc(placeOf(s))}${s.role && empName(s) ? ` • ${esc(s.role)}` : ""}</div>
        <div class="time">${esc(timeText(s))}</div>
        <div class="meta">${s.role ? `<span class="glass">${esc(s.role)}</span>` : ""}<span class="glass">${hrs(minutes(s))}</span>
          ${s.end <= s.start ? '<span class="glass">Overnight</span>' : ""}${s.status === "unconfirmed" ? '<span class="glass">Unconfirmed</span>' : ""}</div></div></div>
    <div class="cd-label">${liveNow ? "On shift now · ends in" : "Starts in"}</div>
    <div class="countdown" role="timer"><div><b id="cd-d">0</b><span>days</span></div><div><b id="cd-h">00</b><span>hrs</span></div>
      <div><b id="cd-m">00</b><span>min</span></div><div><b id="cd-s">00</b><span>sec</span></div></div></div>`;
}
let lastLive = null;
function tick() {
  const s = nextShift();
  if (!s || !$("#cd-d")) return;
  const now = Date.now(), liveNow = now >= s.startUtc;
  let x = Math.max(0, Math.floor(((liveNow ? s.endUtc : s.startUtc) - now) / 1000));
  const pad = (n) => String(n).padStart(2, "0");
  $("#cd-d").textContent = Math.floor(x / 86400); x %= 86400;
  $("#cd-h").textContent = pad(Math.floor(x / 3600)); x %= 3600;
  $("#cd-m").textContent = pad(Math.floor(x / 60)); $("#cd-s").textContent = pad(x % 60);
  const key = s.id + ":" + liveNow;
  if (lastLive !== null && lastLive !== key && !$("#sheet").open) render();
  lastLive = key;
}

// ---------------------------------------------------------------- SCHEDULE
function scheduleView() {
  S.day ??= today();
  const wk = C.mondayOf(S.day);
  const days = [...Array(7)].map((_, i) => C.addDays(wk, i));
  const byDay = {};
  for (const s of sorted()) (byDay[C.ymd(s.startUtc, tz())] ??= []).push(s);
  const w = C.weekBounds(C.localToUtc(wk, "12:00", tz()).ms, tz());
  const total = C.minutesInRange(D.shifts, w.start, w.end);
  return `
  <header class="head">
    <div class="head-row"><h1>Schedule</h1><button class="btn sm" data-day="${today()}" style="background:rgb(255 255 255 / .12);color:#fff">Today</button></div>
    <div class="week-nav"><button data-week="-7" aria-label="Previous week">${icon("left")}</button><span>${esc(monthName(S.day))}</span>
      <button data-week="7" aria-label="Next week">${icon("right")}</button></div>
    <div class="week">${days.map((d) => `<button class="day ${d === today() ? "today" : ""}" data-day="${d}" aria-pressed="${d === S.day}" aria-label="${esc(dayName(d, "long"))} ${Number(d.slice(8))}">
      <small>${dayName(d).slice(0, 1)}</small><b>${Number(d.slice(8))}</b><span class="dots">${(byDay[d] || []).filter(live).slice(0, 3).map(() => "<i></i>").join("")}</span></button>`).join("")}</div>
    <div class="week-total"><span>Week total</span><b>${hrs(total)}${D.profile.type === "student" ? " of 20h" : ""}</b></div>
  </header>
  <div class="body">
    ${days.filter((d) => d >= S.day).map((d) => `<div class="dayhead"><b>${Number(d.slice(8))}</b><span>${dayName(d)}</span>${d === today() ? "<em>Today</em>" : ""}</div>
      ${(byDay[d] || []).map(shiftRow).join("") || `<div class="dayoff">${icon("palm")} Day off</div>`}`).join("")}
    <div class="spacer"></div>
  </div>
  <button class="fab" data-new aria-label="Add shift">${icon("plus")}</button>`;
}
function shiftRow(s) {
  const name = placeOf(s);
  return `<button class="shift ${live(s) ? "" : "cancelled"}" data-open="${s.id}">
    <span class="badge-ic ${colorFor(name)}">${esc(name[0] || "?")}</span>
    <span><span class="s-name">${esc(name)}</span><span class="s-time" style="display:block">${esc(timeText(s))} · ${hrs(minutes(s))}</span><span class="s-flags">${chips(s)}</span></span>
    ${s.role ? `<span class="chip ${colorFor(s.role)}">${esc(s.role)}</span>` : "<span></span>"}</button>`;
}

// ---------------------------------------------------------------- HOURS
function hoursView() {
  const z = tz(), student = D.profile.type === "student";
  const thisMon = C.mondayOf(today());
  const weeks = [];
  for (let i = -8; i <= 4; i++) {
    const mon = C.addDays(thisMon, i * 7);
    const start = C.localToUtc(mon, "00:00", z).ms, end = C.localToUtc(C.addDays(mon, 7), "00:00", z).ms;
    const list = D.shifts.filter((s) => live(s) && s.startUtc < end && s.endUtc > start);
    const mins = C.minutesInRange(D.shifts, start, end);
    const pay = list.reduce((a, s) => a + (s.pay ? (s.pay * C.overlapMin(s.startUtc, s.endUtc, start, end)) / 60 : 0), 0);
    weeks.push({ mon, mins, count: list.length, pay, current: i === 0, future: i > 0 });
  }
  const scale = Math.max(student ? 1200 : 0, ...weeks.map((w) => w.mins), 60);
  const past = weeks.filter((w) => !w.future && !w.current);
  const avg = past.length ? past.reduce((a, w) => a + w.mins, 0) / past.length : 0;
  const totalPay = weeks.filter((w) => !w.future).reduce((a, w) => a + w.pay, 0);
  return `
  <header class="head"><div class="head-row"><h1>Hours</h1></div>
    <p class="sub" style="margin-top:.4rem">${student ? "Students: up to 20 hours each week (Monday–Sunday)." : "Your weekly hours and pay."}</p></header>
  <div class="body">
    <div class="card" style="margin-top:1rem"><div class="stats">
      <div class="stat"><div class="ic blue">${icon("clock")}</div><b>${hrs(weeks.find((w) => w.current).mins)}</b><span>This week</span></div>
      <div class="stat"><div class="ic violet">${icon("chart")}</div><b>${hrs(Math.round(avg))}</b><span>Avg (8 wks)</span></div>
      <div class="stat"><div class="ic green">${icon("coin")}</div><b>${totalPay ? GBP.format(totalPay) : "–"}</b><span>Pay (9 wks)</span></div>
    </div></div>
    <div class="sec-title"><h2>Week by week</h2></div>
    <div class="card">${[...weeks.filter((w) => w.current), ...weeks.filter((w) => w.future), ...weeks.filter((w) => !w.current && !w.future).reverse()].map((w) => {
      const pct = Math.min(100, (w.mins / scale) * 100);
      const cls = student && w.mins > 1200 ? "full" : student && w.mins >= 960 ? "warn" : "";
      return `<div class="wk ${w.current ? "cur" : ""}">
        <div class="wk-top"><span>${w.current ? "<b>This week</b>" : `Week of ${esc(shortDate(w.mon))}`}${w.future ? ' <span class="chip c-blue">Upcoming</span>' : ""}</span>
          <span><b>${hrs(w.mins)}</b>${w.count ? ` · ${w.count} shift${w.count > 1 ? "s" : ""}` : ""}${w.pay ? ` · ${GBP.format(w.pay)}` : ""}</span></div>
        <div class="bar ${cls}" style="position:relative">${student ? `<span class="limit-line" style="left:${(1200 / scale) * 100}%"></span>` : ""}<i style="width:${pct}%"></i></div></div>`;
    }).join("")}
    ${student ? '<p class="small muted" style="margin:.6rem 0 0">The line marks 20 hours.</p>' : ""}</div>
    <div class="spacer"></div>
  </div>`;
}

// ---------------------------------------------------------------- SETTINGS
function themePicker() {
  const cur = window.getTheme();
  return [["light", "sun", "Light"], ["dark", "moon", "Dark"], ["auto", "phone", "Auto"]].map(([v, ic, l]) =>
    `<button type="button" role="radio" aria-checked="${cur === v}" data-theme-set="${v}">${icon(ic)}<span>${l}</span></button>`).join("");
}
function settingsView() {
  const p = D.profile, student = p.type === "student";
  const missing = needsCalendar();
  return `
  <header class="head"><div class="head-row"><h1>Settings</h1></div>
    <div class="profile"><span class="avatar lg">${esc(initials(p.name))}</span>
      <div><b>${esc(p.name)}</b><span>Stored only on this phone</span><br><span class="chip ${student ? "c-violet" : "c-blue"}" style="margin-top:.3rem">${student ? "Student · 20h/week" : "Worker"}</span></div></div>
  </header>
  <div class="body">
    <div class="group"><h3>You</h3><div class="card">
      <label class="row stack"><span class="txt"><b>Name</b></span><input class="input" id="p-name" value="${esc(p.name)}" maxlength="40"></label>
      <div class="row" style="display:block"><div class="txt" style="margin-bottom:.5rem"><b>I am a…</b><span>Students can't add shifts that take any week over 20 hours.</span></div>
        <div class="type-pick" style="margin:0">
          <label class="type-opt"><input type="radio" name="p-type" value="student" ${student ? "checked" : ""}><span><b>${icon("cap")} Student</b><small>20 hours a week max</small></span></label>
          <label class="type-opt"><input type="radio" name="p-type" value="worker" ${!student ? "checked" : ""}><span><b>${icon("bag")} Worker</b><small>No weekly limit</small></span></label></div></div>
      <div class="row"><div class="txt"></div><button class="btn primary sm" data-save-profile>Save</button></div>
    </div></div>

    <div class="group"><h3>Reminders (iPhone Calendar)</h3><div class="card">
      <div class="row" style="display:block"><div class="txt"><b>Default reminders for new shifts</b><span>Each becomes an alert on the Calendar event.</span></div>
        <div class="presets" style="margin-top:.6rem">${PRESETS.map((m) => `<button type="button" class="preset" data-defrem="${m}" aria-pressed="${D.settings.defaultReminders.includes(m)}">${remShort(m)}</button>`).join("")}</div></div>
      <div class="row"><div class="ic c-teal">${icon("calplus")}</div><div class="txt"><b>Add upcoming shifts to Calendar</b><span>${missing.length ? `${missing.length} not added yet` : "All upcoming shifts are in your Calendar"}</span></div>
        ${missing.length ? `<a class="btn sm primary" href="${calHref(missing)}" data-cal="${missing.map((s) => s.id).join(",")}">Add</a>` : ""}</div>
      <details class="howto"><summary>How Calendar reminders work</summary><ul>
        <li>Tap <b>Add to Calendar</b> on a shift, then <b>Add All</b> in the window that opens. Your iPhone then alerts you at each reminder time, even when ShiftMate is closed.</li>
        <li>If nothing opens, use <b>Save calendar file</b> instead, then open the file and tap <b>Add All</b>.</li>
        <li>Make sure alerts are on: iPhone <b>Settings → Notifications → Calendar → Allow Notifications</b>.</li>
        <li>If you <b>change or cancel</b> a shift, delete the old event in the Calendar app, then add the shift again.</li>
        <li>While ShiftMate is open, it also shows reminders on screen.</li></ul></details>
    </div></div>

    <div class="group"><h3>Appearance</h3><div class="card" style="padding:1rem"><div class="theme-pick" role="radiogroup" aria-label="Theme">${themePicker()}</div></div></div>

    <div class="group"><h3>Employers</h3><div class="card">
      ${D.employers.length ? D.employers.map((e) => `<div class="row"><span class="badge-ic ${colorFor(e.name)}" style="width:36px;height:36px;border-radius:10px">${esc(e.name[0])}</span>
        <div class="txt"><b>${esc(e.name)}</b><span>${esc(e.address || "No address")}</span></div>
        <button class="del-emp btn sm" data-del-emp="${e.id}" aria-label="Remove ${esc(e.name)}">${icon("trash")}</button></div>`).join("") : '<div class="row"><div class="txt"><span>Add employers when you add a shift.</span></div></div>'}
    </div></div>

    <div class="group"><h3>Backup</h3><div class="card">
      <div class="row"><div class="ic c-blue">${icon("down")}</div><div class="txt"><b>Save a backup</b><span>Your data is only on this phone. Save a backup to Files or iCloud now and then.</span></div>
        <button class="btn sm" data-export>Save</button></div>
      <div class="row"><div class="ic c-violet">${icon("up")}</div><div class="txt"><b>Restore from backup</b><span>Replaces what's on this phone</span></div>
        <button class="btn sm" data-import>Restore</button></div>
      <div class="row"><div class="ic c-red">${icon("trash")}</div><div class="txt"><b>Erase all data</b><span>Deletes every shift and setting from this phone</span></div>
        <button class="btn sm danger" data-erase>Erase</button></div>
    </div></div>
    <p class="small muted" style="text-align:center;margin:1.2rem 0 0">ShiftMate · stored on this device only</p>
    <div class="spacer"></div>
  </div>`;
}

// ---------------------------------------------------------------- sheets
const sheet = $("#sheet");
function openSheet(html) {
  $("#sheet-body").innerHTML = `<div class="sheet-inner"><div class="grabber"></div>${html}</div>`;
  if (!sheet.open) sheet.showModal();
}
sheet.addEventListener("click", (e) => { if (e.target === sheet || e.target.closest("[data-close]")) sheet.close(); });

function calButtons(list, label = "Add to Calendar") {
  const ids = list.map((s) => s.id).join(",");
  return `<div class="sheet-actions"><a class="btn primary" href="${calHref(list)}" data-cal="${ids}">${icon("calplus")} ${label}</a></div>
    <div class="sheet-actions"><button class="btn" data-calfile="${ids}">${icon("share")} Save calendar file</button></div>`;
}
function shiftDetail(id) {
  const s = D.shifts.find((x) => x.id === id);
  if (!s) return;
  const now = Date.now(), started = s.startUtc <= now, past = s.endUtc < now;
  const addr = s.address || emp(s)?.address;
  const calState = !live(s) || past ? "" : s.cal === "stale"
    ? `<div class="warnbox" style="margin-bottom:.6rem">You changed this shift after adding it to your Calendar. Delete the old event in the Calendar app, then add it again.</div>${calButtons([s], "Add updated shift")}`
    : s.cal === "added" ? `<p class="small muted" style="margin:0 0 .4rem">${icon("check")} In your Calendar. Your iPhone will remind you.</p>
        <div class="sheet-actions"><button class="btn" data-calfile="${s.id}">${icon("share")} Save calendar file again</button></div>`
    : calButtons([s]);
  openSheet(`
    <h2 id="sheet-title">${esc(placeOf(s))}<button data-close aria-label="Close">${icon("x")}</button></h2>
    <div class="s-flags" style="margin:-.5rem 0 1rem">${s.role ? `<span class="chip ${colorFor(s.role)}">${esc(s.role)}</span>` : ""}${chips(s)}</div>
    <div class="detail-list">
      <div>${icon("cal")}<span>${esc(fmt(s.startUtc, s.tz, { weekday: "long", day: "numeric", month: "long" }))}</span></div>
      <div>${icon("clock")}<span>${esc(timeText(s))} · ${hrs(minutes(s))}</span></div>
      ${addr ? `<div>${icon("pin")}<span>${esc(addr)}</span></div>` : ""}
      ${s.pay ? `<div>${icon("coin")}<span>${GBP2.format(s.pay)}/h · about ${GBP.format((s.pay * minutes(s)) / 60)}</span></div>` : ""}
      ${s.notes ? `<div>${icon("list")}<span>${esc(s.notes)}</span></div>` : ""}
      <div>${icon("bell")}<span>${s.reminders.length ? s.reminders.map((m) => `${esc(remShort(m))} before`).join(", ") : "No reminders"}</span></div>
    </div>
    ${calState}
    ${!live(s) || past ? `<div class="sheet-actions"><button class="btn danger" data-act="delete" data-id="${s.id}">${icon("trash")} Delete</button></div>` : `
    <div class="sheet-actions">
      ${s.status === "unconfirmed" ? `<button class="btn" data-act="confirm" data-id="${s.id}">${icon("check")} Confirm</button>` : ""}
      ${started && !s.checkedIn ? `<button class="btn" data-act="checkin" data-id="${s.id}">${icon("check")} Check in</button>` : ""}
      <button class="btn" data-edit="${s.id}">Edit</button></div>
    <div class="sheet-actions"><button class="btn danger" data-act="cancel" data-id="${s.id}">Cancel shift</button>
      <button class="btn danger" data-act="delete" data-id="${s.id}">${icon("trash")} Delete</button></div>`}`);
}

let formRems = [], editing = null;
function remEditor() {
  const box = $("#form-rems");
  box.innerHTML = `<div class="presets">${PRESETS.map((m) => `<button type="button" class="preset" data-rem="${m}" aria-pressed="${formRems.includes(m)}">${remShort(m)}</button>`).join("")}</div>
    ${formRems.filter((m) => !PRESETS.includes(m)).map((m) => `<span class="chip c-blue" style="margin:0 .3rem .4rem 0">${remShort(m)} <button type="button" data-rem="${m}" aria-label="Remove" style="border:0;background:none;color:inherit;cursor:pointer">✕</button></span>`).join("")}
    <div class="custom-add"><span class="muted">Custom:</span><input type="number" min="1" value="45" class="c-v" aria-label="Custom amount">
      <select class="c-u" aria-label="Custom unit"><option>minutes</option><option>hours</option><option>days</option></select>
      <button type="button" class="btn sm" data-remadd>Add</button></div>`;
}
function shiftForm(shift, presetDay) {
  editing = shift || null;
  const d = shift ? shift.date : presetDay || C.addDays(today(), 1);
  formRems = shift ? [...shift.reminders] : [...D.settings.defaultReminders];
  const zones = Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : [DEVICE_TZ];
  const curTz = shift ? shift.tz : tz();
  if (!zones.includes(curTz)) zones.unshift(curTz);
  openSheet(`
    <h2 id="sheet-title">${shift ? "Edit shift" : "Add shift"}<button type="button" data-close aria-label="Close">${icon("x")}</button></h2>
    <form id="shift-form" novalidate>
      <label class="field"><span>Employer</span><select name="employer">
        <option value="">None</option>${D.employers.map((e) => `<option value="${e.id}" ${shift?.employerId === e.id ? "selected" : ""}>${esc(e.name)}</option>`).join("")}
        <option value="new" ${!D.employers.length && !shift ? "selected" : ""}>+ Add a new employer…</option></select></label>
      <div class="grid2" id="new-emp" ${!D.employers.length && !shift ? "" : "hidden"}>
        <label class="field"><span>Employer name</span><input name="new_emp" maxlength="60"></label>
        <label class="field"><span>Address</span><input name="new_addr"></label></div>
      <div class="grid2">
        <label class="field"><span>Role</span><input name="role" placeholder="e.g. Barista" value="${esc(shift?.role || "")}" maxlength="40"></label>
        <label class="field"><span>Pay per hour (£)</span><input name="pay" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Optional" value="${shift?.pay ?? ""}"></label></div>
      <div class="grid3">
        <label class="field"><span>Date</span><input type="date" name="date" value="${d}" required></label>
        <label class="field"><span>Start</span><input type="time" name="start" value="${shift?.start || "09:00"}" required></label>
        <label class="field"><span>End</span><input type="time" name="end" value="${shift?.end || "17:00"}" required></label></div>
      <p class="hint" id="len-hint"></p>
      <label class="field"><span>Status</span><select name="status">
        <option value="confirmed" ${shift?.status !== "unconfirmed" ? "selected" : ""}>Confirmed</option>
        <option value="unconfirmed" ${shift?.status === "unconfirmed" ? "selected" : ""}>Not confirmed yet</option></select></label>
      <details class="more"><summary>More details</summary>
        <label class="field"><span>Workplace address</span><input name="address" placeholder="Leave blank to use the employer's" value="${esc(shift?.address || "")}"></label>
        <label class="field"><span>Preparation notes</span><textarea name="notes" rows="2" placeholder="e.g. Bring ID badge">${esc(shift?.notes || "")}</textarea></label>
        <label class="field"><span>Time zone</span><select name="tz">${zones.map((z) => `<option ${z === curTz ? "selected" : ""}>${esc(z)}</option>`).join("")}</select></label>
      </details>
      <div class="field"><span>Reminders</span><div id="form-rems"></div></div>
      <p class="form-error" id="form-error" role="alert"></p>
      <div class="sheet-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">${shift ? "Save changes" : "Add shift"}</button></div>
    </form>`);
  const f = $("#shift-form");
  remEditor();
  f.employer.onchange = () => { $("#new-emp").hidden = f.employer.value !== "new"; };
  ["date", "start", "end", "tz"].forEach((n) => f[n].addEventListener("input", () => lengthHint(f)));
  lengthHint(f);
  f.addEventListener("submit", saveShift);
}
function lengthHint(f) {
  const el = $("#len-hint");
  if (!f.date.value || !f.start.value || !f.end.value) return (el.textContent = "");
  const r = C.resolveShift(f.date.value, f.start.value, f.end.value, f.tz.value);
  let text = `${hrs(r.minutes)} shift${r.overnight ? ", ends the next day" : ""}.`;
  el.className = "hint";
  if (D.profile.type === "student") {
    const w = C.weekBounds(r.startUtc, tz());
    const used = C.minutesInRange(D.shifts, w.start, w.end, editing?.id);
    const add = C.overlapMin(r.startUtc, r.endUtc, w.start, w.end);
    text += ` That week: ${hrs(used)} booked → ${hrs(used + add)} of 20h.`;
    const problem = C.checkWeeklyLimit(D.profile, D.shifts, r, editing?.id);
    if (problem) { el.className = "hint bad"; text += " Over the student limit."; }
    else if (used + add > 960) el.className = "hint warn";
  }
  el.textContent = text + (r.warnings.length ? " " + r.warnings.join(" ") : "");
}
function saveShift(e) {
  e.preventDefault();
  const f = e.target, err = $("#form-error");
  err.textContent = "";
  if (!f.date.value || !f.start.value || !f.end.value) return (err.textContent = "Please fill in the date, start and end.");
  if (f.start.value === f.end.value) return (err.textContent = "Start and end can't be the same time.");
  const pay = f.pay.value === "" ? null : Number(f.pay.value);
  if (pay !== null && !(pay >= 0 && pay <= 10000)) return (err.textContent = "Pay per hour doesn't look right.");
  const r = C.resolveShift(f.date.value, f.start.value, f.end.value, f.tz.value);
  const problem = C.checkWeeklyLimit(D.profile, D.shifts, r, editing?.id);
  if (problem) return (err.textContent = problem);
  let employerId = f.employer.value && f.employer.value !== "new" ? Number(f.employer.value) : null;
  if (f.employer.value === "new") {
    const name = f.new_emp.value.trim();
    if (!name) return (err.textContent = "Please enter the employer's name.");
    const existing = D.employers.find((x) => x.name.toLowerCase() === name.toLowerCase());
    employerId = existing ? existing.id : (D.employers.push({ id: newId(), name, address: f.new_addr.value.trim() || null }), D.employers.at(-1).id);
  }
  const data = {
    employerId, role: f.role.value.trim() || null, pay, date: f.date.value, start: f.start.value, end: f.end.value, tz: f.tz.value,
    startUtc: r.startUtc, endUtc: r.endUtc, status: f.status.value, address: f.address.value.trim() || null,
    notes: f.notes.value.trim() || null, reminders: [...new Set(formRems)].sort((a, b) => b - a),
  };
  let s;
  if (editing) {
    s = editing;
    const changed = ["startUtc", "endUtc", "reminders", "address", "notes", "employerId", "role", "status"].some((k) => JSON.stringify(s[k]) !== JSON.stringify(data[k]));
    Object.assign(s, data, { updated: Date.now() });
    if (s.startUtc > Date.now()) s.checkedIn = false;
    if (changed && s.cal === "added") s.cal = "stale";
  } else {
    s = { id: newId(), uid: uid(), ...data, checkedIn: false, cal: "none", created: Date.now() };
    D.shifts.push(s);
  }
  if (!save()) return;
  S.day = s.date;
  render();
  shiftDetail(s.id); // straight to "Add to Calendar"
  toast(r.warnings.length ? r.warnings.join(" ") : editing ? "Shift updated" : "Shift added");
}

// ---------------------------------------------------------------- backup
async function exportBackup() {
  const json = JSON.stringify({ app: "ShiftMate", exported: new Date().toISOString(), data: D }, null, 2);
  const name = `shiftmate-backup-${today()}.json`;
  const file = new File([json], name, { type: "application/json" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "ShiftMate backup" }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(file), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
$("#import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const data = parsed.data || parsed;
    const ok = data && data.version === 1 && Array.isArray(data.shifts) && Array.isArray(data.employers) && data.profile;
    if (!ok) throw new Error("That file isn't a ShiftMate backup.");
    for (const s of data.shifts) {
      if (typeof s.startUtc !== "number" || typeof s.endUtc !== "number" || typeof s.id !== "number") throw new Error("The backup file is damaged.");
      s.reminders = Array.isArray(s.reminders) ? s.reminders.filter((m) => Number.isInteger(m) && m > 0) : [];
    }
    if (!confirm(`Restore ${data.shifts.length} shifts from this backup? Everything currently on this phone will be replaced.`)) return;
    D = { ...blank(), ...data };
    save();
    render();
    toast("Backup restored");
  } catch (ex) { toast(ex.message || "Couldn't read that file.", true); }
});

// ---------------------------------------------------------------- in-app reminders (while open)
let lastCheck = Date.now();
function checkReminders() {
  const now = Date.now();
  for (const s of D.shifts) {
    if (!live(s) || s.startUtc <= lastCheck) continue;
    for (const m of s.reminders) {
      const at = s.startUtc - m * C.MIN;
      if (at > lastCheck && at <= now) {
        toast(`<b>${esc(placeOf(s))} in ${esc(remShort(m))}</b>Your shift starts at ${esc(fmtTime(s.startUtc, s.tz))}. Time to get ready!`, false, true);
        beep();
      }
    }
  }
  lastCheck = now;
}

// ---------------------------------------------------------------- events
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-theme-set]");
  if (b) { window.setTheme(b.dataset.themeSet); $$(".theme-pick").forEach((el) => (el.innerHTML = themePicker())); }
});
document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-new],[data-open],[data-edit],[data-act],[data-day],[data-week],[data-cal],[data-calfile],[data-rem],[data-remadd],[data-defrem],[data-save-profile],[data-del-emp],[data-export],[data-import],[data-erase]");
  if (!t || !D.profile) return;
  const d = t.dataset;
  if (d.cal) {
    // Let the link open the calendar file; just remember these shifts were added.
    const ids = d.cal.split(",").map(Number);
    markInCalendar(ids);
    setTimeout(() => { render(); if (sheet.open) sheet.close(); toast("In the Calendar window, tap Add All. If nothing opened, use Save calendar file."); }, 400);
    return;
  }
  e.preventDefault();
  if ("new" in d) return shiftForm(null, S.tab === "schedule" && S.day >= today() ? S.day : null);
  if (d.open) return shiftDetail(Number(d.open));
  if (d.edit) return shiftForm(D.shifts.find((s) => s.id === Number(d.edit)));
  if (d.day) { S.day = d.day; return render(); }
  if (d.week) { S.day = C.addDays(S.day, Number(d.week)); return render(); }
  if (d.calfile) {
    const ids = d.calfile.split(",").map(Number);
    if (await shareCalendarFile(D.shifts.filter((s) => ids.includes(s.id)))) {
      markInCalendar(ids); render(); if (sheet.open) sheet.close();
      toast("Open the file and tap Add All to put it in your Calendar.");
    }
    return;
  }
  if (d.rem) {
    const m = Number(d.rem);
    formRems = formRems.includes(m) ? formRems.filter((x) => x !== m) : [...formRems, m];
    return remEditor();
  }
  if ("remadd" in d) {
    const box = $("#form-rems");
    const m = Math.round(Number($(".c-v", box).value) * { minutes: 1, hours: 60, days: 1440 }[$(".c-u", box).value]);
    if (!(m >= 1 && m <= 14 * 1440)) return toast("Reminders can be from 1 minute to 14 days before.", true);
    if (!formRems.includes(m)) formRems.push(m);
    return remEditor();
  }
  if (d.defrem) {
    const m = Number(d.defrem), cur = D.settings.defaultReminders;
    D.settings.defaultReminders = cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m].sort((a, b) => b - a);
    save();
    t.setAttribute("aria-pressed", String(D.settings.defaultReminders.includes(m)));
    return;
  }
  if ("saveProfile" in d) {
    const name = $("#p-name").value.trim();
    if (!name) return toast("Please enter your name.", true);
    const type = $("input[name=p-type]:checked").value;
    D.profile = { ...D.profile, name, type };
    save(); render();
    if (type === "student") {
      const over = [];
      for (let i = 0; i <= 8; i++) {
        const w = C.weekBounds(Date.now() + i * 7 * C.DAY, tz());
        if (C.minutesInRange(D.shifts, w.start, w.end) > C.STUDENT_LIMIT_MIN) over.push(shortDate(w.monday));
      }
      if (over.length) return toast(`Saved. The week${over.length > 1 ? "s" : ""} of ${over.join(", ")} already ${over.length > 1 ? "have" : "has"} more than 20h. Remove shifts there to get under the limit.`, true);
    }
    return toast("Saved");
  }
  if (d.delEmp) {
    const id = Number(d.delEmp), used = D.shifts.some((s) => s.employerId === id);
    if (!confirm(used ? "Remove this employer? Their shifts stay, but without an employer name." : "Remove this employer?")) return;
    D.employers = D.employers.filter((x) => x.id !== id);
    for (const s of D.shifts) if (s.employerId === id) s.employerId = null;
    save(); return render();
  }
  if ("export" in d) return exportBackup();
  if ("import" in d) return $("#import-file").click();
  if ("erase" in d) {
    if (!confirm("Erase all ShiftMate data from this phone? This can't be undone. Events already in your Calendar stay there.")) return;
    localStorage.removeItem(KEY);
    D = blank();
    if (sheet.open) sheet.close();
    return showWelcome();
  }
  if (d.act) {
    const s = D.shifts.find((x) => x.id === Number(d.id));
    if (!s) return;
    const inCal = s.cal === "added" || s.cal === "stale";
    if (d.act === "confirm") { s.status = "confirmed"; if (s.cal === "added") s.cal = "stale"; toast("Shift confirmed"); }
    if (d.act === "checkin") { s.checkedIn = true; toast("Checked in. Have a good shift!"); }
    if (d.act === "cancel") {
      if (!confirm("Cancel this shift?")) return;
      s.status = "cancelled";
      toast(inCal ? "Shift cancelled. Also delete it from your Calendar so you don't get reminders." : "Shift cancelled", inCal);
    }
    if (d.act === "delete") {
      if (!confirm("Delete this shift?")) return;
      D.shifts = D.shifts.filter((x) => x !== s);
      toast(inCal && s.endUtc > Date.now() ? "Deleted. Also delete it from your Calendar so you don't get reminders." : "Shift deleted", inCal);
    }
    save();
    if (sheet.open) sheet.close();
    render();
  }
});

// ---------------------------------------------------------------- misc
function toast(msg, isErr = false, html = false) {
  const t = document.createElement("div");
  t.className = "toast" + (isErr ? " err" : "");
  t.setAttribute("role", isErr ? "alert" : "status");
  if (html) t.innerHTML = msg; else t.textContent = msg;
  $("#toasts").appendChild(t);
  setTimeout(() => t.remove(), html ? 10000 : 5000);
}
let audio;
function beep() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880; g.gain.setValueAtTime(0.0001, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, audio.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.6);
    o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.65);
  } catch (_) {}
}

// Another tab or the restored app changed the data: reload it.
window.addEventListener("storage", (e) => { if (e.key === KEY) { D = loadData(); D.profile ? render() : showWelcome(); } });
document.addEventListener("visibilitychange", () => { if (!document.hidden && D.profile && !sheet.open) { checkReminders(); render(); } });
setInterval(tick, 1000);
setInterval(checkReminders, 20000);
if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
  // Once the offline helper takes over, re-draw so calendar links use it.
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (D.profile && !sheet.open) render(); });
}
boot();
