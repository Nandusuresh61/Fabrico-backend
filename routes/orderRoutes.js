import express from 'express';
import { 
    createOrder,
    getOrders,
    getOrderById,
    updateOrderStatus,
    cancelOrder
} from '../controllers/orderController.js';
import { authenticate } from '../middlewares/authMiddleWare.js';

const router = express.Router();

router.use(authenticate); // Protect all order routes

router.route('/')
    .post(createOrder)
    .get(getOrders);

router.route('/:id')
    .get(getOrderById);

router.route('/:id/status')
    .put(updateOrderStatus);

router.route('/:id/cancel')
    .put(cancelOrder);

export default router;
