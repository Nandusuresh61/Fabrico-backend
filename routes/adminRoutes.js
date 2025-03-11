import express from "express"
import { authenticate, authorizeAdmin } from '../middlewares/authMiddleware.js';
import { getAllUsers, loginAdmin, logoutAdmin, toggleUserStatus } from "../controllers/adminController.js";


const router = express.Router();

router.get('/',authenticate, authorizeAdmin, getAllUsers)
router.post('/login',authenticate, authorizeAdmin, loginAdmin)
router.post('/logout', logoutAdmin);
router.put('/:userId/toggle-status', authenticate, authorizeAdmin, toggleUserStatus);


export default router;