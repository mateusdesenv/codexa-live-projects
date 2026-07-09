import { formatDate } from '../utils/validators.js';

export default function ProjectCard({ project, mode = 'user', onSeen, onHighlight, onDelete }) {
  const isAdmin = mode === 'admin';

  return (
    <article className={`project-card ${!project.seen ? 'is-new' : ''} ${project.highlighted ? 'is-highlighted' : ''}`}>
      <div className="project-card-top">
        <div>
          <div className="project-badges">
            <span className={`status-badge status-${project.status.toLowerCase().replaceAll(' ', '-')}`}>
              {project.status}
            </span>
            {!project.seen ? <span className="new-badge">Novo</span> : <span className="seen-badge">Visto</span>}
            {project.highlighted ? <span className="highlight-badge">Destaque da live</span> : null}
          </div>
          <h3>{project.title}</h3>
        </div>
      </div>

      <p className="project-description">{project.description}</p>

      {project.technologies ? (
        <div className="tech-list" aria-label="Tecnologias usadas">
          {project.technologies.split(',').map((tech) => (
            <span key={`${project.id}-${tech.trim()}`}>{tech.trim()}</span>
          ))}
        </div>
      ) : null}

      <div className="project-meta">
        <span>Por {project.userName}</span>
        <span>{formatDate(project.createdAt)}</span>
      </div>

      <a className="project-link" href={project.url} target="_blank" rel="noreferrer">
        Abrir projeto
      </a>

      {isAdmin ? (
        <div className="card-actions">
          <button className="btn btn-ghost" onClick={() => onSeen(project.id)} disabled={project.seen}>
            {project.seen ? 'Já visto' : 'Marcar como visto'}
          </button>
          <button className="btn btn-ghost" onClick={() => onHighlight(project.id)}>
            {project.highlighted ? 'Remover destaque' : 'Destacar'}
          </button>
          <button className="btn btn-danger" onClick={() => onDelete(project.id)}>
            Remover
          </button>
        </div>
      ) : null}
    </article>
  );
}
