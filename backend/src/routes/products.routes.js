const router = require('express').Router();
const { q, tx } = require('../config/db');
const { auth } = require('../middleware/auth');

router.use(auth());

router.get('/', async (req, res, next) => {
  try {
    const term = (req.query.q || '').toString().trim();
    const params = [];
    let where = 'WHERE 1 = 1';
    if (term) {
      where += ' AND (p.name LIKE ? OR p.sku LIKE ?)';
      params.push(`%${term}%`, `%${term}%`);
    }
    const rows = await q(
      `SELECT p.*, c.name AS category_name
       FROM products p LEFT JOIN product_categories c ON c.id = p.category_id
       ${where} ORDER BY p.id DESC LIMIT 500`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/categories', async (req, res, next) => {
  try {
    res.json(await q('SELECT * FROM product_categories ORDER BY name'));
  } catch (err) { next(err); }
});

router.post('/categories', async (req, res, next) => {
  try {
    const name = ((req.body || {}).name || '').trim();
    if (!name) return res.status(400).json({ error: 'El nombre de la categoría es obligatorio' });
    const result = await q('INSERT INTO product_categories (name) VALUES (?)', [name]);
    res.status(201).json({ id: result.insertId, name });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const rows = await q(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN product_categories c ON c.id = p.category_id WHERE p.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
    if (!b.sku || !b.sku.trim()) return res.status(400).json({ error: 'La referencia (SKU) es obligatoria' });
    const result = await q(
      `INSERT INTO products (name, sku, category_id, type, price, cost, qty_available, min_stock, uom, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.name.trim(), b.sku.trim(),
        b.category_id || null, b.type || 'product',
        Number(b.price) || 0, Number(b.cost) || 0,
        Number(b.qty_available) || 0, Number(b.min_stock) || 0,
        b.uom || 'Unidad', b.active === undefined ? 1 : (b.active ? 1 : 0)
      ]
    );
    const row = await q('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.status(201).json(row[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe un producto con esa referencia (SKU)' });
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    const current = await q('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!current[0]) return res.status(404).json({ error: 'Producto no encontrado' });
    await q(
      `UPDATE products SET name = ?, sku = ?, category_id = ?, type = ?, price = ?, cost = ?, min_stock = ?, uom = ?, active = ?
       WHERE id = ?`,
      [
        (b.name || current[0].name).trim(),
        (b.sku || current[0].sku).trim(),
        b.category_id !== undefined ? (b.category_id || null) : current[0].category_id,
        b.type || current[0].type,
        b.price !== undefined ? Number(b.price) || 0 : current[0].price,
        b.cost !== undefined ? Number(b.cost) || 0 : current[0].cost,
        b.min_stock !== undefined ? Number(b.min_stock) || 0 : current[0].min_stock,
        b.uom || current[0].uom,
        b.active !== undefined ? (b.active ? 1 : 0) : current[0].active,
        req.params.id
      ]
    );
    const row = await q('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json(row[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe un producto con esa referencia (SKU)' });
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await q('UPDATE products SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Ajuste manual de stock: { type: 'in' | 'out' | 'adjust', qty, reference }
router.post('/:id/stock', async (req, res, next) => {
  try {
    const { type = 'in', reference = null } = req.body || {};
    const qty = Number((req.body || {}).qty);
    if (!['in', 'out', 'adjust'].includes(type)) return res.status(400).json({ error: 'Tipo de movimiento inválido' });
    if (!qty || qty <= 0) return res.status(400).json({ error: 'La cantidad debe ser mayor que cero' });

    const result = await tx(async (conn) => {
      const [rows] = await conn.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [req.params.id]);
      const product = rows[0];
      if (!product) throw Object.assign(new Error('Producto no encontrado'), { status: 404 });
      if (product.type === 'service') throw Object.assign(new Error('Los servicios no gestionan stock'), { status: 400 });

      let delta = qty;
      if (type === 'out') {
        if (Number(product.qty_available) < qty) {
          throw Object.assign(new Error(`Stock insuficiente (disponible: ${product.qty_available})`), { status: 400 });
        }
        delta = -qty;
      }
      const newQty = type === 'adjust' ? qty : Number(product.qty_available) + delta;
      await conn.query('UPDATE products SET qty_available = ? WHERE id = ?', [newQty, req.params.id]);
      await conn.query(
        'INSERT INTO inventory_movements (product_id, type, qty, reference, user_id) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, type, qty, reference, req.user.id]
      );
      return { id: product.id, qty_available: newQty };
    });

    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
