import mysql from 'mysql2/promise';
import 'dotenv/config';

const sslConfig = process.env.DOLT_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {};

const pool = mysql.createPool({
  host:             process.env.DOLT_HOST     || 'localhost',
  port:             parseInt(process.env.DOLT_PORT || '3307', 10),
  user:             process.env.DOLT_USER     || 'root',
  password:         process.env.DOLT_PASSWORD || '',
  database:         process.env.DOLT_DATABASE || 'dolt_crm',
  waitForConnections: true,
  connectionLimit:  10,
  multipleStatements: false,
  ...sslConfig,
});

export default pool;

// Run fn(conn) with a dedicated connection, then DOLT_ADD + DOLT_COMMIT on same conn.
export async function withDoltCommit(fn, message, authorEmail) {
  const conn = await pool.getConnection();
  try {
    const result = await fn(conn);
    await conn.query("CALL DOLT_ADD('.')");
    const author = `${authorEmail} <${authorEmail}>`;
    await conn.query('CALL DOLT_COMMIT(?, ?, ?, ?)', ['-m', message, '--author', author]);
    return result;
  } finally {
    conn.release();
  }
}
