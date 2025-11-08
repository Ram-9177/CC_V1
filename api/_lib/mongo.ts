import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('MONGODB_URI not set in environment');
}

// Cache the mongoose connection across serverless invocations
let cached = (global as any)._mongoosePromise as Promise<typeof mongoose> | undefined;

if (!cached) {
  cached = mongoose
    .connect(uri, {
      // keep pool small on free/free-tier
      maxPoolSize: Number(process.env.MONGO_POOL_SIZE || 5),
      serverSelectionTimeoutMS: 5000,
    })
    .then(() => mongoose);
  (global as any)._mongoosePromise = cached;
}

export default cached;