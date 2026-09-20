/**
 * Generates production-ready brand assets from source SVGs in public/brand/.
 * Run: npm run brand:generate
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BRAND_DIR = path.join(ROOT, "public", "brand");
const APP_DIR = path.join(ROOT, "src", "app");

const THEME = {
  lightBg: "#fbfaf8",
  darkBg: "#161311",
  lightFg: "#1f1915",
  darkFg: "#f2ede6",
  lightInk: { r: 18, g: 12, b: 8 },
  darkInk: { r: 252, g: 246, b: 238 },
};

const SOURCES = {
  markLight: "normal_logo.svg",
  markDark: "dark_logo.svg",
  faviconLight: "favicon_normal.svg",
  faviconDark: "favicon_dark.svg",
};

function stripSvgMetadata(svg) {
  let out = svg;
  out = out.replace(/<metadata>[\s\S]*?<\/metadata>/gi, "");
  out = out.replace(/\sxmlns:c2pa="[^"]*"/gi, "");
  return out;
}

function removeWhiteBackgroundRect(svg) {
  return svg.replace(/<rect[^>]*fill="#ffffff"[^>]*\/>/gi, "");
}

function extractFirstEmbeddedPng(svg) {
  const matches = [...svg.matchAll(/(?:xlink:)?href="data:image\/png;base64,([^"]+)"/gi)];
  if (!matches.length) return null;

  for (const match of matches) {
    const buffer = Buffer.from(match[1], "base64");
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (width <= 1000 && height <= 1000) {
      return { buffer, width, height };
    }
  }

  const fallback = Buffer.from(matches[0][1], "base64");
  return {
    buffer: fallback,
    width: fallback.readUInt32BE(16),
    height: fallback.readUInt32BE(20),
  };
}

function sampleCornerColors(data, width, height) {
  const coords = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  const samples = coords.map(([x, y]) => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  });

  const avg = [0, 0, 0];
  for (const [r, g, b] of samples) {
    avg[0] += r;
    avg[1] += g;
    avg[2] += b;
  }
  avg[0] = Math.round(avg[0] / samples.length);
  avg[1] = Math.round(avg[1] / samples.length);
  avg[2] = Math.round(avg[2] / samples.length);
  return avg;
}

function colorDistance(r, g, b, bg) {
  return Math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2);
}

async function removeUniformBackground(buffer, tolerance = 22) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bg = sampleCornerColors(data, info.width, info.height);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const nearCorner = colorDistance(r, g, b, bg) <= tolerance;
    const nearWhite = r >= 245 && g >= 245 && b >= 245;
    const nearBlack = r <= 28 && g <= 28 && b <= 28;

    if (nearCorner || nearWhite || nearBlack) {
      data[i + 3] = 0;
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .trim({ threshold: 1 })
    .png();
}

function isWarmAccent(r, g, b) {
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  return chroma >= 28 && r >= g - 8 && g >= b - 4 && (r + g) / 2 > b + 12;
}

function applyInk(r, g, b, ink, strength) {
  return {
    r: Math.round(r * (1 - strength) + ink.r * strength),
    g: Math.round(g * (1 - strength) + ink.g * strength),
    b: Math.round(b * (1 - strength) + ink.b * strength),
  };
}

/**
 * Theme-tuned cleanup — keep gold accents, drop muddy plate leftovers.
 */
