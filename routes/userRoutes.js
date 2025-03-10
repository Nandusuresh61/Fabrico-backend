import express from 'express';
import { createUser, loginUser, logoutUser, getAllUsers, toggleUserStatus } from '../controllers/userController.js';
import { authenticate, authorizeAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/', createUser);
router.post('/auth', loginUser);
router.post('/logout', logoutUser);
router.get('/', authenticate, authorizeAdmin, getAllUsers);
router.put('/:userId/toggle-status', authenticate, authorizeAdmin, toggleUserStatus);

export default router;
