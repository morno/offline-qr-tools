"use strict";

// Colour and surface options: three-colour gradients, eye centre colour, rounded block corners,
// background patterns and the brand palette.
const { test, expect, openApp, openAllSections, enterNetwork, waitForScan, download } = require("./fixtures");

// FICTIONAL TEST DATA - not a real network or password.
const SSID = "Kafé Åkerö";
const PASSWORD = "Hemligt;lösen:1234";

function svgIsWellFormed(page, svg) {
  return page.evaluate((s) => new DOMParser().parseFromString(s, "image/svg+xml").getElementsByTagName("parsererror").length === 0, svg);
}

test("three-colour gradients stay scannable and export three stops", async ({ guarded: page }) => {
  await openApp(page);
  await enterNetwork(page, SSID, PASSWORD);
  const result = await page.evaluate(() => {
    const bad = [];
    for (const gradient of GRADIENT_TYPES.slice(1)) {
      for (const shape of ["square", "liquid", "dots"]) {
        const opts = Object.assign(getRenderOpts(), { gradient: gradient, qrShape: shape, qrColor: "#4c1d95", gradientColor3: "#be123c", gradientColor2: "#1e3a8a" });
        const scene = buildScene(currentQR, 560, opts);
        if (verifyScan(sceneToCanvas(scene), scene.cell, currentPayload).status !== "ok") bad.push(gradient + "/" + shape);
      }
    }
    const svg = sceneToSVG(buildScene(currentQR, 400, Object.assign(getRenderOpts(), { gradient: "diagonal", qrColor: "#4c1d95", gradientColor3: "#be123c", gradientColor2: "#1e3a8a" })));
    return { bad: bad, svg: svg };
  });
  expect(result.bad).toEqual([]);
  expect(result.svg).toMatch(/<stop offset="0" stop-color="#4c1d95"\/><stop offset="0.5" stop-color="#be123c"\/><stop offset="1" stop-color="#1e3a8a"\/>/);
  expect(await svgIsWellFormed(page, result.svg)).toBe(true);
});

test("third colour control: shown only with a gradient, and a light middle colour warns", async ({ guarded: page }) => {
  await openApp(page);
  await enterNetwork(page, SSID, PASSWORD);
  await openAllSections(page);
  await expect(page.locator("#useGradientColor3Wrap")).toBeHidden();
  await page.selectOption("#gradient", "vertical");
  await expect(page.locator("#useGradientColor3Wrap")).toBeVisible();
  await expect(page.locator("#gradientColor3Wrap")).toBeHidden();
  await page.check("#useGradientColor3");
  await expect(page.locator("#gradientColor3Wrap")).toBeVisible();
  await page.evaluate(() => $("#gradientColor3").val("#fef08a").trigger("change"));
  await expect(page.locator("#contrastWarning")).toBeVisible();
  await page.evaluate(() => $("#gradientColor3").val("#7f1d1d").trigger("change"));
  await expect(page.locator("#contrastWarning")).toBeHidden();
  // Without a gradient the third colour is not used at all.
  await page.selectOption("#gradient", "none");
  expect(await page.evaluate(() => getRenderOpts().gradientColor3)).toBeNull();
});

test("eye centres can have their own colour with every corner style", async ({ guarded: page }) => {
  await openApp(page);
  await enterNetwork(page, SSID, PASSWORD);
  const result = await page.evaluate(() => {
    const bad = [];
    for (const eye of Object.keys(EYE_STYLES)) {
      const opts = Object.assign(getRenderOpts(), { eyeStyle: eye, eyeColor: "#0f172a", eyeBallColor: "#b91c1c" });
      const scene = buildScene(currentQR, 560, opts);
      if (verifyScan(sceneToCanvas(scene), scene.cell, currentPayload).status !== "ok") bad.push(eye);
    }
    const svg = sceneToSVG(buildScene(currentQR, 400, Object.assign(getRenderOpts(), { eyeStyle: "circle", eyeBallColor: "#b91c1c" })));
    return { bad: bad, svg: svg };
  });
  expect(result.bad).toEqual([]);
  // Frames and centres are two even-odd paths; the centres use the custom colour.
  expect(result.svg.match(/fill-rule="evenodd"/g).length).toBe(2);
  expect(result.svg).toContain('fill="#b91c1c" fill-rule="evenodd"');
});

