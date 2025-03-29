import express from 'express';
import { 
    addToWishlist, 
    removeFromWishlist, 
    getWishlist 
} from '../controllers/wishlistController.js';
import { authenticate } from '../middlewares/authMiddleWare.js';

const router = express.Router();

router.use(authenticate); // Protect all wishlist routes

router.route('/')
    .get(getWishlist)
    .post(addToWishlist);

router.delete('/:itemId', removeFromWishlist);

export default router;
