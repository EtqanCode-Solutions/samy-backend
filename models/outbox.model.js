// src/models/outbox.model.js
import { DataTypes, Model } from "sequelize";

export class OutboxLocal extends Model {}

export function initOutboxLocal(sqlite) {
  OutboxLocal.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      table: { type: DataTypes.STRING(64), allowNull: false },   // مثال: 'customers'
      op: { type: DataTypes.ENUM("create", "update", "delete"), allowNull: false },
      pk: { type: DataTypes.STRING(64), allowNull: false },      // المفتاح الأساسي
      payload: { type: DataTypes.JSON, allowNull: true },        // بيانات العملية
      version: { type: DataTypes.INTEGER, allowNull: true },     // اختياري
    },
    {
      sequelize: sqlite,
      modelName: "OutboxLocal",
      tableName: "outbox_local",
      timestamps: true,
      paranoid: false,
    }
  );
  return OutboxLocal;
}
