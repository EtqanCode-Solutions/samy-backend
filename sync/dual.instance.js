// src/sync/dual.instance.js
let dual = null;

export function setDual(instance) {
  dual = instance;
}

export function getDual() {
  if (!dual) throw new Error("DualWrite instance not set yet");
  return dual;
}
