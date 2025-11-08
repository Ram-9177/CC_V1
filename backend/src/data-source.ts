import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';

// Provide a lightweight local dev fallback using SQLite when SQLITE=true is set.
// This avoids needing Docker for quick frontend+backend runs during development.
const useSqlite = process.env.SQLITE === 'true';

let AppDataSource: DataSource;

if (useSqlite) {
  // sqlite database file under backend/tmp for quick local runs
  const sqliteFile = process.env.SQLITE_FILE || join(__dirname, '..', 'tmp', 'dev.sqlite');
  AppDataSource = new DataSource({
    type: 'sqlite',
    database: sqliteFile,
    synchronize: true,
    logging: false,
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
  });
} else {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5432', 10);
  const username = process.env.DB_USERNAME || 'postgres';
  const password = process.env.DB_PASSWORD || 'password';
  const database = process.env.DB_NAME || 'hostelconnect';

  AppDataSource = new DataSource({
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,
    synchronize: false,
    logging: false,
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations/*{.ts,.js}']
  });
}

// Allow running migrations via: node -r ts-node/register ./node_modules/typeorm/cli.js migration:run -d ./dist/src/data-source.js
// or during development: node -r ts-node/register ./node_modules/typeorm/cli.js migration:run -d ./src/data-source.ts

export default AppDataSource;
