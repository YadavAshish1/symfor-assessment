const express = require('express');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const {
  listDocuments,
  uploadDocument,
  deleteDocument,
} = require('../controllers/documentController');

const router = express.Router();

// Authentication Middleware
router.use(auth);

//list documents
router.get('/', listDocuments);

//upload
router.post('/upload', requireRole('admin', 'manager'), uploadDocument);

//delete
router.delete('/:id', requireRole('admin'), deleteDocument);

module.exports = router;
