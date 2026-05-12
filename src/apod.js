// =================================================================
// APOD loader — reads from the locally-cached data/apod.json
// =================================================================
// A GitHub Action (.github/workflows/refresh-apod.yml) scrapes
// apod.nasa.gov daily, compresses the image, and commits the updated
// data/ files. GitHub Pages auto-deploys, so the client just reads
// from the same origin — no API keys, no CORS proxy.
//
// If the JSON or image is missing, we fall back to an archive entry.
// =================================================================

const DATA_URL = "./data/apod.json";
const IMAGE_URL = "./data/apod.jpg";

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
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${response.status}`);
    const data = await response.json();
    return normalize(data);
  } catch (error) {
    console.warn("APOD JSON unavailable; using archive fallback", error);
    return {
      ...ARCHIVE_FALLBACK,
      fallbackNote: "Daily data unavailable — showing an archive favourite.",
    };
  }
}

function normalize(entry) {
  return {
    title: entry.title || "Untitled exhibit",
    date: entry.date || "",
    explanation: entry.explanation || "",
    credit: entry.credit || "",
    copyright: entry.credit || entry.copyright || "",
    imageUrl: IMAGE_URL,         // the locally-cached image
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
