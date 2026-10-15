"use strict";

/* =========================================================================
 * QR shape registries (pure — no DOM, no jQuery)
 *
 * MODULE_SHAPES    the data modules ("dots"), neighbour-aware where useful
 * EYE_STYLES       the three finder patterns ("eyes"): a tested pair of
 *   EYE_FRAME_SHAPES (the 7×7 outer ring) and EYE_BALL_SHAPES (the 3×3 centre)
 *
 * Every entry returns SVG path data, so the canvas and SVG renderers draw identical
 * shapes. Names follow the conventions used by common QR designers (qr-code-styling,
 * QRCode Monkey). Scanners rely on the finder patterns, so eye shapes stay compact and
 * solid; every combination is decoded in tests/e2e/app.spec.js.
 *
 * Why eye styles are pairs instead of two free choices: a frame and centre with different
 * geometry (e.g. a square ring around a round centre) skews the module size the decoder
 * measures from the eyes, and in combination with dots or lines 30–90 % of the tested codes
 * stopped decoding. Pairs that failed were left out.
 *
 * To add a shape: add an entry with a `labelKey` (i18n key in every lang/*.js file) and
 * a pathD function (for eyes: an EYE_STYLES entry). The UI options, whitelists and scan
 * tests pick it up automatically — keep it only if the scan tests pass.
 *
 * Depends on: core/util.js (f, roundRectD)
 * ========================================================================= */

function circleD(cx, cy, r) {
  return "M" + f(cx - r) + " " + f(cy) + "a" + f(r) + " " + f(r) + " 0 1 0 " + f(2 * r) + " 0a" +
    f(r) + " " + f(r) + " 0 1 0 " + f(-2 * r) + " 0z";
}

function diamondD(cx, cy, r) {
  return "M" + f(cx) + " " + f(cy - r) + "L" + f(cx + r) + " " + f(cy) + "L" + f(cx) + " " + f(cy + r) +
    "L" + f(cx - r) + " " + f(cy) + "Z";
}

function hexagonD(cx, cy, r) {
  // Pointy-top hexagon; r is the distance from the centre to a corner.
  const w = r * Math.sqrt(3) / 2;
  return "M" + f(cx) + " " + f(cy - r) + "L" + f(cx + w) + " " + f(cy - r / 2) + "L" + f(cx + w) + " " + f(cy + r / 2) +
    "L" + f(cx) + " " + f(cy + r) + "L" + f(cx - w) + " " + f(cy + r / 2) + "L" + f(cx - w) + " " + f(cy - r / 2) + "Z";
}

// Plus sign: a horizontal and a vertical bar of width `arm` spanning the whole module.
function plusD(x, y, size, arm) {
  const a = (size - arm) / 2;
  return "M" + f(x + a) + " " + f(y) + "h" + f(arm) + "v" + f(a) + "h" + f(a) + "v" + f(arm) + "h" + f(-a) + "v" + f(a) +
    "h" + f(-arm) + "v" + f(-a) + "h" + f(-a) + "v" + f(-arm) + "h" + f(a) + "Z";
}

function heartD(cx, cy, s) {
  return "M" + f(cx) + " " + f(cy + 0.46 * s) +
    "C" + f(cx - 0.62 * s) + " " + f(cy + 0.02 * s) + " " + f(cx - 0.5 * s) + " " + f(cy - 0.52 * s) + " " + f(cx) + " " + f(cy - 0.22 * s) +
    "C" + f(cx + 0.5 * s) + " " + f(cy - 0.52 * s) + " " + f(cx + 0.62 * s) + " " + f(cy + 0.02 * s) + " " + f(cx) + " " + f(cy + 0.46 * s) + "Z";
}

