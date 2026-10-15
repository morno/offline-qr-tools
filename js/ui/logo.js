"use strict";

/* =========================================================================
 * Logo upload (hardened)
 *  - size cap before reading, magic-byte sniffing (PNG/JPEG only, no SVG),
 *  - dimension cap, then re-encoded through a canvas to a clean PNG so no
 *    original bytes (metadata, polyglot payloads) ever reach an export.
 *  - The same pipeline (loadLogoBuffer) is used for logos inside design files.
 *
 * Depends on: jQuery, ui/state.js; showMessage()/updatePreview() from app.js at event time
 * (the load functions are only called after app.js has loaded)
 * ========================================================================= */

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_MAX_DIMENSION = 4096;
const LOGO_NORMALIZED_MAX = 1024;

function sniffImageMime(bytes) {
  const png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  if (bytes.length >= 8 && png.every(function(b, i) { return bytes[i] === b; })) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return "image/jpeg";
  return null;
}

// Every load gets a number. Decoding is asynchronous, so a slow, older load (or one the user
// has removed in the meantime) must never overwrite what was chosen after it.
let logoLoadSeq = 0;

function clearLogo() {
  logoLoadSeq++;
  logoGenerated = false;
  logoImage = null;
  logoDataUrl = null;
  $("#logoFile").val("");
  $("#logoPreview").empty().append($("<span class='logo-none' data-i18n='none'></span>").text(t("none")));
  $("#removeLogo").hide();
  $("#logoExtras").hide();
}

function rejectLogo(key) {
  clearLogo();
  showMessage("#logoError", key);
  updatePreview();
}

function loadImage(src) {
  return new Promise(function(resolve, reject) {
    const img = new Image();
    img.onload = function() { resolve(img); };
    img.onerror = function() { reject("logoErrRead"); };
    img.src = src;
  });
}

