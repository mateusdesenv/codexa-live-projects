import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import ProjectCard from '../components/ProjectCard.jsx';
import Toast from '../components/Toast.jsx';
import { fetchDraws, saveDraw } from '../services/draws.js';
import { getUserName, signOutUser } from '../services/firebase.js';
import {
  fetchProjects,
  patchProject,
  removeAllProjects,
  removeProject
} from '../services/storage.js';
import { fetchUsers, setUserDiscordAccess } from '../services/users.js';

const statusOptions = ['Todos', 'Ideia', 'Em andamento', 'Finalizado'];

function AdminHeader({ user, onLogout }) {
  const navItems = [
    { label: 'Visao geral', href: '#visao-geral', active: true },
    { label: 'Fila', href: '#fila' },
    { label: 'Sorteio', href: '#sorteio' },
    { label: 'Comunidade', href: '#comunidade' },
    { label: 'Historico', href: '#historico' }
  ];

  return (
    <header className="admin-live-header">
      <a className="admin-live-brand" href="#visao-geral" aria-label="Live Projects">
        <span>LP</span>
        <strong>Live Projects</strong>
      </a>

      <nav className="admin-live-nav" aria-label="Navegacao da central">
        {navItems.map((item) => (
          <a className={item.active ? 'is-active' : ''} href={item.href} key={item.label}>
            {item.label}
          </a>
        ))}
      </nav>

      <div className="admin-live-user">
        {user?.photoURL ? <img src={user.photoURL} alt="" /> : <span>MC</span>}
        <div>
          <strong>Mateus Camargo</strong>
          <small>{user?.email}</small>
        </div>
        <button className="btn btn-ghost btn-small" onClick={onLogout}>
          Sair
        </button>
      </div>
    </header>
  );
}

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
  const [toast, setToast] = useState('');

  useEffect(() => {
    refreshProjects();
    const interval = setInterval(refreshProjects, 20000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshProjects();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refreshProjects);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refreshProjects);
    };
  }, []);

  const stats = useMemo(() => {
    const inProgress = projects.filter((project) => project.status === 'Em andamento').length;
    const finished = projects.filter((project) => project.status === 'Finalizado').length;
    const discordReady = users.filter((profile) => profile.discordEnabled === true).length;

    return {
      total: projects.length,
      unseen: projects.filter((project) => !project.seen).length,
      highlighted: projects.filter((project) => project.highlighted).length,
      users: users.length,
      inProgress,
      finished,
      discordReady
    };
  }, [projects, users]);

  const nextProject = useMemo(() => {
    return projects.find((project) => !project.seen) || projects[0] || null;
  }, [projects]);

  const recentActivity = useMemo(() => {
    const projectEvents = projects.slice(0, 5).map((project) => ({
      id: `project-${project.id}`,
      title: project.title,
      label: project.seen ? 'Ja passou pela curadoria' : 'Novo projeto na fila',
      meta: project.userName || project.userEmail || 'Comunidade'
    }));

    const userEvents = users.slice(0, 3).map((profile) => ({
      id: `user-${profile.uid}`,
      title: profile.displayName || profile.email,
      label: profile.discordEnabled ? 'Discord liberado' : 'Usuario cadastrado',
      meta: profile.email
    }));

    return [...projectEvents, ...userEvents].slice(0, 6);
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
      fetchProjects(user?.email),
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

  function handleReact(project, reaction) {
    setToast(`${reaction} registrado para ${project.title}.`);
  }

  // Atualização otimista do toggle de acesso ao Discord: reflete na hora no
  // estado local e, se a chamada falhar, faz rollback e mostra um aviso discreto.
  async function handleToggleDiscord(uid, next) {
    setUsers((current) =>
      current.map((item) => (item.uid === uid ? { ...item, discordEnabled: next } : item))
    );

    try {
      const updated = await setUserDiscordAccess(uid, next);
      setUsers((current) =>
        current.map((item) =>
          item.uid === uid ? { ...item, discordEnabled: updated.discordEnabled === true } : item
        )
      );
    } catch {
      setUsers((current) =>
        current.map((item) => (item.uid === uid ? { ...item, discordEnabled: !next } : item))
      );
      setToast('Não foi possível atualizar o acesso ao Discord. Tente de novo.');
    }
  }

  async function handleLogout() {
    await signOutUser();
    navigate('/');
  }

  return (
    <main className="dashboard-page admin-live-page">
      <Toast message={toast} onDismiss={() => setToast('')} />
      <AdminHeader user={user} onLogout={handleLogout} />

      <section className="admin-live-hero panel" id="visao-geral">
        <div>
          <span className="live-badge">Pronto para live</span>
          <h1>Central da Live</h1>
          <p>Curadoria dos projetos enviados pela comunidade em tempo real.</p>
        </div>

        <div className="admin-live-metrics" aria-label="Metricas gerais">
          <article>
            <span>Fila total</span>
            <strong>{stats.total}</strong>
          </article>
          <article>
            <span>Para analisar</span>
            <strong>{stats.unseen}</strong>
          </article>
          <article>
            <span>Destaques</span>
            <strong>{stats.highlighted}</strong>
          </article>
          <article>
            <span>Comunidade</span>
            <strong>{stats.users}</strong>
          </article>
        </div>
      </section>

      <section className="admin-command-grid">
        <section className="admin-main-column">
          <article className="panel next-review-card">
            <div className="section-title inline-title">
              <div>
                <p className="eyebrow">Proxima analise</p>
                <h2>{nextProject?.title || 'Nenhum projeto na fila'}</h2>
                <p>{nextProject ? `${nextProject.userName} enviou este projeto para a curadoria.` : 'Quando a galera enviar projetos, o proximo item aparece aqui.'}</p>
              </div>
              <span className="counter-pill">{stats.unseen} pendentes</span>
            </div>

            {nextProject ? (
              <div className="next-review-actions">
                <a className="btn btn-primary" href={nextProject.url} target="_blank" rel="noreferrer">
                  Abrir projeto
                </a>
                <button className="btn btn-ghost" onClick={() => handleSeen(nextProject.id)} disabled={nextProject.seen}>
                  {nextProject.seen ? 'Ja visto' : 'Marcar visto'}
                </button>
                <button className="btn btn-ghost" onClick={() => handleHighlight(nextProject.id)}>
                  {nextProject.highlighted ? 'Remover destaque' : 'Destacar'}
                </button>
              </div>
            ) : null}
          </article>

          <section className="panel admin-panel admin-queue-panel" id="fila">
            <div className="admin-toolbar">
              <div className="section-title">
                <p className="eyebrow">Fila</p>
                <h2>Projetos enviados</h2>
                <p className="local-note">
                  Triagem conectada ao MongoDB pela API Node do projeto.
                </p>
              </div>

              <div className="toolbar-actions">
                <button className="btn btn-danger" onClick={handleClearAll} disabled={projects.length === 0}>
                  Limpar todos
                </button>
              </div>
            </div>

            <div className="filters-grid admin-live-filters">
              <label className="field">
                <span>Buscar</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Projeto, usuario, tecnologia ou descricao"
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

            <div className="admin-filter-chips" aria-label="Resumo da fila">
              <span>{filteredProjects.length} visiveis</span>
              <span>{stats.inProgress} em andamento</span>
              <span>{stats.finished} finalizados</span>
              <span>{stats.highlighted} destaques</span>
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
                    onReact={handleReact}
                  />
                ))}
              </div>
            )}
          </section>
        </section>

        <aside className="admin-side-column">
          <article className="panel draw-panel" id="sorteio">
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

          <article className="panel users-panel" id="comunidade">
          <div className="section-title inline-title">
            <div>
              <p className="eyebrow">Comunidade</p>
              <h2>Usuarios cadastrados</h2>
              <p>{stats.discordReady} com Discord liberado.</p>
            </div>
            <span className="counter-pill">{users.length}</span>
          </div>

          {users.length === 0 ? (
            <EmptyState title="Nenhum usuário registrado ainda." description="Quando alguém entrar com Google, aparece aqui." />
          ) : (
            <div className="users-list">
              {users.map((profile) => {
                const discordOn = profile.discordEnabled === true;
                const isAdminRow = profile.role === 'admin';
                return (
                  <div className="user-row" key={profile.uid}>
                    {profile.photoURL ? <img src={profile.photoURL} alt="" /> : <span>{profile.displayName?.slice(0, 1) || 'U'}</span>}
                    <div>
                      <strong>{profile.displayName}</strong>
                      <small>{profile.email}</small>
                    </div>
                    <div className="user-row-meta">
                      <em>{isAdminRow ? 'Admin' : `${profile.loginCount || 0} logins`}</em>
                      {isAdminRow ? null : (
                        <button
                          type="button"
                          className={`discord-switch ${discordOn ? 'is-on' : ''}`}
                          role="switch"
                          aria-checked={discordOn}
                          onClick={() => handleToggleDiscord(profile.uid, !discordOn)}
                        >
                          <span className="discord-switch-label">Discord</span>
                          <span className="discord-switch-track" aria-hidden="true">
                            <span className="discord-switch-thumb" />
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </article>

          <article className="panel activity-panel" id="historico">
            <div className="section-title inline-title">
              <div>
                <p className="eyebrow">Historico</p>
                <h2>Atividade recente</h2>
              </div>
              <span className="counter-pill">{recentActivity.length}</span>
            </div>

            {recentActivity.length === 0 ? (
              <EmptyState title="Sem atividade ainda." description="Projetos, usuarios e sorteios aparecem aqui." />
            ) : (
              <div className="activity-list">
                {recentActivity.map((item) => (
                  <div className="activity-item" key={item.id}>
                    <span />
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.label} • {item.meta}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </aside>
      </section>
    </main>
  );
}
