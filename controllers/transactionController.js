import asyncHandler from '../middlewares/asyncHandler.js';
import Wallet from '../models/walletModel.js';
import { HTTP_STATUS } from '../utils/httpStatus.js';

export const getAllTransactions = asyncHandler(async (req, res) => {
    const { 
        page = 1, 
        limit = 10, 
        search = '', 
        type = 'all',
        sortField = 'date',
        sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;

    // Build match conditions
    
    const matchConditions = {};
    if (type && type !== 'all') {
        matchConditions['type'] = type;
    }
    if (search) {
        matchConditions.$or = [
            { 'transactionId': { $regex: search, $options: 'i' } },
            { 'description': { $regex: search, $options: 'i' } },
            { 'user.username': { $regex: search, $options: 'i' } }
        ];
    }

    const pipeline = [
        { $unwind: '$transactions' },
        {
            $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'userDetails'
            }
        },
        { $unwind: '$userDetails' },
        {
            $project: {
                _id: '$transactions._id',
                transactionId: '$transactions.id',
                amount: '$transactions.amount',
                type: '$transactions.type',
                description: '$transactions.description',
                date: '$transactions.date',
                orderId: '$transactions.orderId',
                status: '$transactions.status',
                user: {
                    _id: '$userDetails._id',
                    username: '$userDetails.username',
                    email: '$userDetails.email'
                }
            }
        }
    ];

    if (Object.keys(matchConditions).length > 0) {
        pipeline.push({ $match: matchConditions });
    }

    // Add sorting with proper field mapping
    const sortFieldMap = {
        'date': 'date',
        'amount': 'amount',
        'id': 'transactionId',
        'type': 'type',
        'status': 'status'
    };

    const validSortField = sortFieldMap[sortField] || 'date';
    const validSortOrder = sortOrder === 'asc' ? 1 : -1;


    pipeline.push({
        $sort: {
            [validSortField]: validSortOrder
        }
    });

    // Get total count before pagination
    const totalDocs = await Wallet.aggregate([
        ...pipeline,
        { $count: 'total' }
    ]);

    // Add pagination
    pipeline.push(
        { $skip: skip },
        { $limit: parseInt(limit) }
    );

    const transactions = await Wallet.aggregate(pipeline);
    const total = totalDocs[0]?.total || 0;

    res.status(HTTP_STATUS.OK).json({
        transactions: transactions.map(t => ({
            ...t,
            id: t.transactionId // Ensure id is available for frontend compatibility
        })),
        pagination: {
            page: parseInt(page),
            totalPages: Math.ceil(total / limit),
            total,
            hasNextPage: page < Math.ceil(total / limit),
            hasPrevPage: page > 1
        }
    });
});

export const getTransactionById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const wallet = await Wallet.findOne({ 'transactions.id': id })
        .populate('userId', 'username email');

    if (!wallet) {
        res.status(HTTP_STATUS.NOT_FOUND);
        throw new Error('Transaction not found');
    }

    const transaction = wallet.transactions.find(t => t.id === id);
    
    res.status(HTTP_STATUS.OK).json({
        transaction: {
            transactionId: transaction.id,
            amount: transaction.amount,
            type: transaction.type,
            description: transaction.description,
            date: transaction.date,
            orderId: transaction.orderId,
            status: transaction.status
        },
        user: {
            _id: wallet.userId._id,
            username: wallet.userId.username,
            email: wallet.userId.email
        }
    });
});