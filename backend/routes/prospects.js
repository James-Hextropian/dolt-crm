import { Router } from 'express';
import pool, { withDoltCommit } from '../db.js';

const router = Router();

// GET /api/prospects
router.get('/', async (req, res) => {
  try {
    const { search, segment, status, assigned_to, source } = req.query;
    let sql = `
      SELECT p.*,
             u.name AS assigned_name,
             es.name AS sequence_name,
             a.company_name AS converted_company
      FROM prospects p
      LEFT JOIN users u ON u.id = p.assigned_to
      LEFT JOIN email_sequences es ON es.id = p.sequence_id
      LEFT JOIN accounts a ON a.id = p.converted_account_id
      WHERE 1=1
    `;
    const params = [];
    if (search) {
      sql += ' AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.company LIKE ? OR p.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (segment) { sql += ' AND p.segment = ?'; params.push(segment); }
    if (status)  { sql += ' AND p.status = ?';  params.push(status); }
    if (source)  { sql += ' AND p.source = ?';  params.push(source); }
    if (assigned_to) { sql += ' AND p.assigned_to = ?'; params.push(assigned_to); }
    sql += ' ORDER BY p.next_action_date ASC, p.updated_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/prospects/stats
router.get('/stats', async (req, res) => {
  try {
    const [total] = await pool.query('SELECT COUNT(*) AS n FROM prospects');
    const [active] = await pool.query("SELECT COUNT(*) AS n FROM prospects WHERE status = 'Active'");
    const [today] = await pool.query("SELECT COUNT(*) AS n FROM prospects WHERE last_contact_date = CURDATE()");
    const [converted] = await pool.query(
      "SELECT COUNT(*) AS n FROM prospects WHERE status = 'Converted' AND DATE_FORMAT(updated_at,'%Y-%m') = DATE_FORMAT(NOW(),'%Y-%m')"
    );
    res.json({
      total: total[0].n,
      active: active[0].n,
      contacted_today: today[0].n,
      converted_this_month: converted[0].n,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/prospects/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, u.name AS assigned_name, es.name AS sequence_name
       FROM prospects p
       LEFT JOIN users u ON u.id = p.assigned_to
       LEFT JOIN email_sequences es ON es.id = p.sequence_id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const prospect = rows[0];

    // Get current step content if on a sequence
    let currentStep = null;
    if (prospect.sequence_id && prospect.sequence_step > 0) {
      const [steps] = await pool.query(
        'SELECT * FROM sequence_steps WHERE sequence_id = ? AND step_number = ?',
        [prospect.sequence_id, prospect.sequence_step]
      );
      currentStep = steps[0] || null;
    } else if (prospect.sequence_id) {
      const [steps] = await pool.query(
        'SELECT * FROM sequence_steps WHERE sequence_id = ? AND step_number = 1',
        [prospect.sequence_id]
      );
      currentStep = steps[0] || null;
    }

    res.json({ ...prospect, current_step: currentStep });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/prospects
router.post('/', async (req, res) => {
  const { first_name, last_name, title, company, email, linkedin_url, segment, sequence_id, assigned_to, notes } = req.body;
  try {
    const authorEmail = req.user.email;
    const row = await withDoltCommit(async (conn) => {
      const [result] = await conn.query(
        `INSERT INTO prospects (first_name, last_name, title, company, email, linkedin_url, segment, sequence_id, assigned_to, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [first_name || null, last_name || null, title || null, company || null,
         email || null, linkedin_url || null, segment || null,
         sequence_id || null, assigned_to || null, notes || null]
      );
      const [rows] = await conn.query('SELECT * FROM prospects WHERE id = ?', [result.insertId]);
      return rows[0];
    }, `CRM: add prospect ${first_name || ''} ${last_name || ''} at ${company || ''}`.trim(), authorEmail);
    res.status(201).json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/prospects/:id
router.put('/:id', async (req, res) => {
  const {
    first_name, last_name, title, company, email, linkedin_url,
    segment, sequence_id, sequence_step, sequence_stage,
    last_contact_date, next_action, next_action_date,
    status, notes, assigned_to,
  } = req.body;
  try {
    const authorEmail = req.user.email;
    const row = await withDoltCommit(async (conn) => {
      await conn.query(
        `UPDATE prospects SET
          first_name=?, last_name=?, title=?, company=?, email=?, linkedin_url=?,
          segment=?, sequence_id=?, sequence_step=?, sequence_stage=?,
          last_contact_date=?, next_action=?, next_action_date=?,
          status=?, notes=?, assigned_to=?
         WHERE id=?`,
        [
          first_name || null, last_name || null, title || null, company || null,
          email || null, linkedin_url || null, segment || null,
          sequence_id || null, sequence_step ?? 0, sequence_stage || 'Not Started',
          last_contact_date || null, next_action || null, next_action_date || null,
          status || 'Active', notes || null, assigned_to || null, req.params.id,
        ]
      );
      const [rows] = await conn.query('SELECT * FROM prospects WHERE id = ?', [req.params.id]);
      if (!rows.length) throw Object.assign(new Error('Not found'), { status: 404 });
      return rows[0];
    }, `CRM: update prospect ${first_name || ''} ${last_name || ''}`.trim(), authorEmail);
    res.json(row);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/prospects/:id/advance — mark current step done, move to next
router.post('/:id/advance', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM prospects WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const p = rows[0];
    if (!p.sequence_id) return res.status(400).json({ error: 'No sequence assigned' });

    const nextStep = (p.sequence_step || 0) + 1;

    // Check if next step exists
    const [nextStepRows] = await pool.query(
      'SELECT * FROM sequence_steps WHERE sequence_id = ? AND step_number = ?',
      [p.sequence_id, nextStep]
    );
    const hasNext = nextStepRows.length > 0;

    const authorEmail = req.user.email;
    const row = await withDoltCommit(async (conn) => {
      if (hasNext) {
        const dayOffset = nextStepRows[0].day_offset;
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + (dayOffset || 1));
        const nextDateStr = nextDate.toISOString().slice(0, 10);

        await conn.query(
          `UPDATE prospects SET sequence_step=?, sequence_stage=?, last_contact_date=CURDATE(),
           next_action_date=?, next_action=?, status='Active' WHERE id=?`,
          [nextStep, `Step ${nextStep}`, nextDateStr, nextStepRows[0].channel, req.params.id]
        );
      } else {
        // Sequence complete
        await conn.query(
          `UPDATE prospects SET sequence_stage='Complete', last_contact_date=CURDATE(),
           next_action='Follow up', next_action_date=NULL WHERE id=?`,
          [req.params.id]
        );
      }
      const [updated] = await conn.query('SELECT * FROM prospects WHERE id = ?', [req.params.id]);
      return { ...updated[0], next_step: hasNext ? nextStepRows[0] : null };
    }, `CRM: advance prospect step → Step ${nextStep}`, authorEmail);
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/prospects/:id/convert — convert prospect to account + deal
router.post('/:id/convert', async (req, res) => {
  const { company_name, segment, deal_stage, deal_value, website } = req.body;
  if (!company_name?.trim()) return res.status(400).json({ error: 'company_name is required' });

  try {
    const [pRows] = await pool.query('SELECT * FROM prospects WHERE id = ?', [req.params.id]);
    if (!pRows.length) return res.status(404).json({ error: 'Prospect not found' });
    const prospect = pRows[0];

    const authorEmail = req.user.email;
    const result = await withDoltCommit(async (conn) => {
      // Create account
      const [acctResult] = await conn.query(
        'INSERT INTO accounts (company_name, website, segment, owner_id) VALUES (?, ?, ?, ?)',
        [company_name.trim(), website || null, segment || prospect.segment || null, req.user.id]
      );
      const accountId = acctResult.insertId;

      // Create contact from prospect
      if (prospect.first_name || prospect.email) {
        await conn.query(
          'INSERT INTO contacts (account_id, name, title, email, is_primary) VALUES (?, ?, ?, ?, 1)',
          [
            accountId,
            `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim() || 'Unknown',
            prospect.title || null,
            prospect.email || null,
          ]
        );
      }

      // Create deal
      const [dealResult] = await conn.query(
        'INSERT INTO deals (deal_name, account_id, stage, deal_value, owner_id, probability) VALUES (?, ?, ?, ?, ?, ?)',
        [company_name.trim(), accountId, deal_stage || 'Qualification', deal_value || null, req.user.id, 25]
      );
      await conn.query(
        'INSERT INTO deal_stage_history (deal_id, stage) VALUES (?, ?)',
        [dealResult.insertId, deal_stage || 'Qualification']
      );

      // Mark prospect as converted
      await conn.query(
        "UPDATE prospects SET status='Converted', converted_account_id=? WHERE id=?",
        [accountId, prospect.id]
      );

      return { account_id: accountId, deal_id: dealResult.insertId };
    }, `CRM: convert prospect ${prospect.first_name || ''} ${prospect.last_name || ''} → account ${company_name}`, authorEmail);

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/prospects/:id
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT first_name, last_name, company FROM prospects WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const p = rows[0];
    const authorEmail = req.user.email;
    await withDoltCommit(async (conn) => {
      await conn.query('DELETE FROM prospects WHERE id = ?', [req.params.id]);
    }, `CRM: delete prospect ${p.first_name || ''} ${p.last_name || ''} at ${p.company || ''}`.trim(), authorEmail);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
