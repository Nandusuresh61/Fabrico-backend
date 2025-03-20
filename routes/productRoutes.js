import express from "express";
import { addProduct, } from "../controllers/productController.js";
import { authenticate, authorizeAdmin } from "../middlewares/authMiddleWare.js";
import upload from '../middlewares/uploadMiddleware.js';


const router = express.Router();


router.post('/', authenticate, authorizeAdmin, upload.array('images', 5), addProduct);
// router.put('/:id', authenticate, authorizeAdmin, editProduct);
// router.put('/:id/toggle-status', authenticate, authorizeAdmin, deleteProduct); //toggle category status
// router.get('/', authenticate, authorizeAdmin, getAllProduct);


export default router;