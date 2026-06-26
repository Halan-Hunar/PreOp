const mysql = require('mysql2/promise');

// Enable SSL only when a CA cert is provided (managed hosts like Aiven require it).
// Local dev with no DB_CA_CERT keeps SSL off so nothing breaks.
const ssl = process.env.DB_CA_CERT
  ? { rejectUnauthorized: true, ca: process.env.DB_CA_CERT }
  : undefined;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  ...(ssl && { ssl }),
});

module.exports = pool;
