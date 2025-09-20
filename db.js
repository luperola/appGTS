// db.js — ESM
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Heroku richiede SSL; in locale puoi disattivarlo con DATABASE_SSL=false
  ssl:
    process.env.DATABASE_SSL === "false"
      ? false
      : { rejectUnauthorized: false },
});

export default {
  query: (text, params) => pool.query(text, params),
};
