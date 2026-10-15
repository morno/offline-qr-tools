"use strict";

/* =========================================================================
 * Frame templates
 *
 * build(M, o, tx) returns:
 *   h         total height (width is always M.S)
 *   block     { x, y, size, radius? }  QR incl. quiet zone — drawn by the core, never by templates
 *   back      primitives drawn BEFORE the QR (anything overlapping the block gets covered)
 *   front     text primitives drawn AFTER the QR (dropped if they overlap the block)
 *   pageColor background of the whole image (null = transparent)
 * blockOnPaper: true means the QR block sits on the template's own paper, so a transparent
 * export keeps the QR background there.
 *
 * To add a style: add an entry here and an <option> in #frameStyle (+ i18n key).
 *
 * Depends on: render/scene.js, core/util.js; t() from ui/i18n.js at render time
 * ========================================================================= */

// Rectangle (x0, y0)–(x1, y1) with semicircular bites along every edge and quarter bites
// at the corners. The holes are cut out of the outline (not painted over), so the stamp
// also works on a transparent background. All arcs use sweep 0: they bend into the paper.
function stampPathD(x0, y0, x1, y1, r) {
  const bite = function(ex, ey) { return "A" + f(r) + " " + f(r) + " 0 0 0 " + f(ex) + " " + f(ey); };
  const centres = function(from, to) {
    const len = Math.abs(to - from);
    const count = Math.max(2, Math.round(len / (r * 3.2)));
    const list = [];
    for (let i = 1; i < count; i++) list.push(from + (to - from) * i / count);
    return list;
  };
  let d = "M" + f(x0 + r) + " " + f(y0);
  centres(x0, x1).forEach(function(c) { d += "L" + f(c - r) + " " + f(y0) + bite(c + r, y0); });
  d += "L" + f(x1 - r) + " " + f(y0) + bite(x1, y0 + r);
  centres(y0, y1).forEach(function(c) { d += "L" + f(x1) + " " + f(c - r) + bite(x1, c + r); });
  d += "L" + f(x1) + " " + f(y1 - r) + bite(x1 - r, y1);
  centres(x1, x0).forEach(function(c) { d += "L" + f(c + r) + " " + f(y1) + bite(c - r, y1); });
  d += "L" + f(x0 + r) + " " + f(y1) + bite(x0, y1 - r);
  centres(y1, y0).forEach(function(c) { d += "L" + f(x0) + " " + f(c + r) + bite(x0, c - r); });
  d += "L" + f(x0) + " " + f(y0 + r) + bite(x0 + r, y0) + "Z";
  return d;
}

// Ticket outline (0, 0)–(w, h): rounded corners of radius r and a semicircular notch of
// radius nr on each side at the perforation height ny. Like the stamp, the notches are cut
// out of the outline instead of painted over, so the ticket also works on a transparent
// background. The outline runs clockwise: corners use sweep 1 (bulge out), notches sweep 0
// (bend into the paper).
function ticketPathD(w, h, r, ny, nr) {
  const corner = function(ex, ey) { return "A" + f(r) + " " + f(r) + " 0 0 1 " + f(ex) + " " + f(ey); };
  const notch = function(ex, ey) { return "A" + f(nr) + " " + f(nr) + " 0 0 0 " + f(ex) + " " + f(ey); };
  return "M" + f(r) + " 0H" + f(w - r) + corner(w, r) +
    "V" + f(ny - nr) + notch(w, ny + nr) +
    "V" + f(h - r) + corner(w - r, h) +
    "H" + f(r) + corner(0, h - r) +
    "V" + f(ny + nr) + notch(0, ny - nr) +
    "V" + f(r) + corner(r, 0) + "Z";
}

// Classic layouts: optional frame line + text as plain lines or colored plates.
function classicTemplate(kind) {
  return {
    ownsText: false,
    build: function(M, o, tx) {
      const S = M.S;
      const framed = kind !== "none";
      const lw = kind === "dashed" ? Math.max(2, S * 0.008) : (framed ? Math.max(2, S * 0.015) : 0);
      const R = kind === "rounded" ? S * 0.06 : 0;
      const Rin = Math.max(0, R - lw);
      const inset = framed ? lw + S * 0.03 : 0;
      const B = S - inset * 2;
      const banner = o.textStyle === "banner";
      const innerW = S - lw * 2;
      const plainMaxW = S - 2 * Math.max(inset, S * 0.05);
      const back = [];
      const front = [];
      let y = lw;

      if (o.title) {
        if (banner) {
          const h = M.bandH(M.fontTitle);
          back.push({ type: "path", d: roundRectD(lw, y, innerW, h, [Rin, Rin, 0, 0]), fill: o.textBgColor });
          front.push.apply(front, tx({ text: o.title, cx: S / 2, cy: y + h / 2, basePx: M.fontTitle, maxWidth: innerW - S * 0.08, bold: true, bg: o.textBgColor, icon: o.wifiIcon && !o.caption }));
          y += h + (framed ? S * 0.03 : 0);
        } else {
          const h = M.fontTitle * 2.2;
          y += framed ? S * 0.02 : 0;
          front.push.apply(front, tx({ text: o.title, cx: S / 2, cy: y + h / 2, basePx: M.fontTitle, maxWidth: plainMaxW, bold: true, bg: o.qrBgColor, icon: o.wifiIcon && !o.caption }));
          y += h;
        }
      } else {
        y += framed ? inset - lw : 0;
      }

      const block = { x: inset, y: y, size: B };
      y += B;

      if (o.caption) {
        if (banner) {
          const h = M.bandH(M.fontCaption);
          y += framed ? S * 0.03 : 0;
          back.push({ type: "path", d: roundRectD(lw, y, innerW, h, [0, 0, Rin, Rin]), fill: o.textBgColor });
          front.push.apply(front, tx({ text: o.caption, cx: S / 2, cy: y + h / 2, basePx: M.fontCaption, maxWidth: innerW - S * 0.08, bold: true, bg: o.textBgColor, icon: o.wifiIcon }));
          y += h;
        } else {
          const h = M.fontCaption * 2.2;
          front.push.apply(front, tx({ text: o.caption, cx: S / 2, cy: y + h / 2, basePx: M.fontCaption, maxWidth: plainMaxW, bold: false, bg: o.qrBgColor, icon: o.wifiIcon }));
          y += h + (framed ? S * 0.02 : 0);
        }
      } else {
        y += framed ? inset - lw : 0;
      }
      y += lw;

      if (framed) {
        // The frame line goes last in the back layer so it sits on top of the plates.
        back.push({
          type: "path",
          d: roundRectD(lw / 2, lw / 2, S - lw, y - lw, R),
          stroke: o.frameColor,
          lineWidth: lw,
          dash: kind === "dashed" ? [lw * 4, lw * 3] : null
        });
        if (kind === "double") {
          // Thin inner line; first in the back layer so text plates cover it instead of crossing it.
          const lw2 = lw * 0.45;
          const off = lw * 1.9;
          back.unshift({ type: "path", d: roundRectD(off, off, S - off * 2, y - off * 2, Math.max(0, R - off)), stroke: o.frameColor, lineWidth: lw2 });
        }
      }
      return { h: y, block: block, back: back, front: front, pageColor: o.qrBgColor };
    }
  };
}

