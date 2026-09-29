import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { resolveImage, downloadImage } from '../controllers/image.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const resolveLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down.' },
});

router.post('/resolve', resolveLimiter, asyncHandler(resolveImage));
router.get('/download', asyncHandler(downloadImage));

export default router;
