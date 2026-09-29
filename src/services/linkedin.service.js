import * as cheerio from 'cheerio';
import { HttpError } from '../utils/HttpError.js';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const ALLOWED_HOSTS = new Set(['www.linkedin.com', 'linkedin.com', 'lnkd.in']);
const ALLOWED_CDN_HOSTS = new Set(['dms.licdn.com', 'media.licdn.com']);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS) || 12000;

export function isSupportedUrl(rawUrl) {
  try {
    const { hostname } = new URL(rawUrl);
    return ALLOWED_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

export async function resolveLinkedInVideo(rawUrl) {
  if (!isSupportedUrl(rawUrl)) {
    throw new HttpError(400, 'Please paste a linkedin.com or lnkd.in link.');
  }

  let res;
  try {
    res = await fetch(rawUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'en-US,en;q=0.9',
      },
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

  const videoEl = $('video[data-sources]').first();
  if (!videoEl.length) {
    if (/authwall|Sign in to view/i.test(html)) {
      throw new HttpError(422, 'This post is not public — only public post videos can be fetched.');
    }
    throw new HttpError(404, "Couldn't find a video in that link.");
  }

  let sources;
  try {
    sources = JSON.parse(videoEl.attr('data-sources'));
  } catch {
    throw new HttpError(500, 'Could not read the video data on that post.');
  }

  const normalizedSources = sources
    .filter((s) => s && s.src)
    .map((s) => ({
      url: s.src,
      type: s.type || 'video/mp4',
      bitrate: s['data-bitrate'] || 0,
    }))
    .sort((a, b) => b.bitrate - a.bitrate);

  if (!normalizedSources.length) {
    throw new HttpError(404, "Couldn't find a downloadable video source in that link.");
  }

  const thumbnail =
    videoEl.attr('data-poster-url') || $('meta[property="og:image"]').attr('content') || null;

  const title = ($('meta[property="og:title"]').attr('content') || $('title').text() || 'LinkedIn video').trim();

  const description =
    $('[data-test-id="main-feed-activity-card__commentary"]').first().text().trim() || null;

  return {
    title,
    description,
    thumbnail,
    sources: normalizedSources,
    canonicalUrl: res.url,
  };
}

export async function streamLinkedInVideo(src, filename, res) {
  if (!src || typeof src !== 'string') {
    throw new HttpError(400, 'Missing "src" query parameter.');
  }

  let parsed;
  try {
    parsed = new URL(src);
  } catch {
    throw new HttpError(400, 'Invalid "src" URL.');
  }

  if (!ALLOWED_CDN_HOSTS.has(parsed.hostname)) {
    throw new HttpError(400, 'That source host is not allowed.');
  }

  const upstream = await fetch(parsed.toString(), { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS * 2) });
  if (!upstream.ok || !upstream.body) {
    throw new HttpError(502, `Failed to fetch the video (status ${upstream.status}).`);
  }

  const safeName =
    String(filename || 'linkedin-video')
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .trim()
      .slice(0, 80) || 'linkedin-video';

  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.mp4"`);
  const contentLength = upstream.headers.get('content-length');
  if (contentLength) res.setHeader('Content-Length', contentLength);

  return upstream;
}
