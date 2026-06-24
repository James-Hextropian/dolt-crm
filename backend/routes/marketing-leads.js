import { Router } from 'express';
import pool, { withDoltCommit } from '../db.js';

const router = Router();

const COMMIT_MSG = 'Marketing leads update';

// GET /api/marketing-leads
router.get('/', async (req, res) => {
  try {
    const { status, priority, segment, date_range, search } = req.query;
    let sql = `
      SELECT ml.*, u.name AS assigned_name
      FROM marketing_leads ml
      LEFT JOIN users u ON u.id = ml.assigned_to
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ' AND (ml.first_name LIKE ? OR ml.last_name LIKE ? OR ml.company LIKE ? OR ml.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status)   { sql += ' AND ml.status = ?';   params.push(status); }
    if (priority) { sql += ' AND ml.priority = ?';  params.push(priority); }
    if (segment)  { sql += ' AND ml.segment = ?';   params.push(segment); }
    if (date_range === '7d')  { sql += ' AND ml.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'; }
    if (date_range === '30d') { sql += ' AND ml.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'; }

    sql += ' ORDER BY ml.created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/marketing-leads — single add
router.post('/', async (req, res) => {
  const {
    first_name, last_name, title, company, email, linkedin_url,
    segment, priority, source, notes, assigned_to, import_batch,
  } = req.body;

  try {
    const authorEmail = req.user.email;
    const row = await withDoltCommit(async (conn) => {
      const [result] = await conn.query(
        `INSERT INTO marketing_leads
          (first_name, last_name, title, company, email, linkedin_url,
           segment, priority, source, notes, assigned_to, imported_by, import_batch)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          first_name || null, last_name || null, title || null, company || null,
          email || null, linkedin_url || null, segment || null,
          priority || 'Medium', source || null, notes || null,
          assigned_to || null, authorEmail, import_batch || null,
        ]
      );
      const [rows] = await conn.query('SELECT * FROM marketing_leads WHERE id = ?', [result.insertId]);
      return rows[0];
    }, COMMIT_MSG, authorEmail);
    res.status(201).json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/marketing-leads/import — bulk import
router.post('/import', async (req, res) => {
  const { leads, import_batch, default_priority, default_source } = req.body;
  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: 'leads array is required' });
  }

  const authorEmail = req.user.email;
  const imported = [];
  const errors   = [];

  try {
    await withDoltCommit(async (conn) => {
      for (let i = 0; i < leads.length; i++) {
        const l = leads[i];
        if (!l.first_name && !l.last_name && !l.company && !l.email) {
          errors.push({ row: i + 1, reason: 'missing required fields' });
          continue;
        }
        try {
          const [result] = await conn.query(
            `INSERT INTO marketing_leads
              (first_name, last_name, title, company, email, linkedin_url,
               segment, priority, source, notes, imported_by, import_batch)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              l.first_name || null, l.last_name || null, l.title || null,
              l.company || null, l.email || null, l.linkedin_url || null,
              l.segment || null,
              l.priority || default_priority || 'Medium',
              l.source || default_source || null,
              l.notes || null, authorEmail, import_batch || null,
            ]
          );
          imported.push(result.insertId);
        } catch (rowErr) {
          errors.push({ row: i + 1, reason: rowErr.message });
        }
      }
    }, COMMIT_MSG, authorEmail);

    res.json({ imported: imported.length, skipped: errors.length, errors });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/marketing-leads/:id
router.put('/:id', async (req, res) => {
  const {
    first_name, last_name, title, company, email, linkedin_url,
    segment, priority, source, notes, status, assigned_to,
  } = req.body;

  try {
    const authorEmail = req.user.email;
    const row = await withDoltCommit(async (conn) => {
      await conn.query(
        `UPDATE marketing_leads SET
          first_name=?, last_name=?, title=?, company=?, email=?, linkedin_url=?,
          segment=?, priority=?, source=?, notes=?, status=?, assigned_to=?
         WHERE id=?`,
        [
          first_name || null, last_name || null, title || null, company || null,
          email || null, linkedin_url || null, segment || null,
          priority || 'Medium', source || null, notes || null,
          status || 'New', assigned_to || null, req.params.id,
        ]
      );
      const [rows] = await conn.query('SELECT * FROM marketing_leads WHERE id = ?', [req.params.id]);
      if (!rows.length) throw Object.assign(new Error('Not found'), { status: 404 });
      return rows[0];
    }, COMMIT_MSG, authorEmail);
    res.json(row);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/marketing-leads/:id/convert — convert to prospect
router.post('/:id/convert', async (req, res) => {
  try {
    const [leadRows] = await pool.query('SELECT * FROM marketing_leads WHERE id = ?', [req.params.id]);
    if (!leadRows.length) return res.status(404).json({ error: 'Not found' });
    const lead = leadRows[0];

    const authorEmail = req.user.email;
    const result = await withDoltCommit(async (conn) => {
      const [r] = await conn.query(
        `INSERT INTO prospects
          (first_name, last_name, title, company, email, linkedin_url,
           segment, source, priority, notes, assigned_to, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Marketing Lead', ?, ?, ?, 'Active')`,
        [
          lead.first_name, lead.last_name, lead.title, lead.company,
          lead.email, lead.linkedin_url, lead.segment,
          lead.priority, lead.notes, lead.assigned_to || null,
        ]
      );
      const prospectId = r.insertId;
      await conn.query(
        "UPDATE marketing_leads SET status='Converted', converted_to_prospect_id=? WHERE id=?",
        [prospectId, lead.id]
      );
      return { prospect_id: prospectId };
    }, COMMIT_MSG, authorEmail);

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/marketing-leads/:id
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT first_name, last_name FROM marketing_leads WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const authorEmail = req.user.email;
    await withDoltCommit(async (conn) => {
      await conn.query('DELETE FROM marketing_leads WHERE id = ?', [req.params.id]);
    }, COMMIT_MSG, authorEmail);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
