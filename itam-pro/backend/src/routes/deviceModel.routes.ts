import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { listModels, listAllModels, createModel, updateModel, deleteModel, stockSummary, reorderModels } from '../controllers/deviceModel.controller.js';

const router = Router();
router.use(authenticate);

router.get ('/stock-summary', stockSummary);
router.get ('/',              listModels);
router.get ('/all',   requireRole('MANAGER'), listAllModels);
router.post('/',      requireRole('MANAGER'), createModel);
router.put ('/:id',   requireRole('MANAGER'), updateModel);
router.patch ('/reorder', requireRole('MANAGER'), reorderModels);
router.delete('/:id',    requireRole('MANAGER'), deleteModel);

export default router;
