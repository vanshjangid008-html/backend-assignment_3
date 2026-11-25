const Product = require('../models/Product');
const mongoose = require('mongoose');

/**
 * @desc    Create a new product
 * @route   POST /api/products
 */
const createProduct = async (req, res, next) => {
  try {
    const { name, sku, category, price, quantity, reorderLevel, supplier } = req.body;

    const product = new Product({
      name,
      sku,
      category,
      price,
      quantity,
      reorderLevel,
      supplier
    });

    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all products with filtering, sorting, and pagination
 * @route   GET /api/products
 * @query   category, minPrice, maxPrice, search, inStock, supplier, sortBy, order, page, limit
 */
const getAllProducts = async (req, res, next) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      search,
      inStock,
      supplier,
      sortBy = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 10
    } = req.query;

    const filter = {};

    // Category filter (case-insensitive)
    if (category) {
      filter.category = { $regex: new RegExp(`^${category.trim()}$`, 'i') };
    }

    // Supplier filter
    if (supplier) {
      filter.supplier = { $regex: new RegExp(supplier.trim(), 'i') };
    }

    // Keyword search in name or SKU
    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: searchRegex }, { sku: searchRegex }];
    }

    // Price range filtering
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined && !isNaN(Number(minPrice))) {
        filter.price.$gte = Number(minPrice);
      }
      if (maxPrice !== undefined && !isNaN(Number(maxPrice))) {
        filter.price.$lte = Number(maxPrice);
      }
    }

    // In-stock availability filter
    if (inStock !== undefined) {
      if (inStock === 'true' || inStock === true) {
        filter.quantity = { $gt: 0 };
      } else if (inStock === 'false' || inStock === false) {
        filter.quantity = 0;
      }
    }

    // Pagination calculations
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sortOrder = order.toLowerCase() === 'asc' ? 1 : -1;
    const sortOptions = {};
    const allowedSortFields = ['name', 'price', 'quantity', 'reorderLevel', 'category', 'createdAt', 'updatedAt'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    sortOptions[sortField] = sortOrder;

    // Execute queries in parallel
    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
    ]);

    const totalPages = Math.ceil(total / limitNum) || (total === 0 ? 0 : 1);

    res.status(200).json({
      total,
      page: pageNum,
      totalPages,
      count: products.length,
      products
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single product by ID
 * @route   GET /api/products/:id
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json(product);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update product details
 * @route   PUT /api/products/:id
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: req.body },
      {
        returnDocument: 'after',
        runValidators: true
      }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json(updatedProduct);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Adjust product stock level safely (increment or decrement)
 * @route   PATCH /api/products/:id/stock
 */
const adjustStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { change } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }

    if (change === undefined || typeof change !== 'number' || isNaN(change)) {
      return res.status(400).json({
        message: 'Invalid input. Please provide a numeric "change" value (positive to restock, negative to sell).'
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const newQuantity = product.quantity + change;

    if (newQuantity < 0) {
      return res.status(400).json({
        message: `Insufficient stock. Current stock is ${product.quantity}, cannot reduce by ${Math.abs(change)}.`
      });
    }

    product.quantity = newQuantity;
    await product.save();

    res.status(200).json({
      message: 'Stock updated',
      product
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a product
 * @route   DELETE /api/products/:id
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json({
      message: 'Product deleted',
      id
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get low-stock alert report using MongoDB aggregation
 * @route   GET /api/products/low-stock
 */
const getLowStockReport = async (req, res, next) => {
  try {
    const lowStockItems = await Product.aggregate([
      {
        $match: {
          $expr: { $lte: ['$quantity', '$reorderLevel'] }
        }
      },
      {
        $addFields: {
          stockValue: { $round: [{ $multiply: ['$price', '$quantity'] }, 2] },
          id: { $toString: '$_id' }
        }
      },
      {
        $sort: { quantity: 1 }
      }
    ]);

    res.status(200).json({
      count: lowStockItems.length,
      lowStockItems
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get category-wise inventory summary using MongoDB aggregation
 * @route   GET /api/products/summary
 */
const getCategorySummary = async (req, res, next) => {
  try {
    const summary = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalStockValue: { $sum: { $multiply: ['$price', '$quantity'] } },
          avgPrice: { $avg: '$price' }
        }
      },
      {
        $project: {
          _id: 1,
          totalItems: 1,
          totalQuantity: 1,
          totalStockValue: { $round: ['$totalStockValue', 2] },
          avgPrice: { $round: ['$avgPrice', 2] }
        }
      },
      {
        $sort: { totalStockValue: -1 }
      }
    ]);

    res.status(200).json({
      categories: summary.length,
      summary
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  adjustStock,
  deleteProduct,
  getLowStockReport,
  getCategorySummary
};
