// src/controllers/customers.controller.js
import { Op } from "sequelize";
import { randomUUID } from "crypto";
import {
  CustomerLocal as CustomerLocalModel,
  CustomerRemote as CustomerRemoteModel,
} from "../models/customer.model.js";
import { getDual } from "../sync/dual.instance.js";

// ===== Helpers =====

// استخرج أعلى رقم من C-XYZ وأرجع التالي
async function nextCustomerCode() {
  const rows = await CustomerLocalModel.findAll({
    attributes: ["code"],
    where: { code: { [Op.like]: "C-%" } },
  });

  let max = 0;
  for (const r of rows) {
    const code = (r.code || "").toString();
    const m = code.match(/^C-(\d+)$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  const next = max + 1;
  return `C-${String(next).padStart(3, "0")}`;
}

function normalizeCreateBody(body) {
  const out = { ...body };
  if (!out.id) out.id = randomUUID();  // UUID موحّد للجنبين
  if (!out.version) out.version = 1;   // نسخة أولى
  if (out.totalPaid == null) out.totalPaid = 0;
  if (out.totalDebt == null) out.totalDebt = 0;
  return out;
}

// ===== Controllers =====

export const list = async (req, res) => {
  try {
    const { q = "", debt = "all", sort = "name", limit = 100, offset = 0 } = req.query;

    const where = {};
    if (q) {
      const like = { [Op.like]: `%${q}%` };
      where[Op.or] = [{ code: like }, { name: like }, { phone: like }, { subject: like }];
    }
    if (debt === "hasDebt") where.totalDebt = { [Op.gt]: 0 };
    if (debt === "noDebt") where.totalDebt = { [Op.lte]: 0 };

    const order =
      sort === "debtDesc" ? [["totalDebt", "DESC"]] :
      sort === "paidDesc" ? [["totalPaid", "DESC"]] :
      [["name", "ASC"]];

    const rows = await CustomerLocalModel.findAll({ where, order, limit: +limit, offset: +offset });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const getOne = async (req, res) => {
  const row = await CustomerLocalModel.findByPk(req.params.id);
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(row);
};

export const create = async (req, res) => {
  try {
    let code = req.body?.code;
    if (!code || !/^C-\d{3,}$/.test(code)) {
      code = await nextCustomerCode();
    }

    const payload = normalizeCreateBody({ ...req.body, code });
    const dual = getDual();

    const result = await dual.writeBoth(
      CustomerLocalModel,
      CustomerRemoteModel,
      "create",
      payload.id,
      payload
    );

    res.status(201).json({ ...payload, _sync: { mode: result.mode, queued: !!result.queued } });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

export const update = async (req, res) => {
  try {
    const id = req.params.id;
    const row = await CustomerLocalModel.findByPk(id);
    if (!row) return res.status(404).json({ message: "Not found" });

    const dual = getDual();
    const nextVersion = (row.version || 1) + 1;

    let code = req.body?.code ?? row.code;
    if (!code || !/^C-\d{3,}$/.test(code)) {
      code = /^C-\d{3,}$/.test(row.code || "") ? row.code : await nextCustomerCode();
    }

    const payload = {
      ...req.body,
      code,
      version: nextVersion,
      updatedAt: new Date(),
    };

    const result = await dual.writeBoth(
      CustomerLocalModel,
      CustomerRemoteModel,
      "update",
      id,
      payload,
      { id }
    );

    const updated = await CustomerLocalModel.findByPk(id);
    res.json({ ...updated.toJSON(), _sync: { mode: result.mode, queued: !!result.queued } });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

export const remove = async (req, res) => {
  try {
    const id = req.params.id;
    const row = await CustomerLocalModel.findByPk(id);
    if (!row) return res.status(404).json({ message: "Not found" });

    const dual = getDual();
    const result = await dual.writeBoth(
      CustomerLocalModel,
      CustomerRemoteModel,
      "delete",
      id,
      undefined,
      { id }
    );

    res.json({ ok: true, _sync: { mode: result.mode, queued: !!result.queued } });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};
