import { useEffect, useRef } from 'react';

// Modal acessível: role="dialog" + aria-modal, fecha no ESC / clique no backdrop
// / botão "Fechar". Foca o botão de fechar ao abrir. Segue a identidade dark
// on-brand do app. Recebe a mensagem a exibir e onClose.
export default function NerdModal({ message, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="nerd-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="nerd-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nerd-modal-title"
      >
        <p className="eyebrow" id="nerd-modal-title">
          Acesso ao Discord
        </p>
        <p className="nerd-modal-message">{message}</p>
        <button
          type="button"
          className="btn btn-primary btn-full"
          onClick={() => onClose?.()}
          ref={closeRef}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
