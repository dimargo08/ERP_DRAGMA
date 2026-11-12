const router = require('express').Router();
const { q } = require('../config/db');
const { auth } = require('../middleware/auth');

router.use(auth());

router.get('/', async (req, res, next) => {
  try {
    const term = (req.query.q || '').toString().trim();
    const type = (req.query.type || '').toString();
    const params = [];
    let where = 'WHERE 1 = 1';
    if (term) {
      where += ' AND (name LIKE ? OR email LIKE ? OR vat LIKE ?)';
      params.push(`%${term}%`, `%${term}%`, `%${term}%`);
    }
    if (['customer', 'supplier', 'both'].includes(type)) {
      where += ' AND (type = ? OR type = "both")';
      params.push(type);
    }
    const rows = await q(
      `SELECT p.*, 
        (SELECT COUNT(*) FROM sales_orders s WHERE s.partner_id = p.id) AS sales_count,
        (SELECT COUNT(*) FROM purchase_orders po WHERE po.supplier_id = p.id) AS purchases_count
       FROM partners p ${where} ORDER BY p.id DESC LIMIT 500`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await q('SELECT * FROM partners WHERE id = ?', [req.params.id]);
    if (!row[0]) return res.status(404).json({ error: 'Contacto no encontrado' });
    res.json(row[0]);
  } catch (err) { next(err); }
});

function validate(body) {
  if (!body.name || !body.name.trim()) return 'El nombre es obligatorio';
  if (body.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) return 'Email inválido';
  if (body.type && !['customer', 'supplier', 'both'].includes(body.type)) return 'Tipo inválido';
  return null;
}

router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    const invalid = validate(b);
    if (invalid) return res.status(400).json({ error: invalid });
    const result = await q(
      `INSERT INTO partners (name, email, phone, vat, type, address, city, country, is_company, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.name.trim(), b.email || null, b.phone || null, b.vat || null,
        b.type || 'customer', b.address || null, b.city || null, b.country || null,
        b.is_company === undefined ? 1 : (b.is_company ? 1 : 0), b.active === undefined ? 1 : (b.active ? 1 : 0)
      ]
    );
    const row = await q('SELECT * FROM partners WHERE id = ?', [result.insertId]);
    res.status(201).json(row[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    const invalid = validate(b);
    if (invalid) return res.status(400).json({ error: invalid });
    const current = await q('SELECT * FROM partners WHERE id = ?', [req.params.id]);
    if (!current[0]) return res.status(404).json({ error: 'Contacto no encontrado' });
    await q(
      `UPDATE partners SET name = ?, email = ?, phone = ?, vat = ?, type = ?, address = ?, city = ?, country = ?, is_company = ?, active = ?
       WHERE id = ?`,
      [
        (b.name || current[0].name).trim(),
        b.email !== undefined ? b.email : current[0].email,
        b.phone !== undefined ? b.phone : current[0].phone,
        b.vat !== undefined ? b.vat : current[0].vat,
        b.type || current[0].type,
        b.address !== undefined ? b.address : current[0].address,
        b.city !== undefined ? b.city : current[0].city,
        b.country !== undefined ? b.country : current[0].country,
        b.is_company !== undefined ? (b.is_company ? 1 : 0) : current[0].is_company,
        b.active !== undefined ? (b.active ? 1 : 0) : current[0].active,
        req.params.id
      ]
    );
    const row = await q('SELECT * FROM partners WHERE id = ?', [req.params.id]);
    res.json(row[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await q('UPDATE partners SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
