import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { getStats } from '../controllers/stats.controller.js';

const router = Router();

router.use(authenticate);
router.get('/', getStats);

export default router;
