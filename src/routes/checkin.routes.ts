import { Router } from 'express';
import { Role } from '@prisma/client';
import { CheckInController } from '../controllers/checkin.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate, requireRole([Role.ADMIN, Role.STAFF]));

router.post('/validate', CheckInController.validateTicket);
router.get('/search', CheckInController.searchAttendees);

export default router;

