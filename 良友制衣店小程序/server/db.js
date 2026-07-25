
const mysql = require('mysql2/promise');

let pool = null;

async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: 'liangyou_tailor',
      waitForConnections: true,
      connectionLimit: 1,
      charset: 'utf8mb4'
    });
  }
  return pool;
}

module.exports = { getPool };
