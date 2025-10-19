// models/customer.model.js
import { DataTypes } from "sequelize";
import { sqlite, mysql } from "../database.js";

export function defineCustomer(sequelize) {
  const Customer = sequelize.define(
    "Customer",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      code: { type: DataTypes.STRING, allowNull: false, unique: true },
      name: { type: DataTypes.STRING, allowNull: false },
      subject: { type: DataTypes.STRING },
      customRate: { type: DataTypes.FLOAT, defaultValue: 0 },
      phone: { type: DataTypes.STRING },
      totalPaid: { type: DataTypes.FLOAT, defaultValue: 0 },
      totalDebt: { type: DataTypes.FLOAT, defaultValue: 0 },
      notes: { type: DataTypes.TEXT },

      // حقول المزامنة
      syncDirty: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      version:   { type: DataTypes.INTEGER,  allowNull: false, defaultValue: 0 },
    },
    {
      tableName: "customers",
      timestamps: true,
      paranoid: true, // deletedAt
    }
  );

  // علامات القذارة لعمليات الإنشاء/التعديل/الحذف (مع إمكانية تخطيها)
  const markDirty = (instance, options) => {
    if (options?.skipSyncFlags) return;
    instance.set("syncDirty", true);
    instance.set("version", (instance.get("version") ?? 0) + 1);
  };
  Customer.addHook("beforeCreate", markDirty);
  Customer.addHook("beforeUpdate", markDirty);
  Customer.addHook("beforeDestroy", (instance, options) => {
    if (options?.skipSyncFlags) return;
    instance.set("syncDirty", true);
    instance.set("version", (instance.get("version") ?? 0) + 1);
  });

  return Customer;
}

export const CustomerLocal  = defineCustomer(sqlite); // SQLite
export const CustomerRemote = defineCustomer(mysql);  // MySQL
