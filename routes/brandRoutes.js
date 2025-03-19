import express from 'express';
import { 
    getBrands, 
    createBrand, 
    updateBrand, 
    toggleBrandStatus 
} from '../controllers/brandController.js';
import { authenticate, authorizeAdmin } from '../middlewares/authMiddleWare.js';

const router = express.Router();

router.get('/', getBrands);

router.post('/', authenticate, authorizeAdmin, createBrand);

router.put('/:id', authenticate, authorizeAdmin, updateBrand);

router.put('/:id/toggle-status', authenticate, authorizeAdmin, toggleBrandStatus);

export default router;
