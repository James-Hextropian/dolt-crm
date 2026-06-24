import { Router } from 'express';
import pool, { withDoltCommit } from '../db.js';

const router = Router();

const STAGES = [
  'Prospecting','Qualification','Discovery','Demo',
  'POC Planned','POC Active','Negotiation',
  'Closed-Won','Closed-Lost','Post-Sale',
];

// GET /api/accounts
router.get('/', async (req, res) => {
  try {
    const { search, segment, mine } = req.query;
    let sql = `
      SELECT a.*,
             u.name AS owner_name,
             (SELECT stage FROM deals WHERE account_id = a.id ORDER BY updated_at DESC LIMIT 1) AS current_stage,
             (SELECT deal_value FROM deals WHERE account_id = a.id ORDER BY updated_at DESC LIMIT 1) AS deal_value,
             (SELECT COUNT(*) FROM contacts WHERE account_id = a.id) AS contact_count
      FROM accounts a
      LEFT JOIN users u ON u.id = a.owner_id
      WHERE 1=1
    `;
    const params = [];

    if (mine === 'true') {
      sql += ' AND a.owner_id = ?';
      params.push(req.user.id);
    }
    if (search) {
      sql += ' AND (a.company_name LIKE ? OR a.website LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (segment) {
      sql += ' AND a.segment = ?';
      params.push(segment);
    }

    sql += ' ORDER BY a.company_name';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/accounts/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, u.name AS owner_name
       FROM accounts a LEFT JOIN users u ON u.id = a.owner_id
       WHERE a.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/accounts
router.post('/', async (req, res) => {
  const { company_name, website, segment, owner_id, last_contact_date } = req.body;
  if (!company_name?.trim()) return res.status(400).json({ error: 'company_name is required' });

  try {
    const authorEmail = req.user.email;
    const row = await withDoltCommit(async (conn) => {
      const [result] = await conn.query(
        'INSERT INTO accounts (company_name, website, segment, owner_id, last_contact_date) VALUES (?, ?, ?, ?, ?)',
        [company_name.trim(), website || null, segment || null, owner_id || null, last_contact_date || null]
      );
      const [rows] = await conn.query('SELECT * FROM accounts WHERE id = ?', [result.insertId]);
      return rows[0];
    }, `CRM: add account ${company_name.trim()}`, authorEmail);
    res.status(201).json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/accounts/:id
router.put('/:id', async (req, res) => {
  const { company_name, website, segment, owner_id, last_contact_date } = req.body;
  if (!company_name?.trim()) return res.status(400).json({ error: 'company_name is required' });

  try {
    const authorEmail = req.user.email;
    const row = await withDoltCommit(async (conn) => {
      await conn.query(
        'UPDATE accounts SET company_name=?, website=?, segment=?, owner_id=?, last_contact_date=?, updated_at=NOW() WHERE id=?',
        [company_name.trim(), website || null, segment || null, owner_id || null, last_contact_date || null, req.params.id]
      );
      const [rows] = await conn.query('SELECT * FROM accounts WHERE id = ?', [req.params.id]);
      if (!rows.length) throw Object.assign(new Error('Not found'), { status: 404 });
      return rows[0];
    }, `CRM: update account ${company_name.trim()}`, authorEmail);
    res.json(row);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/accounts/:id
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT company_name FROM accounts WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const name = rows[0].company_name;
    const authorEmail = req.user.email;
    await withDoltCommit(async (conn) => {
      await conn.query('DELETE FROM accounts WHERE id = ?', [req.params.id]);
    }, `CRM: delete account ${name}`, authorEmail);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/accounts/:id/notes
router.get('/:id/notes', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT n.*, u.name AS author_name
       FROM notes n LEFT JOIN users u ON u.id = n.created_by
       WHERE n.account_id = ?
       ORDER BY n.created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/accounts/:id/notes
router.post('/:id/notes', async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'content is required' });

  try {
    const authorEmail = req.user.email;
    const row = await withDoltCommit(async (conn) => {
      const [result] = await conn.query(
        'INSERT INTO notes (account_id, content, created_by) VALUES (?, ?, ?)',
        [req.params.id, content.trim(), req.user.id]
      );
      const [rows] = await conn.query(
        'SELECT n.*, u.name AS author_name FROM notes n LEFT JOIN users u ON u.id = n.created_by WHERE n.id = ?',
        [result.insertId]
      );
      return rows[0];
    }, `CRM: add note for account ${req.params.id}`, authorEmail);
    res.status(201).json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/accounts/:id/notes/:noteId
router.put('/:id/notes/:noteId', async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'content is required' });

  try {
    const authorEmail = req.user.email;
    const row = await withDoltCommit(async (conn) => {
      await conn.query(
        'UPDATE notes SET content=?, updated_at=NOW() WHERE id=? AND account_id=?',
        [content.trim(), req.params.noteId, req.params.id]
      );
      const [rows] = await conn.query(
        'SELECT n.*, u.name AS author_name FROM notes n LEFT JOIN users u ON u.id = n.created_by WHERE n.id = ?',
        [req.params.noteId]
      );
      return rows[0];
    }, `CRM: update note ${req.params.noteId}`, authorEmail);
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/accounts/:id/notes/:noteId
router.delete('/:id/notes/:noteId', async (req, res) => {
  try {
    const authorEmail = req.user.email;
    await withDoltCommit(async (conn) => {
      await conn.query('DELETE FROM notes WHERE id=? AND account_id=?', [req.params.noteId, req.params.id]);
    }, `CRM: delete note ${req.params.noteId}`, authorEmail);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
