import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, unlinkSync } from 'fs';
import pool, { withDoltCommit } from '../db.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(__dir, '../uploads/documents');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'text/plain', 'text/csv',
]);

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename:    (_, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error(`File type not allowed: ${file.mimetype}`));
  },
});

const router = Router({ mergeParams: true });

// GET /api/accounts/:id/documents
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.*, u.name AS uploader_name
       FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.account_id = ? ORDER BY d.created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/accounts/:id/documents
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const authorEmail = req.user.email;
    const row = await withDoltCommit(async (conn) => {
      const [result] = await conn.query(
        'INSERT INTO documents (account_id, file_name, file_path, file_size, mime_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
        [req.params.id, req.file.originalname, req.file.filename, req.file.size, req.file.mimetype, req.user.id]
      );
      const [rows] = await conn.query('SELECT * FROM documents WHERE id = ?', [result.insertId]);
      return rows[0];
    }, `CRM: upload document ${req.file.originalname}`, authorEmail);
    res.status(201).json(row);
  } catch (err) {
    try { unlinkSync(join(UPLOAD_DIR, req.file.filename)); } catch {}
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/accounts/:id/documents/:docId
router.delete('/:docId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM documents WHERE id = ? AND account_id = ?',
      [req.params.docId, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const doc = rows[0];
    const authorEmail = req.user.email;
    await withDoltCommit(async (conn) => {
      await conn.query('DELETE FROM documents WHERE id = ?', [doc.id]);
    }, `CRM: delete document ${doc.file_name}`, authorEmail);
    try { unlinkSync(join(UPLOAD_DIR, doc.file_path)); } catch {}
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET download / preview
router.get('/:docId/download', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM documents WHERE id = ? AND account_id = ?',
    [req.params.docId, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  const doc = rows[0];
  res.setHeader('Content-Disposition', `attachment; filename="${doc.file_name}"`);
  res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
  res.sendFile(join(UPLOAD_DIR, doc.file_path));
});

router.get('/:docId/preview', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM documents WHERE id = ? AND account_id = ?',
    [req.params.docId, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  const doc = rows[0];
  res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
  res.sendFile(join(UPLOAD_DIR, doc.file_path));
});

export default router;
