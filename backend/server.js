import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { requireAuth } from './middleware/auth.js';
import authRouter       from './routes/auth.js';
import accountsRouter   from './routes/accounts.js';
import contactsRouter   from './routes/contacts.js';
import dealsRouter      from './routes/deals.js';
import usersRouter      from './routes/users.js';
import doltRouter       from './routes/dolt.js';
import documentsRouter  from './routes/documents.js';
import prospectsRouter       from './routes/prospects.js';
import sequencesRouter       from './routes/sequences.js';
import marketingLeadsRouter  from './routes/marketing-leads.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IS_PROD   = process.env.NODE_ENV === 'production';
const PORT      = process.env.PORT || 3003;

const REQUIRED_ENV = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();
if (IS_PROD) app.set('trust proxy', 1);
app.use(compression());

const ALLOWED_ORIGINS = (process.env.FRONTEND_URL || 'http://localhost:5176,http://localhost:5177')
  .split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true);
    else cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login',           loginLimiter);
app.use('/api/auth/forgot-password', loginLimiter);
app.use('/api/auth', authRouter);
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

if (IS_PROD) {
  const DIST = join(__dirname, '../frontend/dist');
  if (existsSync(DIST)) {
    app.use(express.static(DIST, { maxAge: '1y', immutable: true }));
  }
}

app.use('/api', requireAuth);

app.use('/api/accounts/:id/documents', documentsRouter);
app.use('/api/accounts',   accountsRouter);
app.use('/api/contacts',   contactsRouter);
app.use('/api/deals',      dealsRouter);
app.use('/api/users',      usersRouter);
app.use('/api/dolt',       doltRouter);
app.use('/api/prospects',        prospectsRouter);
app.use('/api/sequences',        sequencesRouter);
app.use('/api/marketing-leads',  marketingLeadsRouter);

if (IS_PROD) {
  const DIST = join(__dirname, '../frontend/dist');
  if (existsSync(DIST)) {
    app.get('*', (req, res) => res.sendFile(join(DIST, 'index.html')));
  }
}

// ── Database init ─────────────────────────────────────────────────────────────

const MIGRATIONS = [
  'migrate_meddic.sql',
  'migrate_prospecting.sql',
  'migrate_marketing_leads.sql',
];

async function runMigrations(conn) {
  for (const file of MIGRATIONS) {
    const [rows] = await conn.query(
      'SELECT 1 FROM schema_migrations WHERE filename = ?', [file]
    );
    if (rows.length > 0) continue;

    const filePath = join(__dirname, 'db', file);
    if (!existsSync(filePath)) { console.warn(`Migration file not found: ${file}`); continue; }

    const sql = readFileSync(filePath, 'utf8');
    // Split on semicolons but skip empty statements
    const stmts = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of stmts) {
      try {
        await conn.query(stmt);
      } catch (err) {
        const ignorable =
          err.code === 'ER_DUP_FIELDNAME' ||
          err.code === 'ER_TABLE_EXISTS_ERROR' ||
          /already exists/i.test(err.message);
        if (ignorable) {
          console.warn(`  skipped (already exists): ${stmt.slice(0, 80).replace(/\s+/g, ' ').trim()}`);
        } else {
          throw err;
        }
      }
    }
    await conn.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
    console.log(`  migration applied: ${file}`);
  }
}

