const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function makeDatabaseConfig(environment, defaultDatabase, allowLocalDefaults = false) {
  const prefix = `DB_${environment.toUpperCase()}`;
  const localFallback = (key, fallback) =>
    allowLocalDefaults ? process.env[key] || fallback : process.env[key];

  return {
    database: process.env[`${prefix}_NAME`] || defaultDatabase,
    username: process.env[`${prefix}_USER`] || localFallback("PGUSER", "postgres"),
    password:
      process.env[`${prefix}_PASSWORD`] ??
      (allowLocalDefaults ? process.env.PGPASSWORD || "" : undefined),
    host: process.env[`${prefix}_HOST`] || localFallback("PGHOST", "127.0.0.1"),
    port: Number(process.env[`${prefix}_PORT`] || process.env.PGPORT || 5432),
    dialect: "postgres",
    logging: false,
  };
}

function makeProductionConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return makeDatabaseConfig("production", "hacktiv_chess_production");

  const url = new URL(connectionString);
  if (!(["postgres:", "postgresql:"].includes(url.protocol)) || !url.hostname || !url.pathname.slice(1)) {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  return {
    database: decodeURIComponent(url.pathname.slice(1)),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: Number(url.port || 5432),
    dialect: "postgres",
    dialectOptions: { ssl: { rejectUnauthorized: true } },
    logging: false,
  };
}

module.exports = {
  development: makeDatabaseConfig("development", "hacktiv_chess_development", true),
  test: makeDatabaseConfig("test", "hacktiv_chess_testing", true),
  production: makeProductionConfig(),
};
