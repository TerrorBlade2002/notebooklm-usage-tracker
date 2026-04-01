// Catch everything at the process level so we never silently die
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});

console.log("=== SERVER STARTING ===");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT env:", process.env.PORT);
console.log("DATABASE_URL set:", !!process.env.DATABASE_URL);

const express = require("express");
const cors = require("cors");
const path = require("path");

let db;
try {
  db = require("./db");
  console.log("db.js loaded OK");
} catch (e) {
  console.error("db.js failed to load:", e.message);
  db = {
    pool: null,
    initializeDatabase: async () => { throw new Error("DB module failed to load"); },
    logInteraction: async () => { throw new Error("DB unavailable"); },
    getFilteredLogs: async () => [],
    getStats: async () => [],
    getUniqueNotebookNames: async () => [],
    getUniqueUsernames: async () => [],
  };
}

const app = express();
const PORT = process.env.PORT || 3001;
let dbReady = false;

app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    db_ready: dbReady,
    port: PORT,
  });
});

// ---- POST /api/log - Receive logs from Chrome Extension ----
app.post("/api/log", async (req, res) => {
  try {
    const { session_id, system_username, notebook_name, notebook_id,
      turn_number, first_question_summary, current_question_summary,
      idempotency_key, timestamp } = req.body;

    if (!notebook_name || !notebook_id || !idempotency_key) {
      return res.status(400).json({ error: "Missing required fields: notebook_name, notebook_id, idempotency_key" });
    }

    const result = await db.logInteraction(req.body);
    if (result.duplicate) {
      return res.json({ success: true, duplicate: true, message: "Already logged" });
    }
    res.status(201).json({ success: true, id: result.id, created_at: result.created_at });
  } catch (error) {
    console.error("Log error:", error);
    res.status(500).json({ error: "Failed to log interaction" });
  }
});

// ---- GET /api/reports - Filtered logs for dashboard ----
app.get("/api/reports", async (req, res) => {
  try {
    const { from, to, notebook_name, system_username, limit, offset } = req.query;
    const logs = await db.getFilteredLogs({
      from: from || null, to: to || null,
      notebook_name: notebook_name || null,
      system_username: system_username || null,
      limit: parseInt(limit) || 1000, offset: parseInt(offset) || 0,
    });
    res.json({ count: logs.length, logs });
  } catch (error) {
    console.error("Reports error:", error);
    res.status(500).json({ error: "Failed to get reports" });
  }
});

// ---- GET /api/reports/csv - Download CSV ----
app.get("/api/reports/csv", async (req, res) => {
  try {
    const { from, to, notebook_name, system_username } = req.query;
    const logs = await db.getFilteredLogs({
      from: from || null, to: to || null,
      notebook_name: notebook_name || null,
      system_username: system_username || null,
      limit: 50000, offset: 0,
    });

    const headers = [
      "ID", "Session ID", "System Username", "Notebook Name", "Notebook ID",
      "Turn Number", "First Question Summary", "Current Question Summary",
      "Idempotency Key", "Timestamp", "Created At"
    ];
    const csvRows = [headers.join(",")];

    for (const row of logs) {
      csvRows.push([
        row.id,
        row.session_id,
        `"${(row.system_username || "").replace(/"/g, '""')}"`,
        `"${(row.notebook_name || "").replace(/"/g, '""')}"`,
        row.notebook_id,
        row.turn_number,
        `"${(row.first_question_summary || "").replace(/"/g, '""')}"`,
        `"${(row.current_question_summary || "").replace(/"/g, '""')}"`,
        row.idempotency_key,
        row.timestamp,
        row.created_at,
      ].join(","));
    }

    const filename = `nlm-usage-report-${new Date().toISOString().split("T")[0]}.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csvRows.join("\n"));
  } catch (error) {
    console.error("CSV error:", error);
    res.status(500).json({ error: "Failed to generate CSV" });
  }
});

// ---- GET /api/stats - Aggregated stats ----
app.get("/api/stats", async (req, res) => {
  try {
    const { from, to } = req.query;
    const stats = await db.getStats({ from: from || null, to: to || null });
    res.json({ stats });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// ---- GET /api/filters - Get unique filter values ----
app.get("/api/filters", async (req, res) => {
  try {
    const [notebookNames, usernames] = await Promise.all([
      db.getUniqueNotebookNames(), db.getUniqueUsernames()
    ]);
    res.json({ notebook_names: notebookNames, usernames });
  } catch (error) {
    res.status(500).json({ error: "Failed to get filters" });
  }
});

// Serve dashboard
app.use("/dashboard", express.static(path.join(__dirname, "dashboard")));
app.get("/", (req, res) => res.redirect("/dashboard"));

// ---- DELETE /api/admin/reset - Clear all logs (requires secret) ----
app.delete("/api/admin/reset", async (req, res) => {
  const secret = req.headers["x-admin-secret"];
  if (secret !== (process.env.ADMIN_SECRET || "astraglobal-nlm-reset-2026")) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  try {
    const result = await db.pool.query("DELETE FROM conversation_logs");
    await db.pool.query("ALTER SEQUENCE conversation_logs_id_seq RESTART WITH 1");
    res.json({ success: true, deleted: result.rowCount });
  } catch (error) {
    console.error("Reset error:", error);
    res.status(500).json({ error: "Failed to reset" });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ---- START ----
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`=== SERVER LISTENING on 0.0.0.0:${PORT} ===`);
});

server.on("error", (err) => {
  console.error("Server listen error:", err);
});

// DB init - non-blocking, retries forever
const initDb = async () => {
  try {
    await db.initializeDatabase();
    if (!dbReady) console.log("=== DATABASE READY ===");
    dbReady = true;
  } catch (e) {
    dbReady = false;
    console.error("DB init failed (will retry in 15s):", e.message || e);
  }
};

initDb();
setInterval(initDb, 15000);
