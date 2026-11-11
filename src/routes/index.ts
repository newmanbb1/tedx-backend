import { Router } from 'express';
import authRoutes from './auth.routes.js';
import eventRoutes from './event.routes.js';
import orderRoutes from './order.routes.js';
import adminRoutes from './admin.routes.js';
import checkinRoutes from './checkin.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/events', eventRoutes);
router.use('/orders', orderRoutes);
router.use('/admin', adminRoutes);
router.use('/checkin', checkinRoutes);

export default router;
