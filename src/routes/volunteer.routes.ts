import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import { VolunteerController } from '../controllers/volunteer.controller.js';
import { uploadReceiptMiddleware } from '../config/multer.js';

const router = Router();

router.use(authenticate);
router.use(requireRole([Role.ADMIN, Role.VOLUNTEER]));

router.post('/register', uploadReceiptMiddleware.single('receipt'), VolunteerController.register);
router.get('/lookup-carnet', VolunteerController.lookupCarnet);
router.post('/dispatch-whatsapp', VolunteerController.dispatchWhatsApp);
router.get('/cash-summary', VolunteerController.getCashSummary);

export default router;