// Re-encodes a decoded image to a clean PNG data URL → Promise<{ img, dataUrl }>.
function normalizeLogo(img) {
  const scale = Math.min(1, LOGO_NORMALIZED_MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL("image/png");
  return loadImage(dataUrl).then(function(clean) { return { img: clean, dataUrl: dataUrl }; });
}

// The hardened pipeline, shared by the file picker and design files (js/ui/design-file.js):
// size cap → sniff → decode → dimension check → re-encode. The original bytes are only ever
// decoded. Resolves to { img, dataUrl }; rejects with an i18n error key. Changes nothing.
function decodeLogoBuffer(buf) {
  if (buf.byteLength > LOGO_MAX_BYTES) return Promise.reject("logoErrSize");
  const mime = sniffImageMime(new Uint8Array(buf, 0, Math.min(16, buf.byteLength)));
  if (!mime) return Promise.reject("logoErrType");
  const blobUrl = URL.createObjectURL(new Blob([buf], { type: mime }));
  return loadImage(blobUrl).then(function(img) {
    URL.revokeObjectURL(blobUrl);
    if (!img.naturalWidth || img.naturalWidth > LOGO_MAX_DIMENSION || img.naturalHeight > LOGO_MAX_DIMENSION) {
      throw "logoErrDims";
    }
    return normalizeLogo(img);
  }, function(key) {
    URL.revokeObjectURL(blobUrl);
    throw key;
  });
}

// Shows a decoded logo right away (and cancels any load still in progress).
function useDecodedLogo(logo) {
  logoLoadSeq++;
  logoImage = logo.img;
  logoDataUrl = logo.dataUrl;
  showMessage("#logoError", null);
  $("#logoPreview").empty().append($("<img>").attr({ src: logo.dataUrl, alt: t("logoPreviewAlt") }));
  $("#removeLogo").show();
  $("#logoExtras").show();
  updatePreview();
}

// Applies the result of a load only if no newer load or removal happened meanwhile.
function finishLogoLoad(promise) {
  const seq = ++logoLoadSeq;
  showMessage("#logoError", null);
  promise.then(function(logo) {
    if (seq === logoLoadSeq) useDecodedLogo(logo);
  }, function(key) {
    if (seq === logoLoadSeq) rejectLogo(typeof key === "string" ? key : "logoErrRead");
  });
}

function loadLogoBuffer(buf) {
  finishLogoLoad(decodeLogoBuffer(buf));
}

// Logos shipped with the app (the Swish symbol in js/assets/swish-symbols.js). They are trusted
// files, not user input, but still go through the same re-encode step so every logo in the
// app is a clean PNG data URL. Only data URLs from the bundled list are accepted.
// An uploaded or bundled logo replaces initials or an icon.
function resetGeneratedLogoFields() {
  $("#logoInitials").val("");
  $("#logoIcon").val("none");
  logoGenerated = false;
}

function loadBundledLogo(dataUrl) {
  const bundled = typeof SWISH_SYMBOLS === "object" ? Object.keys(SWISH_SYMBOLS).map(function(k) { return SWISH_SYMBOLS[k]; }) : [];
  if (bundled.indexOf(dataUrl) < 0) return;
  resetGeneratedLogoFields();
  finishLogoLoad(loadImage(dataUrl).then(normalizeLogo));
}

$("#logoFile").on("change", function(e) {
  const file = e.target.files && e.target.files[0];
  if (file) resetGeneratedLogoFields();
  showMessage("#logoError", null);
  if (!file) return;
  // Checked before reading so a huge file is never loaded into memory.
  if (file.size > LOGO_MAX_BYTES) { rejectLogo("logoErrSize"); return; }
  finishLogoLoad(file.arrayBuffer().then(decodeLogoBuffer, function() { throw "logoErrRead"; }));
});

$("#removeLogo").on("click", function() {
  resetGeneratedLogoFields();
  clearLogo();
  showMessage("#logoError", null);
  updatePreview();
});

/* ---- Logo shape (crop) ----------------------------------------------------- */

// Crops the logo to a centred square cut as a circle or rounded square. The result is a canvas
// (drawn directly) plus its PNG data URL (for SVG), cached so the preview does not redo it.
let shapedLogoCache = { key: null, value: null };

function shapedLogo(img, dataUrl, shape) {
  if (!img || !dataUrl || LOGO_SHAPES.indexOf(shape) <= 0) return { img: img, dataUrl: dataUrl };
  const key = shape + "|" + dataUrl;
  if (shapedLogoCache.key === key) return shapedLogoCache.value;
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const side = Math.min(w, h);
  const c = document.createElement("canvas");
  c.width = c.height = side;
  const ctx = c.getContext("2d");
  ctx.clip(new Path2D(shape === "circle" ? circleD(side / 2, side / 2, side / 2) : roundRectD(0, 0, side, side, side * LOGO_ROUNDED_RADIUS)));
  ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, side, side);
  shapedLogoCache = { key: key, value: { img: c, dataUrl: c.toDataURL("image/png") } };
  return shapedLogoCache.value;
}

/* ---- Generated logos: initials and built-in icons ------------------------ */

// Built-in icons, drawn in a 100 × 100 box with scene primitives (render/scene.js), so they need
// no image file and no upload. They are drawn in white (or black) on a disc in the code colour;
// details marked CUT_OUT take the disc colour.
const CUT_OUT = "cut-out";

function iconStroke(d, color, w) { return { type: "path", d: d, stroke: color, lineWidth: w || 7, cap: "round" }; }

const LOGO_ICONS = {
  wifi: function(c) { return wifiIconItems(50, 52, 62, c); },
  phone: function(c) {
    return [{ type: "path", fill: c, d: "M33 22C30 22 25 26 25 31C25 52 48 75 69 75C74 75 78 70 78 67V60C78 58 76 56 74 56L62 54C60 54 59 55 58 56L54 61C46 57 43 54 39 46L44 42C45 41 46 40 46 38L44 26C44 24 42 22 40 22Z" }];
  },
  envelope: function(c) {
    return [{ type: "path", fill: c, d: roundRectD(20, 30, 60, 42, 5) }, iconStroke("M24 35L50 55L76 35", CUT_OUT, 5)];
  },
  pin: function(c) {
    return [{ type: "path", fill: c, fillRule: "evenodd", d: "M50 82L31 54A23 23 0 1 1 69 54Z" + circleD(50, 41, 9) }];
  },
  calendar: function(c) {
    return [
      { type: "path", fill: c, fillRule: "evenodd", d: roundRectD(22, 27, 56, 50, 6) + roundRectD(28, 43, 44, 28, 2) },
      { type: "path", fill: c, d: roundRectD(33, 20, 7, 15, 3.5) + roundRectD(60, 20, 7, 15, 3.5) + roundRectD(34, 48, 10, 8, 1) + roundRectD(56, 59, 10, 8, 1) }
    ];
  },
  cup: function(c) {
    return [
      { type: "path", fill: c, d: "M24 42H68V58C68 70 60 78 46 78C32 78 24 70 24 58Z" },
      iconStroke("M68 48C80 48 80 64 68 64", c, 6),
      iconStroke("M38 22C34 27 42 30 38 35M52 22C48 27 56 30 52 35", c, 4)
    ];
  },
  heart: function(c) { return [{ type: "path", fill: c, d: heartD(50, 53, 66) }]; },
  star: function(c) { return [{ type: "path", fill: c, d: starD(50, 53, 34) }]; }
};

