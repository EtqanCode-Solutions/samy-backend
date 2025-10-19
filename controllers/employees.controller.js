// src/controllers/employees.controller.js
import { Op } from "sequelize";
import { randomUUID } from "crypto";
import {
  EmployeeLocal as EmployeeLocalModel,
  EmployeeRemote as EmployeeRemoteModel,
} from "../models/employee.model.js";
import { getDual } from "../sync/dual.instance.js";

/* ===== Helpers ===== */

// استخرج أعلى EMP-XYZ وأرجع التالي
async function nextEmployeeCode() {
  const rows = await EmployeeLocalModel.findAll({
    attributes: ["code"],
    where: { code: { [Op.like]: "EMP-%" } },
    paranoid: false,
  });

  let max = 0;
  for (const r of rows) {
    const code = String(r.code || "");
    const m = code.match(/^EMP-(\d+)$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  const next = max + 1;
  return `EMP-${String(next).padStart(3, "0")}`;
}

function normalizeCreateBody(body) {
  const out = { ...body };

  // إلزاميّات
  const required = ["name","department","title","grade","phone","status","salary","hireDate"];
  for (const k of required) {
    if (out[k] === undefined || out[k] === null || out[k] === "")
      throw new Error(`Missing field: ${k}`);
  }
  if (!["active","resigned"].includes(out.status)) throw new Error("Invalid status");

  // UUID موحّد + نسخة أولى
  if (!out.id) out.id = randomUUID();
  if (!out.version) out.version = 1;

  // code
  if (!out.code || !/^EMP-\d{3,}$/.test(out.code)) {
    // هيتعين لاحقًا في create لو ناقص
  }

  // قيم افتراضية
  if (out.salary == null) out.salary = 0;
  if (out.manager === "") out.manager = null;
  if (!out.resignDate) out.resignDate = null;

  // صيغ التاريخ
  out.hireDate   = String(out.hireDate).slice(0,10);
  out.resignDate = out.resignDate ? String(out.resignDate).slice(0,10) : null;

  return out;
}

/* ===== Controllers ===== */

export const list = async (req, res) => {
  try {
    const {
      q = "",
      dept = "all",
      status = "all",
      sort = "name",
      limit = 200,
      offset = 0,
    } = req.query;

    const where = {};
    if (q) {
      const like = { [Op.like]: `%${q}%` };
      where[Op.or] = [
        { code: like }, { name: like }, { phone: like },
        { department: like }, { title: like },
      ];
    }
    if (dept !== "all")   where.department = dept;
    if (status !== "all") where.status = status;

    const order =
      sort === "hireDesc"   ? [["hireDate","DESC"]] :
      sort === "salaryDesc" ? [["salary", "DESC"]] :
      [["name", "ASC"]];

    const rows = await EmployeeLocalModel.findAll({
      where, order, limit: +limit, offset: +offset,
    });

    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const getOne = async (req, res) => {
  const row = await EmployeeLocalModel.findByPk(req.params.id, { paranoid: false });
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(row);
};

export const create = async (req, res) => {
  try {
    let payload = normalizeCreateBody(req.body);

    let code = payload.code;
    if (!code || !/^EMP-\d{3,}$/.test(code)) {
      code = await nextEmployeeCode();
    }
    payload = { ...payload, code };

    const dual = getDual();
    const result = await dual.writeBoth(
      EmployeeLocalModel,
      EmployeeRemoteModel,
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
    const row = await EmployeeLocalModel.findByPk(id);
    if (!row) return res.status(404).json({ message: "Not found" });

    // تحضير النسخة والكود
    const nextVersion = (row.version || 1) + 1;

    let code = req.body?.code ?? row.code;
    if (!code || !/^EMP-\d{3,}$/.test(code)) {
      code = /^EMP-\d{3,}$/.test(row.code || "") ? row.code : await nextEmployeeCode();
    }

    const payload = {
      ...req.body,
      code,
      version: nextVersion,
      updatedAt: new Date(),
    };

    const dual = getDual();
    const result = await dual.writeBoth(
      EmployeeLocalModel,
      EmployeeRemoteModel,
      "update",
      id,
      payload,
      { id }
    );

    const updated = await EmployeeLocalModel.findByPk(id);
    res.json({ ...updated.toJSON(), _sync: { mode: result.mode, queued: !!result.queued } });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

export const remove = async (req, res) => {
  try {
    const id = req.params.id;
    const row = await EmployeeLocalModel.findByPk(id);
    if (!row) return res.status(404).json({ message: "Not found" });

    const dual = getDual();
    const result = await dual.writeBoth(
      EmployeeLocalModel,
      EmployeeRemoteModel,
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
