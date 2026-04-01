const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL is not set. DB operations will fail until it is configured.");
}

const dbUrl = process.env.DATABASE_URL || "";
const useSSL = dbUrl.includes("railway.app") || dbUrl.includes("railway.internal");

const pool = new Pool({
  connectionString: dbUrl || undefined,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
});

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_logs (
        id SERIAL PRIMARY KEY,
        session_id TEXT,
        system_username TEXT,
        notebook_name TEXT NOT NULL,
        notebook_id TEXT NOT NULL,
        turn_number INTEGER,
        first_question_summary TEXT,
        current_question_summary TEXT,
        idempotency_key TEXT UNIQUE NOT NULL,
        timestamp TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_logs_notebook_name ON conversation_logs (notebook_name);
      CREATE INDEX IF NOT EXISTS idx_logs_system_username ON conversation_logs (system_username);
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON conversation_logs (timestamp);
      CREATE INDEX IF NOT EXISTS idx_logs_idempotency ON conversation_logs (idempotency_key);
    `);
    console.log("Database initialized successfully");
  } finally {
    client.release();
  }
}

async function logInteraction(data) {
  const {
    session_id, system_username, notebook_name, notebook_id,
    turn_number, first_question_summary, current_question_summary,
    idempotency_key, timestamp,
  } = data;

  // Check for duplicate via idempotency key
  const existing = await pool.query(
    "SELECT id FROM conversation_logs WHERE idempotency_key = $1",
    [idempotency_key]
  );
  if (existing.rows.length > 0) {
    return { duplicate: true, id: existing.rows[0].id };
  }

  const result = await pool.query(
    `INSERT INTO conversation_logs
      (session_id, system_username, notebook_name, notebook_id,
       turn_number, first_question_summary, current_question_summary,
       idempotency_key, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, created_at`,
    [
      session_id, system_username, notebook_name, notebook_id,
      turn_number || 0, first_question_summary, current_question_summary,
      idempotency_key, timestamp || new Date().toISOString(),
    ]
  );
  return { id: result.rows[0].id, created_at: result.rows[0].created_at };
}

async function getFilteredLogs({ from, to, notebook_name, system_username, limit, offset }) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (from) {
    conditions.push(`timestamp >= $${idx++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`timestamp <= $${idx++}`);
    params.push(to);
  }
  if (notebook_name) {
    conditions.push(`notebook_name = $${idx++}`);
    params.push(notebook_name);
  }
  if (system_username) {
    conditions.push(`system_username = $${idx++}`);
    params.push(system_username);
  }

  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
  const query = `SELECT * FROM conversation_logs ${where} ORDER BY timestamp DESC LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
}

async function getStats({ from, to }) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (from) {
    conditions.push(`timestamp >= $${idx++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`timestamp <= $${idx++}`);
    params.push(to);
  }

  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
  const query = `
    SELECT
      notebook_name,
      COUNT(*) AS total_interactions,
      COUNT(DISTINCT system_username) AS unique_users,
      COUNT(DISTINCT session_id) AS total_sessions
    FROM conversation_logs
    ${where}
    GROUP BY notebook_name
    ORDER BY total_interactions DESC
  `;

  const result = await pool.query(query, params);
  return result.rows;
}

async function getUniqueNotebookNames() {
  const result = await pool.query(
    "SELECT DISTINCT notebook_name FROM conversation_logs ORDER BY notebook_name"
  );
  return result.rows.map((r) => r.notebook_name);
}

async function getUniqueUsernames() {
  const result = await pool.query(
    "SELECT DISTINCT system_username FROM conversation_logs WHERE system_username IS NOT NULL ORDER BY system_username"
  );
  return result.rows.map((r) => r.system_username);
}

module.exports = {
  pool,
  initializeDatabase,
  logInteraction,
  getFilteredLogs,
  getStats,
  getUniqueNotebookNames,
  getUniqueUsernames,
};
