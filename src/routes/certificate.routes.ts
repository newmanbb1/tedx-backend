import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import { CertificateController } from '../controllers/certificate.controller.js';
import { uploadMediaMiddleware } from '../config/multer.js';
import { certificateLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

// Rutas públicas
router.get('/templates', CertificateController.getTemplates);
router.get('/lookup', certificateLimiter, CertificateController.lookup);
router.get('/verify/:code', CertificateController.verify);

// Rutas de administración
router.get('/', authenticate, requireRole([Role.ADMIN]), CertificateController.getAllCertificates);
router.post(
  '/templates/:category',
  authenticate,
  requireRole([Role.ADMIN]),
  uploadMediaMiddleware.single('image'),
  CertificateController.updateTemplate
);
router.post('/manual-issue', authenticate, requireRole([Role.ADMIN]), CertificateController.issueManual);

export default router;

