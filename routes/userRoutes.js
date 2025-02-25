import express from 'express';
import { createUser,
         loginUser,
         logoutUser,
         getAllUser,
         getCurrentUserProfile ,
         updateCurrentUserProfile,
         deleteUserById,
         getUserById,
         UpdateUserById,

         } from '../controllers/userController.js';

import { authenticate, authorizeAdmin } from '../middlewares/authMiddleWare.js';



const router = express.Router()

//create user/ login/logout done 
router.route('/').post(createUser).get(authenticate, authorizeAdmin,getAllUser);
router.post('/auth', loginUser)
router.post('/logout', logoutUser)


//user directly  to profile and update  // here we can add profile photo
router.route('/profile').get(authenticate, getCurrentUserProfile).put(authenticate, updateCurrentUserProfile)



//admin access like CRUD for admin

router.route('/:id')
.delete(authenticate, authorizeAdmin, deleteUserById)
.get(authenticate, authorizeAdmin , getUserById)
.put(authenticate, authorizeAdmin, UpdateUserById)



export default router;