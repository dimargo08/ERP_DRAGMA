const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { q } = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');

router.use(auth(), requireRole('admin'));

router.get('/', async (req, res, next) => {
  try {
    const term = (req.query.q || '').toString().trim();
    const params = [];
    let where = 'WHERE 1 = 1';
    if (term) {
      where += ' AND (name LIKE ? OR email LIKE ?)';
      params.push(`%${term}%`, `%${term}%`);
    }
    const rows = await q(
      `SELECT id, name, email, role, active, last_login, created_at FROM users ${where} ORDER BY id`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
    if (!b.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email)) return res.status(400).json({ error: 'Email inválido' });
    if (!b.password || String(b.password).length < 4) return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
    if (!['admin', 'sales', 'purchase', 'accounting'].includes(b.role)) return res.status(400).json({ error: 'Rol inválido' });

    const hash = await bcrypt.hash(String(b.password), 10);
    const result = await q(
      'INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, ?)',
      [b.name.trim(), b.email.toLowerCase().trim(), hash, b.role, b.active === undefined ? 1 : (b.active ? 1 : 0)]
    );
    const row = await q('SELECT id, name, email, role, active FROM users WHERE id = ?', [result.insertId]);
    res.status(201).json(row[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    const current = await q('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!current[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (current[0].role === 'admin' && b.role && b.role !== 'admin') {
      const admins = await q("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1");
      if (admins[0].c <= 1) return res.status(400).json({ error: 'Debe existir al menos un administrador activo' });
    }

    let hash = current[0].password_hash;
    if (b.password) {
      if (String(b.password).length < 4) return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
      hash = await bcrypt.hash(String(b.password), 10);
    }
    await q(
      'UPDATE users SET name = ?, email = ?, password_hash = ?, role = ?, active = ? WHERE id = ?',
      [
        (b.name || current[0].name).trim(),
        (b.email || current[0].email).toLowerCase().trim(),
        hash,
        ['admin', 'sales', 'purchase', 'accounting'].includes(b.role) ? b.role : current[0].role,
        b.active !== undefined ? (b.active ? 1 : 0) : current[0].active,
        req.params.id
      ]
    );
    const row = await q('SELECT id, name, email, role, active, last_login FROM users WHERE id = ?', [req.params.id]);
    res.json(row[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const target = await q('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!target[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (target[0].id === req.user.id) return res.status(400).json({ error: 'No puedes desactivar tu propio usuario' });
    if (target[0].role === 'admin') {
      const admins = await q("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1");
      if (admins[0].c <= 1) return res.status(400).json({ error: 'Debe existir al menos un administrador activo' });
    }
    await q('UPDATE users SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
