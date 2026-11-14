export const CATEGORIES = [
  ['breakfast', 'Reggeli', '#E8A317'],
  ['tens', 'Tízórai', '#40A99B'],
  ['lunch', 'Ebéd', '#E57A43'],
  ['snack', 'Uzsonna', '#8B75C9'],
  ['dinner', 'Vacsora', '#4478C7'],
  ['treat', 'Nasi', '#D26B92'],
  ['other', 'Egyéb', '#87909B']
];

export const categoryMap = Object.fromEntries(CATEGORIES.map(([id, label, color]) => [id, { label, color }]));

export function localDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function localTime(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function parseLocalDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function addDays(value, amount) {
  const date = typeof value === 'string' ? parseLocalDate(value) : new Date(value);
  date.setDate(date.getDate() + amount);
  return localDate(date);
}

export function daysBetween(start, end) {
  const out = [];
  for (let day = start; day <= end; day = addDays(day, 1)) out.push(day);
  return out;
}

export function startOfWeek(value) {
  const date = parseLocalDate(value);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return localDate(date);
}

export function suggestedCategory(time) {
  const minutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  if (minutes >= 300 && minutes < 600) return 'breakfast';
  if (minutes >= 600 && minutes < 660) return 'tens';
  if (minutes >= 660 && minutes < 900) return 'lunch';
  if (minutes >= 900 && minutes < 1080) return 'snack';
  if (minutes >= 1080) return 'dinner';
  return 'treat';
}

export function formatDate(value, options = {}) {
  return new Intl.DateTimeFormat('hu-HU', options).format(parseLocalDate(value));
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
}

export function validateEntry(entry) {
  const errors = {};
  if (!categoryMap[entry.category]) errors.category = 'Válassz étkezési kategóriát.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.mealDate)) errors.mealDate = 'Adj meg érvényes dátumot.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.mealTime)) errors.mealTime = 'Adj meg érvényes időpontot.';
  if (!entry.description || !entry.description.trim()) errors.description = 'A leírás nem lehet üres.';
  return errors;
}

export function compareEntries(a, b) {
  return `${a.mealDate}T${a.mealTime}`.localeCompare(`${b.mealDate}T${b.mealTime}`) || a.createdAt.localeCompare(b.createdAt);
}

export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

export function isValidRange(start, end) {
  return /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start <= end;
}