async function initDatabase() {
  const db = process.env.DOLT_DATABASE || 'dolt_crm';

  // Bootstrap: connect without database to create it
  const bootstrap = await mysql.createConnection({
    host:     process.env.DOLT_HOST     || 'localhost',
    port:     parseInt(process.env.DOLT_PORT || '3307', 10),
    user:     process.env.DOLT_USER     || 'root',
    password: process.env.DOLT_PASSWORD || '',
    multipleStatements: false,
    ssl: process.env.DB_USE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${db}\``);
  await bootstrap.query(`USE \`${db}\``);

  const schemaSql = readFileSync(join(__dirname, 'db/schema.sql'), 'utf8');
  const statements = schemaSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    try {
      await bootstrap.query(stmt);
    } catch (err) {
      const ignorable =
        err.code === 'ER_DUP_FIELDNAME' ||
        err.code === 'ER_TABLE_EXISTS_ERROR' ||
        /already exists/i.test(err.message);
      if (!ignorable) throw err;
    }
  }

  // Run incremental migrations
  await runMigrations(bootstrap);

  // Seed admin user if no users
  const [urows] = await bootstrap.query('SELECT COUNT(*) AS n FROM users');
  if (urows[0].n === 0) {
    const hash = await bcrypt.hash('password123', 12);
    await bootstrap.query(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      ['james@dolthub.com', hash, 'James Wright', 'admin']
    );
    console.log('Admin user created: james@dolthub.com / password123');
  }

  // Check if we need to seed accounts
  const [rows] = await bootstrap.query('SELECT COUNT(*) AS n FROM accounts');
  if (rows[0].n === 0) {
    await seedData(bootstrap);
  }

  await bootstrap.end();
  console.log('Database ready.');
}

async function seedData(db) {
  console.log('Seeding initial data...');

  // Get admin user id
  const [urows] = await db.query('SELECT id FROM users LIMIT 1');
  const ownerId = urows[0]?.id || null;

  // 1. GasTown
  const [r1] = await db.query(
    'INSERT INTO accounts (company_name, segment, owner_id) VALUES (?, ?, ?)',
    ['GasTown', 'Coding Agents', ownerId]
  );
  await db.query(
    'INSERT INTO deals (deal_name, account_id, stage, probability) VALUES (?, ?, ?, ?)',
    ['GasTown', r1.insertId, 'Post-Sale', 100]
  );
  await db.query(
    'INSERT INTO notes (account_id, content) VALUES (?, ?)',
    [r1.insertId, '4 to 600 parallel agents use case']
  );

  // 2. Flock Safety
  const [r2] = await db.query(
    'INSERT INTO accounts (company_name, segment, owner_id) VALUES (?, ?, ?)',
    ['Flock Safety', 'App Builders', ownerId]
  );
  await db.query(
    'INSERT INTO deals (deal_name, account_id, stage, probability) VALUES (?, ?, ?, ?)',
    ['Flock Safety', r2.insertId, 'Post-Sale', 100]
  );

  // 3. EA / Flock Savy
  const [r3] = await db.query(
    'INSERT INTO accounts (company_name, segment, owner_id) VALUES (?, ?, ?)',
    ['EA / Flock Savy', 'App Builders', ownerId]
  );
  await db.query(
    'INSERT INTO deals (deal_name, account_id, stage, probability) VALUES (?, ?, ?, ?)',
    ['EA / Flock Savy', r3.insertId, 'Post-Sale', 100]
  );

  // 4. Turbine / Scorewarrior
  const [r4] = await db.query(
    'INSERT INTO accounts (company_name, segment, owner_id) VALUES (?, ?, ?)',
    ['Turbine / Scorewarrior', 'Agents for X', ownerId]
  );
  await db.query(
    'INSERT INTO deals (deal_name, account_id, stage, probability) VALUES (?, ?, ?, ?)',
    ['Turbine / Scorewarrior', r4.insertId, 'Post-Sale', 100]
  );

  // Dolt commit for seed data
  try {
    await db.query("CALL DOLT_ADD('.')");
    await db.query("CALL DOLT_COMMIT('-m', 'Initial CRM seed data: 4 known DoltHub customers')");
    console.log('Seed data committed to Dolt.');
  } catch (err) {
    console.warn('Dolt commit skipped (may not have changed rows):', err.message);
  }
}

async function start() {
  try {
    await initDatabase();
  } catch (err) {
    console.error('Database init error:', err.message);
    process.exit(1);
  }
  app.listen(PORT, () =>
    console.log(`DoltHub CRM API running on http://localhost:${PORT}`)
  );
}

start();
