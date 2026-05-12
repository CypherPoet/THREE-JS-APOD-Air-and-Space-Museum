#!/usr/bin/env node
// =================================================================
// fetch-apod.mjs
//
// Scrapes https://apod.nasa.gov/apod/astropix.html, parses its
// (gloriously simple) HTML, and writes to an append-only archive:
//
//   data/
//   ├── manifest.json                  { latest: YYYY-MM-DD, entries: [...] }
//   └── archive/
//       ├── YYYY-MM-DD.json            (structured metadata)
//       └── YYYY-MM-DD.jpg             (compressed image for that day)
//
// Running this multiple times for the same day overwrites that day's
// pair but never touches other days. The manifest stays sorted newest
// first so the frontend just reads `entries[0]` (or `latest`) to find
// today's exhibit.
//
// Used by:
//   - local refresh (`node scripts/fetch-apod.mjs`)
//   - .github/workflows/refresh-apod.yml (daily cron)
//
// Pass `--from=path/to/file.html` to parse a local HTML file instead
// of fetching the live page (handy for testing).
// =================================================================

import { mkdir, readFile, writeFile, stat, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const DATA_DIR = resolve(PROJECT_ROOT, "data");
const ARCHIVE_DIR = resolve(DATA_DIR, "archive");
const MANIFEST_PATH = resolve(DATA_DIR, "manifest.json");

const APOD_URL = "https://apod.nasa.gov/apod/astropix.html";
const APOD_BASE = "https://apod.nasa.gov/apod/";

function buildApodUrl(dateKey) {
  // dateKey: YYYY-MM-DD → apod.nasa.gov/apod/apYYMMDD.html
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`APOD_DATE must be YYYY-MM-DD, got "${dateKey}"`);
  return `${APOD_BASE}ap${match[1].slice(2)}${match[2]}${match[3]}.html`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const overrideDate = process.env.APOD_DATE || args.date;
  const sourceUrl = overrideDate ? buildApodUrl(overrideDate) : APOD_URL;

  console.log(`> fetching APOD… (${sourceUrl})`);
  const html = args.from
    ? await readFile(args.from, "utf8")
    : await fetchText(sourceUrl);

  console.log("> parsing…");
  const parsed = parseApod(html);
  // When APOD_DATE is set, we know the intended date — trust it over the
  // parsed value, which can fall back to "today" if the page predates the
  // current HTML format. The parsed date remains useful as a sanity check.
  const dateKey = overrideDate || parsed.date;
  if (overrideDate && parsed.date !== overrideDate) {
    console.log(`> note: page-internal date "${parsed.date}" — using override "${overrideDate}"`);
  }

  console.log(`> title:  ${parsed.title}`);
  console.log(`> date:   ${dateKey}`);
  console.log(`> image:  ${parsed.image_url}`);

  console.log("> downloading image…");
  const imageBytes = await fetchBytes(parsed.image_url);
  console.log(`> raw image: ${(imageBytes.length / 1024).toFixed(1)} KB`);

  await mkdir(ARCHIVE_DIR, { recursive: true });
  const jpegPath = resolve(ARCHIVE_DIR, `${dateKey}.jpg`);
  await writeFile(jpegPath, imageBytes);

  // Resize + compress so each committed image stays small (~300-600 KB).
  const compressed = compressImage(jpegPath, 2400, 86);
  const finalSize = (await stat(jpegPath)).size;
  console.log(`> final image (${compressed}): ${(finalSize / 1024).toFixed(1)} KB`);

  const entry = {
    ...parsed,
    date: dateKey,
    original_url: sourceUrl,
    image_bytes: finalSize,
    fetched_at: new Date().toISOString(),
  };
  const entryPath = resolve(ARCHIVE_DIR, `${dateKey}.json`);
  await writeFile(entryPath, JSON.stringify(entry, null, 2) + "\n");

  // ----------------------------------------------------------------
  // Rebuild the manifest by scanning data/archive/ for every dated
  // JSON file. This makes the script self-healing: drop a file in by
  // hand and the next run picks it up automatically.
  // ----------------------------------------------------------------
  const scanned = await scanArchive(ARCHIVE_DIR);
  const manifest = {
    latest: scanned[0] || dateKey,
    entries: scanned,
    updated_at: new Date().toISOString(),
  };
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");

  console.log(`> archive now holds ${manifest.entries.length} entr${manifest.entries.length === 1 ? "y" : "ies"}`);
  console.log(`> latest: ${manifest.latest}`);
}

