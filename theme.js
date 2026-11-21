// Applies the saved theme before the page paints (no flash of the wrong theme).
// "auto" follows the device; "light"/"dark" override it. Stored per browser.
(function () {
  var t = "auto";
  try { t = localStorage.getItem("sm-theme") || "auto"; } catch (e) {}
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  window.setTheme = function (v) {
    try { localStorage.setItem("sm-theme", v); } catch (e) {}
    if (v === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", v);
    var dark = v === "dark" || (v === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", dark ? "#0a0d29" : "#11143a");
  };
  window.getTheme = function () { try { return localStorage.getItem("sm-theme") || "auto"; } catch (e) { return "auto"; } };
})();
