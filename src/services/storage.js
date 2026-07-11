import { auth, isAdminEmail, signOutUser } from './firebase.js';

const PROJECTS_KEY = 'live_projects_items';
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Anexa a identidade verificada (ID token do Firebase) a cada chamada à API.
// A identidade passa a vir do token no backend, não mais do corpo da requisição.
async function authHeaders() {
  const current = auth.currentUser;
  if (!current) return {};
  try {
    const idToken = await current.getIdToken();
    return { Authorization: `Bearer ${idToken}` };
  } catch {
    return {};
  }
}

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function getProjects() {
  return safeParse(localStorage.getItem(PROJECTS_KEY), []).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

export function saveProjects(projects) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function addProject(project) {
  const projects = getProjects();
  const nextProjects = [project, ...projects];
  saveProjects(nextProjects);
  return nextProjects;
}

export function updateProject(projectId, updates) {
  const projects = getProjects();
  const nextProjects = projects.map((project) =>
    project.id === projectId ? { ...project, ...updates } : project
  );
  saveProjects(nextProjects);
  return nextProjects;
}

export function deleteProject(projectId) {
  const projects = getProjects();
  const nextProjects = projects.filter((project) => project.id !== projectId);
  saveProjects(nextProjects);
  return nextProjects;
}

export function clearProjects() {
  saveProjects([]);
}

export function getProjectsByUser(userEmail, userName) {
  const normalizedEmail = userEmail?.trim().toLowerCase();
  const normalizedName = userName?.trim().toLowerCase();

  return getProjects().filter(
    (project) =>
      project.userEmail?.toLowerCase() === normalizedEmail ||
      (!project.userEmail && project.userName?.toLowerCase() === normalizedName)
  );
}

export async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeaders()),
    ...options.headers
  };

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    // 401: token ausente/expirado/inválido. Limpa a sessão de forma suave (o
    // onAuthStateChanged leva de volta ao login). Só desloga se ainda houver
    // usuário, evitando loop de signOut.
    if (response.status === 401 && auth.currentUser) {
      await signOutUser().catch(() => {});
    }
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || 'Erro ao acessar API.');
    error.status = response.status;
    error.code = payload.error || '';
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

// Estatísticas públicas para a tela de login (sem autenticação).
export async function fetchStats() {
  const response = await fetch(`${API_BASE_URL}/stats`);
  if (!response.ok) throw new Error('stats indisponível');
  const payload = await response.json();
  return payload.stats;
}

// Erros de indisponibilidade/bloqueio vindos do backend (rejeição intencional).
// O fluxo NÃO deve cair no fallback local nesses casos — precisa propagar para o
// dashboard exibir o toast genérico.
export function isProcessingUnavailable(error) {
  return (
    error?.status === 429 ||
    error?.status === 403 ||
    error?.code === 'PROCESSING_UNAVAILABLE'
  );
}

// O escopo agora é decidido no servidor pelo e-mail verificado do token
// (admin vê tudo; usuário vê os seus). O cliente apenas solicita /projects.
export async function fetchProjects(userEmail) {
  try {
    const payload = await request('/projects');
    saveProjects(payload.projects);
    return payload.projects;
  } catch (error) {
    return isAdminEmail(userEmail) ? getProjects() : getProjectsByUser(userEmail);
  }
}

export async function fetchProjectsByUser(userEmail, userName) {
  if (isAdminEmail(userEmail)) {
    return fetchProjects(userEmail);
  }

  try {
    const payload = await request('/projects');
    saveProjects([
      ...payload.projects,
      ...getProjects().filter((project) => project.userEmail && project.userEmail !== userEmail)
    ]);
    return payload.projects;
  } catch (error) {
    return getProjectsByUser(userEmail, userName);
  }
}

export async function createProject(project) {
  try {
    const savedProject = await request('/projects', {
      method: 'POST',
      body: JSON.stringify(project)
    });
    saveProjects([savedProject, ...getProjects().filter((item) => item.id !== savedProject.id)]);
    return savedProject;
  } catch (error) {
    // Só cai no fallback local em falha de rede/offline (erro sem status HTTP).
    // Qualquer resposta do backend (4xx/5xx) é intencional — propagar para o
    // dashboard tratar (toast genérico em 403/429, re-login em 401 etc.).
    if (error?.status) throw error;
    addProject(project);
    return project;
  }
}

export async function patchProject(projectId, updates) {
  try {
    const project = await request(`/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
    updateProject(projectId, project);
    return project;
  } catch (error) {
    updateProject(projectId, updates);
    return { ...updates, id: projectId };
  }
}

export async function removeProject(projectId) {
  try {
    await request(`/projects/${projectId}`, { method: 'DELETE' });
  } finally {
    deleteProject(projectId);
  }
}

export async function removeAllProjects() {
  try {
    await request('/projects', { method: 'DELETE' });
  } finally {
    clearProjects();
  }
}
