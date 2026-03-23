import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { exportDevicesCSV, exportAuditCSV } from '../controllers/reports.controller.js';

const router = Router();
router.use(authenticate);

router.get('/devices.csv', exportDevicesCSV);
router.get('/audit.csv',   exportAuditCSV);

export default router;
