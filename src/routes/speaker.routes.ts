import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import { SpeakerController } from '../controllers/speaker.controller.js';
import { uploadMediaMiddleware } from '../config/multer.js';

const router = Router();

// Ruta pública para la Landing Page
router.get('/public', SpeakerController.getPublicSpeakers);

// Rutas de administración
router.get('/', authenticate, requireRole([Role.ADMIN]), SpeakerController.getAllSpeakers);
router.post('/', authenticate, requireRole([Role.ADMIN]), uploadMediaMiddleware.single('image'), SpeakerController.create);
router.put('/:id', authenticate, requireRole([Role.ADMIN]), uploadMediaMiddleware.single('image'), SpeakerController.update);
router.delete('/:id', authenticate, requireRole([Role.ADMIN]), SpeakerController.delete);

export default router;

