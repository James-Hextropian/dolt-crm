import { Router } from 'express';
import pool, { withDoltCommit } from '../db.js';

const router = Router();

// GET /api/contacts?account_id=
router.get('/', async (req, res) => {
  try {
    const { account_id } = req.query;
    let sql = 'SELECT * FROM contacts WHERE 1=1';
    const params = [];
    if (account_id) { sql += ' AND account_id = ?'; params.push(account_id); }
    sql += ' ORDER BY is_primary DESC, name';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/contacts
router.post('/', async (req, res) => {
  const { account_id, name, title, email, phone, is_primary } = req.body;
  if (!account_id || !name?.trim()) return res.status(400).json({ error: 'account_id and name are required' });

  try {
    const authorEmail = req.user.email;
    const row = await withDoltCommit(async (conn) => {
      if (is_primary) {
        await conn.query('UPDATE contacts SET is_primary = 0 WHERE account_id = ?', [account_id]);
      }
      const [result] = await conn.query(
        'INSERT INTO contacts (account_id, name, title, email, phone, is_primary) VALUES (?, ?, ?, ?, ?, ?)',
        [account_id, name.trim(), title || null, email || null, phone || null, is_primary ? 1 : 0]
      );
      const [rows] = await conn.query('SELECT * FROM contacts WHERE id = ?', [result.insertId]);
      return rows[0];
    }, `CRM: add contact ${name.trim()}`, authorEmail);
    res.status(201).json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/contacts/:id
router.put('/:id', async (req, res) => {
  const { name, title, email, phone, is_primary } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  try {
    const authorEmail = req.user.email;
    const row = await withDoltCommit(async (conn) => {
      const [existing] = await conn.query('SELECT account_id FROM contacts WHERE id = ?', [req.params.id]);
      if (!existing.length) throw Object.assign(new Error('Not found'), { status: 404 });
      if (is_primary) {
        await conn.query('UPDATE contacts SET is_primary = 0 WHERE account_id = ?', [existing[0].account_id]);
      }
      await conn.query(
        'UPDATE contacts SET name=?, title=?, email=?, phone=?, is_primary=? WHERE id=?',
        [name.trim(), title || null, email || null, phone || null, is_primary ? 1 : 0, req.params.id]
      );
      const [rows] = await conn.query('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
      return rows[0];
    }, `CRM: update contact ${name.trim()}`, authorEmail);
    res.json(row);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT name FROM contacts WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const authorEmail = req.user.email;
    await withDoltCommit(async (conn) => {
      await conn.query('DELETE FROM contacts WHERE id = ?', [req.params.id]);
    }, `CRM: delete contact ${rows[0].name}`, authorEmail);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
