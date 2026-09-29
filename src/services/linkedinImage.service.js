import * as cheerio from 'cheerio';
import { HttpError } from '../utils/HttpError.js';
import { isSupportedUrl } from './linkedin.service.js';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const CDN_HOST = /^(media|dms)(-exp\d+)?\.licdn\.com$/;
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS) || 12000;

// Profile photos, company logos, icons and placeholders are not post images.
const NOT_POST_IMAGE = /profile-|company-logo|logo|icon|ghost|spinner|blank|emoji|reaction/i;

const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function isCdnImage(rawUrl) {
  try {
    const { protocol, hostname, pathname } = new URL(rawUrl);
    return protocol === 'https:' && CDN_HOST.test(hostname) && !NOT_POST_IMAGE.test(pathname);
  } catch {
    return false;
  }
}

// Collects post images from a public LinkedIn post page, keeping one URL per
// distinct image.
export function extractImages($) {
  const seen = new Set();
  const images = [];

  const add = (rawUrl) => {
    if (!rawUrl || !isCdnImage(rawUrl)) return;
    const { pathname } = new URL(rawUrl);
    if (seen.has(pathname)) return;
    seen.add(pathname);
    images.push({ url: rawUrl });
  };

  const collect = (els) =>
    els.each((_, el) => {
      const img = $(el);
      add(img.attr('data-delayed-url') || img.attr('data-src') || img.attr('src'));
    });

  // Post media inside the activity card first, then any other image on the page.
  collect($('[data-test-id="main-feed-activity-card"] img, article img'));
  if (!images.length) collect($('img'));
  if (!images.length) add($('meta[property="og:image"]').attr('content'));

  return images;
}

export async function resolveLinkedInImages(rawUrl) {
  if (!isSupportedUrl(rawUrl)) {
    throw new HttpError(400, 'Please paste a linkedin.com or lnkd.in link.');
  }

  let res;
  try {
    res = await fetch(rawUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new HttpError(502, 'Could not reach LinkedIn. Try again in a moment.');
  }

  if (!res.ok) {
    throw new HttpError(502, `LinkedIn responded with status ${res.status}.`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const images = extractImages($);

  if (!images.length) {
    if (/authwall|Sign in to view/i.test(html)) {
      throw new HttpError(422, 'This post is not public — only public post images can be fetched.');
    }
    throw new HttpError(404, "Couldn't find an image in that link.");
  }

  const title = ($('meta[property="og:title"]').attr('content') || $('title').text() || 'LinkedIn post').trim();
  const description =
    $('[data-test-id="main-feed-activity-card__commentary"]').first().text().trim() || null;

  return { title, description, images, canonicalUrl: res.url };
}

export async function fetchLinkedInImage(src) {
  if (!src || typeof src !== 'string') {
    throw new HttpError(400, 'Missing "src" query parameter.');
  }

  let parsed;
  try {
    parsed = new URL(src);
  } catch {
    throw new HttpError(400, 'Invalid "src" URL.');
  }

  if (parsed.protocol !== 'https:' || !CDN_HOST.test(parsed.hostname)) {
    throw new HttpError(400, 'That source host is not allowed.');
  }

  const upstream = await fetch(parsed.toString(), { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS * 2) });
  if (!upstream.ok || !upstream.body) {
    throw new HttpError(502, `Failed to fetch the image (status ${upstream.status}).`);
  }

  const contentType = (upstream.headers.get('content-type') || 'image/jpeg').split(';')[0];
  if (!contentType.startsWith('image/')) {
    throw new HttpError(502, 'That link did not return an image.');
  }

  return { upstream, contentType, extension: EXTENSIONS[contentType] || 'jpg' };
}