// Superellipse-like "squircle" in the box (x, y, w, h): flat sides that blend into the corners.
// k = how far the control points reach towards each corner (0.55 ≈ ellipse, 1 = square).
function squircleD(x, y, w, h, k) {
  const cx = x + w / 2, cy = y + h / 2, rx = w / 2, ry = h / 2;
  return "M" + f(cx) + " " + f(y) +
    "C" + f(cx + rx * k) + " " + f(y) + " " + f(x + w) + " " + f(cy - ry * k) + " " + f(x + w) + " " + f(cy) +
    "C" + f(x + w) + " " + f(cy + ry * k) + " " + f(cx + rx * k) + " " + f(y + h) + " " + f(cx) + " " + f(y + h) +
    "C" + f(cx - rx * k) + " " + f(y + h) + " " + f(x) + " " + f(cy + ry * k) + " " + f(x) + " " + f(cy) +
    "C" + f(x) + " " + f(cy - ry * k) + " " + f(cx - rx * k) + " " + f(y) + " " + f(cx) + " " + f(y) + "Z";
}

// Octagon: the box (x, y, w, h) with every corner cut off by `cut`.
function chamferD(x, y, w, h, cut) {
  return "M" + f(x + cut) + " " + f(y) + "H" + f(x + w - cut) + "L" + f(x + w) + " " + f(y + cut) +
    "V" + f(y + h - cut) + "L" + f(x + w - cut) + " " + f(y + h) + "H" + f(x + cut) + "L" + f(x) + " " + f(y + h - cut) +
    "V" + f(y + cut) + "Z";
}

// Clockwise circle: the same winding as roundRectD(), so a circle and a bar that overlap
// add up instead of cancelling out (non-zero fill rule).
function circleCwD(cx, cy, r) {
  return "M" + f(cx - r) + " " + f(cy) + "a" + f(r) + " " + f(r) + " 0 1 1 " + f(2 * r) + " 0a" +
    f(r) + " " + f(r) + " 0 1 1 " + f(-2 * r) + " 0z";
}

// Five-pointed star centred on (cx, cy); r is the outer radius.
function starD(cx, cy, r) {
  const inner = r * STAR_INNER;
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rad = i % 2 ? inner : r;
    d += (i ? "L" : "M") + f(cx + Math.cos(a) * rad) + " " + f(cy + Math.sin(a) * rad);
  }
  return d + "Z";
}

// Concave fillet that fills the corner of a light module where both neighbours on that side
// are dark, so dark areas flow round inside corners too ("liquid"). (x, y) is the corner,
// sx/sy (±1) point into the light module.
function filletD(x, y, sx, sy, r) {
  const sweep = sx * sy > 0 ? 0 : 1;
  return "M" + f(x) + " " + f(y) + "H" + f(x + sx * r) + "A" + f(r) + " " + f(r) + " 0 0 " + sweep + " " + f(x) + " " + f(y + sy * r) + "Z";
}

// Deterministic 0..1 value per module, so the same code always gets the same mosaic.
function moduleNoise(row, col) {
  let h = Math.imul(row + 1, 0x27d4eb2d) ^ Math.imul(col + 1, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

// Calls fn(row, col, x, y) for every dark data module (finder patterns are excluded by isDark).
function eachModule(isDark, n, x0, y0, cell, fn) {
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (isDark(row, col)) fn(row, col, x0 + col * cell, y0 + row * cell);
    }
  }
}

/* ---- Data modules ------------------------------------------------------- */
// pathD(isDark, n, x0, y0, cell): isDark(row, col) is false outside the code and inside the eyes.

// Size factors for the module shapes below, tuned with the scan tests (see AGENTS.md).
// Hearts overlap their neighbours: at the size of one module they decoded only with warnings.
const SMALL_SQUARE_INSET = 0.07;
const HEXAGON_RADIUS = 0.62;
const PLUS_ARM = 0.55;
const HEART_SCALE = 1.3;
const SQUIRCLE_K = 0.86;
// Squarer for the eyes: decoders measure the module size from them (0.86 failed with small squares).
const EYE_SQUIRCLE_K = 0.92;
const BEAD_RADIUS = 0.5;
const BEAD_LINK = 0.6;
const STAR_SCALE = 0.86;
const STAR_INNER = 0.5;
const DROP_RADIUS = 0.5;
const MOSAIC_SIZES = [0.86, 0.94, 1];
const SKETCH_JITTER = 0.09; // how far each corner of a hand-drawn module may move, in modules
const SKETCH_GROW = 0.04;   // drawn slightly larger, so the jitter never leaves gaps that read as light

