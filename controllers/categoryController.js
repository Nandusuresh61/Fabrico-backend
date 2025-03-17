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
    const categories = await Category.find({}); 
    res.status(200).json(categories);
});
export { addCategory, editCategory, deleteCategory, getAllCategories };
