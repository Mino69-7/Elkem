import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { listAlerts, createAlert, updateAlert, deleteAlert, getTriggered } from '../controllers/stockAlert.controller.js';

const router = Router();
router.use(authenticate);

router.get   ('/',          listAlerts);
router.get   ('/triggered', getTriggered);
router.post  ('/',          requireRole('MANAGER'), createAlert);
router.put   ('/:id',       requireRole('MANAGER'), updateAlert);
router.delete('/:id',       requireRole('MANAGER'), deleteAlert);

export default router;
