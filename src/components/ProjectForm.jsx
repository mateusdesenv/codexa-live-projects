import { useState } from 'react';
import { createProjectId, isRequired, isValidUrl } from '../utils/validators.js';

const initialForm = {
  title: '',
  url: '',
  description: '',
  technologies: '',
  status: 'Em andamento'
};

export default function ProjectForm({ userName, userEmail, userPhotoURL, onSubmit }) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setSuccess(false);
  }

  function validate() {
    const nextErrors = {};

    if (!isRequired(form.title)) {
      nextErrors.title = 'Informe o nome do projeto.';
    }

    if (!isRequired(form.url)) {
      nextErrors.url = 'Informe o link do projeto.';
    } else if (!isValidUrl(form.url)) {
      nextErrors.url = 'O link precisa começar com http:// ou https://.';
    }

    if (!isRequired(form.description)) {
      nextErrors.description = 'Informe uma descrição curta.';
    }

    return nextErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const project = {
      id: createProjectId(),
      userName,
      userEmail,
      userPhotoURL: userPhotoURL || '',
      title: form.title.trim(),
      url: form.url.trim(),
      description: form.description.trim(),
      technologies: form.technologies.trim(),
      status: form.status,
      seen: false,
      highlighted: false,
      createdAt: new Date().toISOString()
    };

    setIsSubmitting(true);

    try {
      await onSubmit(project);
      setForm(initialForm);
      setSuccess(true);
    } catch {
      // O feedback do erro é responsabilidade do container (toast genérico).
      // Aqui apenas evitamos exibir sucesso e preservamos os dados digitados.
      setSuccess(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="project-form" onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        <label className="field">
          <span>Nome do projeto</span>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="Ex: Landing page da Barbearia"
          />
          {errors.title ? <small>{errors.title}</small> : null}
        </label>

        <label className="field">
          <span>Link do projeto</span>
          <input
            type="url"
            name="url"
            value={form.url}
            onChange={handleChange}
            placeholder="https://meuprojeto.com"
          />
          {errors.url ? <small>{errors.url}</small> : null}
        </label>
      </div>

      <label className="field">
        <span>Descrição curta</span>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          rows="4"
          placeholder="Conta rapidinho o que esse projeto faz."
        />
        {errors.description ? <small>{errors.description}</small> : null}
      </label>

      <div className="form-grid">
        <label className="field">
          <span>Tecnologias usadas</span>
          <input
            type="text"
            name="technologies"
            value={form.technologies}
            onChange={handleChange}
            placeholder="React, JavaScript, CSS"
          />
        </label>

        <label className="field">
          <span>Status</span>
          <select name="status" value={form.status} onChange={handleChange}>
            <option>Ideia</option>
            <option>Em andamento</option>
            <option>Finalizado</option>
          </select>
        </label>
      </div>

      <div className="form-footer">
        <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Enviando...' : 'Cadastrar projeto'}
        </button>
        {success ? <span className="success-message">Projeto enviado para o mural.</span> : null}
      </div>
    </form>
  );
}