test("rounded block corners never reach the code, for every quiet zone and frame", async ({ guarded: page }) => {
  await openApp(page);
  await enterNetwork(page, SSID, PASSWORD);
  const bad = await page.evaluate(() => {
    const out = [];
    for (const quietZone of QUIET_ZONE_CHOICES) {
      for (const qrCornerRadius of QR_CORNER_RADII) {
        for (const frame of ["none", "border", "card"]) {
          for (const transparent of [false, true]) {
            const opts = Object.assign(getRenderOpts(), { quietZone: quietZone, qrCornerRadius: qrCornerRadius, frameStyle: frame, transparent: transparent, qrBgColor: "#ffffff" });
            const scene = buildScene(currentQR, 520, opts);
            if (verifyScan(sceneToCanvas(scene), scene.cell, currentPayload).status !== "ok") out.push([quietZone, qrCornerRadius, frame, transparent].join("/"));
          }
        }
      }
    }
    // A hostile value falls back to square corners.
    const o = Object.assign(getRenderOpts(), { qrCornerRadius: 99 });
    if (sceneToSVG(buildScene(currentQR, 300, o)) !== sceneToSVG(buildScene(currentQR, 300, Object.assign(o, { qrCornerRadius: 0 })))) out.push("hostile radius used");
    return out;
  });
  expect(bad).toEqual([]);
});

test("background patterns stay outside the code and are left out of transparent exports", async ({ guarded: page }) => {
  await openApp(page);
  await enterNetwork(page, SSID, PASSWORD);
  const result = await page.evaluate(() => {
    const bad = [];
    const statusOf = function(frame, pattern, dark) {
      const opts = Object.assign(getRenderOpts(), { bgPattern: pattern, frameStyle: frame, qrBgColor: dark ? "#0f172a" : "#ffffff", qrColor: dark ? "#ffffff" : "#000000",
        textStyle: "plain", title: "Gäst-WiFi", caption: "Skanna mig" });
      const scene = buildScene(currentQR, 560, opts);
      return verifyScan(sceneToCanvas(scene), scene.cell, currentPayload).status;
    };
    for (const frame of Object.keys(FRAME_TEMPLATES)) {
      // Light modules on a dark background are an inverted code: the app already warns about
      // those and jsQR misses a few at some sizes. There the rule is that a pattern never makes
      // the result worse than the same frame without one.
      const darkWithout = statusOf(frame, "none", true);
      for (const pattern of BACKGROUND_PATTERNS.slice(1)) {
        const light = statusOf(frame, pattern, false);
        if (light !== "ok") bad.push([pattern, frame, "light", light].join("/"));
        const dark = statusOf(frame, pattern, true);
        if (dark === "fail" && darkWithout !== "fail") bad.push([pattern, frame, "dark", dark].join("/"));
      }
    }
    const plainSvg = sceneToSVG(buildScene(currentQR, 300, Object.assign(getRenderOpts(), { frameStyle: "border", bgPattern: "none" })));
    const withPattern = sceneToSVG(buildScene(currentQR, 300, Object.assign(getRenderOpts(), { frameStyle: "border", bgPattern: "dots" })));
    const transparent = sceneToSVG(buildScene(currentQR, 300, Object.assign(getRenderOpts(), { frameStyle: "border", bgPattern: "dots", transparent: true })));
    const transparentPlain = sceneToSVG(buildScene(currentQR, 300, Object.assign(getRenderOpts(), { frameStyle: "border", bgPattern: "none", transparent: true })));
    return { bad: bad, patterned: withPattern.length > plainSvg.length, transparentSame: transparent === transparentPlain };
  });
  expect(result.bad).toEqual([]);
  expect(result.patterned).toBe(true);
  expect(result.transparentSame).toBe(true);
});

