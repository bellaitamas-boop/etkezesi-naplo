import { categoryMap, compareEntries, isValidRange } from './core.js';

export const EXPORT_SCHEMA = 'etkezesi-naplo-backup';
export const EXPORT_VERSION = 1;

export function buildBackup({ entries, tombstones, settings, draft, type = 'full', start = null, end = null, includeSettings = true, includeDraft = true }) {
  if (type === 'partial' && !isValidRange(start, end)) throw new Error('A részleges mentés dátumtartománya hibás.');
  const selectedEntries = type === 'full' ? entries : entries.filter(item => item.mealDate >= start && item.mealDate <= end);
  const selectedTombstones = type === 'full' ? tombstones : tombstones.filter(item => !item.mealDate || (item.mealDate >= start && item.mealDate <= end));
  return {
    schema: EXPORT_SCHEMA,
    schemaVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    backupType: type,
    dateRange: type === 'partial' ? { start, end } : null,
    entryCount: selectedEntries.length,
    contents: { settings: includeSettings, draft: includeDraft, tombstones: true },
    entries: selectedEntries.slice().sort(compareEntries),
    tombstones: selectedTombstones,
    settings: includeSettings ? stripStorageKey(settings) : undefined,
    draft: includeDraft && draft ? stripStorageKey(draft) : undefined
  };
}

function stripStorageKey(value) {
  if (!value) return value;
  const clone = { ...value };
  delete clone.key;
  return clone;
}

export function suggestedBackupName(type, now = new Date()) {
  const p = n => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}`;
  return `etkezesi_naplo_${stamp}_${type === 'full' ? 'teljes' : 'reszleges'}.json`;
}

export function validateBackup(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) errors.push('A fájl nem érvényes mentési objektum.');
  if (!data || data.schema !== EXPORT_SCHEMA) errors.push('A fájl nem Étkezési Napló-mentés.');
  if (!data || data.schemaVersion !== EXPORT_VERSION) errors.push('A mentés verziója nem támogatott.');
  if (!data || !['full', 'partial'].includes(data.backupType)) errors.push('Ismeretlen mentéstípus.');
  if (!data || !Array.isArray(data.entries)) errors.push('Hiányzik a bejegyzések listája.');
  const ids = new Set();
  for (const [index, item] of ((data && data.entries) || []).entries()) {
    if (!item || typeof item !== 'object') { errors.push(`A(z) ${index + 1}. bejegyzés hibás.`); continue; }
    if (!item.id || ids.has(item.id)) errors.push(`Hiányzó vagy ismétlődő azonosító a(z) ${index + 1}. bejegyzésnél.`);
    ids.add(item.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.mealDate || '')) errors.push(`Hibás dátum a(z) ${index + 1}. bejegyzésnél.`);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.mealTime || '')) errors.push(`Hibás idő a(z) ${index + 1}. bejegyzésnél.`);
    if (!categoryMap[item.category]) errors.push(`Ismeretlen kategória a(z) ${index + 1}. bejegyzésnél.`);
    if (!item.description || !String(item.description).trim()) errors.push(`Üres leírás a(z) ${index + 1}. bejegyzésnél.`);
    if (!Number.isInteger(item.revision) || item.revision < 1) errors.push(`Hibás változatszám a(z) ${index + 1}. bejegyzésnél.`);
  }
  if (data && data.backupType === 'partial' && !isValidRange(data.dateRange && data.dateRange.start, data.dateRange && data.dateRange.end)) errors.push('A részleges mentés dátumtartománya hibás.');
  return { valid: errors.length === 0, errors };
}

function sameRecord(a, b) {
  return a.revision === b.revision && a.mealDate === b.mealDate && a.mealTime === b.mealTime && a.category === b.category && a.description === b.description;
}

export function createMergePreview(currentEntries, currentTombstones, backup) {
  const current = new Map(currentEntries.map(item => [item.id, item]));
  const deleted = new Map(currentTombstones.map(item => [item.id || item.key, item]));
  const add = [], unchanged = [], update = [], conflicts = [], ignored = [];

  for (const incoming of backup.entries) {
    const existing = current.get(incoming.id);
    const tombstone = deleted.get(incoming.id);
    if (tombstone) {
      conflicts.push({ id: incoming.id, kind: 'deleted-locally', current: null, incoming, tombstone, choice: 'keep-deleted' });
    } else if (!existing) {
      add.push(incoming);
    } else if (sameRecord(existing, incoming)) {
      unchanged.push(incoming);
    } else if (incoming.revision > existing.revision) {
      update.push(incoming);
    } else if (incoming.revision < existing.revision) {
      ignored.push({ incoming, current: existing, reason: 'newer-local' });
    } else {
      conflicts.push({ id: incoming.id, kind: 'same-revision-different', current: existing, incoming, choice: 'current' });
    }
  }

  const incomingTombstones = Array.isArray(backup.tombstones) ? backup.tombstones : [];
  for (const tombstone of incomingTombstones) {
    const id = tombstone.id || tombstone.key;
    const existing = current.get(id);
    if (!existing) continue;
    if ((tombstone.revision || 0) >= existing.revision) {
      conflicts.push({ id, kind: 'deleted-in-backup', current: existing, incoming: null, tombstone, choice: 'current' });
    }
  }

  return { add, unchanged, update, conflicts, ignored, backup };
}

export function finalizeMergePlan(preview, choices = {}) {
  const add = [...preview.add];
  const update = [...preview.update];
  const deleteIds = [];
  const tombstones = [];
  for (const conflict of preview.conflicts) {
    const choice = choices[conflict.id] || conflict.choice;
    if (conflict.kind === 'deleted-locally') {
      if (choice === 'incoming') add.push(conflict.incoming);
    } else if (conflict.kind === 'deleted-in-backup') {
      if (choice === 'delete') { deleteIds.push(conflict.id); tombstones.push(conflict.tombstone); }
    } else if (choice === 'incoming') update.push(conflict.incoming);
  }
  return { add, update, deleteIds, tombstones };
}
