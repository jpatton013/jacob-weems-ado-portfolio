// Shared across every after-hours-*.html reel page: the persistent
// white circle button that fades the theater back up and returns to
// explosion.html. Mirrors lights-out.js's dim-and-close, just reversed —
// the bars open, the vignette fades, and a white scrim rises over
// everything, so the swap back into explosion.html (which is always
// sitting there bright) reads as one continuous fade rather than a cut.

(function () {
  "use strict";

  var btn = document.getElementById("ah-lights-on");
  var scrim = document.getElementById("ah-lights-on-scrim");
  if (!btn) return;

  var firing = false;

  btn.addEventListener("click", function () {
    if (firing) return;
    firing = true;

    document.body.classList.add("ah-lights-on-active");
    if (scrim) scrim.classList.add("active");

    setTimeout(function () {
      window.location.href = "explosion.html";
    }, 1500);
  });
})();
