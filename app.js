// app.js — versione ESM con Postgres per /api/entries
import "dotenv/config";

import path from "path";
import fs from "fs";
import express from "express";
import { fileURLToPath } from "url";
import db from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ===== Middleware base =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// PRIMA di app.use(express.static(...))
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Statici: /public (index.html, main.js, styles.css, ecc.)
app.use(express.static("public"));

// (Facoltativo) Servi anche i file seed in /data (es. operators.xlsx)
app.use("/data", express.static("data"));

// ===== Helpers =====
function toISO(d) {
  // Converte "DD/MM/YYYY" -> "YYYY-MM-DD"; se è già ISO, la lascia così
  if (!d) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
    const [dd, mm, yyyy] = d.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }
  return d;
}

// ===== ROUTES API =====

// GET tutte le entries (dal DB)
app.get("/api/entries", async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, person, cantiere, equipment,
              work_type AS "workType",
              to_char(work_date,'DD/MM/YYYY') AS date,
              hours, notes
       FROM entries
       ORDER BY work_date DESC, id DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST nuova entry (inserisce nel DB)
app.post("/api/entries", async (req, res, next) => {
  try {
    const { person, cantiere, equipment, workType, date, hours, notes } =
      req.body;

    if (!person || !cantiere || !equipment || !workType || !date) {
      return res.status(400).json({ error: "Campi obbligatori mancanti" });
    }

    const iso = toISO(date);
    const h = Number(hours || 0);

    const { rows } = await db.query(
      `INSERT INTO entries (person, cantiere, equipment, work_type, work_date, hours, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, person, cantiere, equipment,
                 work_type AS "workType",
                 to_char(work_date,'DD/MM/YYYY') AS date,
                 hours, notes`,
      [person, cantiere, equipment, workType, iso, h, notes || null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE entry per id (dal DB)
app.delete("/api/entries/:id", async (req, res, next) => {
  try {
    await db.query(`DELETE FROM entries WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.get("/api/operators", async (_req, res, next) => {
  try {
    const xlsxPath = path.join(__dirname, "data", "operators.xlsx");
    if (fs.existsSync(xlsxPath)) {
      // usa ExcelJS solo se il file esiste
      const mod = await import("exceljs");
      const ExcelJS = mod.default || mod;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(xlsxPath);
      const ws = wb.worksheets[0];
      const names = [];
      if (ws) {
        ws.eachRow((row, i) => {
          const v = (row.getCell(1).value ?? "").toString().trim();
          if (!v) return;
          const header = ["persona", "person", "name", "operatore", "operator"];
          if (i === 1 && header.includes(v.toLowerCase())) return;
          if (!names.includes(v)) names.push(v);
        });
      }
      return res.set("Cache-Control", "no-store").json(names);
    }

    // fallback: DB DISTINCT
    const { rows } = await db.query(
      `SELECT DISTINCT person FROM entries ORDER BY person`
    );
    return res.set("Cache-Control", "no-store").json(rows.map((r) => r.person));
  } catch (err) {
    next(err);
  }
});

// ===== Rotte di servizio =====

// Healthcheck
app.get("/health", (_req, res) => res.type("text/plain").send("OK"));

// Sopprimi 404 favicon nei log
app.get("/favicon.ico", (_req, res) => res.status(204).end());

// (Opzionale) Redirect a dominio personalizzato (decommenta e imposta il tuo dominio)
/*
app.use((req, res, next) => {
  const canonical = process.env.CANONICAL_HOST; // es. "appgts.semiconductor-materials.it"
  if (canonical && req.headers.host && req.headers.host !== canonical) {
    return res.redirect(301, `https://${canonical}${req.url}`);
  }
  next();
});
*/

// POST /login  => { ok:true, token:"admin" } se credenziali ok
app.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  const ok =
    username === (process.env.ADMIN_USER || "") &&
    password === (process.env.ADMIN_PASS || "");
  if (!ok)
    return res.status(401).json({ ok: false, error: "Credenziali errate" });
  res.json({ ok: true, token: "admin" }); // token statico minimale
});

// alias: /api/login -> /login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const ok =
    username === (process.env.ADMIN_USER || "") &&
    password === (process.env.ADMIN_PASS || "");
  if (!ok)
    return res.status(401).json({ ok: false, error: "Credenziali errate" });
  res.json({ ok: true, token: "admin" });
});

function authAdmin(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (key === "admin") return next();
  return res.status(401).json({ error: "unauthorized" });
}

// Esempio: cancellazione consentita solo ad admin
app.delete("/api/entries/:id", authAdmin, async (req, res, next) => {
  try {
    await db.query("DELETE FROM entries WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ===== Error handler unico =====
app.use((err, _req, res, _next) => {
  console.error("API error:", err);
  res.status(500).json({ error: "Errore interno" });
});

// ===== Avvio server (Heroku fornisce PORT) =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server on ${PORT}`);
});