test("brand palette: + saves a colour, every picker shows it, and design files keep it", async ({ guarded: page }) => {
  await openApp(page);
  await enterNetwork(page, SSID, PASSWORD);
  await openAllSections(page);
  await expect(page.locator("#qrColorBrandGrid")).toBeHidden();
  await expect(page.locator("#clearBrandPalette")).toBeHidden();

  await page.click("#qrColorSwatch");
  await page.fill("#qrColorHex", "1e3a8a");
  await page.click("#qrColorBrandAdd");
  await expect(page.locator("#qrColorBrandAdd")).toHaveAttribute("aria-label", /Spara i varumärkesfärgerna, QR-färg/);
  await expect(page.locator("#frameColorBrandGrid button[data-hex='1e3a8a']")).toHaveCount(1);
  await expect(page.locator("#clearBrandPalette")).toBeVisible();

  // Picking the brand colour in another picker sets it.
  await page.click("body");
  await page.selectOption("#frameStyle", "border");
  await page.click("#frameColorSwatch");
  await page.click("#frameColorBrandGrid button[data-hex='1e3a8a']");
  await expect(page.locator("#frameColor")).toHaveValue("#1e3a8a");

  const saved = await download(page, () => page.click("#saveDesign"));
  const design = JSON.parse(saved.data.toString("utf8"));
  expect(design.style.brandPalette).toEqual(["#1e3a8a"]);

  await page.click("#clearBrandPalette");
  await expect(page.locator("#qrColorBrandGrid button")).toHaveCount(0);
  await page.setInputFiles("#designFile", { name: "d.json", mimeType: "application/json", buffer: saved.data });
  await expect(page.locator("#designStatus")).toHaveAttribute("data-i18n", "designOpened");
  await expect(page.locator("#eyeColorBrandGrid button[data-hex='1e3a8a']")).toHaveCount(1);
  await waitForScan(page);
});

