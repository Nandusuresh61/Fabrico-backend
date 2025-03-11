import express from "express"
import { authenticate, authorizeAdmin } from '../middlewares/authMiddleware.js';
import { searchUsers, loginAdmin, logoutAdmin, toggleUserStatus } from "../controllers/adminController.js";


const router = express.Router();


router.post('/login', loginAdmin)
router.post('/logout', logoutAdmin);

// Block & Unblock Option
router.put('/:userId/toggle-status', authenticate, authorizeAdmin, toggleUserStatus);
// Search From backend
router.post('/',authenticate, authorizeAdmin, searchUsers)

export default router;