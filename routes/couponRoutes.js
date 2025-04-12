import express from 'express';
import { createCoupon, getAllCoupons, toggleCouponStatus, updateCoupon } from '../controllers/couponController.js';
import { authenticate, authorizeAdmin } from '../middlewares/authMiddleWare.js';
const router = express.Router();

router.use(authenticate, authorizeAdmin);

router.route('/')
  .get(getAllCoupons)
  .post(createCoupon);

router.route('/:id')
 .put(updateCoupon)
//  .delete(deleteCoupon);

 router.put('/:id/toggle-status', toggleCouponStatus);

export default router;