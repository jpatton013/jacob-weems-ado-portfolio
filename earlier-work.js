// relax.html only: scroll-reveal for the gallery, and a small
// procedural ambient "water" sound behind an opt-in toggle.

(function () {
  "use strict";

  // ---------- scroll reveal ----------
  // Each .plate / .row on this page carries .reveal (starts invisible via
  // CSS). IntersectionObserver flips .visible on once, when a piece is
  // far enough into view, so the gallery feels like it's drifting up to
  // meet you rather than just sitting there static.
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach(function (el) {
      io.observe(el);
    });
  } else {
    // No IntersectionObserver support: just show everything.
    revealEls.forEach(function (el) {
      el.classList.add("visible");
    });
  }

  // ---------- ambient water sound ----------
  // No audio file was supplied for this, so it's generated entirely with
  // the Web Audio API: filtered noise run through a slow-sweeping lowpass
  // filter (the "shhh" of water) plus a slow gain swell (the rise and
  // fall of waves). It starts automatically — every browser still
  // requires an actual user gesture before an AudioContext is allowed to
  // produce audible sound, so the context and node graph are built
  // immediately on load, and then resumed the instant the very first
  // interaction of any kind happens anywhere on the page (not only a
  // click on the toggle), which is as close to "automatic" as autoplay
  // policy allows. The toggle stays as an explicit mute/pause control.
  var toggle = document.getElementById("sound-toggle");
  if (!toggle) return;

  var ctx = null;
  var nodes = null;
  var playing = false;
  var userStopped = false;

  function buildNoiseBuffer(audioCtx, seconds) {
    var sampleRate = audioCtx.sampleRate;
    var length = sampleRate * seconds;
    var buffer = audioCtx.createBuffer(2, length, sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var data = buffer.getChannelData(ch);
      var lastOut = 0;
      for (var i = 0; i < length; i++) {
        var white = Math.random() * 2 - 1;
        // Brown-ish noise (integrated white noise) reads much softer /
        // more "oceanic" than raw white noise, closer to surf than static.
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.2;
      }
    }
    return buffer;
  }

  function startSound() {
    if (!ctx) {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      ctx = new AudioContextClass();
    }
    if (ctx.state === "suspended") ctx.resume();

    var noiseBuffer = buildNoiseBuffer(ctx, 4);
    var source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    // Lowpass filter, slowly swept by an LFO — this is what gives the
    // noise its "wave washing in and out" character rather than a flat hiss.
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 500;
    filter.Q.value = 0.7;

    var filterLfo = ctx.createOscillator();
    filterLfo.frequency.value = 0.06;
    var filterLfoGain = ctx.createGain();
    filterLfoGain.gain.value = 280;
    filterLfo.connect(filterLfoGain);
    filterLfoGain.connect(filter.frequency);

    // Slow master-gain swell — the rise and fall of a wave breaking.
    var masterGain = ctx.createGain();
    masterGain.gain.value = 0.001;

    var swellLfo = ctx.createOscillator();
    swellLfo.frequency.value = 0.1;
    var swellLfoGain = ctx.createGain();
    swellLfoGain.gain.value = 0.035;
    swellLfo.connect(swellLfoGain);
    swellLfoGain.connect(masterGain.gain);

    source.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(ctx.destination);

    // Fade in gently instead of snapping on.
    var now = ctx.currentTime;
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.linearRampToValueAtTime(0.05, now + 1.5);

    source.start();
    filterLfo.start();
    swellLfo.start();

    nodes = { source: source, filter: filter, filterLfo: filterLfo, swellLfo: swellLfo, masterGain: masterGain };
    playing = true;
    toggle.setAttribute("aria-pressed", "true");
  }

  function stopSound() {
    if (!nodes || !ctx) return;
    var now = ctx.currentTime;
    var g = nodes.masterGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.0001, now + 0.8);

    var toStop = nodes;
    setTimeout(function () {
      try {
        toStop.source.stop();
        toStop.filterLfo.stop();
        toStop.swellLfo.stop();
      } catch (e) {
        /* already stopped */
      }
    }, 900);

    nodes = null;
    playing = false;
    toggle.setAttribute("aria-pressed", "false");
  }

  toggle.addEventListener("click", function () {
    if (playing) {
      userStopped = true;
      stopSound();
    } else {
      userStopped = false;
      startSound();
    }
  });

  // Build the node graph right away. Most browsers leave the context
  // "suspended" until a gesture, so this alone usually isn't audible yet
  // — it's the resume below that actually makes sound come out, as soon
  // as the browser will allow it.
  startSound();

  function resumeOnFirstInteraction() {
    if (userStopped) return;
    if (ctx && ctx.state === "suspended") {
      ctx.resume();
    } else if (!playing) {
      startSound();
    }
  }

  ["pointerdown", "keydown", "touchstart", "scroll"].forEach(function (evt) {
    window.addEventListener(evt, resumeOnFirstInteraction, { once: true, passive: true });
  });
})();