async function scanArchive(dir) {
  // Return every YYYY-MM-DD that has BOTH a .json and .jpg sibling,
  // newest first. Stray files (orphan .json or .jpg) are ignored.
  let names;
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const haveJson = new Set();
  const haveJpg = new Set();
  for (const name of names) {
    const match = name.match(/^(\d{4}-\d{2}-\d{2})\.(json|jpg)$/i);
    if (!match) continue;
    if (match[2].toLowerCase() === "json") haveJson.add(match[1]);
    else haveJpg.add(match[1]);
  }
  return [...haveJson]
    .filter((date) => haveJpg.has(date))
    .sort()
    .reverse();
}

function compressImage(path, maxWidth, quality) {
  const attempts = [
    ["magick", [path, "-resize", `${maxWidth}x>`, "-quality", String(quality), "-strip", path]],
    ["convert", [path, "-resize", `${maxWidth}x>`, "-quality", String(quality), "-strip", path]],
    ["sips", ["--resampleWidth", String(maxWidth), "-s", "format", "jpeg", "-s", "formatOptions", String(quality), path, "--out", path]],
  ];
  for (const [cmd, args] of attempts) {
    const result = spawnSync(cmd, args, { stdio: "ignore" });
    if (result.status === 0) return cmd;
  }
  return "uncompressed";
}

// =================================================================
// Parsing
// =================================================================
export function parseApod(html) {
  // The APOD page is plain HTML 3.2-style — no quotes around attrs,
  // mixed case, optional <br>. Be lenient.
  const title = pickTitle(html);
  const date = pickDate(html);
  const imageUrl = pickImage(html);
  const credit = pickCredit(html);
  const copyright = guessCopyright(credit);
  const explanation = pickExplanation(html);

  return {
    title,
    date,
    image_url: imageUrl,
    credit,
    copyright,
    explanation,
    original_url: APOD_URL,
  };
}

function pickTitle(html) {
  // Modern APOD:   <b> Title </b><br><b>Image Credit ...
  // 1996-ish:      <b> Title </b><br><b> Credit: ...
  // Earliest APOD: <b> Title </b><br><b> Picture Credit: ...
  const match = html.match(/<b>\s*([^<]{4,160}?)\s*<\/b>\s*<br>\s*<b>\s*(?:(?:Image|Picture)\s*)?Credit/i);
  if (match) return tidy(match[1]);

  // Fallback: any <b>...</b> followed by <br>
  const fallback = html.match(/<\/center>\s*<center>\s*<b>\s*([^<]{4,160}?)\s*<\/b>/i);
  return fallback ? tidy(fallback[1]) : "Untitled Exhibit";
}

function pickDate(html) {
  const months = ["January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December"];
  const monthAlt = months.join("|");

  // Modern APOD: "2026 May 12" between <p> and <br>.
  const modern = html.match(new RegExp(`<p>\\s*\\n?\\s*(\\d{4})\\s+(${monthAlt})\\s+(\\d{1,2})\\s*<br>`, "i"));
  if (modern) {
    const [, y, monthName, d] = modern;
    const m = String(months.indexOf(monthName) + 1).padStart(2, "0");
    return `${y}-${m}-${String(d).padStart(2, "0")}`;
  }

  // Older APOD (pre-2000): "January 15, 1996" between <p> and <br>.
  const legacy = html.match(new RegExp(`(${monthAlt})\\s+(\\d{1,2}),?\\s+(\\d{4})\\s*<br>`, "i"));
  if (legacy) {
    const [, monthName, d, y] = legacy;
    const m = String(months.indexOf(monthName) + 1).padStart(2, "0");
    return `${y}-${m}-${String(d).padStart(2, "0")}`;
  }

  return new Date().toISOString().slice(0, 10);
}

