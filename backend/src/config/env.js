require('dotenv').config();
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';
const secret = (process.env.JWT_SECRET || '').trim();
const insecureSecret =
  !secret ||
  secret.length < 32 ||
  /cambia-esta-clave|dragma-dev-secret/i.test(secret);

if (isProd && insecureSecret) {
  console.error(
    '[Dragma] JWT_SECRET no es seguro. Define una cadena aleatoria de al menos 32 caracteres en las variables de entorno.'
  );
  process.exit(1);
}

module.exports = {
  isProd,
  JWT_SECRET: insecureSecret ? 'dragma-dev-secret-no-usar-en-produccion' : secret,
  corsOrigins: (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  publicDir: process.env.PUBLIC_DIR || path.join(__dirname, '..', '..', 'public')
};
