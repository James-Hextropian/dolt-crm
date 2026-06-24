import { Router } from 'express';
import pool from '../db.js';

const router = Router();

const ALLOWED_TABLES = ['accounts', 'contacts', 'deals', 'notes'];

// GET /api/dolt/log — commit history
router.get('/log', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM dolt_log ORDER BY date DESC LIMIT 50'
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/dolt/diff/:table — diff HEAD~1..HEAD for a table
router.get('/diff/:table', async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ error: 'Invalid table name' });
  }
  try {
    // Table name is safe (allowlist above), so we can interpolate
    const [rows] = await pool.query(
      `SELECT * FROM dolt_diff('HEAD~1', 'HEAD', '${table}')`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/dolt/timetravel/:table?commit=<hash>
router.get('/timetravel/:table', async (req, res) => {
  const { table } = req.params;
  const { commit } = req.query;
  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ error: 'Invalid table name' });
  }
  if (!commit || !/^[a-f0-9]{7,64}$/.test(commit)) {
    return res.status(400).json({ error: 'Invalid commit hash' });
  }
  try {
    const [rows] = await pool.query(
      `SELECT * FROM \`${table}\` AS OF ?`,
      [commit]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/dolt/reset — hard reset to a commit (destructive!)
router.post('/reset', async (req, res) => {
  const { commit } = req.body;
  if (!commit || !/^[a-f0-9]{7,64}$/.test(commit)) {
    return res.status(400).json({ error: 'Invalid commit hash' });
  }
  try {
    await pool.query('CALL DOLT_RESET(?, ?)', ['--hard', commit]);
    res.json({ ok: true, commit });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/dolt/branches
router.get('/branches', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM dolt_branches');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/dolt/status — working set status
router.get('/status', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM dolt_status');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
