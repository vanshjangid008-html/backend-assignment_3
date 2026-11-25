const express = require('express');
const router = express.Router();
const {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  adjustStock,
  deleteProduct,
  getLowStockReport,
  getCategorySummary
} = require('../controllers/productController');
const {
  validateId,
  validateProductCreate,
  validateStockAdjustment
} = require('../middleware/validate');

// 1. Report and aggregation routes (MUST precede parameterized :id routes)
router.get('/low-stock', getLowStockReport);
router.get('/summary', getCategorySummary);

// 2. Collection routes
router.route('/')
  .post(validateProductCreate, createProduct)
  .get(getAllProducts);

// 3. Stock adjustment route
router.patch('/:id/stock', validateId, validateStockAdjustment, adjustStock);

// 4. Individual product document routes
router.route('/:id')
  .get(validateId, getProductById)
  .put(validateId, updateProduct)
  .delete(validateId, deleteProduct);

module.exports = router;
