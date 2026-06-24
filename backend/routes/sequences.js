import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/sequences
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, COUNT(st.id) AS step_count
       FROM email_sequences s
       LEFT JOIN sequence_steps st ON st.sequence_id = s.id
       GROUP BY s.id ORDER BY s.name`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/sequences
router.post('/', async (req, res) => {
  const { name, segment, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const [result] = await pool.query(
      'INSERT INTO email_sequences (name, segment, description) VALUES (?, ?, ?)',
      [name.trim(), segment || null, description || null]
    );
    const [rows] = await pool.query('SELECT * FROM email_sequences WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/sequences/:id/steps
router.get('/:id/steps', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM sequence_steps WHERE sequence_id = ? ORDER BY step_number',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/sequences/:id/steps
router.post('/:id/steps', async (req, res) => {
  const { step_number, channel, day_offset, subject, body } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO sequence_steps (sequence_id, step_number, channel, day_offset, subject, body) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, step_number, channel || 'Email', day_offset || 0, subject || null, body || null]
    );
    const [rows] = await pool.query('SELECT * FROM sequence_steps WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/sequences/:id/steps/:stepId
router.put('/:id/steps/:stepId', async (req, res) => {
  const { channel, day_offset, subject, body } = req.body;
  try {
    await pool.query(
      'UPDATE sequence_steps SET channel=?, day_offset=?, subject=?, body=? WHERE id=? AND sequence_id=?',
      [channel || 'Email', day_offset || 0, subject || null, body || null, req.params.stepId, req.params.id]
    );
    const [rows] = await pool.query('SELECT * FROM sequence_steps WHERE id = ?', [req.params.stepId]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/sequences/:id/steps/:stepId
router.delete('/:id/steps/:stepId', async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM sequence_steps WHERE id=? AND sequence_id=?',
      [req.params.stepId, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
