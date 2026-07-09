const PROJECTS_KEY = 'live_projects_items';
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Erro ao acessar API.');
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function fetchProjects() {
  try {
    const payload = await request('/projects?includeAll=true');
    saveProjects(payload.projects);
    return payload.projects;
  } catch (error) {
    return getProjects();
  }
}

export async function fetchProjectsByUser(userEmail, userName) {
  try {
    const query = new URLSearchParams({ userEmail }).toString();
    const payload = await request(`/projects?${query}`);
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
