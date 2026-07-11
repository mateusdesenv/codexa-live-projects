import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DiscordConnectCard from '../components/DiscordConnectCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Header from '../components/Header.jsx';
import ProjectCard from '../components/ProjectCard.jsx';
import ProjectForm from '../components/ProjectForm.jsx';
import Toast from '../components/Toast.jsx';
import { isAdminUser, signOutUser } from '../services/firebase.js';
import {
  createProject,
  fetchProjectsByUser,
  isProcessingUnavailable
} from '../services/storage.js';
import { getDisplayName, updateUserProfile, upsertUserSession } from '../services/users.js';

const GENERIC_ERROR =
  'Não foi possível processar seu cadastro agora. Tente novamente mais tarde.';

export default function UserDashboard({ user }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const userEmail = user?.email || '';
  const [profile, setProfile] = useState(null);
  const [nickname, setNickname] = useState('');
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [toast, setToast] = useState('');
  const [discordConnected, setDiscordConnected] = useState(false);
  const [discordMessage, setDiscordMessage] = useState('');
  const userName = getDisplayName(profile, user);
  const isAdmin = isAdminUser(user);
  const showDiscordCard =
    !isAdmin && !discordConnected && profile !== null && !profile.discordId;

  // Retorno do fluxo OAuth do Discord: ?discord=1 (sucesso) | 0 (erro). Limpa o
  // parâmetro da URL para não reprocessar em re-render/reload.
  useEffect(() => {
    const discordResult = searchParams.get('discord');
    if (discordResult === null) return;

    if (discordResult === '1') {
      setDiscordConnected(true);
      setDiscordMessage('Discord conectado. Você já entrou na sala.');
    } else {
      setToast('Não deu para conectar o Discord. Tente de novo.');
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('discord');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const profileProgress = useMemo(() => {
    const checks = [user?.photoURL, userName, userEmail, nickname.trim(), projects.length > 0];
    const completed = checks.filter(Boolean).length;
    return {
      completed,
      total: checks.length,
      percent: Math.round((completed / checks.length) * 100)
    };
  }, [nickname, projects.length, user?.photoURL, userEmail, userName]);

  const userXp = profileProgress.completed * 20 + projects.length * 40;
  const ranking = useMemo(() => {
    const mockRanking = [
      { name: 'Codexa Crew', xp: 420 },
      { name: 'Dev da live', xp: 340 },
      { name: 'Frontend Pro', xp: 260 },
      { name: 'Projeto Ninja', xp: 210 }
    ];

    return [{ name: userName, photoURL: user?.photoURL, xp: userXp, isCurrent: true }, ...mockRanking]
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 5);
  }, [user?.photoURL, userName, userXp]);

  const currentRank = ranking.findIndex((item) => item.isCurrent) + 1 || 12;
  const missions = [
    {
      title: 'Complete seu perfil',
      description: `${profileProgress.completed}/${profileProgress.total} etapas`,
      xp: 50,
      progress: profileProgress.percent
    },
    {
      title: 'Envie 3 projetos',
      description: `${Math.min(projects.length, 3)}/3 enviados`,
      xp: 120,
      progress: Math.min(100, Math.round((projects.length / 3) * 100))
    },
    {
      title: 'Comente 5 projetos',
      description: '0/5 comentarios',
      xp: 80,
      progress: 0
    }
  ];

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      const nextProfile = await upsertUserSession(user);
      const displayName = getDisplayName(nextProfile, user);
      const userProjects = await fetchProjectsByUser(userEmail, displayName);
      if (!active) return;

      setProfile(nextProfile);
      setNickname(nextProfile.publicNickname || '');
      setProjects(userProjects);
      if (nextProfile?.blocked === true) setToast(GENERIC_ERROR);
      setIsLoading(false);
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [user, userEmail]);

  useEffect(() => {
    let active = true;
    const load = () => {
      fetchProjectsByUser(userEmail, userName)
        .then((data) => {
          if (active) setProjects(data);
        })
        .catch(() => {});
    };
    const interval = setInterval(load, 20000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', load);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', load);
    };
  }, [userEmail, userName]);

  async function handleCreateProject(project) {
    try {
      // Identidade (uid/email) vem do ID token no backend; não enviamos como
      // fonte de verdade no corpo. Mantemos o project local para o fallback.
      await createProject(project);
      setToast('');
      setProjects(await fetchProjectsByUser(userEmail, userName));
    } catch (error) {
      if (isProcessingUnavailable(error)) {
        setToast(GENERIC_ERROR);
      }
      throw error;
    }
  }

  async function handleSaveProfile(event) {
    event.preventDefault();
    setIsSavingProfile(true);
    setProfileMessage('');

    try {
      const nextProfile = await updateUserProfile(user.uid, { publicNickname: nickname });
      setProfile(nextProfile);
      setNickname(nextProfile.publicNickname || '');
      setProfileMessage('Conta atualizada.');
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleLogout() {
    await signOutUser();
    navigate('/');
  }

  return (
    <main className="dashboard-page social-dashboard-page">
      <Toast message={toast} onDismiss={() => setToast('')} />
      <Header
        title="Mural da live"
        subtitle={`Fala, ${userName}. Cadastra teus projetos, acompanha tua evolucao e deixa tudo pronto para aparecer na analise.`}
        userName={userName}
        photoURL={user?.photoURL}
        actions={
          <button className="btn btn-ghost" onClick={handleLogout}>
            Sair
          </button>
        }
      />

      <nav className="social-tabs" aria-label="Areas do mural">
        <a href="#novo-projeto">Novo projeto</a>
        <a href="#feed">Feed</a>
        <a href="#missoes">Missoes</a>
        <a href="#ranking">Ranking</a>
      </nav>

      <section className="dashboard-grid social-dashboard-grid">
        <aside className="social-sidebar left-sidebar">
          <section className="panel account-card social-profile-card">
            <div className="account-card-top">
              {user?.photoURL ? <img src={user.photoURL} alt="" /> : <span>{userName.slice(0, 1)}</span>}
              <div>
                <p className="eyebrow">Seu perfil</p>
                <h2>{userName}</h2>
                <p>{userEmail}</p>
              </div>
            </div>

            <div className="profile-progress">
              <div>
                <span>Perfil completo</span>
                <strong>{profileProgress.percent}%</strong>
              </div>
              <div className="progress-track" aria-label={`Perfil ${profileProgress.percent}% completo`}>
                <span style={{ width: `${profileProgress.percent}%` }} />
              </div>
              <p>{profileProgress.completed} de {profileProgress.total} passos prontos para a live.</p>
            </div>

            <form className="nickname-form" onSubmit={handleSaveProfile}>
              <label className="field">
                <span>Apelido publico</span>
                <input
                  type="text"
                  value={nickname}
                  onChange={(event) => {
                    setNickname(event.target.value);
                    setProfileMessage('');
                  }}
                  maxLength="32"
                  placeholder="Ex: @seunome no TikTok"
                />
              </label>
              <button className="btn btn-ghost" type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? 'Salvando...' : 'Salvar apelido'}
              </button>
              {profileMessage ? <span className="success-message">{profileMessage}</span> : null}
            </form>
          </section>

          {showDiscordCard ? (
            <DiscordConnectCard discordEnabled={profile?.discordEnabled === true} />
          ) : null}
          {discordMessage ? (
            <p className="success-message discord-success">{discordMessage}</p>
          ) : null}
        </aside>

        <section className="feed-column">
          <section className="panel social-hero">
            <div>
              <p className="eyebrow">Feed da comunidade</p>
              <h2>Mostra teu projeto para a live.</h2>
              <p>Os envios viram posts no mural e ficam prontos para analise, sorteios e futuras missoes.</p>
            </div>
            <div className="hero-stats">
              <span><strong>{projects.length}</strong> projetos</span>
              <span><strong>{userXp}</strong> XP</span>
              <span><strong>{currentRank || 12}</strong> posicao</span>
            </div>
          </section>

          <section className="panel composer-panel" id="novo-projeto">
            <div className="section-title">
              <p className="eyebrow">Novo post</p>
              <h2>Cadastrar projeto</h2>
              <p>Coloque o link, uma descrição curta e as principais tecnologias.</p>
            </div>

            <ProjectForm
              userName={userName}
              userEmail={userEmail}
              userPhotoURL={user?.photoURL}
              onSubmit={handleCreateProject}
            />
          </section>

          <section className="panel list-panel social-feed-panel" id="feed">
            <div className="section-title inline-title">
              <div>
                <p className="eyebrow">Mural</p>
                <h2>Seus projetos no feed</h2>
              </div>
              <span className="counter-pill">{projects.length}</span>
            </div>

            {projects.length === 0 ? (
              <EmptyState
                title={isLoading ? 'Carregando seus projetos...' : 'Nenhum projeto cadastrado ainda.'}
                description="Quando você enviar um projeto, ele aparece aqui como post do mural."
              />
            ) : (
              <div className="project-list">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </section>
        </section>

        <aside className="right-sidebar">
          <section className="panel social-card ranking-card" id="ranking">
            <div className="section-title inline-title">
              <div>
                <p className="eyebrow">Ranking</p>
                <h2>Ranking da live</h2>
              </div>
              <button className="btn btn-ghost btn-small" type="button">Ver</button>
            </div>

            <div className="ranking-list">
              {ranking.map((item, index) => (
                <div className={item.isCurrent ? 'ranking-item is-current' : 'ranking-item'} key={`${item.name}-${index}`}>
                  {item.photoURL ? <img src={item.photoURL} alt="" /> : <span>{item.name.slice(0, 1)}</span>}
                  <div>
                    <strong>{index + 1}. {item.name}</strong>
                    <div className="progress-track">
                      <span style={{ width: `${Math.min(100, Math.round((item.xp / 420) * 100))}%` }} />
                    </div>
                  </div>
                  <em>{item.xp} XP</em>
                </div>
              ))}
            </div>

            <p className="ranking-note">Sua posição: {currentRank || 12}o · {userXp} XP</p>
          </section>

          <section className="panel social-card missions-card" id="missoes">
            <p className="eyebrow">Missoes</p>
            <h2>Ganhe XP</h2>
            <div className="missions-list">
              {missions.map((mission) => (
                <div className="mission-item" key={mission.title}>
                  <div>
                    <strong>{mission.title}</strong>
                    <span>{mission.description}</span>
                  </div>
                  <em>+{mission.xp} XP</em>
                  <div className="progress-track">
                    <span style={{ width: `${mission.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel social-card live-card">
            <span className="live-badge">Em breve</span>
            <h2>Participe das lives</h2>
            <p>Acompanhe as analises ao vivo e veja seu projeto sendo comentado.</p>
            <a className="btn btn-primary btn-full" href="#" onClick={(event) => event.preventDefault()}>
              Ver proximas lives
            </a>
          </section>
        </aside>
      </section>
    </main>
  );
}
