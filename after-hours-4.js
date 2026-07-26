// after-hours-4.html only: same scroll-scrub setup as the earlier
// reels, pointed at the fourth piece's 80 frames. No finished film for
// this one yet and no countdown (piece-1-only) — it fails quietly into
// a "more soon" caption same as the others did before their videos
// existed. Terminal page for now — no further chain past this one.

(function () {
  "use strict";

  var spacer = document.getElementById("ah-spacer");
  var viewport = document.getElementById("ah-viewport");
  var frameImg = document.getElementById("ah-frame");
  var video = document.getElementById("ah-video");
  var soundBtn = document.getElementById("ah-sound-btn");
  if (!spacer || !viewport || !frameImg) return;

  var FRAME_COUNT = 80;
  var SCRUB_FRACTION = 0.75;

  function frameSrc(n) {
    var padded = String(n).padStart(3, "0");
    return "images/reel-4/frame-" + padded + ".jpg";
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
    video.muted = true;
    var playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(function () {
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

  var thisPage = window.location.pathname.split("/").pop() || "after-hours-4.html";
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
