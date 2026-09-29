import { Router } from 'express';
import videoRoutes from './video.routes.js';
import postBoosterRoutes from './postBooster.routes.js';
import imageRoutes from './image.routes.js';

const router = Router();

router.get('/health', (req, res) => res.json({ ok: true }));
router.use('/', videoRoutes);
router.use('/post-booster', postBoosterRoutes);
router.use('/image', imageRoutes);

export default router;
