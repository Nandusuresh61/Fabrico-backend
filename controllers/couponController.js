import asyncHandler from '../middlewares/asyncHandler.js';
import Coupon from '../models/couponModel.js';
import { HTTP_STATUS } from '../utils/httpStatus.js';

export const createCoupon = asyncHandler(async (req, res) => {
  const { code, description, discountType, discountValue, minimumAmount, startDate, endDate } = req.body;

  // Basic field validation
  if (!code || !description || !discountType || !discountValue || !minimumAmount || !startDate || !endDate) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
      message: 'All fields are required' 
    });
  }

  const codeRegex = /^[A-Z0-9]{6,12}$/;
  if (!codeRegex.test(code.toUpperCase())) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: 'Coupon code must be 6-12 characters long and contain only uppercase letters and numbers'
    });
  }

  const existingCoupon = await Coupon.findOne({ 
    $or: [
      { couponCode: { $regex: new RegExp(`^${code}$`, 'i') } },
      { code: { $regex: new RegExp(`^${code}$`, 'i') } }
    ]
  });

  if (existingCoupon) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
      message: 'Coupon code already exists' 
    });
  }

  if (description.length < 10 || description.length > 200) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: 'Description must be between 10 and 200 characters'
    });
  }

  if (!['percentage', 'fixed'].includes(discountType)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: 'Invalid discount type. Must be either percentage or fixed'
    });
  }

  if (discountType === 'percentage') {
    if (discountValue <= 0 || discountValue > 100) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
        message: 'Percentage discount must be between 0 and 100' 
      });
    }
  } else {
    if (discountValue <= 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: 'Fixed discount amount must be greater than 0'
      });
    }
  }

  if (minimumAmount <= 0) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: 'Minimum amount cannot be negative'
    });
  }

  if (discountType === 'fixed' && discountValue >= minimumAmount) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: 'Fixed discount amount must be less than minimum order amount'
    });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: 'Invalid date format'
    });
  }

  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  if (start < now) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
      message: 'Start date cannot be in the past' 
    });
  }

  if (end <= start) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
      message: 'End date must be after start date' 
    });
  }

  const maxDuration = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
  if (end - start > maxDuration) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: 'Coupon duration cannot exceed 1 year'
    });
  }

  const coupon = await Coupon.create({
    couponCode: code.toUpperCase(),
    code: code.toUpperCase(),
    description,
    discountType,
    discountValue,
    minOrderAmount: minimumAmount,
    startDate: start,
    endDate: end
  });

  res.status(HTTP_STATUS.CREATED).json({
    message: 'Coupon created successfully',
    coupon
  });
});

export const getAllCoupons = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const status = req.query.status || '';
  const sortField = req.query.sortField || 'createdAt';
  const sortOrder = req.query.sortOrder || 'desc';

  const query = {};

  if (search) {
    query.$or = [
      { couponCode: { $regex: search, $options: 'i' } },
      { discountType: { $regex: search, $options: 'i' } }
    ];
  }

  if (status === 'active') {
    query.isExpired = false;
    query.endDate = { $gte: new Date() };
  } else if (status === 'expired') {
    query.$or = [
      { isExpired: true },
      { endDate: { $lt: new Date() } }
    ];
  }

  const skip = (page - 1) * limit;
  const sortOptions = { [sortField]: sortOrder };

  const total = await Coupon.countDocuments(query);

  if (total === 0) {
    return res.status(HTTP_STATUS.OK).json({
      message: 'No coupons available',
      coupons: [],
      page: 1,
      totalPages: 0,
      total: 0
    });
  }

  const coupons = await Coupon.find(query)
    .sort(sortOptions)
    .skip(skip)
    .limit(limit);

  res.status(HTTP_STATUS.OK).json({
    coupons,
    page,
    totalPages: Math.ceil(total / limit),
    total
  });
});