function pickImage(html) {
  // Prefer the high-res image inside the linked <a href="image/...">.
  const linkMatch = html.match(/<a\s+href=["']?([^"'>\s]*image\/[^"'>\s]+\.(?:jpg|jpeg|png|gif))["']?[^>]*>\s*<img/i);
  if (linkMatch) return absolutize(linkMatch[1]);

  // Fallback: the <img src> itself.
  const imgMatch = html.match(/<img\s+src=["']?([^"'>\s]*image\/[^"'>\s]+\.(?:jpg|jpeg|png|gif))["']?/i);
  if (imgMatch) return absolutize(imgMatch[1]);

  // Last fallback: any <img src>.
  const any = html.match(/<img\s+src=["']?([^"'>\s]+)["']?/i);
  return any ? absolutize(any[1]) : "";
}

function pickCredit(html) {
  // Credit block runs from <b>(Image|Picture )?Credit</b> until either a
  // closing </center> (modern format) or a <b>Explanation:</b> (earliest
  // format, which has no centered credit block). The label's </b> may sit
  // after a linked "Copyright" anchor, so we lazy-match to the first </b>.
  const match = html.match(/<b>\s*(?:(?:Image|Picture)\s*)?Credit[\s\S]*?<\/b>([\s\S]*?)(?:<\/center>|<b>\s*Explanation)/i);
  if (!match) return "";

  let raw = tidy(stripTags(match[1])).replace(/^&\s*Copyright\s*:?\s*/i, "");
  // Snip off the "Text: Author" tail — keep image credit only.
  raw = raw.split(/\s*\bText:\s*/i)[0].trim();
  return raw.replace(/[,;]\s*$/, "");
}

function guessCopyright(credit) {
  return credit;
}

function pickExplanation(html) {
  // The explanation runs from <b>Explanation:</b> until the next structural
  // marker. APOD's live HTML uses HTML 3.2 where <p> is a separator with no
  // closing tag, while browser-saved copies rewrite with </p><p>. We accept
  // either: </p>, the start of "Growing Gallery", "Tomorrow's picture", a
  // following <center>, or <hr>.
  const match = html.match(
    /<b>\s*Explanation:?\s*<\/b>([\s\S]*?)(?:<\/p>|<p>\s*<\/p>|<p>\s*<center>|<p>\s*<hr>|<hr>|<b>\s*(?:Growing\s*Gallery|Tomorrow))/i,
  );
  if (!match) return "";
  return tidy(stripTags(match[1]));
}

// =================================================================
// Helpers
// =================================================================
function absolutize(url) {
  if (/^https?:\/\//.test(url)) return url;
  // Strip leading "./" from saved-page exports.
  let path = url.replace(/^\.\//, "");
  // Saved-page exports replace "image/" with the local files directory.
  path = path.replace(/^.*?_files\//, "image/");
  if (!path.startsWith("image/") && !path.startsWith("/")) {
    path = "image/" + path.replace(/^image\//, "");
  }
  return APOD_BASE + path.replace(/^\//, "");
}

function stripTags(html) {
  return html
    .replace(/<a\b[^>]*>([^<]*)<\/a>/gi, "$1")
    .replace(/<\/?[a-z][^>]*>/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => {
      const map = { quot: '"', apos: "'", rsquo: "’", lsquo: "‘",
                    rdquo: "”", ldquo: "“", hellip: "…",
                    mdash: "—", ndash: "–" };
      return map[name.toLowerCase()] || m;
    });
}

function tidy(text) {
  return text.replace(/\s+/g, " ").trim();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "apod-museum-scraper/1.0 (+https://github.com/CypherPoet/THREE-JS-APOD-Air-and-Space-Museum)",
      "Accept": "text/html",
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function fetchBytes(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "apod-museum-scraper/1.0 (+https://github.com/CypherPoet/THREE-JS-APOD-Air-and-Space-Museum)",
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.+)$/);
    if (match) out[match[1]] = match[2];
    else out[arg.replace(/^--/, "")] = true;
  }
  return out;
}

// Only run when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("✗", err.message);
    process.exit(1);
  });
}
