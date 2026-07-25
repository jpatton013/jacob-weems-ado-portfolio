(function () {
  "use strict";

  // ---- config --------------------------------------------------------
  // Bump this as more batches of images get added to images/floats/
  // (float-001.jpg, float-002.jpg, ... sequential, zero-padded to 3
  // digits). Everything else below adapts automatically to the count.
  var FLOAT_COUNT = 319;

  // Weighted size buckets rather than one flat rand(min,max) range — a
  // flat range still LOOKS fairly uniform because most random values land
  // near the middle. Skewing heavily toward small/medium with only a few
  // standouts is what actually reads as varied at a glance, and it also
  // keeps the average tile small, which is what keeps the field dense.
  var SIZE_BUCKETS = [
    { weight: 0.45, min: 45, max: 80 }, // small
    { weight: 0.32, min: 80, max: 120 }, // medium
    { weight: 0.16, min: 120, max: 160 }, // medium-large
    { weight: 0.07, min: 160, max: 210 } // large, rare
  ];

  var field = document.getElementById("float-field");
  if (!field) return;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function randomSize() {
    var r = Math.random();
    var acc = 0;
    for (var i = 0; i < SIZE_BUCKETS.length; i++) {
      acc += SIZE_BUCKETS[i].weight;
      if (r <= acc) return rand(SIZE_BUCKETS[i].min, SIZE_BUCKETS[i].max);
    }
    var last = SIZE_BUCKETS[SIZE_BUCKETS.length - 1];
    return rand(last.min, last.max);
  }

  // Fisher-Yates shuffle of the image indices, so which photo lands in
  // which grid cell is randomized on every load — batches don't stay
  // clumped together in upload order.
  function shuffledIndices(n) {
    var arr = [];
    for (var i = 0; i < n; i++) arr.push(i);
    for (var j = arr.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = arr[j];
      arr[j] = arr[k];
      arr[k] = tmp;
    }
    return arr;
  }

  // ---- scattered layout -----------------------------------------------
  // A loose jittered grid rather than fully random placement: walk through
  // cells left to right / top to bottom, and nudge each image randomly
  // within (and slightly beyond) its cell. The cell size is based on the
  // AVERAGE tile size, not the largest one — most tiles are small/medium,
  // so sizing cells for the rare large one would waste a ton of space and
  // is what made the field sprawl before. The jitter is also allowed to
  // bleed past the cell edge a bit, which is what lets tiles genuinely
  // overlap their neighbors sometimes instead of always sitting in their
  // own clean slot.
  var avgSize = 0;
  for (var b = 0; b < SIZE_BUCKETS.length; b++) {
    avgSize += SIZE_BUCKETS[b].weight * ((SIZE_BUCKETS[b].min + SIZE_BUCKETS[b].max) / 2);
  }
  var fieldWidth = Math.min(window.innerWidth, document.documentElement.clientWidth);
  var cell = avgSize + 2; // tightened further per your last note
  var cols = Math.max(2, Math.floor(fieldWidth / cell));
  var rows = Math.ceil(FLOAT_COUNT / cols);
  var fieldHeight = rows * cell + cell;

  field.style.height = fieldHeight + "px";

  var order = shuffledIndices(FLOAT_COUNT);
  var tiles = [];

  for (var i = 0; i < FLOAT_COUNT; i++) {
    var num = String(order[i] + 1).padStart(3, "0");
    var col = i % cols;
    var row = Math.floor(i / cols);

    var size = randomSize();
    var overlap = cell * 0.3; // how far a tile can bleed into a neighbor
    var x = col * cell + rand(-overlap, cell - size + overlap);
    var y = row * cell + rand(-overlap, cell - size + overlap);
    var baseRotation = rand(-14, 14);
    var wobbleSpread = rand(2, 5);
    var duration = rand(3.5, 6.5);
    var delay = rand(-4, 0);

    // Position/size as CSS custom properties, not direct style.left/top/
    // width — inline styles set that way would always beat the
    // .tile.expanded class rule below, no matter its specificity, and the
    // click-to-expand animation would never actually grow the tile.
    var tile = document.createElement("div");
    tile.className = "tile";
    tile.style.setProperty("--x", x + "px");
    tile.style.setProperty("--y", y + "px");
    tile.style.setProperty("--w", size + "px");

    var spring = document.createElement("div");
    spring.className = "tile-spring";

    var floatEl = document.createElement("div");
    floatEl.className = "tile-float";
    floatEl.style.setProperty("--wobble-from", baseRotation - wobbleSpread + "deg");
    floatEl.style.setProperty("--wobble-to", baseRotation + wobbleSpread + "deg");
    floatEl.style.animationDuration = duration + "s";
    floatEl.style.animationDelay = delay + "s";

    // Two resolutions per image: a small one for the scattered field (so
    // hundreds of them stay light and fast) and a real, high-res one that
    // gets swapped in only when a tile is expanded — so the thumbnail
    // never has to be stretched up to fill most of the screen and go soft.
    var img = document.createElement("img");
    img.src = "images/floats/float-" + num + ".jpg";
    img.dataset.thumb = "images/floats/float-" + num + ".jpg";
    img.dataset.full = "images/floats-full/float-" + num + ".jpg";
    img.alt = "";
    img.loading = "lazy";

    floatEl.appendChild(img);
    spring.appendChild(floatEl);
    tile.appendChild(spring);
    field.appendChild(tile);

    tiles.push({
      el: tile,
      spring: spring,
      floatEl: floatEl,
      img: img,
      size: size,
      x: x,
      y: y,
      // spring-physics state for the scroll/pointer reaction, entirely
      // separate from the CSS idle wobble above
      ox: 0,
      oy: 0,
      vx: 0,
      vy: 0,
      rot: 0,
      vrot: 0,
      sensitivity: rand(0.6, 1.4),
      active: false,
      frozen: false
    });
  }

  // ---- click a tile to blow it up, click again to snap back -------------
  // Classic FLIP technique (First, Last, Invert, Play): measure the tile
  // where it is now, let CSS jump it straight to its final state (centered,
  // huge), measure that, then paint an inverted transform that makes it
  // LOOK like it never moved — and finally transition that inverted
  // transform back to none. The browser only ever animates a transform,
  // which is cheap, so this stays smooth even though the tile is jumping
  // between position:absolute (scattered) and position:fixed (focused).
  var backdrop = document.getElementById("explosion-backdrop");
  var expandedTile = null;
  var BOUNCE_EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

  function flip(tile, mutate, onDone) {
    var oldRect = tile.el.getBoundingClientRect();
    mutate();
    var newRect = tile.el.getBoundingClientRect();

    var scaleX = oldRect.width / newRect.width;
    var scaleY = oldRect.height / newRect.height;
    var dx = oldRect.left + oldRect.width / 2 - (newRect.left + newRect.width / 2);
    var dy = oldRect.top + oldRect.height / 2 - (newRect.top + newRect.height / 2);

    tile.el.style.transition = "none";
    tile.el.style.transform =
      "translate(" + dx + "px, " + dy + "px) scale(" + scaleX + ", " + scaleY + ")";

    // Force a reflow so the browser actually paints one frame with the
    // inverted transform above before we change it again. A single
    // requestAnimationFrame is NOT reliable here — the browser can (and
    // often does) coalesce it with the "none" transition change and skip
    // straight to the end state with no visible animation at all, which
    // is exactly what "snaps but doesn't zoom" looks like. Reading a
    // layout property forces the flush; the double rAF then guarantees a
    // full paint has happened before we start the real transition.
    tile.el.getBoundingClientRect();

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        tile.el.style.transition = "transform 0.6s " + BOUNCE_EASING;
        tile.el.style.transform = "";
        if (onDone) {
          var done = false;
          var finish = function () {
            if (done) return;
            done = true;
            onDone();
          };
          tile.el.addEventListener("transitionend", finish, { once: true });
          // Belt-and-suspenders: if the old and new transforms ever end up
          // identical, no transitionend fires at all, and onDone (which
          // unlocks body scroll on collapse) would never run.
          setTimeout(finish, 700);
        }
      });
    });
  }

  // The expanded box is sized in JS, per image, to match that image's own
  // aspect ratio — not a fixed square. A forced square box was the actual
  // cause of the "snaps diagonal" bug: a portrait or landscape crop has a
  // very different aspect ratio than a square, so the FLIP animation had
  // to scale width and height by DIFFERENT amounts to get from the small
  // scattered rect to the big square one, and that mismatched X/Y scale
  // is what read as a diagonal/skewed pop instead of a clean zoom. Using
  // the thumbnail's already-loaded naturalWidth/naturalHeight (the full
  // and thumb are generated from the same source, so their aspect ratio
  // is identical) keeps scaleX and scaleY equal.
  function expandedSize(tile) {
    var natW = tile.img.naturalWidth || tile.size;
    var natH = tile.img.naturalHeight || tile.size;
    var maxW = window.innerWidth * 0.82;
    var maxH = window.innerHeight * 0.82;
    var ratio = natW / natH;
    if (maxW / maxH > ratio) {
      var h = maxH;
      return { w: h * ratio, h: h };
    }
    var w = maxW;
    return { w: w, h: w / ratio };
  }

  function expand(tile) {
    expandedTile = tile;
    tile.frozen = true;
    tile.spring.style.transform = "";
    // Actually detach the idle-wobble animation, not just pause it. This
    // was the real bug behind the diagonal snap: a CSS keyframe animation
    // still "owns" the transform property of the element it's animating
    // even while paused, and silently wins over any inline style.transform
    // set on that same element — so the earlier "freeze it upright" fix
    // was being ignored, and the tile expanded still carrying whatever
    // mid-wobble rotation it happened to be at. Setting animationName to
    // "none" fully hands transform control back to inline styles.
    tile.floatEl.style.animationName = "none";
    tile.floatEl.style.transform = "none";
    // Swap to the full-resolution image now, so it has the whole 0.6s
    // bounce (and typically a bit more, given caching) to load before
    // anyone's looking closely at it.
    tile.img.src = tile.img.dataset.full;
    document.body.style.overflow = "hidden";
    if (backdrop) backdrop.classList.add("visible");

    var size = expandedSize(tile);

    flip(tile, function () {
      tile.el.style.width = size.w + "px";
      tile.el.style.height = size.h + "px";
      tile.el.classList.add("expanded");
    });
  }

  function collapse(tile) {
    if (backdrop) backdrop.classList.remove("visible");

    flip(
      tile,
      function () {
        tile.el.classList.remove("expanded");
        tile.el.style.width = "";
        tile.el.style.height = "";
      },
      function () {
        tile.frozen = false;
        tile.floatEl.style.animationName = "";
        tile.floatEl.style.transform = "";
        tile.img.src = tile.img.dataset.thumb;
        document.body.style.overflow = "";
        expandedTile = null;
      }
    );
  }

  tiles.forEach(function (t) {
    t.el.addEventListener("click", function () {
      if (expandedTile === null) {
        expand(t);
      } else if (expandedTile === t) {
        collapse(t);
      }
      // a click on some other tile while one is expanded is ignored —
      // close the open one first.
    });
  });

  if (backdrop) {
    backdrop.addEventListener("click", function () {
      if (expandedTile) collapse(expandedTile);
    });
  }

  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && expandedTile) collapse(expandedTile);
  });

  // ---- only animate what's on screen -----------------------------------
  // With this many absolutely-positioned tiles, running the spring
  // simulation on ones far off screen is wasted work. IntersectionObserver
  // flips `active` on tiles as they enter/leave a generous margin around
  // the viewport.
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var tile = tiles.find(function (t) {
            return t.el === entry.target;
          });
          if (tile) tile.active = entry.isIntersecting;
        });
      },
      { rootMargin: "50% 0px 50% 0px" }
    );
    tiles.forEach(function (t) {
      io.observe(t.el);
    });
  } else {
    tiles.forEach(function (t) {
      t.active = true;
    });
  }

  // ---- scroll reacts as a bounce ----------------------------------------
  var lastScrollY = window.scrollY;
  var scrollImpulse = 0;

  window.addEventListener(
    "scroll",
    function () {
      var y = window.scrollY;
      var delta = y - lastScrollY;
      lastScrollY = y;
      scrollImpulse += delta;
    },
    { passive: true }
  );

  // ---- pointer nudges nearby tiles away -----------------------------
  var pointerX = null;
  var pointerY = null;
  var pointerRadius = 160;

  window.addEventListener(
    "pointermove",
    function (e) {
      pointerX = e.clientX;
      pointerY = e.clientY + window.scrollY;
    },
    { passive: true }
  );

  window.addEventListener("pointerleave", function () {
    pointerX = null;
    pointerY = null;
  });

  // ---- the spring loop -----------------------------------------------
  // Each active tile has its own tiny critically-damped-ish spring:
  // an impulse (from scroll, or from the pointer passing nearby) adds to
  // velocity, velocity is damped each frame, and position is pulled back
  // toward zero (its resting/scattered spot). Cheap, dependency-free, and
  // reads as a believable bounce without a physics library.
  function tick() {
    scrollImpulse *= 0.82;

    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      if (!t.active || t.frozen) continue;

      t.vy += scrollImpulse * 0.02 * t.sensitivity;

      if (pointerX !== null) {
        var cx = t.x + t.size / 2;
        var cy = t.y + t.size / 2 + t.oy;
        var dx = cx - pointerX;
        var dy = cy - pointerY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < pointerRadius && dist > 0.01) {
          var force = ((pointerRadius - dist) / pointerRadius) * 6;
          t.vx += (dx / dist) * force * t.sensitivity;
          t.vy += (dy / dist) * force * t.sensitivity;
        }
      }

      t.vx *= 0.88;
      t.vy *= 0.88;
      t.ox += t.vx;
      t.oy += t.vy;
      t.ox *= 0.9;
      t.oy *= 0.9;

      t.vrot += (t.vx * 0.6 - t.rot) * 0.08;
      t.rot += t.vrot;
      t.rot *= 0.9;

      t.spring.style.transform =
        "translate(" + t.ox.toFixed(1) + "px, " + t.oy.toFixed(1) + "px) rotate(" + t.rot.toFixed(2) + "deg)";
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  // ---- keep the scatter sane on resize -------------------------------
  window.addEventListener("resize", function () {
    // A full re-scatter on every resize would jump the layout around
    // distractingly; the field just keeps its layout and lets the browser
    // reflow naturally. A hard refresh re-scatters cleanly if needed.
  });
})();

