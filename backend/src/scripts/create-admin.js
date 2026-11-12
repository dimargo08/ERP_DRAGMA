require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

(async () => {
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = process.env.ADMIN_NAME || 'Administrador';

  if (!email || password.length < 8) {
    console.error('Define ADMIN_EMAIL y ADMIN_PASSWORD (mínimo 8 caracteres) como variables de entorno.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, 'admin', 1)
     ON DUPLICATE KEY UPDATE name = ?, password_hash = ?, role = 'admin', active = 1`,
    [name, email, hash, name, hash]
  );
  console.log(`✔ Administrador ${email} creado o actualizado`);
  await pool.end();
})().catch((err) => {
  console.error('✖ Error:', err.message);
  process.exit(1);
});