const MODULE_SHAPES = {
  square: {
    labelKey: "shapeSquare",
    // Horizontal runs merged into one rectangle each: small output, no anti-aliasing seams.
    pathD: function(isDark, n, x0, y0, cell) {
      let d = "";
      for (let row = 0; row < n; row++) {
        let col = 0;
        while (col < n) {
          if (!isDark(row, col)) { col++; continue; }
          const start = col;
          while (col < n && isDark(row, col)) col++;
          const w = (col - start) * cell;
          d += "M" + f(x0 + start * cell) + " " + f(y0 + row * cell) + "h" + f(w) + "v" + f(cell) + "h" + f(-w) + "z";
        }
      }
      return d;
    }
  },
  rounded: {
    labelKey: "shapeRounded",
    pathD: function(isDark, n, x0, y0, cell) {
      let d = "";
      eachModule(isDark, n, x0, y0, cell, function(r, c, x, y) { d += roundRectD(x, y, cell, cell, cell * 0.28); });
      return d;
    }
  },
  dots: {
    labelKey: "shapeDots",
    // Full-width circles (neighbours touch): smaller dots made jsQR miss codes at some sizes.
    pathD: function(isDark, n, x0, y0, cell) {
      let d = "";
      eachModule(isDark, n, x0, y0, cell, function(r, c, x, y) { d += circleD(x + cell / 2, y + cell / 2, cell * 0.5); });
      return d;
    }
  },
  // Neighbouring modules flow together; only outer corners are rounded ("extra-rounded").
  fluid: {
    labelKey: "shapeFluid",
    pathD: function(isDark, n, x0, y0, cell) {
      const R = cell / 2;
      let d = "";
      eachModule(isDark, n, x0, y0, cell, function(r, c, x, y) {
        const up = isDark(r - 1, c), down = isDark(r + 1, c), left = isDark(r, c - 1), right = isDark(r, c + 1);
        d += roundRectD(x, y, cell, cell, [!up && !left ? R : 0, !up && !right ? R : 0, !down && !right ? R : 0, !down && !left ? R : 0]);
      });
      return d;
    }
  },
  // Leaf shape: rounded top-left and bottom-right where the module is free on that side.
  classy: {
    labelKey: "shapeClassy",
    pathD: function(isDark, n, x0, y0, cell) {
      const R = cell * 0.5;
      let d = "";
      eachModule(isDark, n, x0, y0, cell, function(r, c, x, y) {
        const up = isDark(r - 1, c), down = isDark(r + 1, c), left = isDark(r, c - 1), right = isDark(r, c + 1);
        d += roundRectD(x, y, cell, cell, [!up && !left ? R : 0, 0, !down && !right ? R : 0, 0]);
      });
      return d;
    }
  },
  diamond: {
    labelKey: "shapeDiamond",
    // Diamonds overlap their neighbours slightly: at a 0.56 radius a diamond covers only about
    // 60 % of its module and decoding failed at most sizes (measured by the scan tests).
    pathD: function(isDark, n, x0, y0, cell) {
      let d = "";
      eachModule(isDark, n, x0, y0, cell, function(r, c, x, y) { d += diamondD(x + cell / 2, y + cell / 2, cell * 0.68); });
      return d;
    }
  },
  vlines: {
    labelKey: "shapeVLines",
    // Vertical runs become one rounded bar each.
    pathD: function(isDark, n, x0, y0, cell) {
      const inset = cell * 0.05;
      let d = "";
      for (let col = 0; col < n; col++) {
        let row = 0;
        while (row < n) {
          if (!isDark(row, col)) { row++; continue; }
          const start = row;
          while (row < n && isDark(row, col)) row++;
          d += roundRectD(x0 + col * cell + inset, y0 + start * cell, cell - inset * 2, (row - start) * cell, (cell - inset * 2) / 2);
        }
      }
      return d;
    }
  },
  smallSquares: {
    labelKey: "shapeSmallSquares",
    pathD: function(isDark, n, x0, y0, cell) {
      const inset = cell * SMALL_SQUARE_INSET;
      let d = "";
      eachModule(isDark, n, x0, y0, cell, function(r, c, x, y) { d += roundRectD(x + inset, y + inset, cell - 2 * inset, cell - 2 * inset, 0); });
      return d;
    }
  },
  hexagons: {
    labelKey: "shapeHexagons",
    pathD: function(isDark, n, x0, y0, cell) {
      let d = "";
      eachModule(isDark, n, x0, y0, cell, function(r, c, x, y) { d += hexagonD(x + cell / 2, y + cell / 2, cell * HEXAGON_RADIUS); });
      return d;
    }
  },
  plus: {
    labelKey: "shapePlus",
    pathD: function(isDark, n, x0, y0, cell) {
      let d = "";
      eachModule(isDark, n, x0, y0, cell, function(r, c, x, y) { d += plusD(x, y, cell, cell * PLUS_ARM); });
      return d;
    }
  },
  hearts: {
    labelKey: "shapeHearts",
    pathD: function(isDark, n, x0, y0, cell) {
      let d = "";
      eachModule(isDark, n, x0, y0, cell, function(r, c, x, y) { d += heartD(x + cell / 2, y + cell / 2, cell * HEART_SCALE); });
      return d;
    }
  },
  hlines: {
    labelKey: "shapeHLines",
    pathD: function(isDark, n, x0, y0, cell) {
      const inset = cell * 0.05;
      let d = "";
      for (let row = 0; row < n; row++) {
        let col = 0;
        while (col < n) {
          if (!isDark(row, col)) { col++; continue; }
          const start = col;
          while (col < n && isDark(row, col)) col++;
          d += roundRectD(x0 + start * cell, y0 + row * cell + inset, (col - start) * cell, cell - inset * 2, (cell - inset * 2) / 2);
        }
      }
      return d;
    }
  },
  // Like "fluid", but inside corners are rounded as well: a light module whose two neighbours on
  // one side are dark gets a concave fillet there.
  liquid: {
    labelKey: "shapeLiquid",
    pathD: function(isDark, n, x0, y0, cell) {
      const R = cell / 2;
      let d = MODULE_SHAPES.fluid.pathD(isDark, n, x0, y0, cell);
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (isDark(r, c)) continue;
          const x = x0 + c * cell, y = y0 + r * cell;
          const up = isDark(r - 1, c), down = isDark(r + 1, c), left = isDark(r, c - 1), right = isDark(r, c + 1);
          if (up && left && isDark(r - 1, c - 1)) d += filletD(x, y, 1, 1, R);
          if (up && right && isDark(r - 1, c + 1)) d += filletD(x + cell, y, -1, 1, R);
          if (down && right && isDark(r + 1, c + 1)) d += filletD(x + cell, y + cell, -1, -1, R);
          if (down && left && isDark(r + 1, c - 1)) d += filletD(x, y + cell, 1, -1, R);
        }
      }
      return d;
    }
  },
  // Classy leaf corners (top-left, bottom-right) plus a small rounding on the other free corners.
  classyRounded: {
    labelKey: "shapeClassyRounded",
    pathD: function(isDark, n, x0, y0, cell) {
      const R = cell * 0.5, r = cell * 0.18;
      let d = "";
      eachModule(isDark, n, x0, y0, cell, function(row, c, x, y) {
        const up = isDark(row - 1, c), down = isDark(row + 1, c), left = isDark(row, c - 1), right = isDark(row, c + 1);
        d += roundRectD(x, y, cell, cell, [!up && !left ? R : 0, !up && !right ? r : 0, !down && !right ? R : 0, !down && !left ? r : 0]);
      });
      return d;
    }
  },
  // Round beads, linked to their right and lower neighbours by short bars.
  beads: {
    labelKey: "shapeBeads",
    pathD: function(isDark, n, x0, y0, cell) {
      const rad = cell * BEAD_RADIUS, link = cell * BEAD_LINK;
      let d = "";
      eachModule(isDark, n, x0, y0, cell, function(row, c, x, y) {
        const cx = x + cell / 2, cy = y + cell / 2;
        d += circleCwD(cx, cy, rad);
        if (isDark(row, c + 1)) d += roundRectD(cx, cy - link / 2, cell, link, 0);
        if (isDark(row + 1, c)) d += roundRectD(cx - link / 2, cy, link, cell, 0);
      });
      return d;
    }
  },
  squircle: {
    labelKey: "shapeSquircle",
    pathD: function(isDark, n, x0, y0, cell) {
      let d = "";
      eachModule(isDark, n, x0, y0, cell, function(r, c, x, y) { d += squircleD(x, y, cell, cell, SQUIRCLE_K); });
      return d;
    }
  },
  // Stars are much thinner than a module, so (like hearts) they are drawn larger than one.
  stars: {
    labelKey: "shapeStars",
    pathD: function(isDark, n, x0, y0, cell) {
      let d = "";
      eachModule(isDark, n, x0, y0, cell, function(r, c, x, y) { d += starD(x + cell / 2, y + cell / 2 + cell * 0.05, cell * STAR_SCALE); });
      return d;
    }
  },
  // Drops: round with one sharp corner aimed at the middle of the code.
  drops: {
    labelKey: "shapeDrops",
    pathD: function(isDark, n, x0, y0, cell) {
      const R = cell * DROP_RADIUS, mid = (n - 1) / 2;
      let d = "";
      eachModule(isDark, n, x0, y0, cell, function(r, c, x, y) {
        const below = r < mid, rightSide = c < mid;
        // [top-left, top-right, bottom-right, bottom-left]; the corner facing the middle stays sharp.
        const radii = below ? (rightSide ? [R, R, 0, R] : [R, R, R, 0]) : (rightSide ? [R, 0, R, R] : [0, R, R, R]);
        d += roundRectD(x, y, cell, cell, radii);
      });
      return d;
    }
  },
  // Hand-drawn look: every corner of every module is nudged by a fixed hash (never random), so
  // the same code always looks the same.
  sketch: {
    labelKey: "shapeSketch",
    pathD: function(isDark, n, x0, y0, cell) {
      const j = cell * SKETCH_JITTER, g = cell * SKETCH_GROW;
      let d = "";
      eachModule(isDark, n, x0, y0, cell, function(r, c, x, y) {
        const p = function(k, base) { return base + (moduleNoise(r * 4 + k, c * 3 + k) * 2 - 1) * j; };
        d += "M" + f(p(0, x - g)) + " " + f(p(1, y - g)) + "L" + f(p(2, x + cell + g)) + " " + f(p(3, y - g)) +
          "L" + f(p(4, x + cell + g)) + " " + f(p(5, y + cell + g)) + "L" + f(p(6, x - g)) + " " + f(p(7, y + cell + g)) + "Z";
      });
      return d;
    }
  },
  // Squares of slightly different sizes, picked per module by a fixed hash (never random).
  mosaic: {
    labelKey: "shapeMosaic",
    pathD: function(isDark, n, x0, y0, cell) {
      let d = "";
      eachModule(isDark, n, x0, y0, cell, function(r, c, x, y) {
        const k = MOSAIC_SIZES[Math.floor(moduleNoise(r, c) * MOSAIC_SIZES.length)];
        const s = cell * k, o = (cell - s) / 2;
        d += roundRectD(x + o, y + o, s, s, s * 0.12);
      });
      return d;
    }
  }
};

