"use strict";

/* =========================================================================
 * Accessible colour picker
 *
 * Swatch button + palette popover + hex field, named via the visible caption.
 *
 * Depends on: jQuery, core/util.js, ui/i18n.js
 * ========================================================================= */

const COLOR_PALETTE = [
  "#1a1a1a", "#4b5563", "#0f172a", "#1e3a5f",
  "#0f766e", "#166534", "#854d0e", "#7c2d12",
  "#991b1b", "#9d174d", "#6b21a8", "#4338ca",
  "#0369a1", "#0891b2", "#65a30d", "#ca8a04",
  "#ea580c", "#e11d48", "#ffffff", "#f3f4f6"
];

// Brand palette: up to BRAND_PALETTE_MAX colours (core/design.js) kept in the hidden #brandPalette
// input as "#rrggbb,#rrggbb". It lives in memory and in design files only, never in storage.
function readBrandPalette() {
  return String($("#brandPalette").val() || "").split(",")
    .map(function(v) { return sanitizeHex(v.trim(), ""); })
    .filter(function(v, i, list) { return v && list.indexOf(v) === i; })
    .slice(0, BRAND_PALETTE_MAX);
}

function writeBrandPalette(list) {
  $("#brandPalette").val(list.slice(0, BRAND_PALETTE_MAX).join(",")).trigger("change");
}

function addToBrandPalette(hex) {
  const list = readBrandPalette().filter(function(v) { return v !== hex; });
  list.unshift(hex); // newest first; the oldest drops off when the palette is full
  writeBrandPalette(list);
}

function setupColorPicker(name) {
  const swatchBtn = $("#" + name + "Swatch");
  const hiddenInput = $("#" + name);
  const popover = $("#" + name + "Popover");
  const grid = $("#" + name + "Grid");
  const hexInput = $("#" + name + "Hex");

  const caption = $("#" + name + "Caption");
  const brandGrid = $("<div class='swatch-grid brand-grid'></div>").attr("id", name + "BrandGrid").insertBefore(grid);
  const addBtn = $("<button type='button' class='small-btn brand-add'>+</button>").attr("id", name + "BrandAdd")
    .appendTo(hexInput.closest(".hex-input-row"));
  swatchBtn.attr({ "aria-expanded": "false", "aria-controls": name + "Popover" });

  function currentHex() {
    return sanitizeHex(hiddenInput.val(), "#000000").slice(1);
  }

  function refreshUI() {
    const hex = currentHex();
    swatchBtn.css("background", "#" + hex);
    // e.g. "QR color: #000000, pick color" — the caption tells which of the five pickers this is.
    swatchBtn.attr({ "aria-label": caption.text() + ": #" + hex + ", " + t("pickColor"), "title": "#" + hex });
    hexInput.attr("aria-label", t("hexCodeLabel") + ", " + caption.text());
    if (document.activeElement !== hexInput[0]) hexInput.val(hex);
    addBtn.attr({ "aria-label": t("brandPaletteAdd") + ", " + caption.text(), "title": t("brandPaletteAdd") });
    popover.find(".swatch-grid button").each(function() {
      const selected = $(this).attr("data-hex") === hex;
      $(this).toggleClass("selected", selected).attr("aria-pressed", String(selected));
    });
  }

  // Brand colours first, as a separate row (hidden when the palette is empty).
  function renderBrandGrid() {
    brandGrid.empty();
    readBrandPalette().forEach(function(hex) {
      const clean = hex.slice(1);
      $("<button type='button'></button>")
        .css("background", hex)
        .attr({ "data-hex": clean, "aria-label": t("brandPaletteLabel") + " " + hex, "title": hex })
        .on("click", function() { setColor(clean); })
        .appendTo(brandGrid);
    });
    brandGrid.toggle(brandGrid.children().length > 0);
    refreshUI();
  }

  function setColor(hex) {
    hiddenInput.val("#" + hex.toLowerCase()).trigger("change");
  }

  // Keep the swatch in sync no matter who changes the value.
  hiddenInput.on("change", refreshUI);

  function close() {
    popover.removeClass("open");
    swatchBtn.attr("aria-expanded", "false");
  }

  COLOR_PALETTE.forEach(function(hex) {
    const clean = hex.slice(1).toLowerCase();
    $("<button type='button'></button>")
      .css("background", hex)
      .attr({ "data-hex": clean, "aria-label": hex, "title": hex })
      .on("click", function() { setColor(clean); })
      .appendTo(grid);
  });

  swatchBtn.on("click", function(e) {
    e.stopPropagation();
    const open = !popover.hasClass("open");
    $(".color-popover.open").not(popover).removeClass("open");
    $(".color-swatch-btn").not(swatchBtn).attr("aria-expanded", "false");
    popover.toggleClass("open", open);
    swatchBtn.attr("aria-expanded", String(open));
  });

  popover.on("click", function(e) { e.stopPropagation(); });
  popover.on("keydown", function(e) {
    if (e.key === "Escape") { close(); swatchBtn.trigger("focus"); }
  });

  addBtn.on("click", function() { addToBrandPalette("#" + currentHex()); });
  $("#brandPalette").on("change", renderBrandGrid);

  hexInput.on("input", function() {
    const val = $(this).val().replace("#", "");
    if (isValidHex(val)) setColor(val);
  });

  $(document).on("click", close);
  $(document).on("i18n:applied", refreshUI);

  renderBrandGrid();
}
