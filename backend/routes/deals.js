import { Router } from 'express';
import pool, { withDoltCommit } from '../db.js';

const router = Router();

const STAGES = [
  'Prospecting','Qualification','Discovery','Demo',
  'POC Planned','POC Active','Negotiation',
  'Closed-Won','Closed-Lost','Post-Sale',
];

const CLOSED_STAGES = ['Closed-Won', 'Closed-Lost', 'Post-Sale'];

// GET /api/deals
router.get('/', async (req, res) => {
  try {
    const { mine, stage, account_id, assignedTo } = req.query;
    let sql = `
      SELECT d.*,
             a.company_name,
             a.segment,
             u.name AS owner_name,
             DATEDIFF(NOW(), d.stage_entered_at) AS days_in_stage
      FROM deals d
      JOIN accounts a ON a.id = d.account_id
      LEFT JOIN users u ON u.id = d.owner_id
      WHERE 1=1
    `;
    const params = [];
    if (account_id) { sql += ' AND d.account_id = ?'; params.push(account_id); }
    if (assignedTo) { sql += ' AND d.owner_id = ?'; params.push(Number(assignedTo)); }
    else if (mine === 'true') { sql += ' AND d.owner_id = ?'; params.push(req.user.id); }
    if (stage) { sql += ' AND d.stage = ?'; params.push(stage); }
    sql += ' ORDER BY d.updated_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/deals/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const { assignedTo, mine } = req.query;

    // Resolve the user ID to filter by (null = no filter = all deals)
    let filterUserId = null;
    if (assignedTo) {
      filterUserId = Number(assignedTo);
    } else if (mine === 'true') {
      filterUserId = req.user.id;
    }

    const ownerClause = filterUserId ? 'AND d.owner_id = ?' : '';
    const p = filterUserId ? [filterUserId] : [];

    const [byStage] = await pool.query(`
      SELECT d.stage,
             COUNT(*)                        AS deal_count,
             COALESCE(SUM(d.deal_value), 0)  AS total_value
      FROM deals d
      WHERE 1=1 ${ownerClause}
      GROUP BY d.stage
    `, p);

    const [closingThisMonth] = await pool.query(`
      SELECT COUNT(*) AS n, COALESCE(SUM(d.deal_value), 0) AS v
      FROM deals d
      WHERE d.close_date BETWEEN DATE_FORMAT(NOW(),'%Y-%m-01') AND LAST_DAY(NOW())
        AND d.stage NOT IN ('Closed-Lost','Closed-Won','Post-Sale')
        ${ownerClause}
    `, p);

    const [winRate] = await pool.query(`
      SELECT
        SUM(d.stage = 'Closed-Won')  AS won,
        SUM(d.stage = 'Closed-Lost') AS lost
      FROM deals d
      WHERE d.stage IN ('Closed-Won','Closed-Lost')
        AND d.updated_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        ${ownerClause}
    `, p);

    const [closedWonAccounts] = await pool.query(`
      SELECT COUNT(DISTINCT d.account_id) AS n
      FROM deals d
      WHERE d.stage IN ('Closed-Won','Post-Sale')
        ${ownerClause}
    `, p);

    const [totalPipeline] = await pool.query(`
      SELECT COALESCE(SUM(d.deal_value), 0) AS v
      FROM deals d
      WHERE d.stage NOT IN ('Closed-Lost')
        ${ownerClause}
    `, p);

    res.json({
      by_stage:            byStage,
      closing_this_month:  closingThisMonth[0],
      win_rate:            winRate[0],
      closed_won_accounts: closedWonAccounts[0].n,
      total_pipeline:      totalPipeline[0].v,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/deals/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.*, a.company_name, a.segment, u.name AS owner_name,
              DATEDIFF(NOW(), d.stage_entered_at) AS days_in_stage
       FROM deals d JOIN accounts a ON a.id = d.account_id
       LEFT JOIN users u ON u.id = d.owner_id
       WHERE d.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const [history] = await pool.query(
      'SELECT * FROM deal_stage_history WHERE deal_id = ? ORDER BY entered_at',
      [req.params.id]
    );
    res.json({ ...rows[0], stage_history: history });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/deals
router.post('/', async (req, res) => {
  const { deal_name, account_id, stage, deal_value, close_date, probability, owner_id, win_loss_reason } = req.body;
  if (!deal_name?.trim() || !account_id) return res.status(400).json({ error: 'deal_name and account_id are required' });
  if (CLOSED_STAGES.includes(stage) && !win_loss_reason) {
    return res.status(400).json({ error: 'win_loss_reason is required for closed deals' });
  }

  try {
    const authorEmail = req.user.email;
    const row = await withDoltCommit(async (conn) => {
      const [result] = await conn.query(
        `INSERT INTO deals (deal_name, account_id, stage, deal_value, close_date, probability, owner_id, win_loss_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [deal_name.trim(), account_id, stage || 'Prospecting', deal_value || null,
         close_date || null, probability || 10, owner_id || null, win_loss_reason || null]
      );
      await conn.query(
        'INSERT INTO deal_stage_history (deal_id, stage) VALUES (?, ?)',
        [result.insertId, stage || 'Prospecting']
      );
      const [rows] = await conn.query(
        `SELECT d.*, a.company_name, DATEDIFF(NOW(), d.stage_entered_at) AS days_in_stage
         FROM deals d JOIN accounts a ON a.id = d.account_id WHERE d.id = ?`,
        [result.insertId]
      );
      return rows[0];
    }, `CRM: add deal ${deal_name.trim()}`, authorEmail);
    res.status(201).json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/deals/:id
router.put('/:id', async (req, res) => {
  const { deal_name, account_id, stage, deal_value, close_date, probability, owner_id, win_loss_reason } = req.body;
  if (!deal_name?.trim()) return res.status(400).json({ error: 'deal_name is required' });
  if (CLOSED_STAGES.includes(stage) && !win_loss_reason) {
    return res.status(400).json({ error: 'win_loss_reason is required for closed deals' });
  }

  try {
    const authorEmail = req.user.email;
    const row = await withDoltCommit(async (conn) => {
      const [existing] = await conn.query('SELECT stage FROM deals WHERE id = ?', [req.params.id]);
      if (!existing.length) throw Object.assign(new Error('Not found'), { status: 404 });

      const stageChanged = existing[0].stage !== stage;

      await conn.query(
        `UPDATE deals SET deal_name=?, account_id=?, stage=?, deal_value=?, close_date=?,
         probability=?, owner_id=?, win_loss_reason=?, updated_at=NOW()
         ${stageChanged ? ', stage_entered_at=NOW()' : ''}
         WHERE id=?`,
        [deal_name.trim(), account_id, stage, deal_value || null, close_date || null,
         probability || 10, owner_id || null, win_loss_reason || null, req.params.id]
      );

      if (stageChanged) {
        await conn.query(
          'UPDATE deal_stage_history SET exited_at = NOW() WHERE deal_id = ? AND exited_at IS NULL',
          [req.params.id]
        );
        await conn.query(
          'INSERT INTO deal_stage_history (deal_id, stage) VALUES (?, ?)',
          [req.params.id, stage]
        );
      }

      const [rows] = await conn.query(
        `SELECT d.*, a.company_name, a.segment, DATEDIFF(NOW(), d.stage_entered_at) AS days_in_stage
         FROM deals d JOIN accounts a ON a.id = d.account_id WHERE d.id = ?`,
        [req.params.id]
      );
      return rows[0];
    }, `CRM: update deal ${deal_name.trim()} → ${stage}`, authorEmail);
    res.json(row);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/deals/:id/meddic — save MEDDIC fields and auto-calculate score
router.put('/:id/meddic', async (req, res) => {
  const {
    meddic_metrics, meddic_economic_buyer, meddic_decision_criteria,
    meddic_decision_process, meddic_identify_pain, meddic_champion, meddic_paper_process,
  } = req.body;

  const fields = [
    meddic_metrics, meddic_economic_buyer, meddic_decision_criteria,
    meddic_decision_process, meddic_identify_pain, meddic_champion, meddic_paper_process,
  ];
  const score = fields.filter(f => f && f.trim().length > 0).length;

  try {
    const authorEmail = req.user.email;
    const [dealRows] = await pool.query('SELECT deal_name FROM deals WHERE id = ?', [req.params.id]);
    if (!dealRows.length) return res.status(404).json({ error: 'Not found' });

    const row = await withDoltCommit(async (conn) => {
      await conn.query(
        `UPDATE deals SET
          meddic_metrics=?, meddic_economic_buyer=?, meddic_decision_criteria=?,
          meddic_decision_process=?, meddic_identify_pain=?, meddic_champion=?,
          meddic_paper_process=?, meddic_score=?, updated_at=NOW()
         WHERE id=?`,
        [
          meddic_metrics || null, meddic_economic_buyer || null, meddic_decision_criteria || null,
          meddic_decision_process || null, meddic_identify_pain || null, meddic_champion || null,
          meddic_paper_process || null, score, req.params.id,
        ]
      );
      const [rows] = await conn.query('SELECT * FROM deals WHERE id = ?', [req.params.id]);
      return rows[0];
    }, `CRM: MEDDIC update: ${dealRows[0].deal_name}`, authorEmail);
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/deals/:id
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT deal_name FROM deals WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const authorEmail = req.user.email;
    await withDoltCommit(async (conn) => {
      await conn.query('DELETE FROM deals WHERE id = ?', [req.params.id]);
    }, `CRM: delete deal ${rows[0].deal_name}`, authorEmail);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
