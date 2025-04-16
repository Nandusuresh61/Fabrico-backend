import asyncHandler from "express-async-handler";
import Offer from "../models/offerModel.js";
import Product from "../models/productModel.js";
import Variant from "../models/varientModel.js";
import { HTTP_STATUS } from "../utils/httpStatus.js";


// Helper function

const applyOfferDiscount = async (offer) => {
 if(offer.offerType === "product") {
  for (const productId of offer.items) {
    const variants = await Variant.find({ product: productId });
    for (const variant of variants) {
        const discountAmount = (variant.price * offer.discountPercentage) / 100;
        (variant.discountPrice = Math.round(variant.price - discountAmount));
        await variant.save();
    }
  } 
 }else {
   for (const categoryId of offer.items) {
   const products = await Product.find({ category: categoryId });
   for (const product of products) {
    const variants = await Variant.find({ product: product._id });
    for (const variant of variants) {
        const  productOffer = await Offer.findOne({
            offerType: "product",
            items: product._id,
            isActive: true,
            startDate: { $lte: new Date()},
            endDate: { $gte: new Date()},
            discountPercentage: { $gt: offer.discountPercentage }
        });
        if(!productOffer) {
            const discountAmount = (variant.price * offer.discountPercentage) / 100;
            (variant.discountPrice = Math.round(variant.price - discountAmount));
            await variant.save(); 
        }
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

  const existingOffer = await Offer.find({
    items: { $in: items },
    isActive: true,
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  });

  if (existingOffer.length > 0) {
    res.status(HTTP_STATUS.BAD_REQUEST);
    throw new Error(
      "An active offer already exists for one or more selected items"
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
      res.status(HTTP_STATUS.NOT_FOUND);
      throw new Error("Offer not found");
    }
  
    // If deactivating, remove discounts
    if (offer.isActive) {
      if (offer.offerType === "product") {
        for (const productId of offer.items) {
          const variants = await Variant.find({ product: productId });
          for (const variant of variants) {
            variant.discountPrice = null;
            await variant.save();
          }
        }
      } else {
        for (const categoryId of offer.items) {
          const products = await Product.find({ category: categoryId });
          for (const product of products) {
            const variants = await Variant.find({ product: product._id });
            for (const variant of variants) {
              variant.discountPrice = null;
              await variant.save();
            }
          }
        }
      }
    } else {
      // If activating, apply discounts
      await applyOfferDiscount(offer);
    }
  
    offer.isActive = !offer.isActive;
    const updatedOffer = await offer.save();
    
    res.json({ message: "Offer status updated", offer: updatedOffer });
  });





