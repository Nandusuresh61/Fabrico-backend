import express from 'express';
import { createUser, loginUser, logoutUser, getAllUser, getCurrentUserProfile , updateCurrentUserProfile } from '../controllers/userController.js';
import { authenticate, authorizeAdmin } from '../middlewares/authMiddleWare.js';



const router = express.Router()

//create user/ login/logout done 
router.route('/').post(createUser).get(authenticate, authorizeAdmin,getAllUser);
router.post('/auth', loginUser)
router.post('/logout', logoutUser)


//user directly  to profile and update  // here we can add profile photo
router.route('/profile').get(authenticate, getCurrentUserProfile).put(authenticate, updateCurrentUserProfile)



//admin access like CRUD for admin





export default router;