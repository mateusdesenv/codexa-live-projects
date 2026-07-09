import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

function splitOrigins(value) {
  if (!value || value.trim() === '*') return '*';
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3001),
  mongodbUri: required('MONGODB_URI'),
  mongodbDb: process.env.MONGODB_DB || 'codexa_live_projects',
  projectsCollection: process.env.PROJECTS_COLLECTION || 'codexa_live_projects',
  jsonLimit: process.env.JSON_LIMIT || '2mb',
  corsOrigin: splitOrigins(process.env.CORS_ORIGIN || '*')
};