test("new style options are saved in design files", async ({ guarded: page }) => {
  await openApp(page);
  await enterNetwork(page, SSID, PASSWORD);
  await openAllSections(page);
  await page.selectOption("#gradient", "radial");
  await page.check("#useGradientColor3");
  await page.check("#customEyeBallColor");
  await page.selectOption("#qrCornerRadius", "2");
  await page.selectOption("#bgPattern", "stripes");
  await page.selectOption("#qrShape", "liquid");
  await page.selectOption("#eyeStyle", "squircle");
  const saved = await download(page, () => page.click("#saveDesign"));
  const style = JSON.parse(saved.data.toString("utf8")).style;
  expect(style).toMatchObject({ useGradientColor3: true, customEyeBallColor: true, qrCornerRadius: "2", bgPattern: "stripes", qrShape: "liquid", eyeStyle: "squircle" });
  expect(style.gradientColor3).toMatch(/^#[0-9a-f]{6}$/);
  expect(style.eyeBallColor).toMatch(/^#[0-9a-f]{6}$/);
  await waitForScan(page);
  await expect(page.locator("#scanStatus")).toHaveAttribute("data-state", "ok");
});

test("rotated text (corner band, round badge) is valid in the SVG export and kept off the code", async ({ guarded: page }) => {
  await openApp(page);
  await enterNetwork(page, SSID, PASSWORD);
  const svgs = await page.evaluate(() => ["cornerBand", "badge"].map(function(frame) {
    const opts = Object.assign(getRenderOpts(), { frameStyle: frame, textStyle: "plain", title: "NY <b>&</b>", caption: "Skanna mig" });
    return sceneToSVG(buildScene(currentQR, 500, opts));
  }));
  for (const svg of svgs) {
    expect(svg).toMatch(/<text [^>]*transform="rotate\(-?[0-9.]+ [0-9.]+ [0-9.]+\)"/);
    expect(svg).not.toContain("<b>");
    expect(await svgIsWellFormed(page, svg)).toBe(true);
  }
  expect(svgs[0]).toContain("NY &lt;b&gt;&amp;&lt;/b&gt;");
});

test("the split card shows its second colour picker and uses that colour", async ({ guarded: page }) => {
  await openApp(page);
  await enterNetwork(page, SSID, PASSWORD);
  await openAllSections(page);
  await expect(page.locator("#frameColor2Wrap")).toBeHidden();
  await page.selectOption("#frameStyle", "splitCard");
  await expect(page.locator("#frameColor2Wrap")).toBeVisible();
  await page.evaluate(() => $("#frameColor2").val("#ea580c").trigger("change"));
  const svg = await page.evaluate(() => sceneToSVG(buildScene(currentQR, 400, getRenderOpts())));
  expect(svg).toContain('fill="#ea580c"');
  await page.selectOption("#frameStyle", "card");
  await expect(page.locator("#frameColor2Wrap")).toBeHidden();
  await waitForScan(page);
});

test("a frame matching the content type is offered, never applied on its own", async ({ guarded: page }) => {
  await openApp(page);
  await enterNetwork(page, SSID, PASSWORD);
  await openAllSections(page);
  await expect(page.locator("#suggestFrame")).toBeVisible();
  await expect(page.locator("#suggestFrame")).toHaveText("Använd ramen Wi-Fi-symbol överst");
  await expect(page.locator("#frameStyle")).toHaveValue("none");
  await page.click("#suggestFrame");
  await expect(page.locator("#frameStyle")).toHaveValue("wifiSignal");
  await expect(page.locator("#suggestFrame")).toBeHidden();

  // Other types get their own suggestion; types without one show no button.
  const expectations = { event: "calendar", geo: "mapPin", email: "envelope", phone: "phone", sms: "phone", vcard: "businessCard" };
  for (const [type, frame] of Object.entries(expectations)) {
    await page.check("input[name=qrType][value=" + type + "]");
    await expect(page.locator("#suggestFrame")).toHaveAttribute("data-frame", frame);
  }
  for (const type of ["url", "text", "swish"]) {
    await page.check("input[name=qrType][value=" + type + "]");
    await expect(page.locator("#suggestFrame")).toBeHidden();
  }
});

test("initials and built-in icons become a logo without any upload, and stay scannable", async ({ guarded: page }) => {
  await openApp(page);
  await enterNetwork(page, SSID, PASSWORD);
  await openAllSections(page);
  await page.fill("#logoInitials", "wc");
  await expect(page.locator("#logoPreview img")).toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect(page.locator("#logoExtras")).toBeVisible();
  await waitForScan(page);
  await expect(page.locator("#scanStatus")).toHaveAttribute("data-state", "ok");
  expect(await page.evaluate(() => errorCorrectionLevel())).toBe("H");

  // Every icon at every logo size scans.
  const bad = await page.evaluate(() => {
    const out = [];
    for (const icon of Object.keys(LOGO_ICONS)) {
      const logo = buildGeneratedLogo("", icon);
      for (const size of [10, 20, 30]) {
        const opts = Object.assign(getRenderOpts(), { logoImage: logo.img, logoDataUrl: logo.dataUrl, logoSizePercent: size });
        const scene = buildScene(currentQR, 560, opts);
        if (verifyScan(sceneToCanvas(scene), scene.cell, currentPayload).status !== "ok") out.push(icon + "/" + size);
      }
    }
    return out;
  });
  expect(bad).toEqual([]);

  // Choosing an icon replaces the initials; removing clears both.
  await page.selectOption("#logoIcon", "cup");
  await expect(page.locator("#logoInitials")).toHaveValue("");
  await page.click("#removeLogo");
  await expect(page.locator("#logoIcon")).toHaveValue("none");
  await expect(page.locator("#logoPreview img")).toHaveCount(0);
  await waitForScan(page);
});

test("initials are cleaned and never saved; an icon is saved as a style field", async ({ guarded: page }) => {
  await openApp(page);
  await enterNetwork(page, SSID, PASSWORD);
  await openAllSections(page);
  expect(await page.evaluate(() => [cleanInitials("ab\u0000c d"), cleanInitials("åäöxyz"), cleanInitials("\ud83c"), cleanInitials("🍩x")])).toEqual(["ABC", "ÅÄÖ", "�", "🍩X"]);

  await page.fill("#logoInitials", "TS");
  await waitForScan(page);
  await expect(page.locator("#designLogoWrap")).toBeHidden();
  let saved = await download(page, () => page.click("#saveDesign"));
  let text = saved.data.toString("utf8");
  expect(text).not.toContain("TS");
  expect(JSON.parse(text).logo).toBeUndefined();

  await page.selectOption("#logoIcon", "star");
  await waitForScan(page);
  saved = await download(page, () => page.click("#saveDesign"));
  text = saved.data.toString("utf8");
  expect(JSON.parse(text).style.logoIcon).toBe("star");
  expect(JSON.parse(text).logo).toBeUndefined();

  // Opening the file draws the icon again.
  await page.click("#removeLogo");
  await page.setInputFiles("#designFile", { name: "d.json", mimeType: "application/json", buffer: saved.data });
  await expect(page.locator("#designStatus")).toHaveAttribute("data-i18n", "designOpened");
  await expect(page.locator("#logoPreview img")).toHaveCount(1);
  await waitForScan(page);
});

test("logo shapes and ring: cropped logos stay scannable and export as a clean PNG", async ({ guarded: page }) => {
  await openApp(page);
  await enterNetwork(page, SSID, PASSWORD);
  await openAllSections(page);
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 300; c.height = 180;
    const x = c.getContext("2d"); x.fillStyle = "#7c3aed"; x.fillRect(0, 0, 300, 180);
    return c.toDataURL("image/png");
  });
  await page.setInputFiles("#logoFile", { name: "logo.png", mimeType: "image/png", buffer: Buffer.from(dataUrl.split(",")[1], "base64") });
  await expect(page.locator("#logoPreview img")).toHaveCount(1);
  await expect(page.locator("#logoRingWrap")).toBeHidden();
  for (const shape of ["circle", "rounded", "original"]) {
    await page.selectOption("#logoShape", shape);
    if (shape !== "original") {
      await expect(page.locator("#logoRingWrap")).toBeVisible();
      await page.check("#logoRing");
    }
    await waitForScan(page);
    await expect(page.locator("#scanStatus")).toHaveAttribute("data-state", "ok");
    const svg = await page.evaluate(() => sceneToSVG(buildScene(currentQR, 400, getRenderOpts())));
    expect(svg).toMatch(/<image href="data:image\/png;base64,[A-Za-z0-9+/]+=*"/);
    expect(await svgIsWellFormed(page, svg)).toBe(true);
    // The cropped logo is square; the original keeps its 5:3 shape.
    const ratio = await page.evaluate(() => { const o = getRenderOpts(); return (o.logoImage.naturalWidth || o.logoImage.width) / (o.logoImage.naturalHeight || o.logoImage.height); });
    expect(ratio).toBeCloseTo(shape === "original" ? 300 / 180 : 1, 2);
  }
  // Uploading a picture clears initials and icons.
  await page.fill("#logoInitials", "AB");
  await page.setInputFiles("#logoFile", { name: "logo.png", mimeType: "image/png", buffer: Buffer.from(dataUrl.split(",")[1], "base64") });
  await expect(page.locator("#logoInitials")).toHaveValue("");
  await expect(page.locator("#designLogoWrap")).toBeVisible();
});