/* ---- Finder patterns ("eyes") ------------------------------------------ */
// Eye frame: outer 7×7 minus inner 5×5, rendered with the even-odd fill rule (so shapes
// inside one eye must not overlap). pathD(x, y, cell, corner) with (x, y) = top-left of the
// 7×7 pattern and corner = 0 top-left, 1 top-right, 2 bottom-left (for shapes that point
// towards the middle of the code).

// Corner radii [top-left, top-right, bottom-right, bottom-left] with the corner that faces
// the middle of the code left sharp.
function pointedRadii(corner, r) {
  if (corner === 1) return [r, r, r, 0];
  if (corner === 2) return [r, 0, r, r];
  return [r, r, 0, r];
}

// The opposite: the corner that points away from the middle (towards the code's outer corner)
// stays sharp, like a drop hanging from it.
function dropRadii(corner, r) {
  if (corner === 1) return [r, 0, r, r];
  if (corner === 2) return [r, r, r, 0];
  return [0, r, r, r];
}

const EYE_FRAME_SHAPES = {
  square: function(x, y, c) { return roundRectD(x, y, 7 * c, 7 * c, 0) + roundRectD(x + c, y + c, 5 * c, 5 * c, 0); },
  rounded: function(x, y, c) { return roundRectD(x, y, 7 * c, 7 * c, 2.2 * c) + roundRectD(x + c, y + c, 5 * c, 5 * c, 1.3 * c); },
  circle: function(x, y, c) { return circleD(x + 3.5 * c, y + 3.5 * c, 3.5 * c) + circleD(x + 3.5 * c, y + 3.5 * c, 2.5 * c); },
  leaf: function(x, y, c) {
    return roundRectD(x, y, 7 * c, 7 * c, [3 * c, 0, 3 * c, 0]) + roundRectD(x + c, y + c, 5 * c, 5 * c, [2 * c, 0, 2 * c, 0]);
  },
  pointed: function(x, y, c, corner) {
    return roundRectD(x, y, 7 * c, 7 * c, pointedRadii(corner, 3 * c)) + roundRectD(x + c, y + c, 5 * c, 5 * c, pointedRadii(corner, 2 * c));
  },
  squircle: function(x, y, c) { return squircleD(x, y, 7 * c, 7 * c, EYE_SQUIRCLE_K) + squircleD(x + c, y + c, 5 * c, 5 * c, EYE_SQUIRCLE_K); },
  chamfered: function(x, y, c) { return chamferD(x, y, 7 * c, 7 * c, 1.6 * c) + chamferD(x + c, y + c, 5 * c, 5 * c, 1.2 * c); },
  extraRounded: function(x, y, c) { return roundRectD(x, y, 7 * c, 7 * c, 2.9 * c) + roundRectD(x + c, y + c, 5 * c, 5 * c, 1.9 * c); },
  drop: function(x, y, c, corner) {
    return roundRectD(x, y, 7 * c, 7 * c, dropRadii(corner, 3 * c)) + roundRectD(x + c, y + c, 5 * c, 5 * c, dropRadii(corner, 2 * c));
  }
};

