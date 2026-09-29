import { Readable } from 'node:stream';
import { resolveLinkedInVideo, streamLinkedInVideo } from '../services/linkedin.service.js';
import { HttpError } from '../utils/HttpError.js';

export async function resolveVideo(req, res) {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    throw new HttpError(400, 'Missing "url" in request body.');
  }

  const data = await resolveLinkedInVideo(url.trim());
  res.json(data);
}

export async function downloadVideo(req, res) {
  const { src, filename } = req.query;
  const upstream = await streamLinkedInVideo(src, filename, res);
  Readable.fromWeb(upstream.body).pipe(res);
}
