import { useEffect } from 'react';

// Toast mínimo e acessível: role="alert" para leitores de tela, auto-dismiss e
// dispensa manual. Segue a identidade visual (tokens dark, verde/erro).
export default function Toast({ message, variant = 'error', onDismiss, duration = 4000 }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => onDismiss?.(), duration);
    return () => clearTimeout(timer);
  }, [message, duration, onDismiss]);

  if (!message) return null;

  return (
    <div className="toast-viewport">
      <div className={`toast toast-${variant}`} role="alert" aria-live="assertive">
        <span className="toast-message">{message}</span>
        <button
          type="button"
          className="toast-close"
          onClick={() => onDismiss?.()}
          aria-label="Fechar aviso"
        >
          ×
        </button>
      </div>
    </div>
  );
}
