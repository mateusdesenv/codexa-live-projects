import { formatDate } from '../utils/validators.js';

function parseTechs(value) {
  if (Array.isArray(value)) return value;
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ProjectCard({ project, mode = 'user', onSeen, onHighlight, onDelete, onReact }) {
  const isAdmin = mode === 'admin';
  const techs = parseTechs(project.technologies);
  const authorInitial = (project.userName || 'U').slice(0, 1).toUpperCase();

  return (
    <article className={`project-card ${!project.seen ? 'is-new' : ''} ${project.highlighted ? 'is-highlighted' : ''}`}>
      <div className="project-card-top">
        <div className="project-author">
          {project.userPhotoURL ? <img src={project.userPhotoURL} alt="" /> : <span>{authorInitial}</span>}
          <div>
            <strong>{project.userName}</strong>
            <small>{formatDate(project.createdAt)}</small>
          </div>
        </div>

        <div className="project-card-heading">
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

      {techs.length > 0 ? (
        <div className="tech-list" aria-label="Tecnologias usadas">
          {techs.map((tech) => (
            <span key={`${project.id}-${tech}`}>{tech}</span>
          ))}
        </div>
      ) : null}

      <div className="project-meta social-meta">
        <span>{project.savedCount || 0} salvos</span>
        <span>{project.commentCount || 0} comentarios</span>
        <span>{!project.seen ? 'Na fila da live' : 'Visto pelo admin'}</span>
      </div>

      <a className="project-link" href={project.url} target="_blank" rel="noreferrer">
        Abrir projeto
      </a>

      {isAdmin ? (
        <div className="card-actions">
          <div className="admin-reaction-row" aria-label="Reacoes rapidas">
            {['HOT', 'VER', 'LIVE'].map((reaction) => (
              <button
                className="reaction-button"
                key={reaction}
                type="button"
                onClick={() => onReact?.(project, reaction)}
              >
                {reaction}
              </button>
            ))}
          </div>
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
