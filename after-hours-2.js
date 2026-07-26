// after-hours-2.html only: same scroll-scrub setup as after-hours.js,
// pointed at the second piece's 38 frames. There's no finished film for
// this piece yet, and no countdown either (that's piece-1-only, since
// it's the only reel with something to actually count down into) — once
// scrolling reaches the last frame it just tries videos/reel-2.mp4
// directly; if that file isn't there yet (or fails to load), it fails
// quietly into a "more soon" caption instead of getting stuck or
// throwing.

(function () {
  "use strict";

  var spacer = document.getElementById("ah-spacer");
  var viewport = document.getElementById("ah-viewport");
  var frameImg = document.getElementById("ah-frame");
  var video = document.getElementById("ah-video");
  var soundBtn = document.getElementById("ah-sound-btn");
  if (!spacer || !viewport || !frameImg) return;

  var FRAME_COUNT = 38;
  var SCRUB_FRACTION = 0.75;

  function frameSrc(n) {
    var padded = String(n).padStart(3, "0");
    return "images/reel-2/frame-" + padded + ".jpg";
  }

  var preloaded = {};
  function preload(n) {
    if (n < 1 || n > FRAME_COUNT || preloaded[n]) return;
    preloaded[n] = true;
    var img = new Image();
    img.src = frameSrc(n);
  }

  var currentFrame = 0;
  function showFrame(n) {
    n = Math.max(1, Math.min(FRAME_COUNT, n));
    if (n === currentFrame) return;
    currentFrame = n;
    frameImg.src = frameSrc(n);
    for (var i = n; i <= n + 6; i++) preload(i);
  }

  // ---- "more soon" caption, shown if there's no video to land on yet ----
  var comingSoon = null;
  function showComingSoon() {
    if (comingSoon) return;
    comingSoon = document.createElement("p");
    comingSoon.textContent = "the film for this one is still coming — check back soon";
    comingSoon.style.position = "absolute";
    comingSoon.style.left = "50%";
    comingSoon.style.top = "50%";
    comingSoon.style.transform = "translate(-50%, -50%)";
    comingSoon.style.zIndex = "55";
    comingSoon.style.fontSize = "0.8rem";
    comingSoon.style.letterSpacing = "0.1em";
    comingSoon.style.textTransform = "uppercase";
    comingSoon.style.color = "rgba(255, 255, 255, 0.65)";
    comingSoon.style.textAlign = "center";
    comingSoon.style.width = "70vw";
    comingSoon.style.opacity = "0";
    comingSoon.style.transition = "opacity 1s ease";
    viewport.appendChild(comingSoon);
    requestAnimationFrame(function () {
      comingSoon.style.opacity = "1";
    });
  }

  // ---- straight to video (no countdown for this piece), fires once ----
  var sequenceStarted = false;

  function startVideo() {
    if (!video) {
      showComingSoon();
      return;
    }
    video.classList.add("visible");
    // Starts muted so it autoplays on its own in every browser — "tap
    // for sound" just unmutes what's already playing rather than being
    // what starts it.
    video.muted = true;
    var playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(function () {
        // The no-file-yet case (play() rejects because there's nothing
        // to decode) is handled by the error listener below, which
        // swaps in the caption — this catch is just the rare fallback
        // for a real file that even muted autoplay got blocked on.
        if (soundBtn && video.error === null) {
          soundBtn.hidden = false;
          soundBtn.textContent = "tap to play";
        }
      });
    }
    if (soundBtn && video.error === null) soundBtn.hidden = false;
  }

  if (video) {
    video.addEventListener("error", function () {
      video.classList.remove("visible");
      if (soundBtn) soundBtn.hidden = true;
      showComingSoon();
    });
  }

  if (soundBtn && video) {
    soundBtn.addEventListener("click", function () {
      video.muted = false;
      video.play();
      soundBtn.hidden = true;
    });
  }

  function beginSequence() {
    if (sequenceStarted) return;
    sequenceStarted = true;
    startVideo();
  }

  // ---- manual pin — same approach used throughout the site ----
  var viewportHeight = 0;
  var spacerHeight = 0;

  function pin(state, bottomOffset) {
    if (state === "during") {
      viewport.style.position = "fixed";
      viewport.style.top = "0";
    } else if (state === "after") {
      viewport.style.position = "absolute";
      viewport.style.top = bottomOffset + "px";
    } else {
      viewport.style.position = "absolute";
      viewport.style.top = "0";
    }
  }

  function measure() {
    spacerHeight = spacer.offsetHeight;
    viewportHeight = Math.max(
      window.innerHeight,
      (window.visualViewport && window.visualViewport.height) || 0
    );
  }

  function applyScrub(p) {
    if (p >= SCRUB_FRACTION) {
      showFrame(FRAME_COUNT);
      beginSequence();
      return;
    }
    var scrubP = p / SCRUB_FRACTION;
    showFrame(Math.round(scrubP * (FRAME_COUNT - 1)) + 1);
  }

  function update() {
    var rect = spacer.getBoundingClientRect();
    var total = spacerHeight - viewportHeight;

    if (total <= 0) {
      pin("before", 0);
      showFrame(FRAME_COUNT);
      beginSequence();
      return;
    }

    if (rect.top > 0) {
      pin("before", 0);
      showFrame(1);
    } else if (rect.bottom <= viewportHeight) {
      pin("after", spacerHeight - viewportHeight);
      showFrame(FRAME_COUNT);
      beginSequence();
    } else {
      pin("during", 0);
      var p = -rect.top / total;
      if (p < 0) p = 0;
      if (p > 1) p = 1;
      applyScrub(p);
    }
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      update();
      ticking = false;
    });
  }

  function refresh() {
    measure();
    pin("before", 0);
    update();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", refresh);
  window.addEventListener("orientationchange", refresh);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", refresh);
  }
  window.addEventListener("load", function () {
    refresh();
    setTimeout(refresh, 400);
  });

  showFrame(1);
  preload(2);
  refresh();
})();

// ---- reel-change hand-off into after-hours-3.html ----
// Same trigger as after-hours.js: scroll to the true bottom of the page
// and it flickers into the next piece, reset to the top.
(function () {
  "use strict";

  var overlay = document.getElementById("ah-reload");
  if (!overlay) return;

  var firing = false;

  function atTrueBottom() {
    return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
  }

  function checkBottom() {
    if (firing) return;
    if (window.scrollY < 400) return;
    if (!atTrueBottom()) return;

    firing = true;
    overlay.classList.add("active");

    setTimeout(function () {
      window.location.href = "after-hours-3.html";
    }, 1100);
  }

  window.addEventListener("scroll", checkBottom, { passive: true });
})();

// ---- restore scroll spot after a lights-on/lights-off round trip ----
(function () {
  "use strict";

  var saved;
  try {
    saved = localStorage.getItem("ahResume");
  } catch (e) {
    saved = null;
  }
  if (!saved) return;

  var resume;
  try {
    resume = JSON.parse(saved);
  } catch (e) {
    resume = null;
  }
  if (!resume || !resume.page) return;

  var thisPage = window.location.pathname.split("/").pop() || "after-hours-2.html";
  if (resume.page !== thisPage) return;

  var target = resume.scrollY || 0;
  function apply() {
    window.scrollTo(0, target);
  }

  window.addEventListener("load", function () {
    apply();
    setTimeout(apply, 450);
  });
})();
