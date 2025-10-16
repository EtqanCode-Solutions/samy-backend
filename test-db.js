// test-db.js
import { mysql, sqlite } from "./database.js";

const check = async (name, conn) => {
  try {
    await conn.authenticate();
    console.log(`✅ Connected to ${name}`);
  } catch (e) {
    console.error(`❌ ${name} connection failed:`, e.message);
    process.exitCode = 1;
  }
};

await check("MySQL", mysql);
await check("SQLite", sqlite);

process.exit(); // خروج نظيف بعد الاختبار
