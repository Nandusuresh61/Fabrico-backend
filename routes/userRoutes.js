import express from 'express';
import { 
    createUser, 
    loginUser, 
    logoutUser, 
    verifyOtp,
    resendOtp
} from '../controllers/userController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/register', createUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);

export default router;
