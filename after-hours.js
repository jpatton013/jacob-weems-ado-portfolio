// after-hours.html only: scroll scrubs through the 102 sketch frames,
// then an old-movie countdown and the finished film take over on their
// own once you've scrolled far enough to reach the last one.

(function () {
  "use strict";

  var spacer = document.getElementById("ah-spacer");
  var viewport = document.getElementById("ah-viewport");
  var frameImg = document.getElementById("ah-frame");
  var countdown = document.getElementById("ah-countdown");
  var countdownNum = document.getElementById("ah-countdown-num");
  var video = document.getElementById("ah-video");
  var soundBtn = document.getElementById("ah-sound-btn");
  if (!spacer || !viewport || !frameImg) return;

  var FRAME_COUNT = 102;
  // The first 75% of the spacer's scroll distance scrubs through the
  // frames; the remaining 25% is a held buffer where the countdown and
  // video play out on their own timer rather than following the scroll
  // any further — otherwise scrolling fast would cut the video off
  // mid-play as soon as the spacer ran out.
  var SCRUB_FRACTION = 0.75;

  function frameSrc(n) {
    var padded = String(n).padStart(3, "0");
    return "images/reel/frame-" + padded + ".jpg";
  }

  // Warms a small window of upcoming frames rather than all 102 up
  // front, so scrubbing forward stays smooth without loading the whole
  // sequence on page load.
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
      // Forces a reflow so the animation actually restarts each tick,
      // instead of silently no-opping because the class technically
      // never left before being re-added.
      void countdownNum.offsetWidth;
      countdownNum.classList.add("pop");
      i++;
      setTimeout(next, 700);
    }

    next();
  }

  function startVideo() {
    if (!video) return;
    video.classList.add("visible");
    var playPromise = video.play();
    // Browsers that block unmuted autoplay reject this promise instead
    // of throwing — catch it and surface a manual play control rather
    // than leaving the video silently stuck.
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(function () {
        if (soundBtn) soundBtn.hidden = false;
      });
    }
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

  // ---- manual pin — same fixed/absolute toggling approach as the main
  // page's zoom-out gallery and explosion.html's gather scene, not
  // position:sticky, for the same cross-browser reasons those use it. ----
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