// ---- gather scene: the pile pulls together after the chaos --------------
// A self-contained scene, separate from the field above (same relationship
// as the zoom-out grid is to the gallery on the main page): its own small
// set of tiles, pulled from whatever thumbnails are already on the page,
// arranged scattered-wide at the start and animated into a tight, still-
// messy cluster in the center as you scroll through .gather-spacer. Same
// manual fixed/absolute pin as the main page's zoom-out — not
// position:sticky — for the same cross-browser reasons.
(function () {
  "use strict";

  var spacer = document.getElementById("gather-spacer");
  var viewport = document.getElementById("gather-viewport");
  var cluster = document.getElementById("gather-cluster");
  var button = document.getElementById("gather-button");
  if (!spacer || !viewport || !cluster) return;

  var GATHER_TILE_COUNT = 70;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  // Pull from the thumbnails already built by the field above, rather
  // than re-deriving image paths — stays in sync with however many
  // images actually exist automatically.
  var allSrcs = Array.prototype.map.call(
    document.querySelectorAll(".float-field img"),
    function (img) {
      return img.getAttribute("src");
    }
  );

  // Fisher-Yates, then take the first N — a random, non-repeating subset.
  for (var s = allSrcs.length - 1; s > 0; s--) {
    var k = Math.floor(Math.random() * (s + 1));
    var tmp = allSrcs[s];
    allSrcs[s] = allSrcs[k];
    allSrcs[k] = tmp;
  }
  var srcs = allSrcs.slice(0, Math.min(GATHER_TILE_COUNT, allSrcs.length));

  var vw = window.innerWidth;
  var vh = window.innerHeight;
  var centerX = vw / 2;
  var centerY = vh / 2;
  var clusterRadius = Math.min(vw, vh) * 0.28;

  var gtiles = srcs.map(function (src) {
    var size = rand(70, 150);

    // Scattered starting point: spread across the whole viewport, echoing
    // the chaos of the field just scrolled past.
    var startX = rand(0, vw - size);
    var startY = rand(0, vh - size);
    var startRot = rand(-25, 25);

    // Clustered end point: tightly grouped around center, still jittered
    // and rotated so it reads as a pile, not a grid.
    var angle = rand(0, Math.PI * 2);
    var dist = rand(0, clusterRadius);
    var endX = centerX + Math.cos(angle) * dist - size / 2;
    var endY = centerY + Math.sin(angle) * dist - size / 2;
    var endRot = rand(-16, 16);

    // No z-index here on purpose. Giving tiles their own z-index (as an
    // earlier version did) put them in direct numeric competition with
    // the button's z-index within whatever stacking context .gather-
    // viewport happens to establish (position:fixed always creates one,
    // which isn't obvious) — the button kept losing and sitting invisibly
    // under the pile. Plain DOM order already gives a fine layered look
    // (later-created tiles paint over earlier ones), and leaving every
    // tile at the default stacking level means the button's z-index is
    // the ONLY explicit one around — nothing left to compete with it.
    var el = document.createElement("div");
    el.className = "gather-tile";
    el.style.width = size + "px";
    el.style.left = startX + "px";
    el.style.top = startY + "px";
    el.style.transform = "rotate(" + startRot + "deg)";

    var img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.loading = "lazy";
    el.appendChild(img);
    cluster.appendChild(el);

    return {
      el: el,
      startX: startX,
      startY: startY,
      startRot: startRot,
      endX: endX,
      endY: endY,
      endRot: endRot
    };
  });

  function easeInOut(p) {
    return p * p * (3 - 2 * p); // smoothstep
  }

  function applyProgress(p) {
    var eased = easeInOut(p);
    for (var i = 0; i < gtiles.length; i++) {
      var t = gtiles[i];
      var x = t.startX + (t.endX - t.startX) * eased;
      var y = t.startY + (t.endY - t.startY) * eased;
      var rot = t.startRot + (t.endRot - t.startRot) * eased;
      t.el.style.left = x + "px";
      t.el.style.top = y + "px";
      t.el.style.transform = "rotate(" + rot + "deg)";
    }
    if (button) {
      button.classList.toggle("visible", p > 0.97);
    }
  }

  // ---- manual pin, identical approach to the main page's zoom-out -----
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

  function update() {
    var rect = spacer.getBoundingClientRect();
    var total = spacerHeight - viewportHeight;

    if (total <= 0) {
      pin("before", 0);
      applyProgress(1);
      return;
    }

    if (rect.top > 0) {
      pin("before", 0);
      applyProgress(0);
    } else if (rect.bottom <= viewportHeight) {
      pin("after", spacerHeight - viewportHeight);
      applyProgress(1);
    } else {
      pin("during", 0);
      var p = -rect.top / total;
      if (p < 0) p = 0;
      if (p > 1) p = 1;
      applyProgress(p);
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

  refresh();
})();
