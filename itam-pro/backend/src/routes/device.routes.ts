import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import {
  listDevices, getDevice, createDevice, updateDevice,
  deleteDevice, assignDevice, unassignDevice,
} from '../controllers/device.controller.js';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

router.get   ('/',          listDevices);
router.get   ('/:id',       getDevice);
router.post  ('/',          requireRole('MANAGER', 'TECHNICIAN'), createDevice);
router.put   ('/:id',       requireRole('MANAGER', 'TECHNICIAN'), updateDevice);
router.delete('/:id',       requireRole('MANAGER'),               deleteDevice);
router.patch ('/:id/assign',   requireRole('MANAGER', 'TECHNICIAN'), assignDevice);
router.patch ('/:id/unassign', requireRole('MANAGER', 'TECHNICIAN'), unassignDevice);

export default router;
