import { Link } from 'react-router-dom';

export default function Header({ title, subtitle, userName, photoURL, actions }) {
  return (
    <header className="app-header">
      <Link to="/" className="brand" aria-label="Voltar para início">
        <span className="brand-mark">LP</span>
        <span>Live Projects</span>
      </Link>

      <div className="header-copy">
        <p className="eyebrow">Mural da live</p>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>

      <div className="header-actions">
        {userName ? (
          <span className="user-pill">
            {photoURL ? <img src={photoURL} alt="" /> : null}
            {userName}
          </span>
        ) : null}
        {actions}
      </div>
    </header>
  );
}
