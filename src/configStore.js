/** 사용자 파라미터 오버라이드(localStorage) — 백테스트 결과에 따라 임계값/가중치를 조정할 때 사용 */
import { CONFIG, mergeConfig } from './config.js';

export const CFG_LS_KEY = 'usmacro.cfgOverride.v1';

export function readOverride() {
  try { return JSON.parse(localStorage.getItem(CFG_LS_KEY) || 'null'); } catch (_) { return null; }
}
export function writeOverride(obj) {
  if (obj === null) localStorage.removeItem(CFG_LS_KEY);
  else localStorage.setItem(CFG_LS_KEY, JSON.stringify(obj));
}
export function getActiveConfig() {
  const o = readOverride();
  return o ? mergeConfig(CONFIG, o) : CONFIG;
}
export function hasOverride() { return !!readOverride(); }
