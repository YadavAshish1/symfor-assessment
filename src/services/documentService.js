const { query } = require('../config/db');
const cache = require('../config/redis');


const CACHE_PREFIX = 'docs:list:';

const listDocuments = async ({ page = 1, limit = 10, search = '', uploadedBy = null }) => {
  const offset = (page - 1) * limit;
  const cacheKey = `${CACHE_PREFIX}${page}:${limit}:${search}:${uploadedBy || 'all'}`;

  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const conditions = ['d.is_deleted = false'];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`d.title ILIKE $${params.length}`);
  }

  if (uploadedBy) {
    params.push(uploadedBy);
    conditions.push(`d.uploaded_by = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // total count
  const countResult = await query(
    `SELECT COUNT(*) FROM documents d ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

 
  params.push(limit, offset);
  const { rows } = await query(
    `SELECT d.id, d.title, d.filename, d.mime_type, d.size, d.created_at,
            u.id as uploader_id, u.name as uploader_name
     FROM documents d
     JOIN users u ON u.id = d.uploaded_by
     ${where}
     ORDER BY d.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const result = {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };

  await cache.set(cacheKey, result, 60);
  return result;
};


const createDocument = async ({ title, filename, filepath, mimeType, size, uploadedBy }) => {
  const { rows } = await query(
    `INSERT INTO documents (title, filename, filepath, mime_type, size, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [title, filename, filepath, mimeType, size, uploadedBy]
  );

 
  await cache.delPattern(`${CACHE_PREFIX}*`);

  return rows[0];
};

const softDeleteDocument = async (id) => {
  const { rows } = await query(
    `UPDATE documents
     SET is_deleted = true, updated_at = NOW()
     WHERE id = $1 AND is_deleted = false
     RETURNING *`,
    [id]
  );

  await cache.delPattern(`${CACHE_PREFIX}*`);

  return rows[0] || null;
};

module.exports = {
  listDocuments,
  createDocument,
  softDeleteDocument,
};
