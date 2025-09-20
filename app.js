// app.js — versione ESM con Postgres per /api/entries

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

// GET operators — legge data/operators.xlsx (prima colonna) se presente
app.get("/api/operators", async (req, res) => {
  try {
    const xlsxPath = path.join(__dirname, "data", "operators.xlsx");
    if (!fs.existsSync(xlsxPath)) {
      return res.json([]); // file assente: restituisci array vuoto
    }

    // import dinamico per non rompere se exceljs non è installato
    let ExcelJS;
    try {
      const mod = await import("exceljs");
      ExcelJS = mod.default || mod;
    } catch {
      return res.json([]); // exceljs non disponibile
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(xlsxPath);
    const ws = wb.worksheets[0];
    if (!ws) return res.json([]);

    const names = [];
    ws.eachRow((row, rowNumber) => {
      const val = (row.getCell(1).value ?? "").toString().trim();
      if (!val) return;
      const headerCandidates = [
        "persona",
        "person",
        "name",
        "operatore",
        "operator",
      ];
      if (rowNumber === 1 && headerCandidates.includes(val.toLowerCase()))
        return; // salta header
      if (!names.includes(val)) names.push(val);
    });

    res.json(names);
  } catch {
    res.json([]);
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
