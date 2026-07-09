import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import Header from '../components/Header.jsx';
import ProjectCard from '../components/ProjectCard.jsx';
import ProjectForm from '../components/ProjectForm.jsx';
import { getUserName, signOutUser } from '../services/firebase.js';
import { createProject, fetchProjectsByUser } from '../services/storage.js';
import { getDisplayName, updateUserProfile, upsertUserSession } from '../services/users.js';

export default function UserDashboard({ user }) {
  const navigate = useNavigate();
  const userEmail = user?.email || '';
  const [profile, setProfile] = useState(null);
  const [nickname, setNickname] = useState('');
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const userName = getDisplayName(profile, user);

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
      setIsLoading(false);
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [user, userEmail]);

  async function handleCreateProject(project) {
    await createProject(project);
    setProjects(await fetchProjectsByUser(userEmail, userName));
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
    <main className="dashboard-page">
      <Header
        title={`Fala, ${userName}`}
        subtitle="Cadastra teu projeto no mural da live. Depois ele pode aparecer na análise do admin."
        userName={userName}
        photoURL={user?.photoURL}
        actions={
          <button className="btn btn-ghost" onClick={handleLogout}>
            Sair
          </button>
        }
      />

      <section className="dashboard-grid">
        <div className="panel form-panel">
          <div className="account-card">
            <div className="account-card-top">
              {user?.photoURL ? <img src={user.photoURL} alt="" /> : <span>{userName.slice(0, 1)}</span>}
              <div>
                <p className="eyebrow">Sua conta</p>
                <h2>{userName}</h2>
                <p>{userEmail}</p>
              </div>
            </div>

            <form className="nickname-form" onSubmit={handleSaveProfile}>
              <label className="field">
                <span>Apelido público</span>
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
          </div>

          <div className="section-title">
            <p className="eyebrow">Novo envio</p>
            <h2>Cadastrar projeto</h2>
            <p>Coloque o link, uma descrição curta e as principais tecnologias.</p>
          </div>

          <ProjectForm userName={userName} userEmail={userEmail} onSubmit={handleCreateProject} />
        </div>

        <div className="panel list-panel">
          <div className="section-title inline-title">
            <div>
              <p className="eyebrow">Seus envios</p>
              <h2>Projetos cadastrados</h2>
            </div>
            <span className="counter-pill">{projects.length}</span>
          </div>

          {projects.length === 0 ? (
            <EmptyState
              title={isLoading ? 'Carregando seus projetos...' : 'Nenhum projeto cadastrado ainda.'}
              description="Quando você enviar um projeto, ele aparece aqui."
            />
          ) : (
            <div className="project-list">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
