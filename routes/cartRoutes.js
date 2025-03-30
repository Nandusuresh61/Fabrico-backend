import express from 'express';
import { 
    getCart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart
} from '../controllers/cartController.js';
import { authenticate } from '../middlewares/authMiddleWare.js';

const router = express.Router();

router.use(authenticate);

router.route('/')
    .get(getCart)
    .post(addToCart)
    .delete(clearCart);

router.route('/:itemId')
    .delete(removeFromCart)
    .patch(updateCartQuantity);

export default router;
