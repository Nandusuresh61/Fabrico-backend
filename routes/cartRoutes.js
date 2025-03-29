import express from 'express';
import { 
    getCart,
    addToCart,
    removeFromCart
} from '../controllers/cartController.js';
import { authenticate } from '../middlewares/authMiddleWare.js';

const router = express.Router();

router.use(authenticate);

router.route('/')
    .get(getCart)
    .post(addToCart);

router.route('/:productId')
    .delete(removeFromCart);

export default router;
