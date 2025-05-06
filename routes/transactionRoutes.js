import express from 'express';
import { authenticate, authorizeAdmin } from '../middlewares/authMiddleWare.js';
import { getAllTransactions, getTransactionById } from '../controllers/transactionController.js';

const router = express.Router();

router.use(authenticate, authorizeAdmin); // Protect all transaction routes with admin auth

router.get('/', getAllTransactions);
router.get('/:id', getTransactionById);

export default router;