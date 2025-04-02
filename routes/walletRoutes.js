import express from 'express';
import { getWallet, getWalletTransactions } from '../controllers/walletController.js';
import { authenticate } from '../middlewares/authMiddleWare.js';

const router = express.Router();

router.use(authenticate); // Protect all wallet routes

router.get('/', getWallet);
router.get('/transactions', getWalletTransactions);

export default router;
