import { Router } from 'express';
import { Role } from '@prisma/client';
import { SponsorController } from '../controllers/sponsor.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import { uploadMediaMiddleware } from '../config/multer.js';

const router = Router();

router.get('/', SponsorController.getPublicSponsors);

router.use(authenticate, requireRole([Role.ADMIN]));
router.get('/admin', SponsorController.getAllAdmin);
router.post('/', uploadMediaMiddleware.single('logo'), SponsorController.create);
router.put('/:id', uploadMediaMiddleware.single('logo'), SponsorController.update);
router.delete('/:id', SponsorController.delete);

export default router;
