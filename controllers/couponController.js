import asyncHandler from '../middlewares/asyncHandler.js';
import Coupon from '../models/couponModel.js';
import { HTTP_STATUS } from '../utils/httpStatus.js';

export const createCoupon = asyncHandler(async (req, res) => {
  const { code, description, discountType, discountValue, minimumAmount, startDate, endDate } = req.body;

  if (!code || !description || !discountType || !discountValue || !minimumAmount || !startDate || !endDate) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
      message: 'All fields are required' 
    });
  }


  const existingCoupon = await Coupon.findOne({ 
    couponCode: { $regex: new RegExp(`^${code}$`, 'i') }
  });

  if (existingCoupon) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
      message: 'Coupon code already exists' 
    });
  }

  // Validate discount value
  if (discountType === 'percentage' && (discountValue <= 0 || discountValue > 100)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
      message: 'Percentage discount must be between 0 and 100' 
    });
  }

  // Validate dates
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

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

  const coupon = await Coupon.create({
    couponCode: code.toUpperCase(),
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


  if (code && code !== coupon.couponCode) {
    const existingCoupon = await Coupon.findOne({
      _id: { $ne: couponId },
      couponCode: { $regex: new RegExp(`^${code}$`, 'i') }
    });

    if (existingCoupon) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
        message: 'Coupon code already exists' 
      });
    }
  }


  if (discountType === 'percentage' && (discountValue <= 0 || discountValue > 100)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
      message: 'Percentage discount must be between 0 and 100' 
    });
  }

  const updatedCoupon = await Coupon.findByIdAndUpdate(
    couponId,
    {
      couponCode: code ? code.toUpperCase() : coupon.couponCode,
      description: description || coupon.description,
      discountType: discountType || coupon.discountType,
      discountValue: discountValue || coupon.discountValue,
      minOrderAmount: minimumAmount || coupon.minOrderAmount,
      startDate: startDate || coupon.startDate,
      endDate: endDate || coupon.endDate
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

  coupon.isExpired = !coupon.isExpired;
  await coupon.save();

  res.json({
    message: `Coupon ${coupon.isExpired ? 'deactivated' : 'activated'} successfully`,
    coupon
  });
});