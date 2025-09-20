import express from "express";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import ExcelJS from "exceljs";
import xlsx from "xlsx";
import { fileURLToPath } from "url";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const ENTRIES_PATH = path.join(DATA_DIR, "entries.json");
const OPERATORS_XLSX = path.join(DATA_DIR, "operators.xlsx");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

function ensureEntriesFile() {
  if (!fs.existsSync(ENTRIES_PATH)) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(ENTRIES_PATH, JSON.stringify([]), "utf-8");
  }
}
function loadEntries() {
  ensureEntriesFile();
  return JSON.parse(fs.readFileSync(ENTRIES_PATH, "utf-8"));
}
function saveEntries(entries) {
  fs.writeFileSync(ENTRIES_PATH, JSON.stringify(entries, null, 2), "utf-8");
}
function readOperators() {
  if (!fs.existsSync(OPERATORS_XLSX)) return [];
  const wb = xlsx.readFile(OPERATORS_XLSX);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });
  return rows.map((r) => (r.OPERATORI || "").toString().trim()).filter(Boolean);
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Token mancante" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "devsecret");
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token non valido" });
  }
}

app.get("/api/operators", (req, res) =>
  res.json({ operators: readOperators() })
);

app.post("/api/entry", (req, res) => {
  const { operator, macchina, linea, ore, data, descrizione } = req.body;
  if (!operator || !macchina || !linea || !ore || !data || !descrizione) {
    return res.status(400).json({ error: "Tutti i campi sono obbligatori." });
  }
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
    return res
      .status(400)
      .json({ error: "Formato data non valido (usa DD/MM/YYYY)." });
  }
  const numOre = Number(ore);
  if (!isFinite(numOre) || numOre <= 0)
    return res.status(400).json({ error: "Ore deve essere un numero > 0." });

  const entry = {
    id: Date.now(),
    operator,
    macchina,
    linea,
    ore: numOre,
    data,
    descrizione,
    createdAt: new Date().toISOString(),
  };
  const entries = loadEntries();
  entries.push(entry);
  saveEntries(entries);
  res.json({ ok: true, entry });
});

app.post("/api/login", (req, res) => {
  const { user, pass } = req.body;
  if (
    user === (process.env.ADMIN_USER || "admin") &&
    pass === (process.env.ADMIN_PASS || "GTSTrack")
  ) {
    const token = jwt.sign(
      { role: "admin", user },
      process.env.JWT_SECRET || "devsecret",
      { expiresIn: "12h" }
    );
    return res.json({ token });
  }
  return res.status(401).json({ error: "Credenziali non valide." });
});

// --------- Filtri condivisi ----------
function applyFilters(
  list,
  { macchina, linea, operator, descrContains, dataFrom, dataTo } = {}
) {
  const parseIt = (it) => {
    const [d, m, y] = (it || "").split("/").map(Number);
    return new Date(y || 0, (m || 1) - 1, d || 1);
  };
  let entries = [...list];
  if (macchina) entries = entries.filter((e) => e.macchina === macchina);
  if (linea) entries = entries.filter((e) => e.linea === linea);
  if (operator) entries = entries.filter((e) => e.operator === operator);
  if (descrContains) {
    const needle = String(descrContains).toLowerCase();
    entries = entries.filter((e) =>
      String(e.descrizione || "")
        .toLowerCase()
        .includes(needle)
    );
  }
  if (dataFrom)
    entries = entries.filter((e) => parseIt(e.data) >= parseIt(dataFrom));
  if (dataTo)
    entries = entries.filter((e) => parseIt(e.data) <= parseIt(dataTo));
  return entries;
}

app.post("/api/entries/search", authMiddleware, (req, res) => {
  const filtered = applyFilters(loadEntries(), req.body || {});
  res.json({ entries: filtered });
});

// --- cancellazione filtrati ---
app.post("/api/entries/delete", authMiddleware, (req, res) => {
  const all = loadEntries();
  const toDelete = new Set(applyFilters(all, req.body || {}).map((e) => e.id));
  if (toDelete.size === 0) return res.json({ deleted: 0 });
  const remaining = all.filter((e) => !toDelete.has(e.id));
  saveEntries(remaining);
  res.json({ deleted: toDelete.size });
});

// --- cancellazione TUTTI ---
app.delete("/api/entries/all", authMiddleware, (req, res) => {
  const count = loadEntries().length;
  saveEntries([]);
  res.json({ deleted: count });
});

// === NUOVO: cancellazione singola riga per id ===
app.delete("/api/entries/:id", authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id))
    return res.status(400).json({ error: "ID non valido" });

  const entries = loadEntries();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return res.status(404).json({ error: "Record non trovato" });

  entries.splice(idx, 1);
  saveEntries(entries);
  res.json({ deleted: 1 });
});

// --- export CSV/XLSX (immutati) ---
import ExcelJSModule from "exceljs"; // per sicurezza con bundler
app.post("/api/export/csv", authMiddleware, (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries))
    return res.status(400).json({ error: "entries mancanti" });
  const headers = [
    "Operatore",
    "Macchina",
    "Linea",
    "Ore Lavorate",
    "Data (DD/MM/YYYY)",
    "Descrizione lavoro",
  ];
  const lines = [headers.join(";")];
  for (const e of entries) {
    const row = [
      e.operator,
      e.macchina,
      e.linea,
      e.ore,
      e.data,
      (e.descrizione || "").replace(/\r?\n/g, " "),
    ].map((v) => (typeof v === "string" ? `"${v.replaceAll('"', '""')}"` : v));
    lines.push(row.join(";"));
  }
  const csv = lines.join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=report.csv");
  res.send(csv);
});

app.post("/api/export/xlsx", authMiddleware, async (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries))
    return res.status(400).json({ error: "entries mancanti" });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Report");
  ws.columns = [
    { header: "Operatore", key: "operator", width: 28 },
    { header: "Macchina", key: "macchina", width: 16 },
    { header: "Linea", key: "linea", width: 16 },
    { header: "Ore Lavorate", key: "ore", width: 16 },
    { header: "Data (DD/MM/YYYY)", key: "data", width: 18 },
    { header: "Descrizione lavoro", key: "descrizione", width: 60 },
  ];
  entries.forEach((e) => ws.addRow(e));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { horizontal: "center" };
  ws.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      if (rowNumber > 1 && cell._column && cell._column.key === "ore")
        cell.numFmt = "0.00";
    });
  });
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", "attachment; filename=report.xlsx");
  await wb.xlsx.write(res);
  res.end();
});

app.listen(PORT, () => console.log("Server su http://localhost:" + PORT));
