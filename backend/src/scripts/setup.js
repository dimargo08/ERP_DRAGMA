require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'sql', 'schema.sql'), 'utf8');
  const dbName = process.env.DB_NAME || 'dragma_erp';
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error('DB_NAME inválido');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    multipleStatements: true,
    charset: 'utf8mb4_general_ci'
  });
  console.log('→ Creando base de datos y tablas...');
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await conn.changeUser({ database: dbName });
  await conn.query(sql);
  await conn.end();
  console.log('✔ Esquema aplicado correctamente');
  const seed = require('./seed');
  await seed();
  process.exit(0);
})().catch((err) => {
  console.error('✖ Error:', err.message);
  process.exit(1);
});
