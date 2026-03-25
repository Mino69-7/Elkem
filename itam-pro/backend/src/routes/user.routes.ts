import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { listUsers, getUser, deactivateUser } from '../controllers/user.controller.js';

const router = Router();

router.use(authenticate);

router.get('/',    listUsers);
router.get('/:id', getUser);
router.delete('/:id', requireRole('MANAGER'), deactivateUser);

export default router;
