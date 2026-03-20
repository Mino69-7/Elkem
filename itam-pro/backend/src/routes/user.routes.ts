import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { listUsers, getUser } from '../controllers/user.controller.js';

const router = Router();

router.use(authenticate);

router.get('/',    listUsers);
router.get('/:id', getUser);

export default router;
