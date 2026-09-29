import { boostPost } from '../services/postBooster.service.js';
import { HttpError } from '../utils/HttpError.js';

export async function boostPostHandler(req, res) {
  const { post } = req.body || {};

  if (!post || typeof post !== 'string' || !post.trim()) {
    throw new HttpError(400, 'Missing "post" in request body.');
  }
  if (post.length > 5000) {
    throw new HttpError(400, 'That post is too long (max 5000 characters).');
  }

  const boosted = await boostPost(post.trim());
  res.json({ boosted });
}
