// Shared across every after-hours-*.html reel page: the persistent
// white circle button that fades the theater back up and returns to
// mess.html. Mirrors lights-out.js's dim-and-close, just reversed —
// the bars open, the vignette fades, and a white scrim rises over
// everything, so the swap back into mess.html (which is always
// sitting there bright) reads as one continuous fade rather than a cut.
//
// Also remembers where you were: which piece and how far scrolled into
// it, saved to localStorage right before navigating away. lights-out.js
// reads this back on the way in, so turning the lights back off lands
// you on the same piece at the same spot instead of restarting at the
// first reel every time — but only within that same visit. Two things
// clear it instead: reaching the true end of the last piece (see the
// ah-complete flag after-hours-4.js sets), and going all the way back
// to the landing page (see the resume-clear in script.js) — either one
// means the next lights-off should start over from the first reel.

(function () {
  "use strict";

  var btn = document.getElementById("ah-lights-on");
  var scrim = document.getElementById("ah-lights-on-scrim");
  if (!btn) return;

  var firing = false;

  btn.addEventListener("click", function () {
    if (firing) return;
    firing = true;

    try {
      if (document.body.dataset.ahComplete === "1") {
        // Finished the whole reel this visit — don't save a spot to
        // resume, and clear out anything saved from earlier in the
        // session so the next lights-off starts fresh at piece one.
        localStorage.removeItem("ahResume");
      } else {
        var page = window.location.pathname.split("/").pop() || "lightsoff1.html";
        localStorage.setItem(
          "ahResume",
          JSON.stringify({ page: page, scrollY: window.scrollY })
        );
      }
    } catch (e) {
      // Storage unavailable (private browsing, etc.) — just skip the
      // resume feature rather than breaking the transition.
    }

    document.body.classList.add("ah-lights-on-active");
    if (scrim) scrim.classList.add("active");

    setTimeout(function () {
      window.location.href = "mess.html";
    }, 1500);
  });
})();