async function refineForTheme(pngBuffer, theme) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 8) continue;

    const lum = (r + g + b) / 3;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    const warm = isWarmAccent(r, g, b);

    if (theme === "dark") {
      if (lum < 72 && chroma < 24) {
        data[i + 3] = 0;
      } else if (warm) {
        data[i] = Math.min(255, Math.round(r * 1.18 + 18));
        data[i + 1] = Math.min(255, Math.round(g * 1.12 + 12));
        data[i + 2] = Math.max(0, Math.round(b * 0.92));
        data[i + 3] = 255;
      } else {
        const lift = 1.32;
        data[i] = Math.min(255, Math.round(r * lift + 10));
        data[i + 1] = Math.min(255, Math.round(g * lift + 10));
        data[i + 2] = Math.min(255, Math.round(b * lift + 10));
        data[i + 3] = 255;
      }
    } else if (warm) {
      data[i] = Math.min(255, Math.round(r * 1.08 + 8));
      data[i + 1] = Math.min(255, Math.round(g * 0.98 + 4));
      data[i + 2] = Math.max(0, Math.round(b * 0.82));
      data[i + 3] = 255;
    } else if (lum > 108 || chroma < 24) {
      const inked = applyInk(r, g, b, THEME.lightInk, lum > 108 ? 0.95 : 0.88);
      data[i] = inked.r;
      data[i + 1] = inked.g;
      data[i + 2] = inked.b;
      data[i + 3] = 255;
    } else {
      const inked = applyInk(r, g, b, THEME.lightInk, 0.82);
      data[i] = inked.r;
      data[i + 1] = inked.g;
      data[i + 2] = inked.b;
      data[i + 3] = 255;
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .trim({ threshold: 1 })
    .png()
    .toBuffer();
}

function parseHex(hex) {
  const normalized = hex.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

/**
 * Push contrast + full opacity so marks/icons stay crisp at 24–40px.
 */
async function boostVisibility(pngBuffer, theme, { contrast = 1.28, saturate = 1.45 } = {}) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    const a = data[i + 3];
    if (a < 12) continue;

    const lum = (r + g + b) / 3;
    const warm = isWarmAccent(r, g, b);

    if (theme === "light") {
      if (warm) {
        const avg = lum;
        r = Math.min(255, Math.round(r + (r - avg) * saturate + 6));
        g = Math.min(255, Math.round(g + (g - avg) * (saturate * 0.85)));
        b = Math.max(0, Math.round(b + (b - avg) * 0.35));
      } else {
        const inked = applyInk(r, g, b, THEME.lightInk, 0.92);
        r = inked.r;
        g = inked.g;
        b = inked.b;
      }
    } else if (warm) {
      r = Math.min(255, Math.round(r * 1.14 + 14));
      g = Math.min(255, Math.round(g * 1.1 + 10));
      b = Math.max(0, Math.round(b * 0.94));
    } else {
      const lift = 1.34;
      r = Math.min(255, Math.round(r * lift + 16));
      g = Math.min(255, Math.round(g * lift + 16));
      b = Math.min(255, Math.round(b * lift + 16));
      if ((r + g + b) / 3 < 175) {
        r = Math.min(255, r + 28);
        g = Math.min(255, g + 26);
        b = Math.min(255, b + 24);
      }
    }

    r = Math.min(255, Math.max(0, Math.round((r - 128) * contrast + 128)));
    g = Math.min(255, Math.max(0, Math.round((g - 128) * contrast + 128)));
    b = Math.min(255, Math.max(0, Math.round((b - 128) * contrast + 128)));

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

/** Expand alpha by 1px so thin strokes survive downscaling. */
async function thickenStrokes(pngBuffer, radius = 1) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const copy = Buffer.from(data);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] >= 128) continue;

      let best = -1;
      let bestA = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const j = (ny * width + nx) * 4;
          if (copy[j + 3] > bestA) {
            bestA = copy[j + 3];
            best = j;
          }
        }
      }

      if (best >= 0 && bestA >= 128) {
        data[i] = copy[best];
        data[i + 1] = copy[best + 1];
        data[i + 2] = copy[best + 2];
        data[i + 3] = 255;
      }
    }
  }

  return sharp(data, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function solidifyAlpha(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] >= 24) data[i + 3] = 255;
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

