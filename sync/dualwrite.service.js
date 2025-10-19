// src/sync/dualwrite.service.js
import { isMySqlOnline } from "../utils/remote-health.js";
import { OutboxLocal } from "../models/outbox.model.js";

export class DualWriteService {
  constructor(sqlite, mysql) {
    this.sqlite = sqlite;
    this.mysql = mysql;
  }

  /**
   * يكتب محليًا دائمًا + يحاول ريموت؛ وإن فشل يضيف Outbox
   * @param {Model} LocalModel
   * @param {Model} RemoteModel
   * @param {'create'|'update'|'delete'} op
   * @param {string} pk
   * @param {object} payload
   * @param {object} where
   */
  async writeBoth(LocalModel, RemoteModel, op, pk, payload = undefined, where = undefined) {
    // 1) محلي دائمًا
    if (op === "create") {
      await LocalModel.create(payload);
    } else if (op === "update") {
      await LocalModel.update(payload, { where });
    } else if (op === "delete") {
      await LocalModel.destroy({ where, force: false });
    }

    // 2) حاول ريموت
    const online = await isMySqlOnline(this.mysql);
    if (online) {
      try {
        if (op === "create") {
          if (RemoteModel.upsert) await RemoteModel.upsert(payload);
          else await RemoteModel.create(payload);
        } else if (op === "update") {
          await RemoteModel.update(payload, { where });
        } else if (op === "delete") {
          await RemoteModel.destroy({ where, force: false });
        }
        return { ok: true, mode: "dual" };
      } catch {
        await OutboxLocal.create({
          table: LocalModel.getTableName?.() ?? "unknown",
          op, pk,
          payload: payload ?? null,
          version: payload?.version ?? null,
        });
        return { ok: true, mode: "local-only", queued: true };
      }
    }

    // 3) ريموت أوفلاين
    await OutboxLocal.create({
      table: LocalModel.getTableName?.() ?? "unknown",
      op, pk,
      payload: payload ?? null,
      version: payload?.version ?? null,
    });
    return { ok: true, mode: "local-only", queued: true };
  }

  /** تفريغ الـ Outbox إلى MySQL */
  async flushOutbox(LocalModel, RemoteModel) {
    const online = await isMySqlOnline(this.mysql);
    if (!online) return { ok: false, message: "mysql offline" };

    const rows = await OutboxLocal.findAll({ order: [["id", "ASC"]], limit: 200 });
    for (const row of rows) {
      const { op, pk, payload } = row;
      const where = { id: pk };
      try {
        if (op === "create") {
          if (RemoteModel.upsert) await RemoteModel.upsert(payload);
          else await RemoteModel.create(payload);
        } else if (op === "update") {
          await RemoteModel.update(payload, { where });
        } else if (op === "delete") {
          await RemoteModel.destroy({ where, force: false });
        }
        await row.destroy();
      } catch {
        return { ok: false, message: "flush halted on error", failedId: row.id };
      }
    }
    return { ok: true, flushed: rows.length };
  }
}
