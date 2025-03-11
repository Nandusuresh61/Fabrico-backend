import express from 'express';
import { createUser, loginUser, logoutUser, } from '../controllers/userController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/register', createUser);
router.post('/login', authenticate, loginUser);
router.post('/logout', logoutUser);

export default router;