/** Remove muddy mid-tones — marks read bold at 32–40px display size. */
async function finalizeMarkColors(pngBuffer, theme) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 24) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const warm = isWarmAccent(r, g, b);

    if (theme === "dark") {
      if (warm) {
        data[i] = Math.min(255, r + 10);
        data[i + 1] = Math.min(255, g + 8);
        data[i + 2] = Math.max(0, b - 4);
      } else {
        data[i] = THEME.darkInk.r;
        data[i + 1] = THEME.darkInk.g;
        data[i + 2] = THEME.darkInk.b;
      }
    } else if (warm) {
      data[i] = Math.min(255, Math.round(r * 1.05 + 6));
      data[i + 1] = Math.min(255, Math.round(g * 0.98 + 2));
      data[i + 2] = Math.max(0, Math.round(b * 0.85));
    } else {
      data[i] = THEME.lightInk.r;
      data[i + 1] = THEME.lightInk.g;
      data[i + 2] = THEME.lightInk.b;
    }

    data[i + 3] = 255;
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

/** Circular favicon on transparent canvas — dark ink (light tabs) / bright strokes (dark tabs). */
async function applyCircularMaskTransparent(pngBuffer, size, iconScale = 0.9) {
  const iconSize = Math.round(size * iconScale);
  const offset = Math.round((size - iconSize) / 2);

  const icon = await sharp(pngBuffer)
    .resize(iconSize, iconSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: size <= 64 ? sharp.kernel.lanczos3 : sharp.kernel.cubic,
    })
    .sharpen(size <= 32 ? { sigma: 1.05, m1: 0.7, m2: 3.4 } : { sigma: 0.55, m1: 0.55, m2: 2.5 })
    .png()
    .toBuffer();

  const padded = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: icon, left: offset, top: offset }])
    .png()
    .toBuffer();

  const mask = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
    </svg>`,
  );

  return sharp(padded)
    .composite([{ input: mask, blend: "dest-in" }])
    .png();
}

async function buildTransparentCircularFavicon(pngBuffer, size, theme) {
  let prepared = await thickenStrokes(pngBuffer, size <= 32 ? 3 : 2);
  prepared = await finalizeMarkColors(prepared, theme);
  prepared = await boostVisibility(prepared, theme, { contrast: 1.34, saturate: 1.48 });
  prepared = await thickenStrokes(prepared, 1);
  const iconScale = size <= 16 ? 0.93 : 0.91;
  return applyCircularMaskTransparent(prepared, size, iconScale);
}

async function buildCircularIcon(pngBuffer, size, bgHex, iconScale = 0.88) {
  const iconSize = Math.round(size * iconScale);
  const offset = Math.round((size - iconSize) / 2);
  const bg = parseHex(bgHex);
  const prepared = await thickenStrokes(pngBuffer, size <= 64 ? 2 : 1);

  const icon = await sharp(prepared)
    .resize(iconSize, iconSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: size <= 64 ? sharp.kernel.lanczos3 : sharp.kernel.cubic,
    })
    .sharpen(size <= 64 ? { sigma: 0.9, m1: 0.6, m2: 3 } : { sigma: 0.55, m1: 0.55, m2: 2.5 })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { ...bg, alpha: 1 },
    },
  })
    .composite([{ input: icon, left: offset, top: offset }])
    .png();
}

function buildCircularFaviconSvg(pngBuffer, size = 512) {
  const b64 = pngBuffer.toString("base64");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <clipPath id="circle">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" />
    </clipPath>
  </defs>
  <image href="data:image/png;base64,${b64}" width="${size}" height="${size}" clip-path="url(#circle)" preserveAspectRatio="xMidYMid meet" />
</svg>`;
}

async function buildMaskableIcon(pngBuffer, size = 512, bgHex = THEME.lightBg) {
  const safeZone = Math.round(size * 0.72);
  const offset = Math.round((size - safeZone) / 2);
  const bg = parseHex(bgHex);
  const icon = await buildCircularIcon(pngBuffer, safeZone, bgHex, 0.9);

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { ...bg, alpha: 1 },
    },
  })
    .composite([{ input: await icon.toBuffer(), left: offset, top: offset }])
    .png();
}

