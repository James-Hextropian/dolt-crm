import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const JWT_SECRET         = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

const ACCESS_TTL   = 15 * 60;
const REFRESH_TTL  = 7 * 24 * 3600;
const REMEMBER_TTL = 30 * 24 * 3600;
const IS_PROD      = process.env.NODE_ENV === 'production';

function signAccess(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

function signRefresh(user, rememberMe = false) {
  return jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, {
    expiresIn: rememberMe ? REMEMBER_TTL : REFRESH_TTL,
  });
}

function setTokenCookies(res, accessToken, refreshToken, rememberMe = false) {
  const opts = {
    httpOnly: true,
    sameSite: IS_PROD ? 'strict' : 'lax',
    secure:   IS_PROD,
    path:     '/',
  };
  res.cookie('access_token',  accessToken,  { ...opts, maxAge: ACCESS_TTL * 1000 });
  res.cookie('refresh_token', refreshToken, { ...opts, maxAge: (rememberMe ? REMEMBER_TTL : REFRESH_TTL) * 1000 });
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password, rememberMe = false } = req.body;
  if (!email?.trim() || !password) return res.status(400).json({ error: 'email and password are required' });

  try {
    const [rows] = await pool.query(
      'SELECT id, email, password_hash, name, role, is_active FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid email or password' });

    const user = rows[0];
    if (!user.is_active) return res.status(403).json({ error: 'Account deactivated' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const accessToken  = signAccess(user);
    const refreshToken = signRefresh(user, rememberMe);
    const tokenHash    = await bcrypt.hash(refreshToken, 10);

    const expiresAt = new Date(Date.now() + (rememberMe ? REMEMBER_TTL : REFRESH_TTL) * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, tokenHash, expiresAt]
    );
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    setTokenCookies(res, accessToken, refreshToken, rememberMe);
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const rawRefresh = req.cookies?.refresh_token;
  if (rawRefresh) {
    try {
      const payload = jwt.verify(rawRefresh, JWT_REFRESH_SECRET);
      const [rows] = await pool.query(
        'SELECT id, token_hash FROM refresh_tokens WHERE user_id = ? AND expires_at > NOW()',
        [payload.id]
      );
      for (const row of rows) {
        const match = await bcrypt.compare(rawRefresh, row.token_hash);
        if (match) { await pool.query('DELETE FROM refresh_tokens WHERE id = ?', [row.id]); break; }
      }
    } catch {}
  }
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.json({ ok: true });
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const rawRefresh = req.cookies?.refresh_token;
  if (!rawRefresh) return res.status(401).json({ error: 'No refresh token' });

  try {
    const payload = jwt.verify(rawRefresh, JWT_REFRESH_SECRET);
    const [rows] = await pool.query(
      `SELECT rt.id, rt.token_hash,
              u.id AS uid, u.email, u.name, u.role, u.is_active
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.user_id = ? AND rt.expires_at > NOW()`,
      [payload.id]
    );

    let matchedRow = null;
    for (const row of rows) {
      const ok = await bcrypt.compare(rawRefresh, row.token_hash);
      if (ok) { matchedRow = row; break; }
    }
    if (!matchedRow) return res.status(401).json({ error: 'Invalid refresh token' });
    if (!matchedRow.is_active) return res.status(403).json({ error: 'Account deactivated' });

    await pool.query('DELETE FROM refresh_tokens WHERE id = ?', [matchedRow.id]);
    const user = { id: matchedRow.uid, email: matchedRow.email, name: matchedRow.name, role: matchedRow.role };
    const newAccess  = signAccess(user);
    const newRefresh = signRefresh(user);
    const newHash    = await bcrypt.hash(newRefresh, 10);
    const expiresAt  = new Date(Date.now() + REFRESH_TTL * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, newHash, expiresAt]
    );
    setTokenCookies(res, newAccess, newRefresh);
    res.json({ ok: true });
  } catch { res.status(401).json({ error: 'Invalid or expired refresh token' }); }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, email, name, role, last_login_at FROM users WHERE id = ? AND is_active = 1',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/auth/signup (admin only, or bootstrap)
router.post('/signup', async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email?.trim() || !password || !name?.trim()) {
    return res.status(400).json({ error: 'email, password, and name are required' });
  }
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const [countRows] = await pool.query('SELECT COUNT(*) AS n FROM users');
    const isBootstrap = countRows[0].n === 0;

    if (!isBootstrap) {
      const token = req.cookies?.access_token;
      if (!token) return res.status(401).json({ error: 'Admin authentication required' });
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload.role !== 'admin') return res.status(403).json({ error: 'Admin required' });
      } catch { return res.status(401).json({ error: 'Invalid session' }); }
    }

    const hash    = await bcrypt.hash(password, 12);
    const newRole = isBootstrap ? 'admin' : (role || 'sales_rep');
    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      [email.trim().toLowerCase(), hash, name.trim(), newRole]
    );
    const [newUser] = await pool.query(
      'SELECT id, email, name, role FROM users WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json({ user: newUser[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already in use' });
    res.status(500).json({ error: err.message });
  }
});

export default router;
