import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import Header from '../components/Header.jsx';
import ProjectCard from '../components/ProjectCard.jsx';
import { fetchDraws, saveDraw } from '../services/draws.js';
import { getUserName, signOutUser } from '../services/firebase.js';
import {
  fetchProjects,
  patchProject,
  removeAllProjects,
  removeProject
} from '../services/storage.js';
import { fetchUsers } from '../services/users.js';

const statusOptions = ['Todos', 'Ideia', 'Em andamento', 'Finalizado'];

export default function AdminDashboard({ user }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [draws, setDraws] = useState([]);
  const [rollingProject, setRollingProject] = useState(null);
  const [drawStatus, setDrawStatus] = useState('idle');
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
      highlighted: projects.filter((project) => project.highlighted).length,
      users: users.length
    };
  }, [projects, users]);

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
    const [nextProjects, nextUsers, nextDraws] = await Promise.all([
      fetchProjects(),
      fetchUsers(),
      fetchDraws(8)
    ]);
    setProjects(nextProjects);
    setUsers(nextUsers);
    setDraws(nextDraws);
    setIsLoading(false);
  }

  async function handleDrawProject() {
    if (projects.length === 0 || drawStatus === 'spinning') return;

    setDrawStatus('spinning');
    let ticks = 0;
    const maxTicks = 28;

    await new Promise((resolve) => {
      const interval = window.setInterval(() => {
        const nextProject = projects[Math.floor(Math.random() * projects.length)];
        setRollingProject(nextProject);
        ticks += 1;

        if (ticks >= maxTicks) {
          window.clearInterval(interval);
          resolve();
        }
      }, 80);
    });

    const winner = projects[Math.floor(Math.random() * projects.length)];
    setRollingProject(winner);
    const draw = await saveDraw({
      winner,
      participants: projects,
      participantsCount: projects.length,
      createdBy: getUserName(user)
    });
    setDraws([draw, ...draws.filter((item) => item.id !== draw.id)].slice(0, 8));
    setDrawStatus('done');
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
        <article className="stat-card">
          <span>Usuários</span>
          <strong>{stats.users}</strong>
        </article>
      </section>

      <section className="admin-grid">
        <article className="panel draw-panel">
          <div className="section-title inline-title">
            <div>
              <p className="eyebrow">Sorteio</p>
              <h2>Projeto da live</h2>
              <p>Escolha um envio aleatório e salve o resultado no histórico.</p>
            </div>
            <span className="counter-pill">{projects.length}</span>
          </div>

          <div className={`draw-stage ${drawStatus === 'spinning' ? 'is-spinning' : ''}`}>
            <p>{drawStatus === 'spinning' ? 'Sorteando agora' : 'Na roleta'}</p>
            <strong>{rollingProject?.title || draws[0]?.winner?.title || 'Nenhum sorteio ainda'}</strong>
            <span>{rollingProject?.userName || draws[0]?.winner?.userName || 'Aguardando projetos'}</span>
          </div>

          <div className="draw-actions">
            <button className="btn btn-primary" onClick={handleDrawProject} disabled={projects.length === 0 || drawStatus === 'spinning'}>
              {drawStatus === 'spinning' ? 'Rodando...' : 'Sortear projeto'}
            </button>
            {draws[0]?.winner?.url ? (
              <a className="btn btn-ghost" href={draws[0].winner.url} target="_blank" rel="noreferrer">
                Abrir último
              </a>
            ) : null}
          </div>

          {draws.length > 0 ? (
            <div className="draw-history">
              {draws.slice(0, 4).map((draw) => (
                <div key={draw.id} className="draw-history-item">
                  <strong>{draw.winner.title}</strong>
                  <span>{draw.winner.userName} • {draw.participantsCount} participantes</span>
                </div>
              ))}
            </div>
          ) : null}
        </article>

        <article className="panel users-panel">
          <div className="section-title inline-title">
            <div>
              <p className="eyebrow">Contas</p>
              <h2>Usuários cadastrados</h2>
            </div>
            <span className="counter-pill">{users.length}</span>
          </div>

          {users.length === 0 ? (
            <EmptyState title="Nenhum usuário registrado ainda." description="Quando alguém entrar com Google, aparece aqui." />
          ) : (
            <div className="users-list">
              {users.map((profile) => (
                <div className="user-row" key={profile.uid}>
                  {profile.photoURL ? <img src={profile.photoURL} alt="" /> : <span>{profile.displayName?.slice(0, 1) || 'U'}</span>}
                  <div>
                    <strong>{profile.displayName}</strong>
                    <small>{profile.email}</small>
                  </div>
                  <em>{profile.role === 'admin' ? 'Admin' : `${profile.loginCount || 0} logins`}</em>
                </div>
              ))}
            </div>
          )}
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
