const mongoose = require('mongoose');

/**
 * Validate MongoDB ObjectId parameter
 */
const validateId = (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid product ID format' });
  }
  next();
};

/**
 * Validate product creation payload
 */
const validateProductCreate = (req, res, next) => {
  const { name, sku, category, price, quantity, reorderLevel } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ message: 'Product name is required and must be a string' });
  }

  if (!sku || typeof sku !== 'string' || !sku.trim()) {
    return res.status(400).json({ message: 'Product SKU is required and must be a string' });
  }

  if (!category || typeof category !== 'string' || !category.trim()) {
    return res.status(400).json({ message: 'Product category is required and must be a string' });
  }

  if (price === undefined || typeof price !== 'number' || price < 0 || isNaN(price)) {
    return res.status(400).json({ message: 'Price is required and must be a non-negative number' });
  }

  if (quantity !== undefined && (typeof quantity !== 'number' || quantity < 0 || isNaN(quantity))) {
    return res.status(400).json({ message: 'Quantity must be a non-negative number' });
  }

  if (reorderLevel !== undefined && (typeof reorderLevel !== 'number' || reorderLevel < 0 || isNaN(reorderLevel))) {
    return res.status(400).json({ message: 'Reorder level must be a non-negative number' });
  }

  next();
};

/**
 * Validate stock adjustment payload
 */
const validateStockAdjustment = (req, res, next) => {
  const { change } = req.body;

  if (change === undefined || typeof change !== 'number' || isNaN(change)) {
    return res.status(400).json({
      message: 'Invalid input. Please provide a numeric "change" value in the request body.'
    });
  }

  next();
};

module.exports = {
  validateId,
  validateProductCreate,
  validateStockAdjustment
};
