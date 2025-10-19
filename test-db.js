// test-db.js
import { mysql, sqlite, ensureMySQLDatabase, SQLITE_PATH } from "./database.js";

async function checkConnection(name, conn) {
  try {
    await conn.authenticate();
    console.log(`✅ Connected to ${name}`);
  } catch (e) {
    console.error(`❌ Failed to connect to ${name}:`, e.message);
  }
}

(async () => {
  console.log("SQLite file:", SQLITE_PATH);
  await ensureMySQLDatabase(); // ينشئ قاعدة etqan_daftr لو مش موجودة

  await checkConnection("SQLite", sqlite);
  await checkConnection("MySQL", mysql);

  process.exit();
})();