export const updateCoupon = asyncHandler(async (req, res) => {
  const { code, description, discountType, discountValue, minimumAmount, startDate, endDate } = req.body;
  const couponId = req.params.id;

  const coupon = await Coupon.findById(couponId);

  if (!coupon) {
    return res.status(HTTP_STATUS.NOT_FOUND).json({ 
      message: 'Coupon not found' 
    });
  }

  // Validate discount type and value
  if (discountType && !['percentage', 'fixed'].includes(discountType)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: 'Invalid discount type. Must be either percentage or fixed'
    });
  }

  if (discountType === 'percentage' && discountValue && (discountValue <= 0 || discountValue > 100)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
      message: 'Percentage discount must be between 0 and 100' 
    });
  }

  if (discountType === 'fixed' && discountValue && discountValue <= 0) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: 'Fixed discount amount must be greater than 0'
    });
  }

  // Validate minimum amount
  if (minimumAmount && minimumAmount <= 0) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: 'Minimum amount cannot be negative'
    });
  }

  if (discountType === 'fixed' && minimumAmount && discountValue >= minimumAmount) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: 'Fixed discount amount must be less than minimum order amount'
    });
  }

  let processedStartDate = startDate ? new Date(startDate) : coupon.startDate;
  let processedEndDate = endDate ? new Date(endDate) : coupon.endDate;

  if (startDate || endDate) {
    if (isNaN(processedStartDate.getTime()) || isNaN(processedEndDate.getTime())) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: 'Invalid date format'
      });
    }

    // Match the offer controller's date handling pattern
    processedStartDate.setHours(0, 0, 0, 0);
    
    // Don't use Date.UTC() as it causes timezone issues
    if (processedEndDate <= processedStartDate) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
        message: 'End date must be after start date' 
      });
    }

    const maxDuration = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    if (processedEndDate - processedStartDate > maxDuration) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: 'Coupon duration cannot exceed 1 year'
      });
    }
  }

  const updatedCoupon = await Coupon.findByIdAndUpdate(
    couponId,
    {
      couponCode: code ? code.toUpperCase() : coupon.couponCode,
      code: code ? code.toUpperCase() : coupon.code,
      description: description || coupon.description,
      discountType: discountType || coupon.discountType,
      discountValue: discountValue || coupon.discountValue,
      minOrderAmount: minimumAmount || coupon.minOrderAmount,
      startDate: processedStartDate,
      endDate: processedEndDate,
      isExpired: false // Reset expired status on update
    },
    { new: true }
  );

  res.json({
    message: 'Coupon updated successfully',
    coupon: updatedCoupon
  });
});

// export const deleteCoupon = asyncHandler(async (req, res) => {
//   const coupon = await Coupon.findById(req.params.id);

//   if (!coupon) {
//     return res.status(HTTP_STATUS.NOT_FOUND).json({ 
//       message: 'Coupon not found' 
//     });
//   }

//   await coupon.deleteOne();

//   res.json({ message: 'Coupon deleted successfully' });
// });

export const toggleCouponStatus = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  
  if (!coupon) {
    return res.status(HTTP_STATUS.NOT_FOUND).json({
      message: 'Coupon not found'
    });
  }

  // Check if coupon is expired
  const now = new Date();
  if (coupon.endDate < now ) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: 'Cannot toggle status of expired coupon'
    });
  }

  coupon.isExpired = !coupon.isExpired;
  await coupon.save();

  res.status(HTTP_STATUS.OK).json({
    message: 'Coupon status updated successfully',
    coupon
  });
});

export const getAvailableCoupons = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const coupons = await Coupon.find({
    isExpired: false,
    startDate: { $lte: now },
    endDate: { $gte: now },
    usedBy: { $ne: userId }
  });

  res.status(HTTP_STATUS.OK).json({
    coupons
  });
});

export const validateCoupon = asyncHandler(async (req, res) => {
  const { code, totalAmount } = req.body;
  const userId = req.user._id;

  if (!code || !totalAmount) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: 'Coupon code and total amount are required'
    });
  }

  const coupon = await Coupon.findOne({
    $or: [
      { couponCode: { $regex: new RegExp(`^${code}$`, 'i') } },
      { code: { $regex: new RegExp(`^${code}$`, 'i') } }
    ],
    isExpired: false,
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() },
    usedBy: { $ne: userId }
  });

  if (!coupon) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: 'Invalid or expired coupon code'
    });
  }

  if (totalAmount < coupon.minOrderAmount) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: `Minimum order amount of ₹${coupon.minOrderAmount} required for this coupon`
    });
  }

  let discountAmount = 0;
  if (coupon.discountType === 'percentage') {
    discountAmount = (totalAmount * coupon.discountValue) / 100;
  } else {
    discountAmount = coupon.discountValue;
  }

  const finalAmount = totalAmount - discountAmount;

  res.status(HTTP_STATUS.OK).json({
    message: 'Coupon applied successfully',
    coupon,
    discountAmount,
    finalAmount
  });
});

export const markCouponAsUsed = asyncHandler(async (req, res) => {
  const { couponId } = req.body;
  const userId = req.user._id;

  const coupon = await Coupon.findById(couponId);

  if (!coupon) {
    return res.status(HTTP_STATUS.NOT_FOUND).json({
      message: 'Coupon not found'
    });
  }

  if (coupon.usedBy.includes(userId)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: 'Coupon already used'
    });
  }

  coupon.usedBy.push(userId);
  await coupon.save();

  res.status(HTTP_STATUS.OK).json({
    message: 'Coupon marked as used'
  });
});