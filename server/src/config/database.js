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

module.exports = {
  development: makeDatabaseConfig("development", "hacktiv_chess_development", true),
  test: makeDatabaseConfig("test", "hacktiv_chess_testing", true),
  production: makeDatabaseConfig("production", "hacktiv_chess_production"),
};
