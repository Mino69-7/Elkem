import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { getIntuneStatus, listIntuneDevices, syncIntune } from '../controllers/intune.controller.js';

const router = Router();

router.use(authenticate);

router.get ('/status',  getIntuneStatus);
router.get ('/devices', requireRole('MANAGER', 'TECHNICIAN'), listIntuneDevices);
router.post('/sync',    requireRole('MANAGER', 'TECHNICIAN'), syncIntune);

export default router;
