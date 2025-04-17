import express from 'express';
import { createCoupon, getAllCoupons, toggleCouponStatus, updateCoupon, getAvailableCoupons, validateCoupon, markCouponAsUsed } from '../controllers/couponController.js';
import { authenticate, authorizeAdmin } from '../middlewares/authMiddleWare.js';
const router = express.Router();




// User routes
router.get('/available', authenticate, getAvailableCoupons);
router.post('/validate', authenticate, validateCoupon);
router.post('/mark-used', authenticate, markCouponAsUsed);

// Admin routes
router.use(authenticate, authorizeAdmin);

router.route('/')
  .get(getAllCoupons)
  .post(createCoupon);

router.route('/:id')
 .put(updateCoupon)
//  .delete(deleteCoupon);

 router.put('/:id/toggle-status', toggleCouponStatus);


export default router;