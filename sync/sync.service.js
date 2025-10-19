// sync/sync.service.js
import { Op } from "sequelize";
import { CustomerLocal, CustomerRemote } from "../models/customer.model.js";
import { getMeta, setMeta } from "../models/meta.model.js";
import { mysql } from "../database.js";

async function isMySQLUp() {
  try { await mysql.authenticate(); return true; } catch { return false; }
}

export async function syncOnce() {
  const online = await isMySQLUp();
  if (!online) return { online: false, pushed: 0, pulled: 0 };

  // اتأكد أن الجداول موجودة (بدون alter هنا)
  await CustomerLocal.sync();
  await CustomerRemote.sync();

  let pushed = 0, pulled = 0;

  // ===== PUSH (Local -> Remote) =====
  const dirtyLocals = await CustomerLocal.findAll({
    paranoid: false,
    where: { [Op.or]: [{ syncDirty: true }, { deletedAt: { [Op.ne]: null } }] },
  });

  const tRemote = await mysql.transaction();
  try {
    for (const row of dirtyLocals) {
      const data = row.toJSON();
      const existing = await CustomerRemote.findByPk(data.id, { paranoid: false, transaction: tRemote });

      if (!existing) {
        if (data.deletedAt) continue; // محذوف محلياً ومفيش counterpart
        await CustomerRemote.create(data, { paranoid: false, transaction: tRemote, skipSyncFlags: true });
      } else {
        if (data.deletedAt) {
          if (new Date(existing.updatedAt) <= new Date(data.updatedAt)) {
            await existing.destroy({ transaction: tRemote, skipSyncFlags: true });
          }
        } else {
          if (new Date(existing.updatedAt) <= new Date(data.updatedAt)) {
            await existing.set(data);
            await existing.save({ transaction: tRemote, skipSyncFlags: true });
          }
        }
      }

      if (!row.deletedAt) {
        row.set("syncDirty", false);
        await row.save({ skipSyncFlags: true }); // local save بدون ترانزاكشن MySQL
      }
      pushed++;
    }
    await tRemote.commit();
  } catch (e) {
    await tRemote.rollback();
    throw e;
  }

  // ===== PULL (Remote -> Local) =====
  const lastPull = await getMeta("lastRemoteSyncAt", "1970-01-01T00:00:00.000Z");
  const remoteChanged = await CustomerRemote.findAll({
    paranoid: false,
    where: { updatedAt: { [Op.gt]: new Date(lastPull) } },
  });

  for (const r of remoteChanged) {
    const data = r.toJSON();
    const local = await CustomerLocal.findByPk(data.id, { paranoid: false });

    if (!local) {
      if (data.deletedAt) continue;
      await CustomerLocal.create({ ...data, syncDirty: false }, { paranoid: false, skipSyncFlags: true });
    } else {
      if (new Date(local.updatedAt) < new Date(data.updatedAt)) {
        await local.set({ ...data, syncDirty: false });
        await local.save({ skipSyncFlags: true });
      }
    }
    pulled++;
  }

  await setMeta("lastRemoteSyncAt", new Date().toISOString());
  return { online: true, pushed, pulled };
}
