import { Router } from 'express';
import { Role } from '@prisma/client';
import { BackgroundController } from '../controllers/background.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import { uploadMediaMiddleware } from '../config/multer.js';

const router = Router();

router.get('/', BackgroundController.getPublic);

router.use(authenticate, requireRole([Role.ADMIN]));
router.get('/admin', BackgroundController.getAllAdmin);
router.post('/', uploadMediaMiddleware.single('image'), BackgroundController.create);
router.delete('/:id', BackgroundController.delete);

export default router;

