import { Readable } from 'node:stream';
import { resolveLinkedInImages, fetchLinkedInImage } from '../services/linkedinImage.service.js';
import { HttpError } from '../utils/HttpError.js';

export async function resolveImage(req, res) {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    throw new HttpError(400, 'Missing "url" in request body.');
  }

  const data = await resolveLinkedInImages(url.trim());
  res.json(data);
}

// `inline=1` serves the image for on-page preview; otherwise it downloads.
export async function downloadImage(req, res) {
  const { src, filename, inline } = req.query;
  const { upstream, contentType, extension } = await fetchLinkedInImage(src);

  const safeName =
    String(filename || 'linkedin-image')
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .trim()
      .slice(0, 80) || 'linkedin-image';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (!inline) res.setHeader('Content-Disposition', `attachment; filename="${safeName}.${extension}"`);
  const contentLength = upstream.headers.get('content-length');
  if (contentLength) res.setHeader('Content-Length', contentLength);

  Readable.fromWeb(upstream.body).pipe(res);
}
