(function () {
  "use strict";

  var spacer = document.querySelector(".zoom-spacer");
  var viewport = document.querySelector(".zoom-viewport");
  var grid = document.querySelector(".zoom-grid");
  var label = document.querySelector(".zoom-label");
  var nudge = document.querySelector(".explore-nudge");

  if (!spacer || !viewport || !grid) return;

  var lastCell = grid.lastElementChild;
  var start = { tx: 0, ty: 0, scale: 1 };
  var ticking = false;
  var viewportHeight = 0;
  var spacerHeight = 0;
  var gridSettled = false;

  // ---- manual pinning -----------------------------------------------
  // Not using position:sticky. Some browsers pin/release sticky elements
  // inconsistently once dynamic toolbars or nested transforms are in
  // play, which is what caused the zoom to stall partway. Instead we
  // read the spacer's position on every scroll frame and switch the
  // viewport between three plain states ourselves:
  //   before -> sits at the top of the spacer (not yet visible)
  //   during -> position:fixed, filling the screen (the "pin")
  //   after  -> sits at the bottom of the spacer (scrolls away with page)
  // This only depends on getBoundingClientRect, which every browser
  // computes the same way, so there's no positioning scheme to disagree on.

  function pin(state, bottomOffset) {
    if (state === "during") {
      viewport.style.position = "fixed";
      viewport.style.top = "0";
      viewport.style.bottom = "";
    } else if (state === "after") {
      viewport.style.position = "absolute";
      viewport.style.top = bottomOffset + "px";
      viewport.style.bottom = "";
    } else {
      viewport.style.position = "absolute";
      viewport.style.top = "0";
      viewport.style.bottom = "";
    }
  }

  function measureSizes() {
    spacerHeight = spacer.offsetHeight;
    viewportHeight = Math.max(
      window.innerHeight,
      (window.visualViewport && window.visualViewport.height) || 0
    );
  }

  function updatePinAndProgress() {
    var spacerRect = spacer.getBoundingClientRect();
    var total = spacerHeight - viewportHeight;

    if (total <= 0) {
      pin("before", 0);
      applyZoom(1);
      return;
    }

    if (spacerRect.top > 0) {
      pin("before", 0);
      applyZoom(0);
    } else if (spacerRect.bottom <= viewportHeight) {
      pin("after", spacerHeight - viewportHeight);
      applyZoom(1);
    } else {
      pin("during", 0);
      var p = -spacerRect.top / total;
      if (p < 0) p = 0;
      if (p > 1) p = 1;
      applyZoom(p);
    }
  }

  // ---- zoom math -------------------------------------------------------
  // The last grid image starts filling the whole viewport (matching the
  // painting the visitor just scrolled past) and eases out to the full
  // 4x4 grid as progress goes from 0 to 1.

  function measureZoomStart() {
    var prevTransform = grid.style.transform;
    grid.style.transform = "none";

    var viewportRect = viewport.getBoundingClientRect();
    var cellRect = lastCell.getBoundingClientRect();

    var localX = cellRect.left - viewportRect.left;
    var localY = cellRect.top - viewportRect.top;

    var scaleX = viewportRect.width / cellRect.width;
    var scaleY = viewportRect.height / cellRect.height;
    var scale = Math.max(scaleX, scaleY) || 1;

    start = {
      tx: -scale * localX,
      ty: -scale * localY,
      scale: scale
    };

    grid.style.transform = prevTransform;
  }

  function applyZoom(p) {
    var tx = start.tx * (1 - p);
    var ty = start.ty * (1 - p);
    var scale = start.scale + (1 - start.scale) * p;
    grid.style.transform =
      "translate(" + tx + "px, " + ty + "px) scale(" + scale + ")";

    gridSettled = p > 0.985;

    if (label) {
      label.classList.toggle("visible", gridSettled);
    }
    if (nudge) {
      nudge.classList.toggle("visible", gridSettled);
    }
    grid.classList.toggle("clickable", gridSettled);
  }

  // ---- wiring ------------------------------------------------------

  function refresh() {
    measureSizes();
    pin("before", 0);
    measureZoomStart();
    updatePinAndProgress();
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      updatePinAndProgress();
      ticking = false;
    });
  }

  function onResize() {
    refresh();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onResize);
  }

  window.addEventListener("load", function () {
    refresh();
    // Late image decode can shift the last cell's box slightly; settle once more.
    setTimeout(refresh, 400);
  });

  if (lastCell && !lastCell.complete) {
    lastCell.addEventListener("load", refresh, { once: true });
  }

  if (label) {
    label.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Once the zoom has fully settled into the static grid, clicking
  // anywhere on it (except the "back to top" button, which has its own
  // handler above) opens the floating detail-fragments page.
  grid.addEventListener("click", function () {
    if (gridSettled) {
      window.location.href = "explosion.html";
    }
  });

  refresh();
})();

