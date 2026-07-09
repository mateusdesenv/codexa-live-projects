# Live Projects

App React + Vite com API Node + MongoDB para lives de programação.

O sistema permite que espectadores entrem com Google/Firebase, cadastrem links de projetos e que o administrador visualize, filtre, destaque, marque como visto e remova projetos.

## Stack

- React
- Vite
- JavaScript
- CSS puro
- React Router DOM
- Firebase Auth
- Node.js
- Express
- MongoDB

## Como rodar

```bash
pnpm install
cp .env.example .env
pnpm api:dev
pnpm dev
```

Depois acesse a URL local exibida pelo Vite.

## Rotas

- `/` — login único com Google
- `/dashboard` — dashboard do espectador
- `/admin` — dashboard admin

## Acesso

- `mateus.desenv@gmail.com` — administrador com acesso total
- qualquer outro e-mail — usuário com acesso apenas aos próprios projetos

## Persistência

Os dados ficam no MongoDB pela API Node.

Variáveis principais:

- `MONGODB_URI`
- `MONGODB_DB`
- `PROJECTS_COLLECTION=codexa_live_projects`
- `VITE_API_URL`

## Observação

O frontend mantém fallback local em `localStorage` se a API estiver offline durante desenvolvimento.
