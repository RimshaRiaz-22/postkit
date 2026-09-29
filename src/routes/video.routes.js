import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { resolveVideo, downloadVideo } from '../controllers/video.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const resolveLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down.' },
});

router.post('/resolve', resolveLimiter, asyncHandler(resolveVideo));
router.get('/download', asyncHandler(downloadVideo));

export default router;
