// database.js
import { Sequelize } from "sequelize";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql2 from "mysql2/promise";

// تأكد وجود قاعدة MySQL لو مش موجودة
export async function ensureMySQLDatabase() {
  const DB = process.env.MYSQL_DB || "etqan_daftr";
  const conn = await mysql2.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASS || "",
    multipleStatements: true,
  });
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  );
  await conn.end();
}

export const mysql = new Sequelize(
  process.env.MYSQL_DB || "etqan_daftr",
  process.env.MYSQL_USER || "root",
  process.env.MYSQL_PASS || "",
  {
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    dialect: "mysql",
    logging: false,
  }
);

// SQLite absolute path + ensure folder
const rel = process.env.SQLITE_STORAGE || "./data/app.sqlite";
export const SQLITE_PATH = path.resolve(process.cwd(), rel);
const dir = path.dirname(SQLITE_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

export const sqlite = new Sequelize({
  dialect: "sqlite",
  storage: SQLITE_PATH,
  logging: false,
});
