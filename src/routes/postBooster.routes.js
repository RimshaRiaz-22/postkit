import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { boostPostHandler } from '../controllers/postBooster.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const boostLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down.' },
});

router.post('/boost', boostLimiter, asyncHandler(boostPostHandler));

export default router;