// ---- diptych coordinator (painting 10's two halves) ---------------------
// Each half cycles independently (finished -> draft -> sketch), same as
// clicking any other swap image on the site — clicking left only changes
// left, clicking right only changes right. But neither has a "back to
// finished" click of its own: whichever half is clicked AFTER its last
// state is the one that triggers the shared video, which replaces BOTH
// images at once (regardless of what state the other half was on).
// Clicking the video then resets both halves back to the finished/landing
// state together. Deliberately separate from the generic img.swap loop
// below since these two images no longer carry the "swap" class.
(function () {
  "use strict";

  var left = document.getElementById("diptych-left");
  var right = document.getElementById("diptych-right");
  var video = document.getElementById("diptych-video");
  if (!left || !right || !video) return;

  function statesFor(img) {
    var list = [img.getAttribute("src")];
    var alt = img.getAttribute("data-alt");
    if (alt) list.push(alt);
    var alt2 = img.getAttribute("data-alt2");
    if (alt2) list.push(alt2);
    return list;
  }

  var leftStates = statesFor(left);
  var rightStates = statesFor(right);
  var leftIndex = 0;
  var rightIndex = 0;
  var videoShowing = false;

  function showVideo() {
    videoShowing = true;
    left.style.display = "none";
    right.style.display = "none";
    video.style.display = "block";
    video.currentTime = 0;
    video.play().catch(function () {
      /* If autoplay is blocked, the video is still visible and can be
         started with its own native controls. */
    });
  }

  function backToLanding() {
    videoShowing = false;
    leftIndex = 0;
    rightIndex = 0;
    video.pause();
    video.currentTime = 0;
    video.style.display = "none";
    left.style.display = "block";
    right.style.display = "block";
    left.setAttribute("src", leftStates[0]);
    right.setAttribute("src", rightStates[0]);
  }

  left.addEventListener("click", function () {
    if (videoShowing) return;
    leftIndex++;
    if (leftIndex >= leftStates.length) {
      showVideo();
      return;
    }
    left.setAttribute("src", leftStates[leftIndex]);
  });

  right.addEventListener("click", function () {
    if (videoShowing) return;
    rightIndex++;
    if (rightIndex >= rightStates.length) {
      showVideo();
      return;
    }
    right.setAttribute("src", rightStates[rightIndex]);
  });

  video.addEventListener("click", backToLanding);
})();

// ---- click-to-swap on the draft alternates ------------------------------
// Click cycles through every version available for that image: the
// finished painting (src), then data-alt, then data-alt2 if present, then
// any looping videos present as sibling <video class="swap-video"> elements
// (in the order they appear in the HTML), then back around to the start.
// Most images only have one alt (a 2-click cycle); the five panels have
// draft + sketch + video (4 clicks); painting 7 has draft + sketch + two
// videos (5 clicks). Self-contained so it works even if the zoom section
// above is missing for any reason.
(function () {
  "use strict";

  var swaps = document.querySelectorAll("img.swap");

  swaps.forEach(function (img) {
    var states = [img.getAttribute("src")];
    var alt = img.getAttribute("data-alt");
    if (alt) states.push(alt);
    var alt2 = img.getAttribute("data-alt2");
    if (alt2) states.push(alt2);

    var videos = img.parentElement
      ? Array.prototype.slice.call(
          img.parentElement.querySelectorAll("video.swap-video")
        )
      : [];

    var total = states.length + videos.length;
    if (total < 2) return;

    var index = 0;

    function showState(i) {
      if (i < states.length) {
        img.setAttribute("src", states[i]);
        img.style.display = "block";
        videos.forEach(function (v) {
          v.pause();
          v.currentTime = 0;
          v.style.display = "none";
        });
      } else {
        var active = videos[i - states.length];
        img.style.display = "none";
        videos.forEach(function (v) {
          if (v === active) return;
          v.pause();
          v.currentTime = 0;
          v.style.display = "none";
        });
        active.style.display = "block";
        active.currentTime = 0;
        active.play().catch(function () {
          /* Autoplay can occasionally be blocked even on a direct click;
             the video is still visible and can be started with its own
             native controls if that ever happens. */
        });
      }
    }

    img.addEventListener("click", function () {
      index = (index + 1) % total;
      showState(index);
    });

    videos.forEach(function (video) {
      video.addEventListener("click", function () {
        index = (index + 1) % total;
        showState(index);
      });
    });
  });
})();
