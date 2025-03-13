import express from "express"
import { authenticate, authorizeAdmin } from '../middlewares/authMiddleware.js';
import { loginAdmin, logoutAdmin, toggleUserStatus,updateUserById,deleteUserById,getUserById, getAllUsers } from "../controllers/adminController.js";


const router = express.Router();


router.post('/login', loginAdmin)
router.post('/logout', logoutAdmin);

// Block & Unblock Option
router.put('/:id/toggle-status', authenticate, authorizeAdmin, toggleUserStatus);
// Search From backend
router.get('/users', authenticate,authorizeAdmin, getAllUsers)


//delete,update user by admin

router.route('/:id')
.delete(authenticate, authorizeAdmin, deleteUserById)
.get(authenticate, authorizeAdmin , getUserById)
.put(authenticate, authorizeAdmin, updateUserById)

export default router; 