/* ---- Helpers for the frames below --------------------------------------- */

// Bounding box of the items tx() returned (they all share one), or null when empty.
function textBox(items) {
  return items.length ? items[0].bbox : null;
}

// True when a w×h rectangle centred on (cx, cy) and turned by `angle` overlaps the axis-aligned
// rectangle r (separating-axis test: the shapes are apart if some edge direction separates them).
function rotatedRectHits(cx, cy, w, h, angle, r) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(function(p) {
    return [cx + p[0] * cos - p[1] * sin, cy + p[0] * sin + p[1] * cos];
  });
  const rect = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
  const axes = [[1, 0], [0, 1], [cos, sin], [-sin, cos]];
  return axes.every(function(a) {
    const proj = function(list) { return list.map(function(p) { return p[0] * a[0] + p[1] * a[1]; }); };
    const p1 = proj(pts), p2 = proj(rect);
    return Math.max.apply(null, p1) > Math.min.apply(null, p2) && Math.max.apply(null, p2) > Math.min.apply(null, p1);
  });
}

// Straight text rotated by `angle` (radians) around (cx, cy), e.g. along a diagonal band.
// Built without an icon (icons are not rotated). The renderer's overlap check works on
// axis-aligned boxes, which are far too large for turned text, so the exact check is done here
// against `avoid` (the QR block): overlapping text is dropped, otherwise the items get a tiny
// box that the renderer's check accepts.
function rotatedText(tx, spec, angle, avoid) {
  const items = tx(Object.assign({}, spec, { icon: false }));
  const box = textBox(items);
  if (!box || rotatedRectHits(spec.cx, spec.cy, box.w, box.h, angle, avoid)) return [];
  const bbox = { x: spec.cx, y: spec.cy, w: 0, h: 0 };
  return items.filter(function(it) { return it.type === "text"; }).map(function(it) {
    return Object.assign({}, it, { x: spec.cx, y: spec.cy, rotate: angle, bbox: bbox });
  });
}

// Text along a circle around (cx, cy): on top it reads left to right over the circle, at the
// bottom left to right under it (letters upright in both cases). tx() fits the text to the arc
// length and picks the colour, then every character is placed and turned on its own.
function arcText(tx, spec) {
  const arcLen = spec.radius * spec.maxAngle * 2;
  const fitted = tx({ text: spec.text, cx: 0, cy: 0, basePx: spec.basePx, maxWidth: arcLen, bold: true, bg: spec.bg })
    .filter(function(it) { return it.type === "text"; })[0];
  if (!fitted) return [];
  const chars = Array.from(fitted.text);
  const widths = chars.map(function(ch) { return measureTextWidth(ch, fitted.size, true); });
  const total = widths.reduce(function(a, b) { return a + b; }, 0) / spec.radius;
  let acc = 0;
  return chars.map(function(ch, i) {
    const mid = (acc + widths[i] / 2) / spec.radius;
    acc += widths[i];
    const a = spec.top ? -Math.PI / 2 - total / 2 + mid : Math.PI / 2 + total / 2 - mid;
    const x = spec.cx + Math.cos(a) * spec.radius, y = spec.cy + Math.sin(a) * spec.radius;
    const rot = spec.top ? a + Math.PI / 2 : a - Math.PI / 2;
    // Exact per-character check against the QR block (see rotatedText()).
    if (rotatedRectHits(x, y, widths[i], fitted.size * 1.2, rot, spec.avoid)) return null;
    return { type: "text", x: x, y: y, text: ch, size: fitted.size, bold: true, fill: fitted.fill,
      rotate: rot, bbox: { x: x, y: y, w: 0, h: 0 } };
  }).filter(Boolean);
}

// Ribbon band with folded tails, its top edge at y (shared by the ribbon and double ribbon).
function ribbonBand(S, y, h, color) {
  const a = S * 0.07, d = h * 0.3, drop = h * 0.3, notch = h * 0.35, ty = y + drop;
  const dark = shadeHex(color, -0.3), darker = shadeHex(color, -0.55);
  return [
    { type: "path", fill: dark, d: "M0 " + f(ty) + "H" + f(a + d) + "V" + f(ty + h) + "H0L" + f(notch) + " " + f(ty + h / 2) + "Z" },
    { type: "path", fill: dark, d: "M" + f(S) + " " + f(ty) + "H" + f(S - a - d) + "V" + f(ty + h) + "H" + f(S) + "L" + f(S - notch) + " " + f(ty + h / 2) + "Z" },
    { type: "path", fill: darker, d: "M" + f(a) + " " + f(y + h) + "H" + f(a + d) + "V" + f(y + h + drop) + "Z" },
    { type: "path", fill: darker, d: "M" + f(S - a) + " " + f(y + h) + "H" + f(S - a - d) + "V" + f(y + h + drop) + "Z" },
    { type: "rect", x: a, y: y, w: S - a * 2, h: h, fill: color }
  ];
}

// Plain text line centred at (cx, cy) on the given background; returns tx() items.
function frameText(tx, o, text, cx, cy, basePx, maxWidth, bold, bg, icon) {
  return text ? tx({ text: text, cx: cx, cy: cy, basePx: basePx, maxWidth: maxWidth, bold: bold, bg: bg, icon: icon }) : [];
}

