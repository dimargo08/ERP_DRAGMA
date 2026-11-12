require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { isProd, corsOrigins, publicDir } = require('./config/env');
const { auth } = require('./middleware/auth');

const app = express();

app.disable('x-powered-by');
if (isProd) app.set('trust proxy', 1);

app.use(cors({ origin: corsOrigins.length ? corsOrigins : false }));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (isProd && req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'Dragma ERP API' }));

app.use('/api/auth', require('./routes/auth.routes'));

const protectedRoutes = [
  ['users', require('./routes/users.routes')],
  ['partners', require('./routes/partners.routes')],
  ['products', require('./routes/products.routes')],
  ['inventory', require('./routes/inventory.routes')],
  ['sales/orders', require('./routes/sales.routes')],
  ['sales/deals', require('./routes/deals.routes')],
  ['purchases', require('./routes/purchases.routes')],
  ['invoices', require('./routes/invoices.routes')],
  ['dashboard', require('./routes/dashboard.routes')]
];
for (const [route, handler] of protectedRoutes) app.use(`/api/${route}`, auth(), handler);

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

const indexFile = path.join(publicDir, 'index.html');
if (fs.existsSync(indexFile)) {
  app.use(
    express.static(publicDir, {
      index: false,
      maxAge: isProd ? '1y' : 0,
      setHeaders: (res, filePath) => {
        if (/[\\/](index\.html|config\.js)$/.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
      }
    })
  );
  app.get(/^\/(?!api\/).*/, (req, res, next) => {
    if (!req.accepts('html') || /\.[a-z0-9]+$/i.test(req.path)) return next();
    res.sendFile(indexFile, { headers: { 'Cache-Control': 'no-cache' } });
  });
}

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  console.error('[Dragma]', err.message);
  res
    .status(err.status || 500)
    .json({ error: isProd ? 'Error interno del servidor' : err.message || 'Error interno del servidor' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🐉 Dragma ERP API escuchando en ${PORT}`);
});
