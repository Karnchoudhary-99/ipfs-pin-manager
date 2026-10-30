// Pin registry: the in-memory record of what this manager keeps pinned,
// why, and when. Persistence lives in store.js; the CLI wraps this class.
//
// A pin record: { cid, reason, size, tags, pinnedAt, updatedAt }.
// - reason is free text ("backup", "website", …) and required: an
//   unexplained pin is exactly how orphaned pins accumulate.
// - size is bytes when known, null otherwise; it is advisory metadata,
//   never used to decide whether a pin exists.
// - Re-pinning an existing CID updates its record (reason/tags/size) and
//   refreshes updatedAt, but keeps the original pinnedAt.

import { assertValidCid } from "./cid.js";

export class PinRegistry {
  constructor(pins = []) {
    this.pins = new Map();
    for (const pin of pins) this.#insert(pin, { keepDates: true });
  }

  pin(cid, { reason, size = null, tags = [] } = {}) {
    assertValidCid(cid);
    if (typeof reason !== "string" || reason.trim() === "") {
      throw new TypeError("pin reason must be a non-empty string");
    }
    if (size !== null && (!Number.isInteger(size) || size < 0)) {
      throw new TypeError("pin size must be a non-negative integer or null");
    }
    const existing = this.pins.get(cid);
    const now = new Date().toISOString();
    const record = {
      cid,
      reason: reason.trim(),
      size,
      tags: [...new Set(tags.map(String))].sort(),
      pinnedAt: existing ? existing.pinnedAt : now,
      updatedAt: now,
    };
    this.pins.set(cid, record);
    return record;
  }

  unpin(cid) {
    assertValidCid(cid);
    return this.pins.delete(cid);
  }

  get(cid) {
    assertValidCid(cid);
    return this.pins.get(cid) ?? null;
  }

  has(cid) {
    assertValidCid(cid);
    return this.pins.has(cid);
  }

  get count() {
    return this.pins.size;
  }

  list({ reason, tag } = {}) {
    let records = [...this.pins.values()];
    if (reason !== undefined) records = records.filter((p) => p.reason === reason);
    if (tag !== undefined) records = records.filter((p) => p.tags.includes(tag));
    records.sort((a, b) => a.pinnedAt.localeCompare(b.pinnedAt));
    return records;
  }

  totalSize() {
    let total = 0;
    let known = true;
    for (const pin of this.pins.values()) {
      if (pin.size === null) known = false;
      else total += pin.size;
    }
    return { bytes: total, complete: known };
  }

  toJSON() {
    return { version: 1, pins: this.list() };
  }

  static fromJSON(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.pins)) {
      throw new TypeError("unsupported pin store format (expected { version: 1, pins: [...] })");
    }
    return new PinRegistry(data.pins);
  }

  #insert(pin, { keepDates } = {}) {
    assertValidCid(pin.cid);
    const now = new Date().toISOString();
    this.pins.set(pin.cid, {
      cid: pin.cid,
      reason: pin.reason,
      size: pin.size ?? null,
      tags: [...(pin.tags ?? [])],
      pinnedAt: keepDates && pin.pinnedAt ? pin.pinnedAt : now,
      updatedAt: keepDates && pin.updatedAt ? pin.updatedAt : now,
    });
  }
}
