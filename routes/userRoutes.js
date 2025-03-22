import express from 'express';
import { 
    createUser, 
    loginUser, 
    logoutUser, 
    verifyOtp,
    resendOtp,
    forgotPassword,
    verifyForgotOtp,
    resendForgotOtp,
    resetPassword
} from '../controllers/userController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/register', createUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/forgot-password', forgotPassword);
router.post('/verify-forgot-otp', verifyForgotOtp);
router.post('/resend-forgot-otp', resendForgotOtp);
router.post('/reset-password', resetPassword);

export default router;
