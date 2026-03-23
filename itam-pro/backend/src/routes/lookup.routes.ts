import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { lookupBySerial } from '../controllers/lookup.controller.js';

const router = Router();
router.use(authenticate);
router.get('/serial/:serialNumber', lookupBySerial);

export default router;
