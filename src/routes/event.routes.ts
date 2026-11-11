import { Router } from 'express';
import { EventController } from '../controllers/event.controller.js';

const router = Router();

router.get('/public', EventController.getPublicEvent);

export default router;