const FRAME_TEMPLATES = {
  none: classicTemplate("none"),
  border: classicTemplate("border"),
  rounded: classicTemplate("rounded"),
  dashed: classicTemplate("dashed"),
  double: classicTemplate("double"),

  // Camera viewfinder: corner brackets around the code, title above and caption below.
  brackets: {
    ownsText: true,
    build: function(M, o, tx) {
      const S = M.S;
      const lw = Math.max(2, S * 0.018);
      const inset = S * 0.06;
      const B = S - inset * 2;
      const arm = B * 0.2;
      const titleH = o.title ? M.fontTitle * 2.2 : S * 0.02;
      const captionH = o.caption ? M.fontCaption * 2.2 : S * 0.02;
      const top = titleH + inset;
      const front = [];
      if (o.title) {
        front.push.apply(front, tx({ text: o.title, cx: S / 2, cy: titleH / 2 + S * 0.01, basePx: M.fontTitle, maxWidth: S - inset * 2, bold: true, bg: o.qrBgColor, icon: o.wifiIcon && !o.caption }));
      }
      if (o.caption) {
        front.push.apply(front, tx({ text: o.caption, cx: S / 2, cy: top + B + inset + captionH / 2 - S * 0.01, basePx: M.fontCaption, maxWidth: S - inset * 2, bold: false, bg: o.qrBgColor, icon: o.wifiIcon }));
      }
      // Brackets sit just outside the QR block, so they can never cover a module.
      const e = lw / 2 + S * 0.006;
      const x0 = inset - e, y0 = top - e, x1 = inset + B + e, y1 = top + B + e;
      const d = "M" + f(x0) + " " + f(y0 + arm) + "V" + f(y0) + "H" + f(x0 + arm) +
        "M" + f(x1 - arm) + " " + f(y0) + "H" + f(x1) + "V" + f(y0 + arm) +
        "M" + f(x1) + " " + f(y1 - arm) + "V" + f(y1) + "H" + f(x1 - arm) +
        "M" + f(x0 + arm) + " " + f(y1) + "H" + f(x0) + "V" + f(y1 - arm);
      const back = [{ type: "path", d: d, stroke: o.frameColor, lineWidth: lw, cap: "round" }];
      return { h: top + B + inset + captionH, block: { x: inset, y: top, size: B }, back: back, front: front, pageColor: o.qrBgColor };
    }
  },

  // Postage stamp: frame-coloured paper with perforated edges, text in the top and bottom bands.
  stamp: {
    ownsText: true,
    blockOnPaper: true,
    build: function(M, o, tx) {
      const S = M.S;
      const hole = S * 0.018;           // perforation radius; the paper edge runs through the hole centres
      const edge = S * 0.07;
      const headH = o.title ? M.bandH(M.fontTitle) : edge;
      const footH = o.caption ? M.bandH(M.fontCaption) : edge;
      const B = S - hole * 2 - edge * 2;
      const h = hole * 2 + headH + B + footH;
      const back = [{ type: "path", d: stampPathD(hole, hole, S - hole, h - hole, hole), fill: o.frameColor }];
      const front = [];
      if (o.title) {
        front.push.apply(front, tx({ text: o.title, cx: S / 2, cy: hole + headH / 2, basePx: M.fontTitle, maxWidth: B, bold: true, bg: o.frameColor, icon: o.wifiIcon && !o.caption }));
      }
      if (o.caption) {
        front.push.apply(front, tx({ text: o.caption, cx: S / 2, cy: hole + headH + B + footH / 2, basePx: M.fontCaption, maxWidth: B, bold: true, bg: o.frameColor, icon: o.wifiIcon }));
      }
      return { h: h, block: { x: hole + edge, y: hole + headH, size: B }, back: back, front: front, pageColor: null };
    }
  },

  // Thick colored card: title in the header band, caption in the footer band.
  card: {
    ownsText: true,
    blockOnPaper: true,
    build: function(M, o, tx) {
      const S = M.S;
      const edge = S * 0.06;
      const headH = o.title ? M.bandH(M.fontTitle) : edge;
      const footH = o.caption ? M.bandH(M.fontCaption) : edge;
      const B = S - edge * 2;
      const h = headH + B + footH;
      const back = [{ type: "path", d: roundRectD(0, 0, S, h, S * 0.06), fill: o.frameColor }];
      const front = [];
      if (o.title) {
        front.push.apply(front, tx({ text: o.title, cx: S / 2, cy: headH / 2, basePx: M.fontTitle, maxWidth: S - edge * 3, bold: true, bg: o.frameColor, icon: o.wifiIcon && !o.caption }));
      }
      if (o.caption) {
        front.push.apply(front, tx({ text: o.caption, cx: S / 2, cy: headH + B + footH / 2, basePx: M.fontCaption, maxWidth: S - edge * 3, bold: true, bg: o.frameColor, icon: o.wifiIcon }));
      }
      return { h: h, block: { x: edge, y: headH, size: B, radius: S * 0.03 }, back: back, front: front, pageColor: null };
    }
  },

  // Admission ticket: title in the header, the code, a perforation with a notch on each side,
  // and the caption on the stub below it. Suits events, guest networks and vouchers.
  ticket: {
    ownsText: true,
    blockOnPaper: true,
    build: function(M, o, tx) {
      const S = M.S;
      const edge = S * 0.06;
      // Smaller than edge, so a notch (horizontally and vertically) never reaches the QR block.
      const notchR = S * 0.04;
      const B = S - edge * 2;
      const headH = o.title ? M.bandH(M.fontTitle) : edge;
      const perfY = headH + B + edge;
      const stubH = Math.max(M.bandH(M.fontCaption), notchR * 3);
      const h = perfY + stubH;
      // The perforation must stay visible on any paper colour: darken light paper, lighten dark.
      const perfColor = shadeHex(o.frameColor, relativeLuminance(o.frameColor) > 0.5 ? -0.35 : 0.45);
      const lw = Math.max(1.5, S * 0.006);
      const back = [
        { type: "path", d: ticketPathD(S, h, S * 0.04, perfY, notchR), fill: o.frameColor },
        { type: "path", d: "M" + f(notchR + lw * 3) + " " + f(perfY) + "H" + f(S - notchR - lw * 3),
          stroke: perfColor, lineWidth: lw, dash: [lw * 3, lw * 2.5] }
      ];
      const front = [];
      if (o.title) {
        front.push.apply(front, tx({ text: o.title, cx: S / 2, cy: headH / 2, basePx: M.fontTitle, maxWidth: S - edge * 3, bold: true, bg: o.frameColor, icon: o.wifiIcon && !o.caption }));
      }
      // The stub is part of the ticket's look, so it is never left empty.
      front.push.apply(front, tx({ text: o.caption || t("scanMe"), cx: S / 2, cy: perfY + stubH / 2, basePx: M.fontCaption, maxWidth: S - notchR * 2 - edge * 2, bold: true, bg: o.frameColor, icon: o.wifiIcon }));
      return { h: h, block: { x: edge, y: headH, size: B, radius: S * 0.02 }, back: back, front: front, pageColor: null };
    }
  },

  // Instant-photo look: narrow paper edges, a wide bottom strip holding title and caption,
  // and a soft offset shadow. The paper uses the frame colour; pick a light one for classic.
  polaroid: {
    ownsText: true,
    blockOnPaper: true,
    build: function(M, o, tx) {
      const S = M.S;
      const shadow = S * 0.012;
      const W = S - shadow;
      const edge = W * 0.06;
      const B = W - edge * 2;
      const lines = (o.title ? 1 : 0) + (o.caption ? 1 : 0);
      const titleH = o.title ? M.fontTitle * 1.9 : 0;
      const captionH = o.caption ? M.fontCaption * 1.9 : 0;
      const footH = Math.max(W * 0.18, titleH + captionH + (lines ? edge : 0));
      const h = edge + B + footH;
      const back = [
        { type: "path", d: roundRectD(shadow, shadow, W, h, S * 0.012), fill: shadeHex(o.frameColor, -0.35) },
        { type: "path", d: roundRectD(0, 0, W, h, S * 0.012), fill: o.frameColor }
      ];
      const front = [];
      let y = edge + B + (footH - titleH - captionH) / 2;
      if (o.title) {
        front.push.apply(front, tx({ text: o.title, cx: W / 2, cy: y + titleH / 2, basePx: M.fontTitle, maxWidth: W - edge * 3, bold: true, bg: o.frameColor, icon: o.wifiIcon && !o.caption }));
        y += titleH;
      }
      if (o.caption) {
        front.push.apply(front, tx({ text: o.caption, cx: W / 2, cy: y + captionH / 2, basePx: M.fontCaption, maxWidth: W - edge * 3, bold: false, bg: o.frameColor, icon: o.wifiIcon }));
      }
      return { h: h + shadow, block: { x: edge, y: edge, size: B }, back: back, front: front, pageColor: null };
    }
  },

  // Ribbon band with folded tails under the QR code.
  ribbon: {
    ownsText: true,
    build: function(M, o, tx) {
      const S = M.S;
      const margin = S * 0.1;           // block side margin, leaves room for the tails
      const B = S - margin * 2;
      const dark = shadeHex(o.frameColor, -0.3);
      const darker = shadeHex(o.frameColor, -0.55);
      const back = [];
      const front = [];
      let y = S * 0.03;

      if (o.title) {
        const th = M.fontTitle * 2.2;
        front.push.apply(front, tx({ text: o.title, cx: S / 2, cy: y + th / 2, basePx: M.fontTitle, maxWidth: S - margin * 2, bold: true, bg: o.qrBgColor }));
        y += th;
      }

      const block = { x: margin, y: y, size: B };
      y += B + S * 0.015;

      const h = M.bandH(M.fontCaption);
      const a = S * 0.07;               // main band inset from the edges
      const d = h * 0.3;                // tail tuck-in / fold width
      const drop = h * 0.3;             // tails sit lower than the band
      const notch = h * 0.35;           // V-cut depth at the tail ends
      const ty = y + drop;

      back.push({ type: "path", fill: dark,
        d: "M0 " + f(ty) + "H" + f(a + d) + "V" + f(ty + h) + "H0L" + f(notch) + " " + f(ty + h / 2) + "Z" });
      back.push({ type: "path", fill: dark,
        d: "M" + f(S) + " " + f(ty) + "H" + f(S - a - d) + "V" + f(ty + h) + "H" + f(S) + "L" + f(S - notch) + " " + f(ty + h / 2) + "Z" });
      back.push({ type: "path", fill: darker,
        d: "M" + f(a) + " " + f(y + h) + "H" + f(a + d) + "V" + f(y + h + drop) + "Z" });
      back.push({ type: "path", fill: darker,
        d: "M" + f(S - a) + " " + f(y + h) + "H" + f(S - a - d) + "V" + f(y + h + drop) + "Z" });
      back.push({ type: "rect", x: a, y: y, w: S - a * 2, h: h, fill: o.frameColor });

      front.push.apply(front, tx({ text: o.caption || t("scanMe"), cx: S / 2, cy: y + h / 2, basePx: M.fontCaption, maxWidth: S - a * 2 - S * 0.06, bold: true, bg: o.frameColor, icon: o.wifiIcon }));

      return { h: y + h + drop + S * 0.03, block: block, back: back, front: front, pageColor: o.qrBgColor };
    }
  },

  // Speech bubble above the QR code, pointing down at it.
  bubble: {
    ownsText: true,
    build: function(M, o, tx) {
      const S = M.S;
      const margin = S * 0.07;
      const B = S - margin * 2;
      const h = M.bandH(M.fontTitle);
      const bx = S * 0.1;
      const bw = S - bx * 2;
      const by = S * 0.03;
      const pw = h * 0.55;
      const ph = h * 0.38;
      const back = [
        { type: "path", d: roundRectD(bx, by, bw, h, h / 2), fill: o.frameColor },
        // The pointer starts 1px inside the pill to avoid an anti-aliasing seam.
        { type: "path", fill: o.frameColor,
          d: "M" + f(S / 2 - pw / 2) + " " + f(by + h - 1) + "H" + f(S / 2 + pw / 2) + "L" + f(S / 2) + " " + f(by + h + ph) + "Z" }
      ];
      const front = tx({ text: o.title || t("scanMe"), cx: S / 2, cy: by + h / 2, basePx: M.fontTitle, maxWidth: bw - h, bold: true, bg: o.frameColor, icon: o.wifiIcon });

      let y = by + h + ph + S * 0.01;
      const block = { x: margin, y: y, size: B };
      y += B;

      if (o.caption) {
        const ch = M.fontCaption * 2.2;
        front.push.apply(front, tx({ text: o.caption, cx: S / 2, cy: y + ch / 2, basePx: M.fontCaption, maxWidth: S - margin * 2, bold: false, bg: o.qrBgColor }));
        y += ch;
      } else {
        y += S * 0.03;
      }
      return { h: y, block: block, back: back, front: front, pageColor: o.qrBgColor };
    }
  },
  // Thin outline with the heading breaking the top line and the caption the bottom line,
  // like an HTML <fieldset>.
  fieldset: {
    ownsText: true,
    build: function(M, o, tx) {
      const S = M.S;
      const lw = Math.max(2, S * 0.008);
      const titleH = o.title ? M.fontTitle * 1.6 : lw * 2;
      const captionH = o.caption ? M.fontCaption * 1.6 : lw * 2;
      const top = titleH / 2;
      const inset = lw + S * 0.05;
      const B = S - inset * 2;
      // Text centred on the line reaches 0.6 × its size below/above it (makeText's box is 1.2 ×).
      const gapTop = Math.max(inset, (o.title ? M.fontTitle * 0.65 : 0) + S * 0.02);
      const gapBottom = Math.max(inset, (o.caption ? M.fontCaption * 0.65 : 0) + S * 0.02);
      const blockY = top + gapTop;
      const bottom = blockY + B + gapBottom;
      const front = [];
      const back = [{ type: "path", d: roundRectD(lw / 2, top, S - lw, bottom - top, S * 0.03), stroke: o.frameColor, lineWidth: lw }];
      [[o.title, top, M.fontTitle, true, o.wifiIcon && !o.caption], [o.caption, bottom, M.fontCaption, false, o.wifiIcon]].forEach(function(t) {
        const items = frameText(tx, o, t[0], S / 2, t[1], t[2], S - S * 0.2, t[3], o.qrBgColor, t[4]);
        const box = textBox(items);
        // A plate in the page colour hides the line behind the text.
        if (box) back.push({ type: "rect", x: box.x - S * 0.02, y: t[1] - lw * 2, w: box.w + S * 0.04, h: lw * 4, fill: o.qrBgColor });
        front.push.apply(front, items);
      });
      return { h: bottom + captionH / 2, block: { x: inset, y: blockY, size: B }, back: back, front: front, pageColor: o.qrBgColor };
    }
  },

  // Hang tag: cut top corners, a punched hole with a loop of string, heading and caption on the tag.
  hangTag: {
    ownsText: true,
    blockOnPaper: true,
    build: function(M, o, tx) {
      const S = M.S;
      const edge = S * 0.07;
      const holeR = S * 0.035;
      const neck = S * 0.15;                       // tag starts below the string loop
      const cut = S * 0.16;
      const titleH = o.title ? M.bandH(M.fontTitle) : edge;
      const captionH = o.caption ? M.bandH(M.fontCaption) : edge;
      const top = neck + holeR * 2 + S * 0.02;     // hole sits in the cut-off point
      const B = S - edge * 2;
      const blockY = top + titleH;
      const h = blockY + B + captionH;
      const holeY = neck + holeR + S * 0.035;
      const tag = "M" + f(cut) + " " + f(neck) + "H" + f(S - cut) + "L" + f(S) + " " + f(neck + cut) + "V" + f(h - S * 0.03) +
        "Q" + f(S) + " " + f(h) + " " + f(S - S * 0.03) + " " + f(h) + "H" + f(S * 0.03) + "Q0 " + f(h) + " 0 " + f(h - S * 0.03) +
        "V" + f(neck + cut) + "Z" + circleD(S / 2, holeY, holeR);
      const string = "M" + f(S / 2 - holeR * 0.4) + " " + f(holeY) + "C" + f(S * 0.3) + " " + f(S * 0.02) + " " + f(S * 0.7) + " " + f(S * 0.02) + " " + f(S / 2 + holeR * 0.4) + " " + f(holeY);
      const back = [
        { type: "path", d: tag, fill: o.frameColor, fillRule: "evenodd" },
        { type: "path", d: string, stroke: shadeHex(o.frameColor, relativeLuminance(o.frameColor) > 0.5 ? -0.5 : 0.3), lineWidth: Math.max(2, S * 0.008), cap: "round" }
      ];
      const front = frameText(tx, o, o.title, S / 2, top + titleH / 2, M.fontTitle, S - edge * 3, true, o.frameColor, o.wifiIcon && !o.caption)
        .concat(frameText(tx, o, o.caption, S / 2, blockY + B + captionH / 2, M.fontCaption, S - edge * 3, true, o.frameColor, o.wifiIcon));
      return { h: h, block: { x: edge, y: blockY, size: B }, back: back, front: front, pageColor: null };
    }
  },

  // Diagonal band across the top-right corner with a short text (the heading, or "Scan me!").
  // The block keeps a wider margin there, so the band always stays outside it.
  cornerBand: {
    ownsText: true,
    build: function(M, o, tx) {
      const S = M.S;
      const m = S * 0.19;
      const B = S - m * 2;
      const captionH = o.caption ? M.fontCaption * 2.2 : S * 0.02;
      const h = m + B + Math.max(m * 0.6, captionH);
      // Band between the diagonals d1 and d2 (distance from the corner along both edges);
      // the block's own corner is at 2m, so the band (d2 < 2m) never reaches it.
      const d1 = m * 0.3, d2 = m * 1.75, dm = (d1 + d2) / 2;
      const lw = Math.max(2, S * 0.01);
      const back = [
        { type: "path", d: roundRectD(lw / 2, lw / 2, S - lw, h - lw, S * 0.04), stroke: o.frameColor, lineWidth: lw },
        { type: "path", fill: o.frameColor,
          d: "M" + f(S - d2) + " 0H" + f(S - d1) + "L" + f(S) + " " + f(d1) + "V" + f(d2) + "Z" }
      ];
      // A line "x' + y = d" (x' measured from the right edge) is d/√2 from the corner and d·√2 long
      // inside the image. The text's outer edge is h/√2 nearer the corner than its centre line,
      // so the usable width there is dc·√2 − h; its inner edge (dc + h/√2) must stay below d2.
      const basePx = Math.min((d2 - d1) * 0.36, M.fontTitle);
      const dc = (d1 + d2) / 2 + basePx * 0.25;
      const band = rotatedText(tx, { text: o.title || t("scanMe"), cx: S - dc / 2, cy: dc / 2, basePx: basePx,
        maxWidth: dc * Math.SQRT2 - basePx * 1.3, bold: true, bg: o.frameColor }, Math.PI / 4, { x: m, y: m, w: B, h: B });
      const front = band.concat(frameText(tx, o, o.caption, S / 2, m + B + captionH / 2, M.fontCaption, S - m * 2, false, o.qrBgColor, o.wifiIcon));
      return { h: h, block: { x: m, y: m, size: B }, back: back, front: front, pageColor: o.qrBgColor };
    }
  },

  // Striped shop awning with a scalloped edge above the heading and the code.
  awning: {
    ownsText: true,
    build: function(M, o, tx) {
      const S = M.S;
      const stripes = 8, sw = S / stripes;
      const awH = S * 0.13, scallop = sw / 2;
      const light = shadeHex(o.frameColor, relativeLuminance(o.frameColor) > 0.7 ? -0.25 : 0.85);
      const back = [{ type: "rect", x: 0, y: 0, w: S, h: awH, fill: light }];
      let dark = "";
      for (let i = 0; i < stripes; i++) {
        const x = i * sw;
        if (i % 2 === 0) dark += "M" + f(x) + " 0H" + f(x + sw) + "V" + f(awH) + "H" + f(x) + "Z";
      }
      back.push({ type: "path", d: dark, fill: o.frameColor });
      // Scallops: one half-disc per stripe, in the stripe's colour.
      let darkTips = "", lightTips = "";
      for (let i = 0; i < stripes; i++) {
        const tip = "M" + f(i * sw) + " " + f(awH - 0.5) + "A" + f(scallop) + " " + f(scallop) + " 0 0 0 " + f((i + 1) * sw) + " " + f(awH - 0.5) + "Z";
        if (i % 2 === 0) darkTips += tip; else lightTips += tip;
      }
      back.push({ type: "path", d: darkTips, fill: o.frameColor }, { type: "path", d: lightTips, fill: light });
      const margin = S * 0.08;
      const B = S - margin * 2;
      let y = awH + scallop + S * 0.02;
      const front = [];
      if (o.title) {
        const th = M.fontTitle * 2.2;
        front.push.apply(front, frameText(tx, o, o.title, S / 2, y + th / 2, M.fontTitle, S - margin * 2, true, o.qrBgColor, o.wifiIcon && !o.caption));
        y += th;
      }
      const block = { x: margin, y: y, size: B };
      y += B;
      if (o.caption) {
        const ch = M.fontCaption * 2.2;
        front.push.apply(front, frameText(tx, o, o.caption, S / 2, y + ch / 2, M.fontCaption, S - margin * 2, false, o.qrBgColor, o.wifiIcon));
        y += ch;
      } else {
        y += margin * 0.6;
      }
      return { h: y, block: block, back: back, front: front, pageColor: o.qrBgColor };
    }
  },

  // Chalkboard: a board in the frame colour with a lighter edge, a dashed chalk line inside and
  // the code on its own paper.
  chalkboard: {
    ownsText: true,
    blockOnPaper: true,
    build: function(M, o, tx) {
      const S = M.S;
      const rim = S * 0.035;
      const lw = Math.max(1.5, S * 0.005);
      const chalkAt = rim + lw * 4;                // the dashed chalk line, just inside the rim
      const sheet = S * 0.025;                     // paper margin outside the quiet zone
      const edge = chalkAt + S * 0.04 + sheet;
      const titleH = chalkAt + sheet + (o.title ? M.bandH(M.fontTitle) : S * 0.04);
      const captionH = chalkAt + sheet + (o.caption ? M.bandH(M.fontCaption) : S * 0.04);
      const B = S - edge * 2;
      const h = titleH + B + captionH;
      const chalk = contrastTextColor(o.frameColor) === "#ffffff" ? "#f8fafc" : "#1f2937";
      const back = [
        { type: "path", d: roundRectD(0, 0, S, h, S * 0.02), fill: shadeHex(o.frameColor, relativeLuminance(o.frameColor) > 0.5 ? -0.3 : 0.35) },
        { type: "path", d: roundRectD(rim, rim, S - rim * 2, h - rim * 2, S * 0.01), fill: o.frameColor },
        { type: "path", d: roundRectD(chalkAt, chalkAt, S - chalkAt * 2, h - chalkAt * 2, S * 0.01), stroke: chalk, lineWidth: lw, dash: [lw * 4, lw * 3] },
        { type: "path", d: roundRectD(edge - sheet, titleH - sheet, S - (edge - sheet) * 2, B + sheet * 2, S * 0.008), fill: o.qrBgColor }
      ];
      const front = frameText(tx, o, o.title, S / 2, chalkAt + (titleH - chalkAt - sheet) / 2, M.fontTitle, S - edge * 2.5, true, o.frameColor, o.wifiIcon && !o.caption)
        .concat(frameText(tx, o, o.caption, S / 2, titleH + B + sheet + (captionH - chalkAt - sheet) / 2, M.fontCaption, S - edge * 2.5, false, o.frameColor, o.wifiIcon));
      return { h: h, block: { x: edge, y: titleH, size: B }, back: back, front: front, pageColor: null };
    }
  },

  // Ribbons above and below the code: the heading on the top one, the caption (or "Scan me!")
  // on the bottom one.
  doubleRibbon: {
    ownsText: true,
    build: function(M, o, tx) {
      const S = M.S;
      const margin = S * 0.1;
      const B = S - margin * 2;
      const hTop = M.bandH(M.fontTitle), hBottom = M.bandH(M.fontCaption);
      const back = [];
      const front = [];
      let y = S * 0.02;
      if (o.title) {
        back.push.apply(back, ribbonBand(S, y, hTop, o.frameColor));
        front.push.apply(front, frameText(tx, o, o.title, S / 2, y + hTop / 2, M.fontTitle, S - S * 0.2, true, o.frameColor, o.wifiIcon && !o.caption));
        y += hTop * 1.3 + S * 0.015;
      }
      const block = { x: margin, y: y, size: B };
      y += B + S * 0.015;
      back.push.apply(back, ribbonBand(S, y, hBottom, o.frameColor));
      front.push.apply(front, frameText(tx, o, o.caption || t("scanMe"), S / 2, y + hBottom / 2, M.fontCaption, S - S * 0.2, true, o.frameColor, o.wifiIcon));
      return { h: y + hBottom * 1.3 + S * 0.03, block: block, back: back, front: front, pageColor: o.qrBgColor };
    }
  },

  // Card in two colours: the heading band in the frame colour, the caption band in the second
  // frame colour.
  splitCard: {
    ownsText: true,
    blockOnPaper: true,
    secondColor: true,
    build: function(M, o, tx) {
      const S = M.S;
      const edge = S * 0.06;
      const R = S * 0.06;
      const headH = o.title ? M.bandH(M.fontTitle) : edge;
      const footH = Math.max(o.caption ? M.bandH(M.fontCaption) : edge, edge * 1.5);
      const B = S - edge * 2;
      const h = headH + B + footH;
      const split = headH + B + edge * 0.5;
      const color2 = o.frameColor2 || shadeHex(o.frameColor, -0.3);
      const back = [
        { type: "path", d: roundRectD(0, 0, S, split, [R, R, 0, 0]), fill: o.frameColor },
        { type: "path", d: roundRectD(0, split, S, h - split, [0, 0, R, R]), fill: color2 }
      ];
      const front = frameText(tx, o, o.title, S / 2, headH / 2, M.fontTitle, S - edge * 3, true, o.frameColor, o.wifiIcon && !o.caption)
        .concat(frameText(tx, o, o.caption, S / 2, split + (h - split) / 2, M.fontCaption, S - edge * 3, true, color2, o.wifiIcon));
      return { h: h, block: { x: edge, y: headH, size: B, radius: S * 0.03 }, back: back, front: front, pageColor: null };
    }
  },

  // Thick frame with a tab sticking up from the top edge, holding the heading (or "Scan me!").
  tab: {
    ownsText: true,
    build: function(M, o, tx) {
      const S = M.S;
      const lw = Math.max(3, S * 0.022);
      const tabH = M.bandH(M.fontTitle) * 0.9;
      const label = tx({ text: o.title || t("scanMe"), cx: S / 2, cy: tabH / 2 + lw * 0.3, basePx: M.fontTitle * 0.9, maxWidth: S * 0.7, bold: true, bg: o.frameColor, icon: o.wifiIcon && !o.caption });
      const box = textBox(label);
      const tabW = Math.min(S - S * 0.1, Math.max(S * 0.4, (box ? box.w : 0) + S * 0.12));
      const top = tabH;
      const inset = lw + S * 0.035;
      const B = S - inset * 2;
      const captionH = o.caption ? M.fontCaption * 2.2 : 0;
      const h = top + inset + B + inset + captionH;
      const back = [
        { type: "path", d: roundRectD((S - tabW) / 2, 0, tabW, tabH + lw, [S * 0.03, S * 0.03, 0, 0]), fill: o.frameColor },
        { type: "path", d: roundRectD(lw / 2, top + lw / 2, S - lw, h - top - lw, S * 0.03), stroke: o.frameColor, lineWidth: lw }
      ];
      const front = label.concat(frameText(tx, o, o.caption, S / 2, top + inset + B + inset * 0.4 + captionH / 2, M.fontCaption, S - inset * 2, false, o.qrBgColor, o.wifiIcon));
      return { h: h, block: { x: inset, y: top + inset, size: B }, back: back, front: front, pageColor: o.qrBgColor };
    }
  },

  // Heading with a hand-drawn style arrow curving down towards the code.
  arrow: {
    ownsText: true,
    build: function(M, o, tx) {
      const S = M.S;
      const margin = S * 0.07;
      const B = S - margin * 2;
      const headH = Math.max(M.fontTitle * 2.6, S * 0.17);
      const label = tx({ text: o.title || t("scanMe"), cx: S * 0.4, cy: headH * 0.42, basePx: M.fontTitle, maxWidth: S * 0.62, bold: true, bg: o.qrBgColor, icon: o.wifiIcon && !o.caption });
      const box = textBox(label);
      const lw = Math.max(2.5, S * 0.012);
      const x0 = (box ? box.x + box.w : S * 0.6) + S * 0.025, y0 = headH * 0.42;
      const x1 = Math.min(S - margin * 1.5, x0 + S * 0.16), y1 = headH - lw * 1.5;
      const curve = "M" + f(x0) + " " + f(y0) + "C" + f(x1) + " " + f(y0 - S * 0.02) + " " + f(x1 + S * 0.01) + " " + f(y0 + S * 0.02) + " " + f(x1) + " " + f(y1);
      const head = S * 0.03;
      const tip = "M" + f(x1 - head) + " " + f(y1 - head) + "L" + f(x1) + " " + f(y1) + "L" + f(x1 + head) + " " + f(y1 - head);
      const back = [
        { type: "path", d: curve, stroke: o.frameColor, lineWidth: lw, cap: "round" },
        { type: "path", d: tip, stroke: o.frameColor, lineWidth: lw, cap: "round" }
      ];
      const captionH = o.caption ? M.fontCaption * 2.2 : S * 0.03;
      const front = label.concat(frameText(tx, o, o.caption, S / 2, headH + B + captionH / 2, M.fontCaption, S - margin * 2, false, o.qrBgColor, o.wifiIcon));
      return { h: headH + B + captionH, block: { x: margin, y: headH, size: B }, back: back, front: front, pageColor: o.qrBgColor };
    }
  },

  // Raised card: paper in the background colour with an outline and a solid offset shadow in
  // the frame colour (solid, not blurred, so the PDF matches the screen).
  elevated: {
    ownsText: true,
    blockOnPaper: true,
    build: function(M, o, tx) {
      const S = M.S;
      const off = S * 0.03;
      const W = S - off;
      const edge = W * 0.06;
      const lw = Math.max(2, S * 0.008);
      const titleH = o.title ? M.bandH(M.fontTitle) : edge;
      const captionH = o.caption ? M.bandH(M.fontCaption) : edge;
      const B = W - edge * 2;
      const h = titleH + B + captionH;
      const back = [
        { type: "path", d: roundRectD(off, off, W, h, S * 0.04), fill: o.frameColor },
        { type: "path", d: roundRectD(lw / 2, lw / 2, W - lw, h - lw, S * 0.04), fill: o.qrBgColor, stroke: o.frameColor, lineWidth: lw }
      ];
      const front = frameText(tx, o, o.title, W / 2, titleH / 2, M.fontTitle, W - edge * 2.5, true, o.qrBgColor, o.wifiIcon && !o.caption)
        .concat(frameText(tx, o, o.caption, W / 2, titleH + B + captionH / 2, M.fontCaption, W - edge * 2.5, false, o.qrBgColor, o.wifiIcon));
      return { h: h + off, block: { x: edge, y: titleH, size: B }, back: back, front: front, pageColor: null };
    }
  },

  // Round badge: the code on a disc, the heading curving along the top and the caption along
  // the bottom.
  badge: {
    ownsText: true,
    blockOnPaper: true,
    build: function(M, o, tx) {
      const S = M.S;
      const R = S / 2;
      // The block's corners stay inside the disc with room for the text ring above and below.
      const B = S * 0.6;
      const pos = (S - B) / 2;
      const ringR = R * 0.84;
      const back = [
        { type: "circle", cx: R, cy: R, r: R, fill: o.frameColor },
        { type: "path", d: circleD(R, R, R * 0.965) + circleD(R, R, R * 0.94), fill: shadeHex(o.frameColor, relativeLuminance(o.frameColor) > 0.5 ? -0.25 : 0.3), fillRule: "evenodd" }
      ];
      const size = Math.min(M.fontCaption, R * 0.1);
      // About ±38° keeps every character clear of the block's corners.
      const arc = { cx: R, cy: R, radius: ringR, basePx: size, maxAngle: 0.66, bg: o.frameColor, avoid: { x: pos, y: pos, w: B, h: B } };
      const front = arcText(tx, Object.assign({ text: o.title || t("scanMe"), top: true }, arc))
        .concat(o.caption ? arcText(tx, Object.assign({ text: o.caption, top: false }, arc)) : []);
      return { h: S, block: { x: pos, y: pos, size: B, radius: S * 0.02 }, back: back, front: front, pageColor: null };
    }
  },

  /* ---- Frames that match a content type (suggested in the UI, FRAME_SUGGESTIONS in app.js) ---- */

  // Tear-off calendar page: binder rings, a coloured header with the heading, the code below.
  calendar: {
    ownsText: true,
    blockOnPaper: true,
    build: function(M, o, tx) {
      const S = M.S;
      const ringsH = S * 0.035;
      const headH = Math.max(M.bandH(M.fontTitle) * 1.1, S * 0.13);
      const edge = S * 0.06;
      const B = S - edge * 2;
      const captionH = o.caption ? M.bandH(M.fontCaption) : edge;
      const top = ringsH;
      const h = top + headH + edge * 0.6 + B + captionH;
      const R = S * 0.04;
      const lw = Math.max(1.5, S * 0.005);
      const back = [
        { type: "path", d: roundRectD(lw / 2, top + lw / 2, S - lw, h - top - lw, R), fill: o.qrBgColor, stroke: shadeHex(o.frameColor, 0.4), lineWidth: lw },
        { type: "path", d: roundRectD(0, top, S, headH, [R, R, 0, 0]), fill: o.frameColor }
      ];
      // Two binder rings poking out above the page.
      const ring = shadeHex(o.frameColor, relativeLuminance(o.frameColor) > 0.5 ? -0.5 : -0.6);
      [0.28, 0.72].forEach(function(k) {
        back.push({ type: "path", d: roundRectD(S * k - S * 0.018, 0, S * 0.036, ringsH * 2.2, S * 0.018), fill: ring });
      });
      const front = frameText(tx, o, o.title || t("printHeadingEvent"), S / 2, top + headH / 2 + ringsH * 0.3, M.fontTitle, S - edge * 3, true, o.frameColor, o.wifiIcon && !o.caption)
        .concat(frameText(tx, o, o.caption, S / 2, top + headH + edge * 0.6 + B + captionH / 2, M.fontCaption, S - edge * 3, false, o.qrBgColor, o.wifiIcon));
      return { h: h, block: { x: edge, y: top + headH + edge * 0.6, size: B }, back: back, front: front, pageColor: null };
    }
  },

  // Map pin: the code in the round head of a location pin; heading above, caption under the tip.
  mapPin: {
    ownsText: true,
    blockOnPaper: true,
    build: function(M, o, tx) {
      const S = M.S;
      const titleH = o.title ? M.fontTitle * 2.2 : 0;
      const R = S * 0.48;
      const cx = S / 2, cy = titleH + R + S * 0.01;
      // The square block fits in the head's circle; a white disc just around its corners keeps
      // the pin colour away from the quiet zone's corners.
      const B = R * Math.SQRT2 * 0.9;
      const tipY = cy + R * 1.75;
      // Tangent points where the tail leaves the circle.
      const ang = Math.asin(R / (tipY - cy));
      const tx0 = cx - R * Math.cos(ang), ty0 = cy + R * Math.sin(ang);
      const pin = "M" + f(tx0) + " " + f(ty0) + "A" + f(R) + " " + f(R) + " 0 1 1 " + f(S - tx0) + " " + f(ty0) + "L" + f(cx) + " " + f(tipY) + "Z";
      const back = [{ type: "path", d: pin, fill: o.frameColor }, { type: "circle", cx: cx, cy: cy, r: R * 0.93, fill: o.qrBgColor }];
      const captionH = o.caption ? M.fontCaption * 2.2 : S * 0.02;
      const front = frameText(tx, o, o.title, S / 2, titleH / 2, M.fontTitle, S * 0.9, true, o.qrBgColor, o.wifiIcon && !o.caption)
        .concat(frameText(tx, o, o.caption, S / 2, tipY + captionH / 2, M.fontCaption, S * 0.9, false, o.qrBgColor, o.wifiIcon));
      return { h: tipY + captionH, block: { x: cx - B / 2, y: cy - B / 2, size: B, radius: S * 0.02 }, back: back, front: front, pageColor: o.qrBgColor };
    }
  },

  // Envelope: an open flap behind a letter that holds the code, the pocket in front with the
  // caption. The pocket's V-shaped edge starts below the code, so it never covers it.
  envelope: {
    ownsText: true,
    blockOnPaper: true,
    build: function(M, o, tx) {
      const S = M.S;
      const lx = S * 0.07, lw = S - lx * 2;
      const pad = S * 0.065;                       // white letter margin outside the quiet zone
      const B = lw - pad * 2;
      const titleH = o.title ? M.fontTitle * 2 : pad;
      const flapTop = 0, letterTop = S * 0.05;
      const blockY = letterTop + titleH;
      const pocketTop = blockY + B + pad * 0.6;
      const dip = S * 0.1;
      const captionH = Math.max(o.caption ? M.bandH(M.fontCaption) : 0, S * 0.08);
      const h = pocketTop + dip + captionH + S * 0.03;
      const body = shadeHex(o.frameColor, -0.25);
      const back = [
        { type: "path", d: "M0 " + f(S * 0.32) + "L" + f(S / 2) + " " + f(flapTop) + "L" + f(S) + " " + f(S * 0.32) + "V" + f(h) + "H0Z", fill: body },
        { type: "path", d: roundRectD(lx, letterTop, lw, pocketTop + dip - letterTop, S * 0.015), fill: o.qrBgColor },
        { type: "path", d: "M0 " + f(pocketTop) + "L" + f(S / 2) + " " + f(pocketTop + dip) + "L" + f(S) + " " + f(pocketTop) + "V" + f(h) + "H0Z", fill: o.frameColor }
      ];
      const front = frameText(tx, o, o.title, S / 2, letterTop + titleH / 2, M.fontTitle, lw - pad * 2, true, o.qrBgColor, o.wifiIcon && !o.caption)
        .concat(frameText(tx, o, o.caption, S / 2, pocketTop + dip + captionH / 2, M.fontCaption, S - S * 0.16, true, o.frameColor, o.wifiIcon));
      return { h: h, block: { x: lx + pad, y: blockY, size: B }, back: back, front: front, pageColor: null };
    }
  },

  // Phone: a device outline with the code on its screen, heading above and caption below it.
  phone: {
    ownsText: true,
    blockOnPaper: true,
    build: function(M, o, tx) {
      const S = M.S;
      const bezel = S * 0.045;
      const top = S * 0.08;                        // room for the speaker slot
      const pad = S * 0.035;
      const sx = bezel, sw = S - bezel * 2;
      const B = sw - pad * 2;
      const titleH = o.title ? M.fontTitle * 2.1 : pad;
      const captionH = o.caption ? M.fontCaption * 2.1 : pad;
      const screenH = titleH + B + captionH;
      const h = top + screenH + S * 0.1;
      const back = [
        { type: "path", d: roundRectD(0, 0, S, h, S * 0.09), fill: o.frameColor },
        { type: "path", d: roundRectD(sx, top, sw, screenH, S * 0.035), fill: o.qrBgColor },
        { type: "path", d: roundRectD(S / 2 - S * 0.08, top / 2 - S * 0.008, S * 0.16, S * 0.016, S * 0.008), fill: shadeHex(o.frameColor, relativeLuminance(o.frameColor) > 0.5 ? -0.4 : 0.35) },
        { type: "path", d: roundRectD(S / 2 - S * 0.12, top + screenH + S * 0.045, S * 0.24, S * 0.014, S * 0.007), fill: shadeHex(o.frameColor, relativeLuminance(o.frameColor) > 0.5 ? -0.4 : 0.35) }
      ];
      const front = frameText(tx, o, o.title, S / 2, top + titleH / 2, M.fontTitle, sw - pad * 2, true, o.qrBgColor, o.wifiIcon && !o.caption)
        .concat(frameText(tx, o, o.caption, S / 2, top + titleH + B + captionH / 2, M.fontCaption, sw - pad * 2, false, o.qrBgColor, o.wifiIcon));
      return { h: h, block: { x: sx + pad, y: top + titleH, size: B }, back: back, front: front, pageColor: null };
    }
  },

  // Business card (landscape): the code on the left, heading and caption on the right, an accent
  // stripe in the frame colour along the bottom.
  businessCard: {
    ownsText: true,
    blockOnPaper: true,
    build: function(M, o, tx) {
      const S = M.S;
      const h = S * 0.58;
      const pad = S * 0.05;
      const stripe = S * 0.035;
      const B = h - pad * 2 - stripe;
      const colX = pad + B + pad * 0.8;
      const colW = S - colX - pad;
      const colCx = colX + colW / 2;
      const lw = Math.max(1.5, S * 0.005);
      const back = [
        { type: "path", d: roundRectD(lw / 2, lw / 2, S - lw, h - lw, S * 0.03), fill: o.qrBgColor, stroke: shadeHex(o.frameColor, 0.4), lineWidth: lw },
        { type: "path", d: roundRectD(0, h - stripe, S, stripe, [0, 0, S * 0.03, S * 0.03]), fill: o.frameColor }
      ];
      const mid = (h - stripe) / 2;
      const both = o.title && o.caption;
      const front = frameText(tx, o, o.title, colCx, both ? mid - M.fontTitle * 0.75 : mid, M.fontTitle, colW, true, o.qrBgColor, o.wifiIcon && !o.caption)
        .concat(frameText(tx, o, o.caption, colCx, both ? mid + M.fontCaption * 0.95 : mid, M.fontCaption, colW, false, o.qrBgColor, o.wifiIcon));
      return { h: h, block: { x: pad, y: pad, size: B }, back: back, front: front, pageColor: null };
    }
  },

  // Wi-Fi signal: a large Wi-Fi symbol crowning a rounded frame, heading under it.
  wifiSignal: {
    ownsText: true,
    build: function(M, o, tx) {
      const S = M.S;
      const lw = Math.max(2, S * 0.012);
      const iconS = S * 0.17;
      const iconTop = S * 0.02;
      const inset = lw + S * 0.045;
      const B = S - inset * 2;
      const titleH = o.title ? M.fontTitle * 2 : S * 0.02;
      const top = iconTop + iconS + titleH;
      const captionH = o.caption ? M.fontCaption * 2.2 : inset * 0.6;
      const frameTop = iconTop + iconS * 0.55;
      const h = top + B + inset * 0.5 + captionH;
      const back = [{ type: "path", d: roundRectD(lw / 2, frameTop, S - lw, h - frameTop - lw / 2, S * 0.05), stroke: o.frameColor, lineWidth: lw },
        // A plate behind the symbol interrupts the frame line, so the arcs crown it.
        { type: "rect", x: S / 2 - iconS * 0.75, y: frameTop - lw, w: iconS * 1.5, h: lw * 2, fill: o.qrBgColor }];
      back.push.apply(back, wifiIconItems(S / 2, iconTop + iconS / 2, iconS, o.frameColor));
      const front = frameText(tx, o, o.title, S / 2, iconTop + iconS + titleH / 2, M.fontTitle, S - inset * 2, true, o.qrBgColor, false)
        .concat(frameText(tx, o, o.caption, S / 2, top + B + inset * 0.3 + captionH / 2, M.fontCaption, S - inset * 2, false, o.qrBgColor, false));
      return { h: h, block: { x: inset, y: top, size: B }, back: back, front: front, pageColor: o.qrBgColor };
    }
  }
};
