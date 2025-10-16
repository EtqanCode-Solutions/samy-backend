// database.js
import { Sequelize } from "sequelize";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

/* ===== MySQL ===== */
export const mysql = new Sequelize(
  process.env.MYSQL_DB || "etqan_db",
  process.env.MYSQL_USER || "root",
  process.env.MYSQL_PASS || "",
  {
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    dialect: "mysql",
    logging: false,
  }
);

/* ===== SQLite ===== */
const sqlitePath = process.env.SQLITE_STORAGE || "./data/app.sqlite";
const dir = path.dirname(sqlitePath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

export const sqlite = new Sequelize({
  dialect: "sqlite",
  storage: sqlitePath,
  logging: false,
});
