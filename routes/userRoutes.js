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
    resetPassword,
    googleAuthController,
    verifyEmailUpdateOtp,
    updateUserProfile,
    sendEmailUpdateOtp,
    changePassword
} from '../controllers/userController.js';
import { authenticate } from '../middlewares/authMiddleWare.js'

const router = express.Router();

router.route("/google").post(googleAuthController); // Google Auth Here
router.post('/register', createUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/forgot-password', forgotPassword);
router.post('/verify-forgot-otp', verifyForgotOtp);
router.post('/resend-forgot-otp', resendForgotOtp);
router.post('/reset-password', resetPassword);
router.post('/verify-email-update', authenticate, verifyEmailUpdateOtp);
router.post('/update-profile', authenticate, updateUserProfile);
router.post('/send-email-update-otp', authenticate, sendEmailUpdateOtp);
router.post('/change-password', authenticate, changePassword);

export default router;
