import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import { ValidatorController } from '../controllers/validator.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireRole([Role.ADMIN, Role.VALIDATOR]));

router.get('/queue', ValidatorController.getQueue);
router.get('/stats', ValidatorController.getStats);
router.post('/orders/:id/claim', ValidatorController.claimOrder);
router.post('/orders/:id/release', ValidatorController.releaseOrder);
router.post('/orders/:id/approve', ValidatorController.approveOrder);
router.post('/orders/:id/reject', ValidatorController.rejectOrder);

export default router;

