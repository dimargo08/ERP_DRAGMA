const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { q } = require('../config/db');
const { auth, SECRET } = require('../middleware/auth');

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map();

function loginLimiter(req, res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  if (attempts.size > 10000) attempts.clear();
  const entry = attempts.get(key);
  if (!entry || now > entry.reset) {
    attempts.set(key, { count: 1, reset: now + WINDOW_MS });
    return next();
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
  }
  next();
}

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
    const rows = await q('SELECT * FROM users WHERE email = ? LIMIT 1', [String(email).toLowerCase().trim()]);
    const user = rows[0];
    if (!user || !user.active) return res.status(401).json({ error: 'Credenciales inválidas' });
    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
    await q('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = jwt.sign(payload, SECRET, { expiresIn: '8h' });
    attempts.delete(req.ip || 'unknown');
    res.json({ token, user: payload });
  } catch (err) { next(err); }
});

router.get('/me', auth(), async (req, res, next) => {
  try {
    const rows = await q('SELECT id, name, email, role FROM users WHERE id = ?', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
