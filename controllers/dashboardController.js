import asyncHandler from '../middlewares/asyncHandler.js';
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import { HTTP_STATUS } from '../utils/httpStatus.js';

export const getDashboardStats = asyncHandler(async (req, res) => {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());


    const orderStats = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: lastMonth },
                status: { $ne: 'cancelled' }
            }
        },
        {
            $group: {
                _id: null,
                totalSales: { $sum: '$totalAmount' },
                totalOrders: { $sum: 1 }
            }
        }
    ]);

    const refundStats = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: lastMonth }
            }
        },
        {
            $unwind: '$items'
        },
        {
            $match: {
                'items.returnRequest.status': 'approved'
            }
        },
        {
            $group: {
                _id: null,
                refundCount: { $sum: '$items.quantity' } 
            }
        }
    ]);

    const customerCount = await User.countDocuments({
        isAdmin: false,
        status: 'active',
        isVerified: true
    });

    const monthlyComparison = await Order.aggregate([
        {
            $match: {
                status: { $ne: 'cancelled' },
                createdAt: { $gte: new Date(today.getFullYear(), today.getMonth() - 1, 1) }
            }
        },
        {
            $group: {
                _id: { $month: '$createdAt' },
                total: { $sum: '$totalAmount' }
            }
        }
    ]);

    res.status(HTTP_STATUS.OK).json({
        stats: {
            totalSales: orderStats[0]?.totalSales || 0,
            totalOrders: orderStats[0]?.totalOrders || 0,
            totalCustomers: customerCount || 0,
            refundCount: refundStats[0]?.refundCount || 0
        },
        monthlyComparison
    });
});




export const getSalesData = asyncHandler(async (req, res) => {
    const { period = 'monthly', startDate, endDate } = req.query;
    
    let dateFormat, groupBy, matchCriteria;
    
    switch(period) {
        case 'yearly':
            dateFormat = '%Y';
            groupBy = { $year: '$createdAt' };
            break;
        case 'monthly':
            dateFormat = '%Y-%m';
            groupBy = { 
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' }
            };
            break;
        case 'daily':
            dateFormat = '%Y-%m-%d';
            groupBy = { 
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
            };
            break;
        default:
            dateFormat = '%Y-%m-%d';
            groupBy = { 
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
            };
    }

    if (startDate && endDate) {
        matchCriteria = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        };
    }

    const salesData = await Order.aggregate([
        { $match: { ...matchCriteria, status: { $ne: 'cancelled' } } },
        {
            $group: {
                _id: groupBy,
                sales: { $sum: '$totalAmount' }
            }
        },
        { $sort: { '_id': 1 } }
    ]);

    res.status(HTTP_STATUS.OK).json({ salesData });
});

export const getTopProducts = asyncHandler(async (req, res) => {
    const topProducts = await Order.aggregate([
        { $unwind: '$items' },
        {
            $group: {
                _id: '$items.product',
                totalQuantity: { $sum: '$items.quantity' },
                totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
            }
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 10 },
        {
            $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: '_id',
                as: 'productDetails'
            }
        },
        { $unwind: '$productDetails' }
    ]);

    res.status(HTTP_STATUS.OK).json({ topProducts });
});

export const getTopCategories = asyncHandler(async (req, res) => {
    const topCategories = await Order.aggregate([
        { $unwind: '$items' },
        {
            $lookup: {
                from: 'products',
                localField: 'items.product',
                foreignField: '_id',
                as: 'product'
            }
        },
        { $unwind: '$product' },
        {
            $group: {
                _id: '$product.category',
                totalSales: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                totalQuantity: { $sum: '$items.quantity' }
            }
        },
        {
            $lookup: {
                from: 'categories',
                localField: '_id',
                foreignField: '_id',
                as: 'categoryDetails'
            }
        },
        { $unwind: '$categoryDetails' },
        { $sort: { totalSales: -1 } },
        { $limit: 10 }
    ]);

    res.status(HTTP_STATUS.OK).json({ topCategories });
});

export const getTopBrands = asyncHandler(async (req, res) => {
    const topBrands = await Order.aggregate([
        { $unwind: '$items' },
        {
            $lookup: {
                from: 'products',
                localField: 'items.product',
                foreignField: '_id',
                as: 'product'
            }
        },
        { $unwind: '$product' },
        {
            $group: {
                _id: '$product.brand',
                totalSales: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                totalQuantity: { $sum: '$items.quantity' }
            }
        },
        {
            $lookup: {
                from: 'brands',
                localField: '_id',
                foreignField: '_id',
                as: 'brandDetails'
            }
        },
        { $unwind: '$brandDetails' },
        { $sort: { totalSales: -1 } },
        { $limit: 10 }
    ]);

    res.status(HTTP_STATUS.OK).json({ topBrands });
});

export const getLedgerBook = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    const ledgerEntries = await Order.aggregate([
        {
            $match: {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            }
        },
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                },
                totalRevenue: { $sum: '$totalAmount' },
                totalOrders: { $sum: 1 },
                totalDiscount: { $sum: '$discount' },
                totalCouponDiscount: { $sum: '$couponDiscount' }
            }
        },
        { $sort: { '_id.date': 1 } }
    ]);

    res.status(HTTP_STATUS.OK).json({ ledgerEntries });
});