// routes/admin.routes.js
import { Router } from "express";
import { syncOnce } from "../sync/sync.service.js";
import { CustomerLocal, CustomerRemote } from "../models/customer.model.js";
import { mysql } from "../database.js";

const r = Router();

r.get("/status", async (_req, res) => {
  try {
    await mysql.authenticate();
    res.json({ mysql: "online" });
  } catch {
    res.json({ mysql: "offline" });
  }
});

r.post("/sync", async (_req, res) => {
  try {
    const result = await syncOnce();
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

r.get("/counts", async (_req, res) => {
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

export default r;
