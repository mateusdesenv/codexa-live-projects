import { app } from './app.js';
import { env } from './config/env.js';

app.listen(env.port, () => {
  console.log(`Codexa Live Projects API rodando em http://localhost:${env.port}`);
});