// Eye ball: the 3×3 centre. pathD(x, y, cell) with (x, y) = top-left of the 3×3 area.
// The circle is slightly larger than 3 modules, which decoded more reliably than an exact one.
const EYE_BALL_SHAPES = {
  square: function(x, y, c) { return roundRectD(x, y, 3 * c, 3 * c, 0); },
  rounded: function(x, y, c) { return roundRectD(x, y, 3 * c, 3 * c, 0.9 * c); },
  circle: function(x, y, c) { return circleD(x + 1.5 * c, y + 1.5 * c, 1.65 * c); },
  leaf: function(x, y, c) { return roundRectD(x, y, 3 * c, 3 * c, [1.3 * c, 0, 1.3 * c, 0]); },
  pointed: function(x, y, c, corner) { return roundRectD(x, y, 3 * c, 3 * c, pointedRadii(corner, 1.3 * c)); },
  squircle: function(x, y, c) { return squircleD(x, y, 3 * c, 3 * c, EYE_SQUIRCLE_K); },
  chamfered: function(x, y, c) { return chamferD(x, y, 3 * c, 3 * c, 0.7 * c); },
  extraRounded: function(x, y, c) { return roundRectD(x, y, 3 * c, 3 * c, 1.2 * c); },
  drop: function(x, y, c, corner) { return roundRectD(x, y, 3 * c, 3 * c, dropRadii(corner, 1.3 * c)); }
};

