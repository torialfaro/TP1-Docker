const express = require("express");
const mysql = require("mysql2/promise");

const app = express();
app.use(express.json());

const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

// Pool reutilizable (se inicializa al primer uso)
let pool = null;

async function getPool() {
  if (!pool) {
    pool = mysql.createPool({ ...dbConfig, waitForConnections: true, connectionLimit: 10 });
  }
  return pool;
}

// ── Crear tabla items si no existe (se ejecuta al arrancar) ───────────────────
async function initSchema() {
  try {
    const p = await getPool();
    await p.execute(`
      CREATE TABLE IF NOT EXISTS items (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        nombre     VARCHAR(255) NOT NULL,
        created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Esquema inicializado");
  } catch (err) {
    console.error("No se pudo inicializar esquema (la DB puede no estar lista aún):", err.message);
  }
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "API activa",
    timestamp: new Date().toISOString(),
  });
});

app.get("/db-status", async (_req, res) => {
  try {
    const p = await getPool();
    const [[row]] = await p.execute("SELECT NOW() AS ahora");
    res.json({
      status: "ok",
      db_connected: true,
      db_time: row.ahora,
      host: dbConfig.host,
      database: dbConfig.database,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      db_connected: false,
      message: err.message,
    });
  }
});

app.post("/items", async (req, res) => {
  const { nombre } = req.body;
  if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
    return res.status(400).json({ status: "error", message: 'El campo "nombre" es requerido' });
  }
  try {
    const p = await getPool();
    const [result] = await p.execute("INSERT INTO items (nombre) VALUES (?)", [nombre.trim()]);
    const [[item]] = await p.execute("SELECT * FROM items WHERE id = ?", [result.insertId]);
    res.status(201).json({ status: "ok", item });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get("/items", async (_req, res) => {
  try {
    const p = await getPool();
    const [rows] = await p.execute("SELECT * FROM items ORDER BY created_at DESC");
    res.json({ status: "ok", count: rows.length, items: rows });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
  await initSchema();
});
