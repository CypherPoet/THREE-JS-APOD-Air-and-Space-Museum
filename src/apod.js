// =================================================================
// NASA Astronomy Picture of the Day — fetcher
// =================================================================
// Uses the public api.nasa.gov endpoint. DEMO_KEY works for personal
// usage (30 requests/hour, 50/day per IP). To raise the limit, get a
// free key at https://api.nasa.gov and replace DEMO_KEY below, or set
// localStorage.setItem('apod_key', 'YOUR_KEY') in the browser console.
// =================================================================

const ENDPOINT = "https://api.nasa.gov/planetary/apod";
const DEFAULT_KEY = "DEMO_KEY";

export function getApiKey() {
  try {
    return localStorage.getItem("apod_key") || DEFAULT_KEY;
  } catch {
    return DEFAULT_KEY;
  }
}

export function setApiKey(key) {
  try {
    if (key && key.trim()) {
      localStorage.setItem("apod_key", key.trim());
    } else {
      localStorage.removeItem("apod_key");
    }
  } catch {
    /* localStorage may be disabled */
  }
}

export function isUsingDefaultKey() {
  return getApiKey() === DEFAULT_KEY;
}

const ARCHIVE_FALLBACK = {
  title: "Pillars of Creation",
  date: "1995-04-01",
  explanation:
    "Newborn stars are forming in the Eagle Nebula. This image, taken with the Hubble Space Telescope in 1995, shows evaporating gaseous globules emerging from pillars of molecular hydrogen and dust. The pillars themselves are several light-years long. Although such features can be seen elsewhere, the Eagle Nebula's pillars have become one of the most iconic images in the history of astronomy — and a reminder that the matter from which we are made was once arranged in just such cathedral-like formations.",
  copyright: "NASA, ESA, Hubble Heritage Team",
  imageUrl: "https://wsrv.nl/?url=apod.nasa.gov/apod/image/9504/m16_hst.gif&output=jpg&q=88&w=2400",
  mediaType: "image",
  originalUrl: "https://apod.nasa.gov/apod/ap950401.html",
};

/**
 * Fetch the most recent APOD entry with an image, walking back through
 * recent days if today's entry is a video or the API rejects us.
 * Always resolves — never rejects — so the gallery always has content.
 */
export async function fetchApod() {
  for (let offset = 0; offset <= 7; offset += 1) {
    const date = offset === 0 ? undefined : offsetDate(offset);
    try {
      const entry = await getEntry(date);
      if (entry.media_type === "image") {
        const result = normalize(entry);
        if (offset > 0) {
          result.fallbackNote = `Today's exhibit was unavailable; showing ${formatDate(entry.date)} instead.`;
        }
        return result;
      }
      // It's a video — keep walking back for an image.
    } catch (error) {
      console.warn(`APOD fetch failed for ${date || "today"}`, error);
    }
  }

  // Final fallback: a celebrated archive entry.
  return {
    ...ARCHIVE_FALLBACK,
    fallbackNote: "NASA archive unreachable; showing an archive favourite.",
  };
}

async function getEntry(date) {
  const params = new URLSearchParams({ api_key: getApiKey(), thumbs: "true" });
  if (date) params.set("date", date);
  const response = await fetch(`${ENDPOINT}?${params}`);
  if (!response.ok) {
    throw new Error(`APOD request failed: ${response.status}`);
  }
  return response.json();
}

function normalize(entry) {
  // NASA's APOD images (apod.nasa.gov) don't send Access-Control-Allow-Origin
  // headers, so Three.js can't sample them as WebGL textures. We route the
  // image through wsrv.nl — a free image CDN/proxy that adds CORS headers —
  // and use it to constrain the size for faster delivery.
  const sourceUrl =
    entry.media_type === "image"
      ? entry.hdurl || entry.url
      : entry.thumbnail_url || entry.url;

  return {
    title: entry.title || "Untitled exhibit",
    date: entry.date,
    explanation: entry.explanation || "",
    copyright: (entry.copyright || "").replace(/\s+/g, " ").trim(),
    imageUrl: sourceUrl ? proxyUrl(sourceUrl) : "",
    mediaType: entry.media_type,
    originalUrl: `https://apod.nasa.gov/apod/ap${shortDate(entry.date)}.html`,
  };
}

function proxyUrl(originalUrl) {
  if (!originalUrl) return "";
  // Strip protocol; wsrv.nl expects scheme-less URLs.
  const stripped = originalUrl.replace(/^https?:\/\//, "");
  const params = new URLSearchParams({
    url: stripped,
    output: "jpg",
    q: "88",
    w: "2400",
    we: "", // 'we' (without enlargement) — return original if smaller
  });
  return `https://wsrv.nl/?${params}`;
}

function offsetDate(daysBack) {
  const now = new Date();
  now.setDate(now.getDate() - daysBack);
  return now.toISOString().slice(0, 10);
}

function shortDate(iso) {
  // 2026-05-12  ->  260512
  const [y, m, d] = iso.split("-");
  return `${y.slice(2)}${m}${d}`;
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
