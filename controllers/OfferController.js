import asyncHandler from "express-async-handler";
import Offer from "../models/offerModel.js";
import Product from "../models/productModel.js";
import Variant from "../models/varientModel.js";
import { HTTP_STATUS } from "../utils/httpStatus.js";


export const resetVariantDiscounts = async (offer) => {
  if (offer.offerType === "product") {
    for (const productId of offer.items) {
      const variants = await Variant.find({ product: productId });
      for (const variant of variants) {
        // Check if there's still an active category offer
        const product = await Product.findById(productId);
        const categoryOffer = await Offer.findOne({
          offerType: "category",
          items: product.category,
          isActive: true,
          startDate: { $lte: new Date() },
          endDate: { $gte: new Date() }
        });

        if (categoryOffer) {
          // Apply only category offer
          const discountAmount = (variant.price * categoryOffer.discountPercentage) / 100;
          variant.discountPrice = Math.round(variant.price - discountAmount);
        } else {
          // No active offers, reset discount price
          variant.discountPrice = null;
        }
        await variant.save();
      }
    }
  } else { // For category offers
    for (const categoryId of offer.items) {
      const products = await Product.find({ category: categoryId });
      for (const product of products) {
        const variants = await Variant.find({ product: product._id });
        for (const variant of variants) {
          // Check if there's still an active product offer
          const productOffer = await Offer.findOne({
            offerType: "product",
            items: product._id,
            isActive: true,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
          });

          if (productOffer) {
            // Apply only product offer
            const discountAmount = (variant.price * productOffer.discountPercentage) / 100;
            variant.discountPrice = Math.round(variant.price - discountAmount);
          } else {
            // No active offers, reset discount price
            variant.discountPrice = null;
          }
          await variant.save();
        }
      }
    }
  }
};

export const applyOfferDiscount = async (offer) => {
  const now = new Date();
  const start = new Date(offer.startDate);
  
  // Set hours to 0 for date comparison
  now.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  
  // If start date is in future, don't apply discount
  if (start > now) {
    return;
  }
  if (offer.offerType === "product") {
    for (const productId of offer.items) {
      const variants = await Variant.find({ product: productId });
      for (const variant of variants) {
        // Check if there's an existing category offer
        const product = await Product.findById(productId);
        const categoryOffer = await Offer.findOne({
          offerType: "category",
          items: product.category,
          isActive: true,
          startDate: { $lte: new Date() },
          endDate: { $gte: new Date() }
        });

        // Apply the higher discount
        const productDiscount = offer.discountPercentage;
        const categoryDiscount = categoryOffer ? categoryOffer.discountPercentage : 0;
        const finalDiscount = Math.max(productDiscount, categoryDiscount);

        const discountAmount = (variant.price * finalDiscount) / 100;
        variant.discountPrice = Math.round(variant.price - discountAmount);
        await variant.save();
      }
    }
  } else {
    // For category offers
    for (const categoryId of offer.items) {
      const products = await Product.find({ category: categoryId });
      for (const product of products) {
        const variants = await Variant.find({ product: product._id });
        for (const variant of variants) {
          // Check if there's an existing product offer
          const productOffer = await Offer.findOne({
            offerType: "product",
            items: product._id,
            isActive: true,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
          });

          // Apply the higher discount
          const categoryDiscount = offer.discountPercentage;
          const productDiscount = productOffer ? productOffer.discountPercentage : 0;
          const finalDiscount = Math.max(categoryDiscount, productDiscount);

          const discountAmount = (variant.price * finalDiscount) / 100;
          variant.discountPrice = Math.round(variant.price - discountAmount);
          await variant.save();
        }
      }
    }
  }
};


export const createOffer = asyncHandler(async (req, res) => {
  const {
    offerName,
    offerType,
    discountPercentage,
    startDate,
    endDate,
    items,
  } = req.body;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  if (start < now) {
    res.status(HTTP_STATUS.BAD_REQUEST);
    throw new Error("Offer start date cannot be in the past");
  }

  if (end < start) {
    res.status(HTTP_STATUS.BAD_REQUEST);
    throw new Error("Offer end date cannot be before start date");
  }

  // Find existing offers and deactivate them
  const existingOffers = await Offer.find({
    items: { $in: items },
    isActive: true,
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  });

  // Deactivate existing offers
  if (existingOffers.length > 0) {
    await Promise.all(
      existingOffers.map(async (existingOffer) => {
        existingOffer.isActive = false;
        await existingOffer.save();
      })
    );
  }

  const offer = await Offer.create({
    offerName,
    offerType,
    discountPercentage,
    startDate,
    endDate,
    items,
  });

  await applyOfferDiscount(offer);

  if (offer) {
    res.status(HTTP_STATUS.CREATED).json({ message: "Offer Created", offer });
  } else {
    res.status(HTTP_STATUS.BAD_REQUEST);
    throw new Error("Invalid offer data");
  }
});