async function buildOgImage(markLightBuffer, markDarkBuffer) {
  const width = 1200;
  const height = 630;
  const markSize = 220;

  const lightMark = await buildCircularIcon(markLightBuffer, markSize, THEME.lightBg, 0.82);
  const darkMark = await buildCircularIcon(markDarkBuffer, markSize, THEME.darkBg, 0.82);

  const leftBg = await sharp({
    create: { width: width / 2, height, channels: 4, background: THEME.lightBg },
  })
    .png()
    .toBuffer();

  const rightBg = await sharp({
    create: { width: width / 2, height, channels: 4, background: THEME.darkBg },
  })
    .png()
    .toBuffer();

  const base = await sharp({
    create: { width, height, channels: 4, background: THEME.lightBg },
  })
    .composite([
      { input: leftBg, left: 0, top: 0 },
      { input: rightBg, left: width / 2, top: 0 },
      { input: await lightMark.toBuffer(), left: 140, top: Math.round((height - markSize) / 2) },
      { input: await darkMark.toBuffer(), left: width / 2 + 140, top: Math.round((height - markSize) / 2) },
    ])
    .png()
    .toBuffer();

  const titleSvg = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <text x="420" y="300" font-family="system-ui, sans-serif" font-size="56" font-weight="700" fill="${THEME.lightFg}">MeraBakil</text>
    <text x="420" y="360" font-family="system-ui, sans-serif" font-size="28" fill="#6b6158">Legal Help. Made Simple.</text>
    <text x="${width / 2 + 420}" y="300" font-family="system-ui, sans-serif" font-size="56" font-weight="700" fill="${THEME.darkFg}">MeraBakil</text>
    <text x="${width / 2 + 420}" y="360" font-family="system-ui, sans-serif" font-size="28" fill="#9a9086">Legal Help. Made Simple.</text>
  </svg>`);

  return sharp(base).composite([{ input: titleSvg, top: 0, left: 0 }]).png();
}

async function processSourceSvg(filename, theme, { visibility = "standard" } = {}) {
  const raw = await readFile(path.join(BRAND_DIR, filename), "utf8");
  const cleaned = removeWhiteBackgroundRect(stripSvgMetadata(raw));
  const embedded = extractFirstEmbeddedPng(cleaned);
  if (!embedded) {
    throw new Error(`No embedded PNG found in ${filename}`);
  }
  const transparent = await removeUniformBackground(embedded.buffer);
  const refined = await refineForTheme(await transparent.png().toBuffer(), theme);
  const boostOpts =
    visibility === "mark"
      ? { contrast: 1.1, saturate: 1.18 }
      : visibility === "favicon"
        ? { contrast: 1.4, saturate: 1.62 }
        : { contrast: 1.28, saturate: 1.48 };
  let boosted = refined;
  if (visibility === "mark") {
    // UI marks: refined source only — smooth anti-aliasing at 32–40px
    boosted = await thickenStrokes(refined, 1);
  } else {
    boosted = await boostVisibility(refined, theme, boostOpts);
  }
  if (visibility === "favicon") {
    boosted = await thickenStrokes(boosted, 3);
    boosted = await boostVisibility(boosted, theme, boostOpts);
    boosted = await finalizeMarkColors(boosted, theme);
    boosted = await thickenStrokes(boosted, 1);
  } else if (visibility !== "mark") {
    boosted = await thickenStrokes(boosted, 1);
    boosted = await finalizeMarkColors(boosted, theme);
  }
  return {
    png: boosted,
    width: embedded.width,
    height: embedded.height,
  };
}

async function writePng(filePath, pipeline) {
  await pipeline.toFile(filePath);
  console.log(`  ✓ ${path.relative(ROOT, filePath)}`);
}

async function main() {
  console.log("Generating brand assets…\n");

  const [markLight, markDark, faviconLight, faviconDark] = await Promise.all([
    processSourceSvg(SOURCES.markLight, "light", { visibility: "mark" }),
    processSourceSvg(SOURCES.markDark, "dark", { visibility: "mark" }),
    processSourceSvg(SOURCES.faviconLight, "light", { visibility: "favicon" }),
    processSourceSvg(SOURCES.faviconDark, "dark", { visibility: "favicon" }),
  ]);

  console.log("  mark-light:", markLight.width + "x" + markLight.height);
  console.log("  mark-dark:", markDark.width + "x" + markDark.height);

  // Full-bleed trimmed marks — high-res, smooth edges for header/dashboard use
  const markExportSize = 384;
  await writePng(
    path.join(BRAND_DIR, "mark-light.webp"),
    sharp(markLight.png)
      .resize(markExportSize, markExportSize, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel: sharp.kernel.lanczos3,
      })
      .webp({ quality: 95, effort: 6 }),
  );
  await writePng(
    path.join(BRAND_DIR, "mark-dark.webp"),
    sharp(markDark.png)
      .resize(markExportSize, markExportSize, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel: sharp.kernel.lanczos3,
      })
      .webp({ quality: 95, effort: 6 }),
  );

  const faviconLightPng = faviconLight.png;
  const faviconDarkPng = faviconDark.png;

  const faviconLight32 = await buildTransparentCircularFavicon(faviconLightPng, 32, "light");
  const faviconDark32 = await buildTransparentCircularFavicon(faviconDarkPng, 32, "dark");
  const faviconLight16 = await buildTransparentCircularFavicon(faviconLightPng, 16, "light");
  const faviconDark16 = await buildTransparentCircularFavicon(faviconDarkPng, 16, "dark");
  const faviconLight48 = await buildTransparentCircularFavicon(faviconLightPng, 48, "light");
  const faviconDark48 = await buildTransparentCircularFavicon(faviconDarkPng, 48, "dark");
  const faviconLightCirc = await buildTransparentCircularFavicon(faviconLightPng, 512, "light");
  const faviconDarkCirc = await buildTransparentCircularFavicon(faviconDarkPng, 512, "dark");

  await writePng(path.join(BRAND_DIR, "favicon-light-32.png"), faviconLight32);
  await writePng(path.join(BRAND_DIR, "favicon-dark-32.png"), faviconDark32);
  await writePng(path.join(BRAND_DIR, "favicon-light-16.png"), faviconLight16);
  await writePng(path.join(BRAND_DIR, "favicon-dark-16.png"), faviconDark16);
  await writePng(path.join(BRAND_DIR, "favicon-light-48.png"), faviconLight48);
  await writePng(path.join(BRAND_DIR, "favicon-dark-48.png"), faviconDark48);

  await writeFile(
    path.join(BRAND_DIR, "favicon-light.svg"),
    buildCircularFaviconSvg(await faviconLightCirc.toBuffer(), 512),
    "utf8",
  );
  console.log("  ✓ public/brand/favicon-light.svg");

  await writeFile(
    path.join(BRAND_DIR, "favicon-dark.svg"),
    buildCircularFaviconSvg(await faviconDarkCirc.toBuffer(), 512),
    "utf8",
  );
  console.log("  ✓ public/brand/favicon-dark.svg");

  await writePng(
    path.join(BRAND_DIR, "app-icon-192.png"),
    await buildCircularIcon(faviconLightPng, 192, THEME.lightBg, 0.9),
  );
  await writePng(
    path.join(BRAND_DIR, "app-icon-512.png"),
    await buildCircularIcon(faviconLightPng, 512, THEME.lightBg, 0.9),
  );
  await writePng(
    path.join(BRAND_DIR, "app-icon-maskable-512.png"),
    await buildMaskableIcon(faviconLightPng, 512, THEME.lightBg),
  );
  await writePng(path.join(BRAND_DIR, "og-default.png"), await buildOgImage(markLight.png, markDark.png));

  await mkdir(APP_DIR, { recursive: true });
  await writePng(path.join(APP_DIR, "icon.png"), faviconLight32);
  await writePng(
    path.join(APP_DIR, "apple-icon.png"),
    await buildCircularIcon(faviconLightPng, 180, THEME.lightBg, 0.9),
  );

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
