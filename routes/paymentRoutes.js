import express from 'express';
import { authenticate } from '../middlewares/authMiddleWare.js';
import {
    createRazorpayOrder,
    verifyPayment
} from '../controllers/paymentController.js';

const router = express.Router();

router.post('/create-razorpay-order', authenticate, createRazorpayOrder);
router.post('/verify-payment', authenticate, verifyPayment);

export default router;