import asyncHandler from '../middlewares/asyncHandler.js';
import Wallet from '../models/walletModel.js';
import { HTTP_STATUS } from '../utils/httpStatus.js';

export const getWallet = asyncHandler(async (req, res) => {
    const wallet = await Wallet.findOne({ userId: req.user._id });

    if (!wallet) {
        // Create a new wallet if it doesn't exist
        const newWallet = await Wallet.create({
            userId: req.user._id,
            balance: 0,
            currency: 'INR'
        });
        res.json(newWallet);
    } else {
        res.json(wallet);
    }
});

export const getWalletTransactions = asyncHandler(async (req, res) => {
    const wallet = await Wallet.findOne({ userId: req.user._id });

    if (!wallet) {
        res.json([]);
    } else {
        res.json(wallet.transactions);
    }
});
