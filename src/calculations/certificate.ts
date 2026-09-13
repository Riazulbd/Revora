import type { IsoDate } from '@/types';
import { compareIso } from '@/utils/date';

/**
 * What Revora can honestly put its name to on a Proof Pack.
 *
 * The stamp is worth something only if it claims something true. Revora never
 * sees the motorcycle, so it cannot attest that the bike is sound, that the
 * work was done, or that the odometer was not wound back. What it can attest
 * to is narrower and still useful to a buyer:
 *
 *   - how many records the document was built from,
 *   - the span of dates they cover,
 *   - a fingerprint of exactly those records.
 *
 * The fingerprint is the part that resists a seller with a word processor.
 * Regenerating the pack over unchanged records reproduces the same reference;
 * altering, adding or dropping a single record changes it. A buyer who asks the
 * seller to regenerate the pack in front of them can compare the two.
 *
 * It is a checksum, not a signature: it proves nothing against someone who
 * edits the records themselves before printing, and the wording on the stamp
 * must not pretend otherwise.
 */
export type AttestedRecord = {
  /** Which table it appeared in — so two records with the same id still differ. */
  kind: string;
  id: string;
  date: IsoDate | null;
  /** The figure printed for it, in its smallest integer unit. */
  figure: number | null;
};

export type ProofCertificate = {
  recordCount: number;
  firstDate: IsoDate | null;
  lastDate: IsoDate | null;
  /** Eight hex digits as `A1B2-C3D4`. */
  reference: string;
};

/**
 * FNV-1a, 32-bit.
 *
 * Chosen because it is short enough to write on a stamp and to read aloud over
 * a phone, and because it needs no dependency in a path that runs on a phone
 * with no network. `Math.imul` keeps the multiply in 32-bit range; the `>>> 0`
 * keeps the result unsigned.
 */
function fingerprint(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function proofCertificate(records: readonly AttestedRecord[]): ProofCertificate {
  // Sorted before hashing, so the reference describes the records themselves
  // rather than the order a screen happened to hand them over in.
  const canonical = [...records]
    .map((r) => `${r.kind}|${r.id}|${r.date ?? ''}|${r.figure ?? ''}`)
    .sort()
    .join('\n');

  const dated = records.map((r) => r.date).filter((d): d is IsoDate => d !== null).sort(compareIso);

  const hex = fingerprint(canonical).toString(16).toUpperCase().padStart(8, '0');

  return {
    recordCount: records.length,
    firstDate: dated[0] ?? null,
    lastDate: dated[dated.length - 1] ?? null,
    reference: `${hex.slice(0, 4)}-${hex.slice(4)}`,
  };
}
