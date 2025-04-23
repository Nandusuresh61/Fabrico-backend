import express from 'express';
import { getWallet, getWalletTransactions, checkWalletBalance, processWalletPayment } from '../controllers/walletController.js';
import { authenticate } from '../middlewares/authMiddleWare.js';

const router = express.Router();

router.use(authenticate); // Protect all wallet routes

router.get('/', getWallet);
router.get('/transactions', getWalletTransactions);


router.get('/check-balance', checkWalletBalance);
router.post('/process-payment', processWalletPayment);

export default router;