const LOGO_INITIALS_MAX = 3;
let logoGenerated = false; // true while the logo comes from initials or an icon (never saved as an image)

// Initials: well-formed, no control characters or spaces, at most three characters (code points).
function cleanInitials(raw) {
  return Array.from(toWellFormed(raw || "").replace(/[\u0000-\u001F\u007F\s]+/g, "")).slice(0, LOGO_INITIALS_MAX).join("").toUpperCase();
}

// Draws a generated logo: a disc in the code colour with initials or an icon in the contrast colour.
function buildGeneratedLogo(initials, iconId) {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const bg = sanitizeHex($("#qrColor").val(), "#000000");
  const fg = contrastTextColor(bg);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  if (initials) {
    const px = size * (initials.length > 2 ? 0.36 : initials.length > 1 ? 0.44 : 0.56);
    ctx.fillStyle = fg;
    ctx.font = "bold " + px + "px " + FONT_FAMILY;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, size / 2, size / 2 + px * 0.04, size * 0.8);
  } else if (Object.prototype.hasOwnProperty.call(LOGO_ICONS, iconId)) {
    ctx.save();
    ctx.scale(size / 100, size / 100);
    LOGO_ICONS[iconId](fg).forEach(function(it) {
      drawCanvasItem(ctx, Object.assign({}, it, it.stroke === CUT_OUT ? { stroke: bg } : {}));
    });
    ctx.restore();
  }
  return { img: c, dataUrl: c.toDataURL("image/png") };
}

// Applies (or removes) the generated logo after the initials field or icon select changed.
function updateGeneratedLogo() {
  const initials = cleanInitials($("#logoInitials").val());
  const icon = $("#logoIcon").val();
  if (!initials && !Object.prototype.hasOwnProperty.call(LOGO_ICONS, icon)) {
    if (logoGenerated) { clearLogo(); updatePreview(); }
    return;
  }
  // Marked before useDecodedLogo(), which redraws the preview: everything that runs on that redraw
  // must already know the logo is generated.
  logoGenerated = true;
  useDecodedLogo(buildGeneratedLogo(initials, icon));
  $("#designLogoWrap").hide();
}

$("#logoInitials").on("input", function() {
  if (cleanInitials($(this).val())) $("#logoIcon").val("none");
  updateGeneratedLogo();
});
$("#logoIcon").on("change", function() {
  if ($(this).val() !== "none") $("#logoInitials").val("");
  updateGeneratedLogo();
});
// The generated disc follows the code colour.
$("#qrColor").on("change", function() { if (logoGenerated) updateGeneratedLogo(); });

/* ---- Colours from the logo ---------------------------------------------- */

// Reads the uploaded logo's pixels (it is already a clean, re-encoded PNG) and applies the code
// and frame colours that pickLogoColors() suggests. Nothing leaves the browser.
$("#logoColors").on("click", function() {
  if (!logoImage || logoGenerated) return;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(logoImage, 0, 0, 64, 64);
  const picked = pickLogoColors(ctx.getImageData(0, 0, 64, 64).data, $("#qrBgColor").val());
  if (!picked) { showMessage("#logoColorsStatus", "logoColorsNone"); return; }
  $("#qrColor").val(picked.qr).trigger("change");
  $("#frameColor").val(picked.accent).trigger("change");
  showMessage("#logoColorsStatus", "logoColorsDone");
});

// Only an uploaded image has colours to pick from.
$(document).on("preview:rendered", function() {
  $("#logoColors").toggle(Boolean(logoImage) && !logoGenerated);
});
