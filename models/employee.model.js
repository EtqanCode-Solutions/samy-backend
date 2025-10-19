// src/models/employee.model.js
import { DataTypes } from "sequelize";
import { sqlite, mysql } from "../database.js";

/** مطابق لحقول الـ UI مع حقول المزامنة */
export function defineEmployee(sequelize) {
  const Employee = sequelize.define(
    "Employee",
    {
      id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

      code:       { type: DataTypes.STRING,  allowNull: false, unique: true }, // EMP-001...
      name:       { type: DataTypes.STRING,  allowNull: false },
      department: { type: DataTypes.STRING,  allowNull: false },
      title:      { type: DataTypes.STRING,  allowNull: false },
      grade:      { type: DataTypes.STRING,  allowNull: false },
      manager:    { type: DataTypes.STRING,  allowNull: true  },
      phone:      { type: DataTypes.STRING,  allowNull: false },
      status:     { type: DataTypes.ENUM("active","resigned"), allowNull: false, defaultValue: "active" },
      salary:     { type: DataTypes.FLOAT,   allowNull: false, defaultValue: 0 },
      hireDate:   { type: DataTypes.DATEONLY,allowNull: false },
      resignDate: { type: DataTypes.DATEONLY,allowNull: true  },

      // حقول المزامنة (نفس فكرة customers)
      syncDirty:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      version:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: "employees",
      timestamps: true,
      paranoid: true, // deletedAt
      indexes: [
        { fields: ["code"], unique: true },
        { fields: ["department"] },
        { fields: ["status"] },
      ],
    }
  );

  // تعليم "قذر" + bump version (مع إمكانية التخطي عبر skipSyncFlags)
  const markDirty = (instance, options) => {
    if (options?.skipSyncFlags) return;
    instance.set("syncDirty", true);
    instance.set("version", (instance.get("version") ?? 0) + 1);
  };
  Employee.addHook("beforeCreate", markDirty);
  Employee.addHook("beforeUpdate", markDirty);
  Employee.addHook("beforeDestroy", (instance, options) => {
    if (options?.skipSyncFlags) return;
    instance.set("syncDirty", true);
    instance.set("version", (instance.get("version") ?? 0) + 1);
  });

  return Employee;
}

export const EmployeeLocal  = defineEmployee(sqlite); // SQLite
export const EmployeeRemote = defineEmployee(mysql);  // MySQL
