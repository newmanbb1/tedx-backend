import { Router } from 'express';
import { Role } from '@prisma/client';
import { AdminController } from '../controllers/admin.controller.js';
import { WhatsAppAdminController } from '../controllers/whatsapp-admin.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import { uploadMediaMiddleware } from '../config/multer.js';

const router = Router();

router.use(authenticate, requireRole([Role.ADMIN]));

router.get('/dashboard', AdminController.getDashboardStats);
router.get('/orders', AdminController.getOrders);
router.post('/orders/:id/approve', AdminController.approveOrder);
router.post('/orders/:id/reject', AdminController.rejectOrder);
router.get('/payment-settings', AdminController.getPaymentSettings);
router.put('/payment-settings/:id', AdminController.updatePaymentSettings);
router.post('/payment-settings/:id/qr', uploadMediaMiddleware.single('qrImage'), AdminController.uploadPaymentQr);
router.post('/ticket-types', AdminController.createTicketType);
router.put('/ticket-types/:id', AdminController.updateTicketType);
router.delete('/ticket-types/:id', AdminController.deleteTicketType);

// Rutas de administración de WhatsApp (Evolution API)
router.get('/whatsapp/status', WhatsAppAdminController.getStatus);
router.get('/whatsapp/qr', WhatsAppAdminController.getQR);
router.post('/whatsapp/pairing-code', WhatsAppAdminController.getPairingCode);
router.post('/whatsapp/restart', WhatsAppAdminController.restart);
router.post('/whatsapp/logout', WhatsAppAdminController.logout);
router.post('/whatsapp/send-test', WhatsAppAdminController.sendTest);
router.get('/whatsapp/queue-stats', WhatsAppAdminController.getQueueStats);
router.post('/whatsapp/queue-config', WhatsAppAdminController.updateQueueConfig);
router.post('/whatsapp/queue-clear', WhatsAppAdminController.clearQueue);

export default router;

