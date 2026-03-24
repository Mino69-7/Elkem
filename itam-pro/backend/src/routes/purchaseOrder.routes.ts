import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { listOrders, listHistory, createOrder, updateOrder, cancelOrder, receiveDevice } from '../controllers/purchaseOrder.controller.js';

const router = Router();
router.use(authenticate);

router.get('/',           listOrders);
router.get('/history',    listHistory);
router.post('/',          requireRole('MANAGER'), createOrder);
router.put('/:id',        requireRole('MANAGER'), updateOrder);
router.delete('/:id',     requireRole('MANAGER'), cancelOrder);
router.post('/:orderId/receive', requireRole('TECHNICIAN'), receiveDevice);

export default router;
