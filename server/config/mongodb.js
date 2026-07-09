import { MongoClient } from 'mongodb';
import { env } from './env.js';

let cachedClient;
let cachedDb;
let indexesReady = false;

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

  if (!indexesReady) {
    await Promise.all([
      collection.createIndex({ id: 1 }, { unique: true, name: 'project_id_unique' }),
      collection.createIndex({ userEmail: 1, createdAt: -1 }, { name: 'user_email_createdAt_desc' }),
      collection.createIndex({ createdAt: -1 }, { name: 'createdAt_desc' })
    ]);
    indexesReady = true;
  }

  return collection;
}

export async function closeMongoConnection() {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = undefined;
    cachedDb = undefined;
    indexesReady = false;
  }
}
