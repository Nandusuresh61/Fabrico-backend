import Brand from '../models/brandModel.js';
import asyncHandler from '../middlewares/asyncHandler.js';

export const getBrands = asyncHandler(async (req, res) => {
    const brands = await Brand.find();
    res.json(brands);
});


export const createBrand = asyncHandler(async (req, res) => {
    const { name } = req.body;

    const brandExists = await Brand.findOne({ name });
    if (brandExists) {
        res.status(400);
        throw new Error('Brand already exists');
    }

    const brand = await Brand.create({
        name,
    });

    if (brand) {
        res.status(201).json(brand);
    } else {
        res.status(400);
        throw new Error('Invalid brand data');
    }
});


export const updateBrand = asyncHandler(async (req, res) => {
    const brand = await Brand.findById(req.params.id);

    if (brand) {
        brand.name = req.body.name || brand.name;

        const updatedBrand = await brand.save();
        res.json(updatedBrand);
    } else {
        res.status(404);
        throw new Error('Brand not found');
    }
});


export const toggleBrandStatus = asyncHandler(async (req, res) => {
    const brand = await Brand.findById(req.params.id);

    if (brand) {
        brand.status = brand.status === 'Activated' ? 'Deactivated' : 'Activated';
        const updatedBrand = await brand.save();
        res.json(updatedBrand);
    } else {
        res.status(404);
        throw new Error('Brand not found');
    }
});
