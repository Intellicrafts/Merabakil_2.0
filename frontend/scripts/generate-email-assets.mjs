/**
 * Generates PNG assets for transactional email templates.
 * Run: npm run email:generate
 */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BRAND_DIR = path.join(ROOT, "public", "brand");
const ICON_DIR = path.join(ROOT, "public", "email", "icons");

const BRAND_PRIMARY = "#B45309";
const BRAND_BG = "#FAF7F2";
const ICON_SIZE = 96;

function iconSvg(label, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 96 96">
  <rect x="4" y="4" width="88" height="88" rx="22" fill="${BRAND_BG}" stroke="#E8DFD4" stroke-width="2"/>
  ${inner}
</svg>`;
}

const ICONS = {
  lock: iconSvg(
    "lock",
    `<g transform="translate(28 24)" fill="none" stroke="${BRAND_PRIMARY}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="20" width="32" height="24" rx="4" fill="#FFF7ED"/>
      <path d="M14 20V14a10 10 0 0 1 20 0v6"/>
      <circle cx="20" cy="32" r="2.5" fill="${BRAND_PRIMARY}" stroke="none"/>
    </g>`,
  ),
  welcome: iconSvg(
    "welcome",
    `<g transform="translate(24 24)" fill="none" stroke="${BRAND_PRIMARY}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="24" cy="16" r="10" fill="#FFF7ED"/>
      <path d="M8 44c0-8.837 7.163-16 16-16s16 7.163 16 16"/>
      <path d="M40 20l4 4 8-8" stroke="${BRAND_PRIMARY}" stroke-width="3"/>
    </g>`,
  ),
  "calendar-plus": iconSvg(
    "calendar-plus",
    `<g transform="translate(22 20)" fill="none" stroke="${BRAND_PRIMARY}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="8" width="40" height="36" rx="5" fill="#FFF7ED"/>
      <path d="M4 18h40M16 4v8M32 4v8"/>
      <path d="M24 28v12M18 34h12" stroke-width="3.5"/>
    </g>`,
  ),
  "calendar-check": iconSvg(
    "calendar-check",
    `<g transform="translate(22 20)" fill="none" stroke="${BRAND_PRIMARY}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="8" width="40" height="36" rx="5" fill="#ECFDF5"/>
      <path d="M4 18h40M16 4v8M32 4v8"/>
      <path d="M16 36l6 6 14-14" stroke="#059669" stroke-width="3.5"/>
    </g>`,
  ),
  "calendar-x": iconSvg(
    "calendar-x",
    `<g transform="translate(22 20)" fill="none" stroke="${BRAND_PRIMARY}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="8" width="40" height="36" rx="5" fill="#FFFBEB"/>
      <path d="M4 18h40M16 4v8M32 4v8"/>
      <path d="M18 32l12 12M30 32l-12 12" stroke="#D97706" stroke-width="3.5"/>
    </g>`,
  ),
  "calendar-cancel": iconSvg(
    "calendar-cancel",
    `<g transform="translate(22 20)" fill="none" stroke="${BRAND_PRIMARY}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="8" width="40" height="36" rx="5" fill="#FEF2F2"/>
      <path d="M4 18h40M16 4v8M32 4v8"/>
      <path d="M18 32l12 12M30 32l-12 12" stroke="#DC2626" stroke-width="3.5"/>
    </g>`,
  ),
};

async function writePng(filePath, pipeline) {
  await pipeline.png({ compressionLevel: 9, palette: false }).toFile(filePath);
  console.log(`  ✓ ${path.relative(ROOT, filePath)}`);
}

async function main() {
  console.log("Generating email assets…\n");
  await mkdir(ICON_DIR, { recursive: true });

  const markWebp = path.join(BRAND_DIR, "mark-light.webp");
  const markSource = path.join(BRAND_DIR, "app_icon_normal.svg");

  let markBuffer;
  try {
    markBuffer = await readFile(markWebp);
    await writePng(
      path.join(BRAND_DIR, "mark-light.png"),
      sharp(markBuffer).resize(128, 128, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel: sharp.kernel.lanczos3,
      }),
    );
  } catch {
    const svg = await readFile(markSource, "utf8");
    await writePng(
      path.join(BRAND_DIR, "mark-light.png"),
      sharp(Buffer.from(svg)).resize(128, 128, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      }),
    );
  }

  // Wordmark lockup for clients that prefer a single logo image
  await writePng(
    path.join(BRAND_DIR, "logo-light.png"),
    sharp({
      create: {
        width: 360,
        height: 72,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: await sharp(path.join(BRAND_DIR, "mark-light.png"))
            .resize(56, 56, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer(),
          left: 0,
          top: 8,
        },
        {
          input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="280" height="72">
            <text x="0" y="34" font-family="'Segoe UI', system-ui, sans-serif" font-size="28" font-weight="700" fill="#1C1410">MeraBakil</text>
            <text x="0" y="58" font-family="'Segoe UI', system-ui, sans-serif" font-size="14" font-weight="500" fill="#6B5E54">Legal Help. Made Simple.</text>
          </svg>`),
          left: 68,
          top: 0,
        },
      ]),
  );

  for (const [name, svg] of Object.entries(ICONS)) {
    await writePng(
      path.join(ICON_DIR, `${name}.png`),
      sharp(Buffer.from(svg)).resize(ICON_SIZE, ICON_SIZE, {
        kernel: sharp.kernel.lanczos3,
      }),
    );
  }

  console.log("\nDone. Email assets ready in public/brand and public/email/icons.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
