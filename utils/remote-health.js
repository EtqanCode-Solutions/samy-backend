// src/utils/remote-health.js
export async function isMySqlOnline(mysql) {
  try {
    await mysql.authenticate();
    return true;
  } catch {
    return false;
  }
}
