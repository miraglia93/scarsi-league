/* ============================================================
   SCARSI LEAGUE — micro test-runner, senza dipendenze esterne
   (coerente con "niente librerie nuove salvo necessità reale")
   ============================================================ */

let pass = 0;
let fail = 0;

export function test(nome, fn) {
  try {
    fn();
    pass++;
    console.log(`  ✓ ${nome}`);
  } catch (e) {
    fail++;
    console.error(`  ✗ ${nome}\n    ${e.message}`);
  }
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assert fallito");
}

export function assertEqual(ottenuto, atteso, msg) {
  const a = JSON.stringify(ottenuto);
  const b = JSON.stringify(atteso);
  if (a !== b) throw new Error(`${msg || "assertEqual"}: atteso ${b}, ottenuto ${a}`);
}

export function assertVicino(ottenuto, atteso, tolleranza, msg) {
  if (Math.abs(ottenuto - atteso) > tolleranza) {
    throw new Error(`${msg || "assertVicino"}: atteso ~${atteso} (±${tolleranza}), ottenuto ${ottenuto}`);
  }
}

export function riepilogo(nomeFile) {
  console.log(`  → ${pass} passati, ${fail} falliti (${nomeFile})\n`);
  return fail === 0;
}
