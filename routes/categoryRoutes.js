import express from "express";
import { addCategory, editCategory, deleteCategory, getAllCategories } from "../controllers/categoryController.js";
import { authenticate, authorizeAdmin } from "../middlewares/authMiddleWare.js";


const router = express.Router();


router.post('/', authenticate, authorizeAdmin, addCategory);
router.put('/:id', authenticate, authorizeAdmin, editCategory);
router.put('/:id/toggle-status', authenticate, authorizeAdmin, deleteCategory); //toggle category status
router.get('/', getAllCategories);


export default router;



