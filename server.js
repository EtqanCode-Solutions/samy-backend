// src/server.js
import express from "express";
import cors from "cors";
import { sqlite, mysql } from "./database.js";
import { CustomerLocal, CustomerRemote } from "./models/customer.model.js";
import { MetaLocal, MetaRemote } from "./models/meta.model.js";
import customers from "./routes/customers.routes.js";

import { initOutboxLocal } from "./models/outbox.model.js";
import { DualWriteService } from "./sync/dualwrite.service.js";
import { setDual } from "./sync/dual.instance.js";
import { startOnlineMonitor } from "./sync/online-monitor.js";

import employees from "./routes/employees.routes.js";
import { EmployeeLocal, EmployeeRemote } from "./models/employee.model.js";



const app = express();
app.use(cors());
app.use(express.json());

// ===== Routes (APIs) =====
app.use("/api/customers", customers);
app.use("/api/employees", employees);


// ===== Databases =====
await sqlite.authenticate();
console.log("SQLite ready ✅");

// Init models (محلي)
await CustomerLocal.sync({ alter: true });
await EmployeeLocal.sync({ alter: true });

await MetaLocal.sync();
initOutboxLocal(sqlite);
await sqlite.sync(); // يضمن outbox_local

// MySQL (إن توفر)
try {
  await mysql.authenticate();
  await CustomerRemote.sync({ alter: true });
  await EmployeeRemote.sync({ alter: true });

  await MetaRemote.sync();
  console.log("MySQL ready ✅");
} catch {
  console.log("MySQL offline ⚠️");
}
console.log("DB ready ✅");

// ===== Dual-Write instance + singleton (بدون circular import) =====
const dual = new DualWriteService(sqlite, mysql);
setDual(dual);

// ===== Admin endpoints =====
app.get("/admin/status", async (_req, res) => {
  // فحص لحظي لحالة MySQL
  let mysqlState = "offline";
  try {
    await mysql.authenticate();
    mysqlState = "online";
  } catch {}
  res.json({
    sqlite: sqlite.options?.storage || "sqlite",
    mysql: mysqlState,
  });
});

app.get("/admin/counts", async (_req, res) => {
  try {
    const [lc, rc] = await Promise.all([
      CustomerLocal.count({ paranoid: false }),
      CustomerRemote.count({ paranoid: false }).catch(() => null),
    ]);
    res.json({ sqlite: lc, mysql: rc });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.post("/admin/sync", async (_req, res) => {
  try {
    const result = await dual.flushOutbox(CustomerLocal, CustomerRemote);
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ===== Auto Online Monitor: Flush تلقائي عند عودة MySQL =====
startOnlineMonitor({
  mysql,
  dual,
  pairs: [
    [CustomerLocal, CustomerRemote],
    [EmployeeLocal, EmployeeRemote], // ← الموظفون
  ],
  onStateChange(isUp) {
    console.log(`[mysql] state => ${isUp ? "ONLINE ✅" : "OFFLINE ⚠️"}`);
  },
  intervalWhenOffline: 5_000,
  intervalWhenOnline: 30_000,
});
// (اختياري) health بسيط
app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server on http://localhost:" + PORT));
