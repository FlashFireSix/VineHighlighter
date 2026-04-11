class VineCategorySnapshotComparer {
  static parseCountFromBracketSpan(text) {
    if (text == null) return null;
    const t = String(text).trim();
    const exact = t.match(/^\(\s*(\d+)\s*\)$/);
    if (exact) return parseInt(exact[1], 10);
    const loose = t.match(/\(\s*(\d+)\s*\)/);
    return loose ? parseInt(loose[1], 10) : null;
  }

  static normalizeCategoryName(text) {
    if (text == null) return '';
    return String(text).replace(/\s+/g, ' ').trim();
  }

  static highlightStateFor(previous, current) {
    const out = {};
    const names = Object.keys(current);
    if (!previous) {
      for (const name of names) out[name] = null;
      return out;
    }
    for (const name of names) {
      if (!Object.prototype.hasOwnProperty.call(previous, name)) {
        out[name] = null;
        continue;
      }
      const prev = previous[name];
      const next = current[name];
      if (next > prev) out[name] = 'increase';
      else if (next < prev) out[name] = 'decrease';
      else out[name] = null;
    }
    return out;
  }
}

globalThis.VineCategorySnapshotComparer = VineCategorySnapshotComparer;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VineCategorySnapshotComparer };
}
