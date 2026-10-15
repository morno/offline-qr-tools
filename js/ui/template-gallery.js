"use strict";

/* =========================================================================
 * Template gallery
 *
 * Ready-made looks applied through the design-file path (parseDesignFile + applyDesignControls in
 * ui/design-file.js), so a template can only set what a design file could set. Unlike design
 * files, a template may suggest a heading and caption: it fills those fields only when they are
 * empty or still hold the previous template's text. Kept apart from design-file.js, which must
 * never touch text fields (a unit test checks).
 *
 * Depends on: jQuery, core/design.js, render/*, ui/design-file.js; getRenderOpts(),
 *             updateQrStyleVisibility(), updatePreview(), showMessage() from app.js
 * ========================================================================= */


// Complete looks (frame, shapes, colours and a suggested text) for common uses and Swedish
// holidays. A template is applied exactly like a design file: through parseDesignFile() with the
// form's own options, so it can only set values a design file could set. Content is never touched;
// the suggested heading and caption only fill fields that are empty or still hold the previous
// template's text.
const TEMPLATE_BASE_STYLE = {
  qrShape: "square", eyeStyle: "square", qrColor: "#000000", qrBgColor: "#ffffff", gradient: "none", gradientColor2: "#0369a1",
  moduleColors: "single", useGradientColor3: false, customEyeColor: false, customEyeBallColor: false, qrCornerRadius: "0",
  bgPattern: "none", frameStyle: "none", frameColor: "#1a1a1a", frameColor2: "#0369a1", textStyle: "plain", autoTextColor: true
};

const TEMPLATE_GALLERY = [
  {id: "cafe", labelKey: "tplCafe", style: {"frameStyle": "awning", "frameColor": "#7c2d12", "qrShape": "liquid", "eyeStyle": "rounded", "qrColor": "#3f2a1d"}, titleKey: "tplCafeTitle", captionKey: "tplCafeCaption"},
  {id: "restaurant", labelKey: "tplRestaurant", style: {"frameStyle": "chalkboard", "frameColor": "#1f2937", "qrShape": "rounded", "eyeStyle": "extraRounded"}, titleKey: "tplRestaurantTitle", captionKey: "tplRestaurantCaption"},
  {id: "hotel", labelKey: "tplHotel", style: {"frameStyle": "elevated", "frameColor": "#1e3a5f", "qrShape": "classy", "eyeStyle": "leaf", "qrColor": "#1e3a5f"}, titleKey: "tplHotelTitle", captionKey: "tplHotelCaption"},
  {id: "office", labelKey: "tplOffice", style: {"frameStyle": "fieldset", "qrShape": "square", "eyeStyle": "rounded", "qrColor": "#0f172a", "frameColor": "#0f172a"}, titleKey: "tplOfficeTitle", captionKey: "tplOfficeCaption"},
  {id: "gym", labelKey: "tplGym", style: {"frameStyle": "cornerBand", "frameColor": "#dc2626", "qrShape": "square", "eyeStyle": "chamfered", "qrColor": "#111827"}, titleKey: "tplGymTitle", captionKey: "tplGymCaption"},
  {id: "beauty", labelKey: "tplBeauty", style: {"frameStyle": "badge", "frameColor": "#9d174d", "qrShape": "dots", "eyeStyle": "circle", "qrColor": "#831843"}, titleKey: "tplBeautyTitle", captionKey: "tplBeautyCaption"},
  {id: "realEstate", labelKey: "tplRealEstate", style: {"frameStyle": "house", "frameColor": "#0369a1", "qrShape": "squircle", "eyeStyle": "squircle", "qrColor": "#0c4a6e"}, titleKey: "tplRealEstateTitle", captionKey: "tplRealEstateCaption"},
  {id: "shop", labelKey: "tplShop", style: {"frameStyle": "hangTag", "frameColor": "#b91c1c", "qrShape": "rounded", "eyeStyle": "rounded"}, titleKey: "tplShopTitle", captionKey: "tplShopCaption"},
  {id: "event", labelKey: "tplEvent", style: {"frameStyle": "ticket", "frameColor": "#6d28d9", "qrShape": "beads", "eyeStyle": "circle", "gradient": "diagonal", "qrColor": "#4c1d95", "gradientColor2": "#be123c"}, titleKey: "tplEventTitle", captionKey: "tplEventCaption"},
  {id: "wedding", labelKey: "tplWedding", style: {"frameStyle": "heart", "frameColor": "#be123c", "qrShape": "dots", "eyeStyle": "circle", "qrColor": "#881337"}, titleKey: "tplWeddingTitle", captionKey: "tplWeddingCaption"},
  {id: "modern", labelKey: "tplModern", style: {"frameStyle": "roundCode", "frameColor": "#c4b5fd", "qrShape": "dots", "eyeStyle": "circle", "moduleColors": "berry"}},
  {id: "christmas", labelKey: "tplChristmas", style: {"frameStyle": "gift", "frameColor": "#b91c1c", "qrShape": "stars", "eyeStyle": "extraRounded", "qrColor": "#166534"}, titleKey: "tplChristmasTitle", captionKey: "tplChristmasCaption"},
  {id: "lucia", labelKey: "tplLucia", style: {"frameStyle": "stamp", "frameColor": "#1e3a8a", "qrShape": "squircle", "eyeStyle": "rounded", "qrColor": "#1e3a8a"}, titleKey: "tplLuciaTitle", captionKey: "tplLuciaCaption"},
  {id: "easter", labelKey: "tplEaster", style: {"frameStyle": "splitCard", "frameColor": "#ca8a04", "frameColor2": "#15803d", "qrShape": "drops", "eyeStyle": "drop", "qrColor": "#365314"}, titleKey: "tplEasterTitle", captionKey: "tplEasterCaption"},
  {id: "midsummer", labelKey: "tplMidsummer", style: {"frameStyle": "doubleRibbon", "frameColor": "#15803d", "qrShape": "liquid", "eyeStyle": "leaf", "moduleColors": "forest"}, titleKey: "tplMidsummerTitle", captionKey: "tplMidsummerCaption"},
  {id: "halloween", labelKey: "tplHalloween", style: {"frameStyle": "card", "frameColor": "#ea580c", "qrShape": "sketch", "eyeStyle": "pointed", "qrColor": "#1c1917"}, titleKey: "tplHalloweenTitle", captionKey: "tplHalloweenCaption"},
  {id: "valentine", labelKey: "tplValentine", style: {"frameStyle": "heart", "frameColor": "#e11d48", "qrShape": "hearts", "eyeStyle": "rounded", "moduleColors": "berry"}, titleKey: "tplValentineTitle", captionKey: "tplValentineCaption"}
];

