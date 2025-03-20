import express from 'express';
import {
  addProduct,
  editProduct,
  getAllProducts,
  toggleProductStatus,
} from '../controllers/productController.js';
import { authenticate, authorizeAdmin } from '../middlewares/authMiddleWare.js';
import upload from '../middlewares/uploadMiddleware.js';

const router = express.Router();

router.post('/', authenticate, authorizeAdmin, upload.array('images', 5), addProduct);
router.put('/:id', authenticate, authorizeAdmin, upload.array('images', 5), editProduct);
router.put('/:id/toggle-status', authenticate, authorizeAdmin, toggleProductStatus);
router.get('/', authenticate, authorizeAdmin, getAllProducts);

export default router;
