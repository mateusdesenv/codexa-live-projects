import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import Header from '../components/Header.jsx';
import ProjectCard from '../components/ProjectCard.jsx';
import ProjectForm from '../components/ProjectForm.jsx';
import { getUserName, signOutUser } from '../services/firebase.js';
import { createProject, fetchProjectsByUser } from '../services/storage.js';

export default function UserDashboard({ user }) {
  const navigate = useNavigate();
  const [userName] = useState(getUserName(user));
  const userEmail = user?.email || '';
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadProjects() {
      const userProjects = await fetchProjectsByUser(userEmail, userName);
      if (active) {
        setProjects(userProjects);
        setIsLoading(false);
      }
    }

    loadProjects();

    return () => {
      active = false;
    };
  }, [userEmail, userName]);

  async function handleCreateProject(project) {
    await createProject(project);
    setProjects(await fetchProjectsByUser(userEmail, userName));
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