// The styles offered in the UI: frame + centre pairs that pass the scan tests. A frame of
// separate dots was tried and dropped: it failed for up to 65 % of the tested codes.
const EYE_STYLES = {
  square: { labelKey: "eyeSquare", frame: "square", ball: "square" },
  rounded: { labelKey: "eyeRounded", frame: "rounded", ball: "rounded" },
  roundedDot: { labelKey: "eyeRoundedDot", frame: "rounded", ball: "circle" },
  circle: { labelKey: "eyeCircle", frame: "circle", ball: "circle" },
  leaf: { labelKey: "eyeLeaf", frame: "leaf", ball: "leaf" },
  leafDot: { labelKey: "eyeLeafDot", frame: "leaf", ball: "circle" },
  circleRounded: { labelKey: "eyeCircleRounded", frame: "circle", ball: "rounded" },
  pointed: { labelKey: "eyePointed", frame: "pointed", ball: "pointed" },
  squircle: { labelKey: "eyeSquircle", frame: "squircle", ball: "squircle" },
  chamfered: { labelKey: "eyeChamfered", frame: "chamfered", ball: "chamfered" },
  extraRounded: { labelKey: "eyeExtraRounded", frame: "extraRounded", ball: "extraRounded" },
  drop: { labelKey: "eyeDrop", frame: "drop", ball: "drop" }
};

