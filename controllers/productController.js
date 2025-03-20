import Product from '../models/productModel.js';
import cloudinary from '../config/cloudinary.js';

// ➡️ Add Product
export const addProduct = async (req, res) => {
  try {
    const { name, description, price, discount, category, brand, stock } = req.body;

    if (!req.files || req.files.length < 3) {
      return res.status(400).json({ message: 'At least 3 images are required' });
    }

    // Upload images to Cloudinary using Promise.all
    const imageUrls = await Promise.all(
      req.files.map((file) => {
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'products' },
            (error, result) => {
              if (error) return reject(error);
              resolve(result.secure_url);
            }
          );
          uploadStream.end(file.buffer);
        });
      })
    );

    // Save product after uploading images
    const product = new Product({
      name,
      description,
      price,
      discount,
      category,
      brand,
      stock,
      images: imageUrls,
    });

    await product.save();

    res.status(201).json({ message: 'Product added successfully', product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ➡️ Edit Product
export const editProduct = async (req, res) => {
  try {
    const { name, description, price, discount, category, brand, stock } = req.body;
    const { id } = req.params;

    // Find the product
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Upload new images if provided
    if (req.files && req.files.length > 0) {
      // Delete old images from Cloudinary
      await Promise.all(
        product.images.map(async (url) => {
          const publicId = url.split('/').pop().split('.')[0];
          await cloudinary.uploader.destroy(`products/${publicId}`);
        })
      );

      // Upload new images
      const imageUrls = await Promise.all(
        req.files.map((file) => {
          return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              { folder: 'products' },
              (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
              }
            );
            uploadStream.end(file.buffer);
          });
        })
      );

      product.images = imageUrls;
    }

    // Update product fields
    product.name = name || product.name;
    product.description = description || product.description;
    product.price = price || product.price;
    product.discount = discount || product.discount;
    product.category = category || product.category;
    product.brand = brand || product.brand;
    product.stock = stock || product.stock;

    await product.save();

    res.status(200).json({ message: 'Product updated successfully', product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all products (with search, pagination, and sorting)
export const getAllProducts = async (req, res) => {
  try {
    const { search, page = 1, limit = 5 } = req.query;

    // Search filter (if search query exists)
    const searchQuery = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    // Pagination and sorting
    const skip = (page - 1) * limit;

    // ✅ Populate category and brand names
    const products = await Product.find(searchQuery)
      .populate('category', 'name') // Populate the 'name' field from Category collection
      .populate('brand', 'name') // Populate the 'name' field from Brand collection
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Total product count for pagination
    const totalProducts = await Product.countDocuments(searchQuery);

    res.status(200).json({
      products,
      totalProducts,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalProducts / limit),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ➡️ Toggle Product Status (Active/Blocked)
export const toggleProductStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    product.status = product.status === 'active' ? 'blocked' : 'active';
    await product.save();

    res.status(200).json({ message: 'Product status updated', product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
