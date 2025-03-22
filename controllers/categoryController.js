import Category from "../models/categoryModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";

// Add Category
const addCategory = asyncHandler(async (req, res) => {
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ message: 'Category name is required' });
    }

    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
        return res.status(400).json({ message: 'Category already exists' });
    }

    const category = new Category({ name });
    await category.save();

    res.status(201).json({ message: 'Category added successfully', category });
});

//  Edit Category
const editCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    const category = await Category.findById(id);

    if (!category) {
        return res.status(404).json({ message: 'Category not found' });
    }

    category.name = name || category.name;
    await category.save();

    res.status(200).json({ message: 'Category updated successfully', category });
});

//  Soft Delete Category
const deleteCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
        return res.status(404).json({ message: 'category not found' });
    }

    category.status = category.status === 'Activated' ? 'Deactivated' : 'Activated';
    await category.save();

    res.status(200).json({ message: `Category ${category.status === 'Activated' ? 'Deactivated' : 'Activated'} successfully.`,status: category.status });
});

//  Get All Categories 
const getAllCategories = asyncHandler(async (req, res) => {
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
    const total = await Category.countDocuments(query);

    // Get categories with pagination and sorting
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
