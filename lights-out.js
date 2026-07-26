// explosion.html only: the hidden lightswitch. Clicking it dims the
// whole page to black and closes the letterbox bars in, then hands off
// to after-hours.html once that finishes — after-hours.html starts
// already in the dark/letterboxed state, so the page swap underneath
// is invisible and the whole thing reads as one continuous reveal
// rather than a navigation.

(function () {
  "use strict";

  var toggle = document.getElementById("lightswitch");
  var overlay = document.getElementById("lights-out");
  if (!toggle || !overlay) return;

  var firing = false;

  toggle.addEventListener("click", function () {
    if (firing) return;
    firing = true;
    overlay.classList.add("active");

    // If a reel page was left via its own "lights back on" button, it
    // saved which piece and how far scrolled — pick that back up
    // instead of always starting over at the first reel.
    var dest = "after-hours.html";
    try {
      var saved = localStorage.getItem("ahResume");
      if (saved) {
        var resume = JSON.parse(saved);
        if (resume && resume.page) dest = resume.page;
      }
    } catch (e) {
      // Fall back to the default first-reel destination.
    }

    // The scrim fade (1.1s) and the bar close (starts 0.3s in, takes 1s
    // — so finishes at 1.3s) overlap on purpose, staggered slightly so
    // the dim reads first and the bars close in over/after it rather
    // than both snapping at once. Navigate once both are done.
    setTimeout(function () {
      window.location.href = dest;
    }, 1500);
  });
})();
