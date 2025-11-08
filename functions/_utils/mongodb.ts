import { MongoClient, Db, ObjectId } from 'mongodb';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export interface EnvMongo {
  MONGODB_CONNECTION_STRING: string;
  MONGODB_DATABASE: string;
}

export async function getMongoClient(env: EnvMongo): Promise<MongoClient> {
  if (cachedClient) return cachedClient;
  const uri = env.MONGODB_CONNECTION_STRING;
  if (!uri) throw new Error('Missing MONGODB_CONNECTION_STRING');
  const client = new MongoClient(uri, { serverApi: { version: '1' as any } });
  await client.connect();
  cachedClient = client;
  return client;
}

export async function getDatabase(env: EnvMongo): Promise<Db> {
  if (cachedDb) return cachedDb;
  const client = await getMongoClient(env);
  const dbName = env.MONGODB_DATABASE;
  if (!dbName) throw new Error('Missing MONGODB_DATABASE');
  cachedDb = client.db(dbName);
  return cachedDb;
}

export { ObjectId };
