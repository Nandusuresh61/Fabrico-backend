import express from 'express';
import { 
    createOrder,
    getOrders,
    getOrderById,
    updateOrderStatus,
    cancelOrder,
    verifyReturnRequest
} from '../controllers/orderController.js';
import { authenticate, authorizeAdmin } from '../middlewares/authMiddleWare.js';

const router = express.Router();

router.use(authenticate); // Protect all order routes

router.route('/')
    .post(createOrder)
    .get(authorizeAdmin, getOrders); // Only admin can get all orders

router.route('/:id')
    .get(getOrderById);

router.route('/:id/status')
    .put(authorizeAdmin, updateOrderStatus);

router.route('/:id/cancel')
    .put(cancelOrder);

router.route('/:id/return/:itemId')
    .put(authorizeAdmin, verifyReturnRequest);

export default router;
