// after-hours-3.html only: same scroll-scrub setup as the first two
// reels, pointed at a third set of frames. TODO once frames arrive: bump
// FRAME_COUNT below to match how many land in images/reel-3/. Terminal
// page for now — no further chain past this one.

(function () {
  "use strict";

  var spacer = document.getElementById("ah-spacer");
  var viewport = document.getElementById("ah-viewport");
  var frameImg = document.getElementById("ah-frame");
  var countdown = document.getElementById("ah-countdown");
  var countdownNum = document.getElementById("ah-countdown-num");
  var countdownRing = countdown ? countdown.querySelector(".ah-countdown-ring") : null;
  var video = document.getElementById("ah-video");
  var soundBtn = document.getElementById("ah-sound-btn");
  if (!spacer || !viewport || !frameImg) return;

  // TODO: update once the third piece's frames are uploaded.
  var FRAME_COUNT = 1;
  var SCRUB_FRACTION = 0.75;

  function frameSrc(n) {
    var padded = String(n).padStart(3, "0");
    return "images/reel-3/frame-" + padded + ".jpg";
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

  // ---- countdown -> video, fires once ----
  var sequenceStarted = false;

  function runCountdown() {
    var counts = [5, 4, 3, 2, 1];
    var i = 0;
    countdown.classList.add("visible");

    function next() {
      if (i >= counts.length) {
        countdown.classList.remove("visible");
        startVideo();
        return;
      }
      countdownNum.textContent = String(counts[i]);
      countdownNum.classList.remove("pop");
      void countdownNum.offsetWidth;
      countdownNum.classList.add("pop");
      if (countdownRing) {
        countdownRing.classList.remove("sweep");
        void countdownRing.offsetWidth;
        countdownRing.classList.add("sweep");
      }
      i++;
      setTimeout(next, 700);
    }

    next();
  }

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
    runCountdown();
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
