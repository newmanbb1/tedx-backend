import { Router } from 'express';
import { Role } from '@prisma/client';
import { AdminController } from '../controllers/admin.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate, requireRole([Role.ADMIN]));

router.get('/dashboard', AdminController.getDashboardStats);
router.get('/orders', AdminController.getOrders);
router.post('/orders/:id/approve', AdminController.approveOrder);
router.post('/orders/:id/reject', AdminController.rejectOrder);
router.put('/payment-settings/:id', AdminController.updatePaymentSettings);

export default router;
