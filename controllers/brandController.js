import Brand from '../models/brandModel.js';
import asyncHandler from '../middlewares/asyncHandler.js';

export const getBrands = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortField = req.query.sortField || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';
    const search = req.query.search || '';
    const status = req.query.status || '';

    const query = {};
    
    // Search condition
    if (search) {
        query.name = { $regex: search, $options: 'i' };
    }

    // Status filter
    if (status) {
        query.status = status;
    }

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Create sort object
    const sortObject = {};
    sortObject[sortField] = sortOrder;

    // Get total count for pagination
    const total = await Brand.countDocuments(query);

    // Get brands with pagination and sorting
    const brands = await Brand.find(query)
        .sort(sortObject)
        .skip(skip)
        .limit(limit);

    res.json({
        brands,
        page,
        totalPages: Math.ceil(total / limit),
        total
    });
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
