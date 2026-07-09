export function isRequired(value) {
  return String(value || '').trim().length > 0;
}

export function isValidUrl(value) {
  const url = String(value || '').trim().toLowerCase();
  return url.startsWith('http://') || url.startsWith('https://');
}

export function createProjectId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function formatDate(dateValue) {
  if (!dateValue) return 'Sem data';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(dateValue));
}
