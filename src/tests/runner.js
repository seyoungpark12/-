/** 의존성 없는 미니 테스트 러너 (브라우저 / Node 공용) */
const suites = [];
let current = null;

export function describe(name, fn) {
  current = { name, tests: [] };
  suites.push(current);
  fn();
  current = null;
}
export function it(name, fn) { current.tests.push({ name, fn }); }

export const assert = {
  ok(v, msg) { if (!v) throw new Error(msg || `expected truthy, got ${v}`); },
  equal(a, b, msg) { if (a !== b) throw new Error(`${msg || 'equal'}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
  deepEqual(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || 'deepEqual'}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
  includes(str, sub, msg) { if (!String(str).includes(sub)) throw new Error(`${msg || 'includes'}: "${sub}" not in "${String(str).slice(0, 120)}"`); },
  notIncludes(str, sub, msg) { if (String(str).includes(sub)) throw new Error(`${msg || 'notIncludes'}: "${sub}" found`); },
  inSet(v, set, msg) { if (!set.includes(v)) throw new Error(`${msg || 'inSet'}: ${v} not in ${JSON.stringify(set)}`); },
  close(a, b, eps = 1e-9, msg) { if (Math.abs(a - b) > eps) throw new Error(`${msg || 'close'}: ${a} vs ${b}`); },
};

export async function runAll() {
  const results = [];
  for (const s of suites) {
    for (const t of s.tests) {
      try { await t.fn(); results.push({ suite: s.name, name: t.name, ok: true }); }
      catch (e) { results.push({ suite: s.name, name: t.name, ok: false, error: String(e && e.message || e) }); }
    }
  }
  return results;
}
