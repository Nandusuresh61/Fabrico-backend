import express from 'express';
import { 
    getDashboardStats,
    getSalesData,
    getTopProducts,
    getTopCategories,
    getTopBrands,
    getLedgerBook
} from '../controllers/dashboardController.js';
import { authenticate, authorizeAdmin } from '../middlewares/authMiddleWare.js';

const router = express.Router();

router.use(authenticate, authorizeAdmin);

router.get('/stats', getDashboardStats);
router.get('/sales', getSalesData);
router.get('/top-products', getTopProducts);
router.get('/top-categories', getTopCategories);
router.get('/top-brands', getTopBrands);
router.get('/ledger', getLedgerBook);

export default router;