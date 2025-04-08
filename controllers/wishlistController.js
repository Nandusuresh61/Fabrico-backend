import asyncHandler from '../middlewares/asyncHandler.js';
import Wishlist from '../models/wishlistModel.js';
import { HTTP_STATUS } from '../utils/httpStatus.js';

const getWishlist = asyncHandler(async (req, res) => {
    let wishlist = await Wishlist.findOne({ user: req.user._id })
        .populate({
            path: 'items.product',
            select: 'name brand category',
            populate: [
                {
                    path: 'brand',
                    select: 'name'
                },
                {
                    path: 'category',
                    select: 'name'
                }
            ]
        })
        .populate({
            path: 'items.variant',
            select: 'color price discountPrice mainImage stock'
        });

    if (!wishlist) {
        wishlist = await Wishlist.create({
            user: req.user._id,
            items: []
        });
    }

    res.json(wishlist);
});


const addToWishlist = asyncHandler(async (req, res) => {
    const { productId, variantId } = req.body;

    let wishlist = await Wishlist.findOne({ user: req.user._id });

    if (!wishlist) {
        wishlist = await Wishlist.create({
            user: req.user._id,
            items: []
        });
    }

    // Check if item already exists
    const itemExists = wishlist.items.find(
        item => item.product.toString() === productId && item.variant.toString() === variantId
    );

    if (itemExists) {
        return res.status(400).json({ message: 'Item already in wishlist' });
    }

    wishlist.items.push({
        product: productId,
        variant: variantId
    });

    await wishlist.save();

    // Populate the wishlist before sending response
    wishlist = await Wishlist.findOne({ user: req.user._id })
        .populate({
            path: 'items.product',
            select: 'name brand category',
            populate: {
                path: 'brand',
                select: 'name'
            }
        })
        .populate({
            path: 'items.variant',
            select: 'color price discountPrice mainImage stock'
        });

    res.status(HTTP_STATUS.CREATED).json(wishlist);
});


const removeFromWishlist = asyncHandler(async (req, res) => {
    let wishlist = await Wishlist.findOne({ user: req.user._id });

    if (!wishlist) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'Wishlist not found' });
    }

    wishlist.items = wishlist.items.filter(
        item => item._id.toString() !== req.params.itemId
    );

    await wishlist.save();

    // Populate the wishlist before sending response
    wishlist = await Wishlist.findOne({ user: req.user._id })
        .populate({
            path: 'items.product',
            select: 'name brand category',
            populate: {
                path: 'brand',
                select: 'name'
            }
        })
        .populate({
            path: 'items.variant',
            select: 'color price discountPrice mainImage stock'
        });

    res.json(wishlist);
});

export { getWishlist, addToWishlist, removeFromWishlist };