const GRADIENT_TYPES = ["none", "vertical", "horizontal", "diagonal", "radial", "angle"];

// Confetti: the data modules are split into groups by a fixed hash and every group gets one colour
// of the palette. All colours are dark enough for a light background; the contrast warning checks
// each of them against the chosen background.
const CONFETTI_PALETTES = {
  rainbow: ["#b91c1c", "#c2410c", "#a16207", "#15803d", "#1d4ed8", "#7e22ce"],
  ocean: ["#0c4a6e", "#0369a1", "#0e7490", "#115e59", "#1e3a8a"],
  forest: ["#14532d", "#166534", "#3f6212", "#365314", "#064e3b"],
  sunset: ["#9f1239", "#be123c", "#c2410c", "#9a3412", "#7e22ce"],
  berry: ["#831843", "#9d174d", "#6b21a8", "#581c87", "#be185d"]
};

// Which palette colour a module gets (0 … count-1).
function confettiIndex(row, col, count) {
  return Math.floor(moduleNoise(row + 131, col + 71) * count);
}

// Subtle patterns for the page around the QR block (never inside it: the block and its quiet
// zone are painted on top). Step = pattern spacing in pixels.
const BACKGROUND_PATTERNS = ["none", "dots", "stripes", "grid", "checks"];

function backgroundPatternD(kind, w, h, step) {
  let d = "";
  if (kind === "dots") {
    const r = step * 0.14;
    for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) d += circleD(x, y, r);
  } else if (kind === "stripes") {
    // Diagonal bands as parallelograms, so they need no clipping or stroke support.
    const band = step * 0.28;
    for (let x = -h; x < w; x += step) d += "M" + f(x) + " " + f(h) + "L" + f(x + h) + " 0H" + f(x + h + band) + "L" + f(x + band) + " " + f(h) + "Z";
  } else if (kind === "grid") {
    const t = Math.max(1, step * 0.06);
    for (let x = 0; x < w; x += step) d += roundRectD(x, 0, t, h, 0);
    for (let y = 0; y < h; y += step) d += roundRectD(0, y, w, t, 0);
  } else if (kind === "checks") {
    const q = step / 2;
    for (let y = 0, row = 0; y < h; y += q, row++) {
      for (let x = (row % 2) * q; x < w; x += step) d += roundRectD(x, y, q, q, 0);
    }
  }
  return d;
}

function isFinderModule(row, col, modCount) {
  return (row < 7 && col < 7) || (row < 7 && col >= modCount - 7) || (row >= modCount - 7 && col < 7);
}

// Centres of the alignment patterns per version (ISO/IEC 18004 Annex E; same table as the
// vendored qrcode-generator, checked by tests/unit/shapes.test.js).
const ALIGNMENT_POSITIONS = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
  [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78],
  [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94], [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170]
];

