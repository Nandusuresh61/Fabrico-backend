import Category from "../models/categoryModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import { HTTP_STATUS } from "../utils/httpStatus.js";


const addCategory = asyncHandler(async (req, res) => {
    const { name } = req.body;

    if (!name) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Category name is required' });
    }

    
    const existingCategory = await Category.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') }
    });
    
    if (existingCategory) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Category name already exists' });
    }

    const category = new Category({ name });
    await category.save();

    res.status(HTTP_STATUS.CREATED).json({ message: 'Category added successfully', category });
});


const editCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    const category = await Category.findById(id);

    if (!category) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Category not found' });
    }

    
    const existingCategory = await Category.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existingCategory) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Category name already exists' });
    }

    category.name = name || category.name;
    await category.save();

    res.status(HTTP_STATUS.OK).json({ message: 'Category updated successfully', category });
});


const deleteCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'category not found' });
    }

    category.status = category.status === 'Activated' ? 'Deactivated' : 'Activated';
    await category.save();

    res.status(HTTP_STATUS.OK).json({ message: `Category ${category.status === 'Activated' ? 'Deactivated' : 'Activated'} successfully.`,status: category.status });
});


const getAllCategories = asyncHandler(async (req, res) => {
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

    
    const total = await Category.countDocuments(query);

    
    const categories = await Category.find(query)
        .sort(sortObject)
        .skip(skip)
        .limit(limit);

    res.json({
        categories,
        page,
        totalPages: Math.ceil(total / limit),
        total
    });
});

export { addCategory, editCategory, deleteCategory, getAllCategories };
