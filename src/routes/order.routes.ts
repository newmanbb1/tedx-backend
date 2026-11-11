import { Router } from 'express';
import { OrderController } from '../controllers/order.controller.js';
import { uploadReceiptMiddleware } from '../config/multer.js';

const router = Router();

router.post('/checkout', OrderController.create);
router.post('/upload-receipt', uploadReceiptMiddleware.single('receipt'), OrderController.uploadReceipt);
router.get('/status/:idOrNumber', OrderController.getStatus);
router.get('/ticket/:code', OrderController.getTicket);

export default router;
