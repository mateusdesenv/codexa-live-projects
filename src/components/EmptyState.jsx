export default function EmptyState({ title = 'Nenhum projeto cadastrado ainda.', description = 'Quando a galera enviar projetos, eles vão aparecer aqui.' }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">&lt;/&gt;</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
