import { MongoClient } from 'mongodb';
import { env } from './env.js';

let cachedClient;
let cachedDb;
const indexesReady = {
  projects: false,
  users: false,
  draws: false
};

export async function getDb() {
  if (cachedDb) return cachedDb;

  if (!cachedClient) {
    cachedClient = new MongoClient(env.mongodbUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000
    });
    await cachedClient.connect();
  }

  cachedDb = cachedClient.db(env.mongodbDb);
  return cachedDb;
}

export async function getProjectsCollection() {
  const db = await getDb();
  const collection = db.collection(env.projectsCollection);

  if (!indexesReady.projects) {
    await Promise.all([
      collection.createIndex({ id: 1 }, { unique: true, name: 'project_id_unique' }),
      collection.createIndex({ userEmail: 1, createdAt: -1 }, { name: 'user_email_createdAt_desc' }),
      collection.createIndex({ createdAt: -1 }, { name: 'createdAt_desc' })
    ]);
    indexesReady.projects = true;
  }

  return collection;
}

export async function getUsersCollection() {
  const db = await getDb();
  const collection = db.collection(env.usersCollection);

  if (!indexesReady.users) {
    await Promise.all([
      collection.createIndex({ uid: 1 }, { unique: true, name: 'user_uid_unique' }),
      collection.createIndex({ email: 1 }, { name: 'user_email' }),
      collection.createIndex({ role: 1, lastLoginAt: -1 }, { name: 'role_lastLoginAt_desc' })
    ]);
    indexesReady.users = true;
  }

  return collection;
}

export async function getDrawsCollection() {
  const db = await getDb();
  const collection = db.collection(env.drawsCollection);

  if (!indexesReady.draws) {
    await Promise.all([
      collection.createIndex({ id: 1 }, { unique: true, name: 'draw_id_unique' }),
      collection.createIndex({ createdAt: -1 }, { name: 'draw_createdAt_desc' })
    ]);
    indexesReady.draws = true;
  }

  return collection;
}

export async function closeMongoConnection() {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = undefined;
    cachedDb = undefined;
    indexesReady.projects = false;
    indexesReady.users = false;
    indexesReady.draws = false;
  }
}