// ---------- wave-wash transition (relax.html only) ----------
// Clear the last portrait and hit the true bottom of the page (no added
// scroll distance) and a wave painting washes over the screen, then
// carries you on to waves.html. Shared script file, so this no-ops
// on any page without a #wave-trigger (waves.html included).
(function () {
  "use strict";

  var trigger = document.getElementById("wave-trigger");
  var overlay = document.getElementById("wave-overlay");
  if (!trigger || !overlay) return;

  var firing = false;

  function fire() {
    if (firing) return;
    firing = true;
    overlay.classList.add("active");
    // Tide finishes rising at 1.4s; hold on the fully-covered, still-
    // shimmering frame for a beat before handing off to the next page.
    setTimeout(function () {
      window.location.href = "waves.html";
    }, 1900);
  }

  // A zero-height target (#wave-trigger has no content, so no intrinsic
  // size) can fail to ever report isIntersecting in some browsers, since
  // the intersection rectangle has no area to overlap regardless of
  // position — direct scroll math against the real end of the document
  // instead. Gated behind an actual-scroll threshold so it can only ever
  // fire from the user scrolling down, never from the page's initial,
  // pre-layout scrollHeight (lazy-loaded images below the fold haven't
  // reserved their box height yet at page-load time, which could
  // otherwise make the very first measurement look like "the bottom").
  function checkBottom() {
    if (firing) return;
    if (window.scrollY < 400) return;
    var doc = document.documentElement;
    var atBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 2;
    if (atBottom) fire();
  }

  window.addEventListener("scroll", checkBottom, { passive: true });
  window.addEventListener("resize", checkBottom);
})();

// ---------- opener water-edge settle (relax.html only) ----------
// The animated ripple overlay on the opener's edges (see #opener-water
// in relax.html) dissolves into the plain still image as soon as you
// start scrolling, rather than running forever — same manual scroll-
// tie-in pattern as the rest of the site's scroll effects, just driving
// opacity instead of a pin.
(function () {
  "use strict";

  var overlay = document.getElementById("opener-water");
  if (!overlay) return;

  // Fully settled by this many pixels of scroll.
  var FADE_DISTANCE = 500;
  var ticking = false;

  function update() {
    var p = Math.min(1, Math.max(0, window.scrollY / FADE_DISTANCE));
    overlay.style.opacity = String(1 - p);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      update();
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  update();
})();

// ---------- arrival tide (relax.html only) ----------
// Starts covering the whole screen (set in CSS by default, no .dismissed
// class yet) and drains away downward a moment after load — orients the
// viewer into the water theme instead of a hard cut in from
// mess.html. No-ops on pages without #page-enter.
(function () {
  "use strict";

  var enter = document.getElementById("page-enter");
  if (!enter) return;

  // A single requestAnimationFrame can get coalesced by the browser with
  // the next paint and skip straight to the end state, so the class add
  // is deferred two frames deep (same fix used for the click-to-expand
  // tiles on mess.html) to guarantee the browser paints the fully-
  // covered starting frame before the drain transition begins.
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      enter.classList.add("dismissed");
    });
  });
})();
