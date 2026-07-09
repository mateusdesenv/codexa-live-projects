import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import Header from '../components/Header.jsx';
import ProjectCard from '../components/ProjectCard.jsx';
import { getUserName, signOutUser } from '../services/firebase.js';
import {
  fetchProjects,
  patchProject,
  removeAllProjects,
  removeProject
} from '../services/storage.js';

const statusOptions = ['Todos', 'Ideia', 'Em andamento', 'Finalizado'];

export default function AdminDashboard({ user }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    refreshProjects();
  }, []);

  const stats = useMemo(() => {
    return {
      total: projects.length,
      unseen: projects.filter((project) => !project.seen).length,
      highlighted: projects.filter((project) => project.highlighted).length
    };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesStatus = statusFilter === 'Todos' || project.status === statusFilter;
      const searchableContent = [
        project.title,
        project.userName,
        project.technologies,
        project.description
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch = !normalizedSearch || searchableContent.includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [projects, search, statusFilter]);

  async function refreshProjects() {
    setProjects(await fetchProjects());
    setIsLoading(false);
  }

  async function handleSeen(projectId) {
    await patchProject(projectId, { seen: true });
    await refreshProjects();
  }

  async function handleHighlight(projectId) {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;

    await patchProject(projectId, { highlighted: !project.highlighted });
    await refreshProjects();
  }

  async function handleDelete(projectId) {
    const shouldDelete = window.confirm('Remover este projeto do mural?');
    if (!shouldDelete) return;

    await removeProject(projectId);
    await refreshProjects();
  }

  async function handleClearAll() {
    const shouldClear = window.confirm('Limpar todos os projetos cadastrados?');
    if (!shouldClear) return;

    await removeAllProjects();
    await refreshProjects();
  }

  async function handleLogout() {
    await signOutUser();
    navigate('/');
  }

  return (
    <main className="dashboard-page">
      <Header
        title="Dashboard admin"
        subtitle="Controle todos os projetos enviados pela galera durante a live."
        userName={getUserName(user)}
        photoURL={user?.photoURL}
        actions={
          <button className="btn btn-ghost" onClick={handleLogout}>
            Sair do admin
          </button>
        }
      />

      <section className="stats-grid">
        <article className="stat-card">
          <span>Total</span>
          <strong>{stats.total}</strong>
        </article>
        <article className="stat-card">
          <span>Novos</span>
          <strong>{stats.unseen}</strong>
        </article>
        <article className="stat-card">
          <span>Destaques</span>
          <strong>{stats.highlighted}</strong>
        </article>
      </section>

      <section className="panel admin-panel">
        <div className="admin-toolbar">
          <div className="section-title">
            <p className="eyebrow">Moderação</p>
            <h2>Projetos enviados</h2>
            <p className="local-note">
              Dados conectados ao MongoDB pela API Node do projeto.
            </p>
          </div>

          <div className="toolbar-actions">
            <button className="btn btn-danger" onClick={handleClearAll} disabled={projects.length === 0}>
              Limpar todos
            </button>
          </div>
        </div>

        <div className="filters-grid">
          <label className="field">
            <span>Buscar</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Projeto, usuário, tecnologia ou descrição"
            />
          </label>

          <label className="field">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {statusOptions.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
        </div>

        {isLoading ? (
          <EmptyState title="Carregando projetos..." description="Buscando envios na API." />
        ) : filteredProjects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="project-list admin-list">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                mode="admin"
                onSeen={handleSeen}
                onHighlight={handleHighlight}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
