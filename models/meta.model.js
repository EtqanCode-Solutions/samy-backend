// models/meta.model.js
import { DataTypes } from "sequelize";
import { sqlite, mysql } from "../database.js";

/** جدول meta محلي (SQLite) */
export const MetaLocal = sqlite.define(
  "Meta",
  {
    key:   { type: DataTypes.STRING, primaryKey: true },
    value: { type: DataTypes.TEXT,   allowNull: false },
  },
  { tableName: "meta", timestamps: false }
);

/** اختياري: نفس الجدول على MySQL لو حابب تخزّن هناك كمان */
export const MetaRemote = mysql.define(
  "Meta",
  {
    key:   { type: DataTypes.STRING, primaryKey: true },
    value: { type: DataTypes.TEXT,   allowNull: false },
  },
  { tableName: "meta", timestamps: false }
);

/** APIs بسيطة للقراءة/الكتابة من المحلي */
export async function getMeta(key, fallback = null) {
  const row = await MetaLocal.findByPk(key);
  return row ? row.get("value") : fallback;
}

export async function setMeta(key, value) {
  await MetaLocal.upsert({ key, value: String(value) });
}
