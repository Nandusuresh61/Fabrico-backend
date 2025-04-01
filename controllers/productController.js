import Product from '../models/productModel.js';
import cloudinary from '../config/cloudinary.js';
import Variant from '../models/varientModel.js';
import Category from '../models/categoryModel.js';


export const addProduct = async (req, res) => {
  try {
    const { name, description, category, brand, variants } = JSON.parse(req.body.data);

    if (!req.files || req.files.length < 3) {
      return res.status(400).json({ message: 'At least 3 images are required' });
    }

   
    const product = new Product({
      name,
      description,
      category,
      brand,
      status: 'active'
    });

    await product.save();

    
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
        discountPrice: variant.discountPrice || null,
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
        select: 'color stock price discountPrice mainImage subImages isBlocked'
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
    const { color, price, stock, discountPrice } = req.body;
    const existingImages = JSON.parse(req.body.existingImages || '[]');

    // Find the product and variant
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const variant = await Variant.findById(variantId);
    if (!variant) {
      return res.status(404).json({ message: 'Variant not found' });
    }

    // Get current images that need to be deleted
    const currentImages = [variant.mainImage, ...variant.subImages];
    const imagesToDelete = currentImages.filter(img => !existingImages.includes(img));

    // Delete removed images from Cloudinary
    if (imagesToDelete.length > 0) {
      await Promise.all(
        imagesToDelete.map(async (url) => {
          if (url) {
            const publicId = url.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`products/${publicId}`);
          }
        })
      );
    }

    // Upload new images if provided
    let newImageUrls = [];
    if (req.files && req.files.length > 0) {
      newImageUrls = await Promise.all(
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
    }

    // Combine existing and new images
    const allImages = [...existingImages, ...newImageUrls];
    
    // Ensure we have at least one image
    if (allImages.length === 0) {
      return res.status(400).json({ message: 'At least one image is required' });
    }

    // Update variant fields
    variant.color = color || variant.color;
    variant.price = price || variant.price;
    variant.discountPrice = discountPrice || null;
    variant.stock = stock || variant.stock;
    variant.mainImage = allImages[0];
    variant.subImages = allImages.slice(1);

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

    
    const products = await Product.find(query)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate({
        path: 'variants',
        select: 'color stock price discountPrice mainImage subImages isBlocked'
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
        select: 'color stock price discountPrice mainImage subImages isBlocked'
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
        select: 'color stock price discountPrice mainImage subImages isBlocked'
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
    const {
      search = '',
      page = 1,
      limit = 12,
      sort = 'featured',
      category = '',
      brand = '',
      minPrice = 0,
      maxPrice = 1000
    } = req.query;

    // Build base query
    const query = {
      status: 'active', // Only active products
    };

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Category filter
    if (category && category !== 'all') {
      const categoryObj = await Category.findOne({ name: { $regex: category, $options: "i" } });
      if (categoryObj) {
        query.category = categoryObj._id;
      }
    }

    // Brand filter
    if (brand && brand !== 'all') {
      query.brand = brand;
    }

    // Sort configuration
    let sortConfig = {};
    switch (sort) {
      case 'price-low':
        sortConfig = { 'variants.0.price': 1 };
        break;
      case 'price-high':
        sortConfig = { 'variants.0.price': -1 };
        break;
      case 'name-asc':
        sortConfig = { name: 1 };
        break;
      case 'name-desc':
        sortConfig = { name: -1 };
        break;
      default:
        sortConfig = { createdAt: -1 }; 
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Get products with all filters applied
    const products = await Product.find(query)
      .populate('category', 'name status')
      .populate('brand', 'name status')
      .populate({
        path: 'variants',
        select: 'color stock price discountPrice mainImage subImages isBlocked'
      })
      .sort(sortConfig)
      .skip(skip)
      .limit(Number(limit));

    // Filter products post-query for variant-specific conditions
    const filteredProducts = products.filter(product => {
      // Check if product has valid category and brand
      if (product.category?.status === 'Deactivated' || 
          product.brand?.status === 'Deactivated') {
        return false;
      }

      // Get non-blocked variants
      const activeVariants = product.variants.filter(v => !v.isBlocked);
      
      // Check if product has any active variants
      if (activeVariants.length === 0) {
        return false;
      }

      // Check price range
      const getEffectivePrice = (variant) => {
        return variant.discountPrice && variant.discountPrice < variant.price 
            ? variant.discountPrice 
            : variant.price;
      };

      const lowestPrice = Math.min(...activeVariants.map(v => getEffectivePrice(v)));
      if (lowestPrice < Number(minPrice) || lowestPrice > Number(maxPrice)) {
        return false;
      }

      return true;
    });

    // After filtering products, add this sorting
    if (sort === 'price-low' || sort === 'price-high') {
      filteredProducts.sort((a, b) => {
        const priceA = Math.min(...a.variants.filter(v => !v.isBlocked)
            .map(v => getEffectivePrice(v)));
        const priceB = Math.min(...b.variants.filter(v => !v.isBlocked)
            .map(v => getEffectivePrice(v)));
        return sort === 'price-low' ? priceA - priceB : priceB - priceA;
      });
    }

    // Get total count for pagination
    const total = await Product.countDocuments(query);

    res.status(200).json({
      products: filteredProducts,
      currentPage: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      totalProducts: filteredProducts.length
    });
  } catch (error) {
    console.error('Error in getAllProductsForUsers:', error);
    res.status(500).json({ message: error.message });
  }
};

// Edit Product Name
export const editProductName = async (req, res) => {
  try {
    const { productId } = req.params;
    const { name } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    product.name = name;
    await product.save();

    // Return populated product
    const populatedProduct = await Product.findById(productId)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate({
        path: 'variants',
        select: 'color stock price discountPrice mainImage subImages isBlocked'
      });

    res.status(200).json({
      message: 'Product name updated successfully',
      product: populatedProduct
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Product Stock
export const updateProductStock = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const { quantity } = req.body;

    const variant = await Variant.findById(variantId);
    if (!variant) {
      return res.status(404).json({ message: 'Variant not found' });
    }

    if (variant.stock < quantity) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    // Update stock
    variant.stock -= quantity;
    await variant.save();

    res.status(200).json({ 
      message: 'Stock updated successfully',
      updatedStock: variant.stock
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

