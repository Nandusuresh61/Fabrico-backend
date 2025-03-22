import Product from '../models/productModel.js';
import cloudinary from '../config/cloudinary.js';
import Variant from '../models/varientModel.js';

// ➡️ Add Product
export const addProduct = async (req, res) => {
  try {
    const { name, description, category, brand, variants } = JSON.parse(req.body.data);

    if (!req.files || req.files.length < 3) {
      return res.status(400).json({ message: 'At least 3 images are required' });
    }

    // Create the product first
    const product = new Product({
      name,
      description,
      category,
      brand,
      status: 'active'
    });

    await product.save();

    // Process variants and their images
    const variantPromises = variants.map(async (variant, index) => {
      // Get the images for this variant
      const variantImages = req.files.filter(file => 
        file.fieldname === `variant${index}`
      );

      if (variantImages.length < 3) {
        throw new Error(`Variant ${index + 1} requires at least 3 images`);
      }

      // Upload images to Cloudinary
      const imageUrls = await Promise.all(
        variantImages.map((file) => {
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

      // Create variant with images
      const newVariant = new Variant({
        product: product._id,
        color: variant.color,
        stock: variant.quantity,
        price: variant.price,
        mainImage: imageUrls[0],
        subImages: imageUrls.slice(1)
      });

      return newVariant.save();
    });

    const savedVariants = await Promise.all(variantPromises);

    // Update product with variant IDs
    product.variants = savedVariants.map(variant => variant._id);
    await product.save();

    // Populate the response
    const populatedProduct = await Product.findById(product._id)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate({
        path: 'variants',
        select: 'color stock price mainImage subImages isBlocked'
      });

    res.status(201).json({ message: 'Product added successfully', product: populatedProduct });
  } catch (error) {
    console.error('Error in addProduct:', error);
    res.status(500).json({ message: error.message });
  }
};

// ➡️ Edit Product Variant
export const editProduct = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const { color, price, stock } = req.body;

    // Find the product and variant
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const variant = await Variant.findById(variantId);
    if (!variant) {
      return res.status(404).json({ message: 'Variant not found' });
    }

    // Upload new images if provided
    if (req.files && req.files.length > 0) {
      // Delete old images from Cloudinary
      await Promise.all([
        variant.mainImage,
        ...variant.subImages
      ].map(async (url) => {
        const publicId = url.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`products/${publicId}`);
      }));

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

      variant.mainImage = imageUrls[0];
      variant.subImages = imageUrls.slice(1);
    }

    // Update variant fields
    variant.color = color || variant.color;
    variant.price = price || variant.price;
    variant.stock = stock || variant.stock;

    await variant.save();

    res.status(200).json({ 
      message: 'Variant updated successfully', 
      productId,
      variantId,
      variant 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all products (with search, pagination, and sorting)
export const getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortField = req.query.sortField || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';
    const search = req.query.search || '';
    const status = req.query.status || '';

    // Build query
    const query = {};
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
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
    const total = await Product.countDocuments(query);

    // Get products with pagination and sorting
    const products = await Product.find(query)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate({
        path: 'variants',
        select: 'color stock price mainImage subImages isBlocked'
      })
      .sort(sortObject)
      .skip(skip)
      .limit(limit);

    res.json({
      products,
      page,
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ➡️ Toggle Product Variant Status (Active/Blocked)
export const toggleProductStatus = async (req, res) => {
  try {
    const { productId, variantId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const variant = await Variant.findById(variantId);
    if (!variant) {
      return res.status(404).json({ message: 'Variant not found' });
    }

    variant.isBlocked = !variant.isBlocked;
    await variant.save();

    res.status(200).json({ 
      message: 'Variant status updated', 
      productId,
      variantId,
      variant 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ➡️ Toggle Product Main Status (Active/Blocked)
export const toggleProductMainStatus = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    product.status = product.status === 'active' ? 'blocked' : 'active';
    await product.save();

    // Return populated product
    const populatedProduct = await Product.findById(productId)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate({
        path: 'variants',
        select: 'color stock price mainImage subImages isBlocked'
      });

    res.status(200).json({ 
      message: 'Product status updated', 
      product: populatedProduct
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get product by ID
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id)
      .populate('category', 'name status')
      .populate('brand', 'name status')
      .populate({
        path: 'variants',
        select: 'color stock price mainImage subImages isBlocked'
      });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if product is blocked
    if (product.status === 'blocked') {
      return res.status(403).json({ message: 'Product is not available' });
    }

    // Check if category or brand is blocked
    if (product.category?.status === 'Deactivated' || product.brand?.status === 'Deactivated') {
      return res.status(403).json({ message: 'Product is not available' });
    }

    // Filter out blocked variants
    product.variants = product.variants.filter(variant => !variant.isBlocked);

    // If no active variants, return error
    if (product.variants.length === 0) {
      return res.status(403).json({ message: 'Product is not available' });
    }

    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const getAllProductsForUsers = async (req, res) => {
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
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate({
        path: 'variants',
        select: 'color stock price mainImage subImages isBlocked'
      })
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