// importEntriesFromJson.js
// importEntriesFromJson.js — ESM
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function toISO(d) {
  if (!d) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
    const [dd, mm, yyyy] = d.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }
  return d; // già ISO
}

const run = async () => {
  const p = path.join(__dirname, "data", "entries.json");
  if (!fs.existsSync(p)) {
    console.error("File non trovato:", p);
    process.exit(1);
  }
  const raw = fs.readFileSync(p, "utf8");
  const entries = JSON.parse(raw);
  let ok = 0;

  for (const e of entries) {
    const person = e.person ?? e.Persona ?? e.name;
    const cantiere = e.cantiere ?? e.Cantiere ?? e.site;
    const equipment = e.equipment ?? e.Equipment ?? "";
    const workType = e.workType ?? e["tipo di lavoro"] ?? e.work_type ?? "";
    const dateISO = toISO(e.date ?? e.work_date);
    const hours = Number(e.hours ?? e["ore lavorate"] ?? e.ore ?? 0);
    const notes = e.notes ?? null;

    if (!person || !cantiere || !equipment || !workType || !dateISO) continue;

    await db.query(
      `INSERT INTO entries (person,cantiere,equipment,work_type,work_date,hours,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [person, cantiere, equipment, workType, dateISO, hours, notes]
    );
    ok++;
  }

  console.log(`Import completato: ${ok}/${entries.length}`);
};

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
