// src/sync/online-monitor.js
// يراقب حالة MySQL ويعمل Flush تلقائي عند التحوّل من Offline -> Online
export function startOnlineMonitor({
  mysql,                  // Sequelize instance
  dual,                   // DualWriteService instance
  pairs,                  // [[LocalModel, RemoteModel], ...]
  onStateChange = () => {},

  // فواصل الفحص (ملي ثانية)
  intervalWhenOffline = 5_000,  // أسرع لما أوفلاين
  intervalWhenOnline  = 30_000, // أبطأ لما أونلاين
}) {
  let timer = null;
  let isOnline = false;
  let running = false;

  async function check() {
    if (running) return;
    running = true;
    try {
      // جرب المصادقة: لو اشتغلت يبقى MySQL أونلاين
      await mysql.authenticate();
      if (!isOnline) {
        isOnline = true;
        onStateChange(true);
        // أول ما يرجع أونلاين: فلّش كل الـ outbox للجداول المعنية
        for (const [LocalModel, RemoteModel] of pairs) {
          try { await dual.flushOutbox(LocalModel, RemoteModel); } catch {}
        }
      } else {
        // وهو أونلاين بالفعل: فلّش دوري خفيف (لو فيه جديد)
        for (const [LocalModel, RemoteModel] of pairs) {
          try { await dual.flushOutbox(LocalModel, RemoteModel); } catch {}
        }
      }
    } catch {
      if (isOnline) {
        isOnline = false;
        onStateChange(false);
      }
    } finally {
      running = false;
      // أعد جدولة الفحص حسب الحالة الحالية
      clearTimeout(timer);
      timer = setTimeout(check, isOnline ? intervalWhenOnline : intervalWhenOffline);
    }
  }

  // بدء الحلقة
  clearTimeout(timer);
  timer = setTimeout(check, 0);

  // دالة إيقاف (لو أحببت)
  return () => clearTimeout(timer);
}
