import Product from '../models/productModel.js';
import cloudinary from '../config/cloudinary.js';



export const addProduct = async (req, res) => {
  try {
    const { name, description, price, discount, category, brand, stock } = req.body;
    
    if (!req.files || req.files.length < 3) {
      return res.status(400).json({ message: 'At least 3 images are required' });
    }

    // Upload images to Cloudinary using Promise.all
    const uploadPromises = req.files.map((file) => {
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
    });

    // Wait for all uploads to finish
    const imageUrls = await Promise.all(uploadPromises);

    // Save product after uploading images
    const product = new Product({
      name,
      description,
      price,
      discount,
      category,
      brand,
      stock,
      images: imageUrls
    });

    await product.save();

    res.status(201).json({ message: 'Product added successfully', product });
    
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
