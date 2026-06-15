require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./src/routes/auth');
const documentRoutes = require('./src/routes/documents');
const { AppError } = require('./src/utils/errors');

const app = express();
const PORT = process.env.PORT || 8080;


if (process.env.STORAGE !== 's3') {
  const uploadDir = process.env.UPLOAD_DIR || 'uploads';
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

app.use(cors());
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// serve uploaded files statically (only in local mode)
if (process.env.STORAGE !== 's3') {
  app.use('/files', express.static(path.join(__dirname, process.env.UPLOAD_DIR || 'uploads')));
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

// 404
app.use((req, res, next) => {
  next(new AppError(`Route ${req.method} ${req.path} not found`, 404));
});

// global error handler
app.use((err, req, res, next) => {
  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Something went wrong';

  if (process.env.NODE_ENV !== 'production' && status === 500) {
    console.error(err.stack);
  }

  res.status(status).json({
    success: false,
    message,
    code : err.code,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  console.log(`Storage mode: ${process.env.STORAGE || 'local'}`);
});

module.exports = app;
