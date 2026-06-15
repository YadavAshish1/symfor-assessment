const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const documentService = require('../services/documentService');
const { uploadToS3, getDownloadUrl } = require('../config/s3');
const { AppError } = require('../utils/errors');

const USE_S3 = process.env.STORAGE === 's3';
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || 'uploads');


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB cap
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new AppError('Only PDF files are allowed', 400));
    }
    cb(null, true);
  },
});


const listDocuments = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const search = (req.query.search || '').trim();
    console.log("page", page, limit, search);
    const result = await documentService.listDocuments({ page, limit, search });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};



const uploadDocument = async (req, res, next) => {
  
  upload.single('file')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('File too large — max 10MB', 400));
      }
      return next(new AppError(err.message, 400));
    }
    if (err) return next(err);
    if (!req.file) return next(new AppError('No file uploaded', 400));

    const { title } = req.body;
    if (!title || !title.trim()) {
      return next(new AppError('Document title is required', 400));
    }

    try {
      const ext = path.extname(req.file.originalname) || '.pdf';
      const uniqueName = `${uuidv4()}${ext}`;
      let filepath;

      if (USE_S3) {
        const s3Key = `documents/${uniqueName}`;
        await uploadToS3(s3Key, req.file.buffer, req.file.mimetype);
        filepath = s3Key;
      } else {
        // write to local disk
        const dest = path.join(UPLOAD_DIR, uniqueName);
        fs.writeFileSync(dest, req.file.buffer);
        filepath = uniqueName; 
      }

      const doc = await documentService.createDocument({
        title: title.trim(),
        filename: req.file.originalname,
        filepath,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedBy: req.user.id,
      });

      res.status(201).json({ success: true, document: doc });
    } catch (uploadErr) {
      next(uploadErr);
    }
  });
};



const deleteDocument = async (req, res, next) => {
  try {
    const doc = await documentService.softDeleteDocument(req.params.id);
    if (!doc) return next(new AppError('Document not found', 404));
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { listDocuments, uploadDocument, deleteDocument };