let lastTemplateTexts = { title: null, caption: null };

function templateStyle(tpl) {
  return Object.assign({}, TEMPLATE_BASE_STYLE, tpl.style);
}

// Render options for a thumbnail: the current code and form, with the template's look on top.
function templateRenderOpts(tpl) {
  const style = templateStyle(tpl);
  return Object.assign(getRenderOpts(), {
    frameStyle: style.frameStyle, frameColor: style.frameColor, frameColor2: style.frameColor2,
    qrShape: style.qrShape, eyeStyle: style.eyeStyle, qrColor: style.qrColor, qrBgColor: style.qrBgColor,
    gradient: style.gradient, gradientColor2: style.gradientColor2, gradientColor3: null,
    moduleColors: style.moduleColors, bgPattern: style.bgPattern, qrCornerRadius: parseInt(style.qrCornerRadius, 10),
    eyeColor: null, eyeBallColor: null, textStyle: "plain", textColorOverride: null,
    title: tpl.titleKey ? t(tpl.titleKey) : "", caption: tpl.captionKey ? t(tpl.captionKey) : "",
    logoImage: null, logoDataUrl: null, transparent: false
  });
}

function applyTemplate(id) {
  const tpl = TEMPLATE_GALLERY.filter(function(x) { return x.id === id; })[0];
  if (!tpl) return;
  const result = parseDesignFile(JSON.stringify(buildDesign(templateStyle(tpl), null)), designEnumOptions());
  if (result.error) return;
  applyDesignControls(result.style);
  [["#titleText", "title", tpl.titleKey], ["#captionText", "caption", tpl.captionKey]].forEach(function(f) {
    const field = $(f[0]);
    const current = String(field.val());
    if (current.trim() === "" || current === lastTemplateTexts[f[1]]) {
      const text = f[2] ? t(f[2]) : "";
      field.val(text);
      lastTemplateTexts[f[1]] = text;
    }
  });
  updateQrStyleVisibility();
  updatePreview();
  showMessage("#templateStatus", "templateApplied");
}

// Thumbnails are drawn with the current code, only while the gallery is open.
function renderTemplateGallery() {
  const grid = $("#templateGrid");
  if (!$("#templateSection").prop("open") || !currentQR) return;
  if (!grid.children().length) {
    TEMPLATE_GALLERY.forEach(function(tpl) {
      $("<button type='button' class='template-btn'></button>").attr("data-template", tpl.id)
        .append($("<span class='template-thumb' aria-hidden='true'></span>"))
        .append($("<span class='template-label'></span>").attr("data-i18n", tpl.labelKey).text(t(tpl.labelKey)))
        .appendTo(grid);
    });
  }
  grid.children().each(function() {
    const tpl = TEMPLATE_GALLERY.filter(function(x) { return x.id === this.getAttribute("data-template"); }, this)[0];
    const canvas = sceneToCanvas(buildScene(currentQR, 240, templateRenderOpts(tpl)));
    $(this).find(".template-thumb").empty().append(canvas);
  });
}

$("#templateGrid").on("click", "button[data-template]", function() { applyTemplate($(this).attr("data-template")); });
$("#templateSection").on("toggle", renderTemplateGallery);
$(document).on("preview:rendered i18n:applied", debounce(renderTemplateGallery, 300));
