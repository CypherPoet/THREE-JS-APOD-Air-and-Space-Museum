// =================================================================
// APOD loader — reads the append-only archive under data/
// =================================================================
// Layout:
//   data/manifest.json                 { latest, entries: [YYYY-MM-DD…] }
//   data/archive/<YYYY-MM-DD>.json     parsed metadata
//   data/archive/<YYYY-MM-DD>.jpg      compressed image
//
// The frontend reads `manifest.latest` and pulls that day's pair.
// No NASA API key, no CORS proxy — everything is same-origin.
//
// A GitHub Action (.github/workflows/refresh-apod.yml) appends a new
// entry every morning and updates the manifest.
// =================================================================

const MANIFEST_URL = "./data/manifest.json";
const ARCHIVE_BASE = "./data/archive";

const ARCHIVE_FALLBACK = {
  title: "Pillars of Creation",
  date: "1995-04-01",
  explanation:
    "Newborn stars are forming in the Eagle Nebula. This image, taken with the Hubble Space Telescope in 1995, shows evaporating gaseous globules emerging from pillars of molecular hydrogen and dust. The pillars themselves are several light-years long. Although such features can be seen elsewhere, the Eagle Nebula's pillars have become one of the most iconic images in the history of astronomy — and a reminder that the matter from which we are made was once arranged in just such cathedral-like formations.",
  credit: "NASA, ESA, Hubble Heritage Team",
  copyright: "NASA, ESA, Hubble Heritage Team",
  imageUrl: "https://wsrv.nl/?url=apod.nasa.gov/apod/image/9504/m16_hst.gif&output=jpg&q=88&w=2400",
  mediaType: "image",
  originalUrl: "https://apod.nasa.gov/apod/ap950401.html",
};

export async function fetchApod() {
  try {
    const manifest = await fetchJson(MANIFEST_URL);
    if (!manifest.latest) throw new Error("manifest has no `latest`");
    const entry = await fetchJson(`${ARCHIVE_BASE}/${manifest.latest}.json`);
    return normalize(entry);
  } catch (error) {
    console.warn("APOD archive unavailable; using fallback", error);
    return {
      ...ARCHIVE_FALLBACK,
      fallbackNote: "Daily data unavailable — showing an archive favourite.",
    };
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  return response.json();
}

function normalize(entry) {
  return {
    title: entry.title || "Untitled exhibit",
    date: entry.date || "",
    explanation: entry.explanation || "",
    credit: entry.credit || "",
    copyright: entry.credit || entry.copyright || "",
    imageUrl: `${ARCHIVE_BASE}/${entry.date}.jpg`,
    sourceImageUrl: entry.image_url || "",
    mediaType: "image",
    originalUrl: entry.original_url || "https://apod.nasa.gov/apod/astropix.html",
    fetchedAt: entry.fetched_at || "",
  };
}

export function formatDate(iso) {
  if (!iso) return "—";
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.toLocaleDateString("en-US", {
      timeZone: "UTC",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
