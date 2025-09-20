// migrate.js — ESM
import db from "./db.js";

const run = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS entries (
      id SERIAL PRIMARY KEY,
      person     TEXT NOT NULL,
      cantiere   TEXT NOT NULL,
      equipment  TEXT NOT NULL,
      work_type  TEXT NOT NULL,
      work_date  DATE NOT NULL,
      hours      NUMERIC(6,2) NOT NULL CHECK (hours >= 0),
      notes      TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_entries_date   ON entries(work_date DESC)`
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_entries_person ON entries(person)`
  );
  console.log("DB migrated ✔");
};

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
