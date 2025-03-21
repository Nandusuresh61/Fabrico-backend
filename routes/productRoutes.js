import express from 'express';
import {
  addProduct,
  editProduct,
  getAllProducts,
  toggleProductStatus,
  toggleProductMainStatus,
  getProductById,
} from '../controllers/productController.js';
import { authenticate, authorizeAdmin } from '../middlewares/authMiddleWare.js';
import upload from '../middlewares/uploadMiddleware.js';

const router = express.Router();

// Handle multiple files with any field name
router.post('/', authenticate, authorizeAdmin, upload.any(), addProduct);
router.put('/:productId/variants/:variantId', authenticate, authorizeAdmin, upload.any(), editProduct);
router.put('/:productId/variants/:variantId/toggle-status', authenticate, authorizeAdmin, toggleProductStatus);
router.put('/:productId/toggle-status', authenticate, authorizeAdmin, toggleProductMainStatus);
router.get('/', getAllProducts);
router.get('/:id', getProductById);

export default router;