export const getAllOffers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || "";
  const status = req.query.status || "";
  const sortedField = req.query.sortedField || "createdAt";
  const sortedOrder = req.query.sortedOrder || "desc";

  const query = {};

  
  if (search) {
    query.$or = [
      { offerName : { $regex: search, $options: "i" } },
      { offerType : { $regex: search, $options: "i" } }
    ];
  }

  if (status) {
    query.isActive = status === "active";
  }

  const total = await Offer.countDocuments(query);

  const offers = await Offer.find(query)
    .sort({ [sortedField]: sortedOrder === "asc" ? 1 : -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  // Populate items based on offerType
  for (const offer of offers) {
    if (offer.offerType === "product") {
      await offer.populate({
        path: "items",
        model: "Product",
        select: "name"
      });
    } else if (offer.offerType === "category") {
      await offer.populate({
        path: "items",
        model: "Category",
        select: "name"
      });
    }
  }

  res.json({
    offers,
    page,
    pages: Math.ceil(total / limit),
    total,
  });
});

export const updateOffer = asyncHandler(async (req, res) => {
  const {
    offerName,
    offerType,
    discountPercentage,
    startDate,
    endDate,
    items,
  } = req.body;

  const offer = await Offer.findById(req.params.offerId);

  if (!offer) {
    res.status(HTTP_STATUS.NOT_FOUND);
    throw new Error("Offer not found");
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  if (start < now) {
    res.status(HTTP_STATUS.BAD_REQUEST);
    throw new Error("Offer start date cannot be in the past");
  }

  if (end < start) {
    res.status(HTTP_STATUS.BAD_REQUEST);
    throw new Error("Offer end date cannot be before start date");
  }

  const existingOffer = await Offer.find({
    _id: { $ne: req.params.offerId },
    items: { $in: items },
    isActive: true,
    startDate: { $lte: end },
    endDate: { $gte: start } ,
    offerType
  });

  if (existingOffer.length > 0) {
    res.status(HTTP_STATUS.BAD_REQUEST);
    throw new Error(
      "An active offer already exists for one or more selected items");
  }

  // removing old discounts

  if(offer.isActive) {
    if(offer.offerType === "product") {
     for (const productId of offer.items) {
      const variants = await Variant.find({ product: productId });
      for (const variant of variants) {
          variant.discountPrice = variant.price;
          await variant.save();
      }
     }
    }else{
        for (const categoryId of offer.items) {
          const products = await Product.find({ category: categoryId });
          for (const product of products) {
           const variants = await Variant.find({ product: product._id });
           for (const variant of variants) {
               variant.discountPrice = variant.price;
               await variant.save();
           }
          }
         }
    }
  }

  offer.offerName =offerName;
  offer.discountPercentage = discountPercentage;
  offer.startDate = startDate;
  offer.endDate = endDate;
  offer.items = items;

  const updatedOffer = await offer.save();

  if (updatedOffer.isActive) {
    await applyOfferDiscount(updatedOffer);
   } 
  res.json({ message: "Offer updated", offer: updatedOffer });
});

export const toggleOfferStatus = asyncHandler(async (req, res) => {
  const offer = await Offer.findById(req.params.offerId);
  
  if (!offer) {
    return res.status(HTTP_STATUS.NOT_FOUND).json({
      message: 'Offer not found'
    });
  }

  // Check if offer is expired
  const now = new Date();
  
  if (offer.endDate < now) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: 'Cannot toggle status of expired offer'
    });
  }

  offer.isActive = !offer.isActive;
  offer.isManuallyDeactivated = !offer.isActive;
  await offer.save();

  await offer.save();

  if (offer.isActive) {
    await applyOfferDiscount(offer);
  } else {
    await resetVariantDiscounts(offer);
  }

  res.status(HTTP_STATUS.OK).json({
    message: 'Offer status updated successfully',
    offer
  });
});