// Modules a scanner needs to locate and sample the grid: finder patterns with their
// separators, timing patterns and alignment patterns. Never cleared for a logo.
function isStructuralModule(row, col, n) {
  if (row < 8 && col < 8 || row < 8 && col >= n - 8 || row >= n - 8 && col < 8) return true;
  if (row === 6 || col === 6) return true;
  // Format information (error correction level and mask) next to the finders.
  if (row === 8 && (col < 9 || col >= n - 8) || col === 8 && (row < 9 || row >= n - 8)) return true;
  const centres = ALIGNMENT_POSITIONS[(n - 17) / 4 - 1] || [];
  for (let i = 0; i < centres.length; i++) {
    for (let j = 0; j < centres.length; j++) {
      const r = centres[i], c = centres[j];
      if (isFinderModule(r, c, n)) continue; // alignment patterns are not placed on the finders
      if (Math.abs(row - r) <= 2 && Math.abs(col - c) <= 2) return true;
    }
  }
  return false;
}

// Top-left module of each finder pattern: top-left, top-right, bottom-left.
function finderOrigins(n) {
  return [[0, 0], [0, n - 7], [n - 7, 0]];
}

// Path data for the three eye frames (rings) and the three centres, each to be filled with
// fillRule "evenodd". They are separate so the centres can get their own colour.
function eyePartsD(n, x0, y0, cell, eyeStyle) {
  const style = Object.prototype.hasOwnProperty.call(EYE_STYLES, eyeStyle) ? EYE_STYLES[eyeStyle] : EYE_STYLES.square;
  const frame = EYE_FRAME_SHAPES[style.frame];
  const ball = EYE_BALL_SHAPES[style.ball];
  let frames = "", balls = "";
  finderOrigins(n).forEach(function(o, corner) {
    const x = x0 + o[1] * cell, y = y0 + o[0] * cell;
    frames += frame(x, y, cell, corner);
    balls += ball(x + 2 * cell, y + 2 * cell, cell, corner);
  });
  return { frames: frames, balls: balls };
}

// Path data for the three eyes (frames + balls), to be filled with fillRule "evenodd".
function eyesPathD(n, x0, y0, cell, eyeStyle) {
  const parts = eyePartsD(n, x0, y0, cell, eyeStyle);
  return parts.frames + parts.balls;
}

// Paint for the modules: a plain colour or a gradient spanning the whole code area.
function qrPaint(opts, x, y, size) {
  const type = GRADIENT_TYPES.indexOf(opts.gradient) > 0 ? opts.gradient : "none";
  if (type === "none") return opts.qrColor;
  // An optional third colour sits in the middle of the gradient.
  const stops = opts.gradientColor3 ? [opts.qrColor, opts.gradientColor3, opts.gradientColor2] : [opts.qrColor, opts.gradientColor2];
  if (type === "radial") return { gradient: "radial", cx: x + size / 2, cy: y + size / 2, r: size * 0.72, stops: stops };
  if (type === "angle") return angleGradient(normalizeAngle(opts.gradientAngle), x, y, size, stops);
  const end = { vertical: [x, y + size], horizontal: [x + size, y], diagonal: [x + size, y + size] }[type];
  return { gradient: "linear", x1: x, y1: y, x2: end[0], y2: end[1], stops: stops };
}

// Whole degrees in 0–359; anything that is not a finite number becomes 45.
function normalizeAngle(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? ((n % 360) + 360) % 360 : 45;
}

// Linear gradient through the centre of the code. 0° runs left to right, 90° top to bottom
// (clockwise, as y grows downwards). The end points are placed so the first and last colour
// touch the corners of the code at every angle.
function angleGradient(degrees, x, y, size, stops) {
  const rad = degrees * Math.PI / 180;
  const dx = Math.cos(rad), dy = Math.sin(rad);
  const half = size / 2 * (Math.abs(dx) + Math.abs(dy));
  const cx = x + size / 2, cy = y + size / 2;
  return { gradient: "linear", x1: cx - dx * half, y1: cy - dy * half, x2: cx + dx * half, y2: cy + dy * half, stops: stops };
}
