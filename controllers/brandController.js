import Brand from '../models/brandModel.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { HTTP_STATUS } from '../utils/httpStatus.js';

export const getBrands = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortField = req.query.sortField || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';
    const search = req.query.search || '';
    const status = req.query.status || '';

    const query = {};
    
    
    if (search) {
        query.name = { $regex: search, $options: 'i' };
    }

    if (status) {
        query.status = status;
    }

    
    const skip = (page - 1) * limit;

    
    const sortObject = {};
    sortObject[sortField] = sortOrder;

    
    const total = await Brand.countDocuments(query);

    
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
        res.status(HTTP_STATUS.BAD_REQUEST);
        throw new Error('Brand already exists');
    }

    const brand = await Brand.create({
        name,
    });

    if (brand) {
        res.status(HTTP_STATUS.CREATED).json(brand);
    } else {
        res.status(HTTP_STATUS.BAD_REQUEST);
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
        res.status(HTTP_STATUS.NOT_FOUND);
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
        res.status(HTTP_STATUS.NOT_FOUND);
        throw new Error('Brand not found');
    }
});
