const router = require('express').Router();
const { q, tx } = require('../config/db');
const { auth } = require('../middleware/auth');

router.use(auth());

const round2 = (n) => Math.round(n * 100) / 100;

async function recalcTotals(conn, orderId) {
  const [rows] = await conn.query('SELECT COALESCE(SUM(subtotal), 0) AS t FROM purchase_order_lines WHERE order_id = ?', [orderId]);
  const total = round2(Number(rows[0].t));
  await conn.query('UPDATE purchase_orders SET amount_untaxed = ?, amount_total = ? WHERE id = ?', [total, total, orderId]);
  return total;
}

router.get('/', async (req, res, next) => {
  try {
    const params = [];
    let where = 'WHERE 1 = 1';
    const term = (req.query.q || '').toString().trim();
    const state = (req.query.state || '').toString();
    if (term) {
      where += ' AND (po.name LIKE ? OR p.name LIKE ?)';
      params.push(`%${term}%`, `%${term}%`);
    }
    if (['draft', 'confirmed', 'received', 'done', 'cancel'].includes(state)) {
      where += ' AND po.state = ?';
      params.push(state);
    }
    const rows = await q(
      `SELECT po.*, p.name AS supplier_name, u.name AS buyer_name
       FROM purchase_orders po
       JOIN partners p ON p.id = po.supplier_id
       LEFT JOIN users u ON u.id = po.user_id
       ${where} ORDER BY po.id DESC LIMIT 300`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const orders = await q(
      `SELECT po.*, p.name AS supplier_name, p.email AS supplier_email, u.name AS buyer_name
       FROM purchase_orders po
       JOIN partners p ON p.id = po.supplier_id
       LEFT JOIN users u ON u.id = po.user_id
       WHERE po.id = ?`,
      [req.params.id]
    );
    if (!orders[0]) return res.status(404).json({ error: 'Compra no encontrada' });
    const lines = await q(
      `SELECT l.*, p.sku FROM purchase_order_lines l LEFT JOIN products p ON p.id = l.product_id WHERE l.order_id = ? ORDER BY l.id`,
      [req.params.id]
    );
    res.json({ ...orders[0], lines });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.supplier_id) return res.status(400).json({ error: 'Selecciona un proveedor' });
    const ids = (Array.isArray(b.lines) ? b.lines : []).map((l) => Number(l.product_id)).filter(Boolean);
    const productRows = ids.length ? await q(`SELECT id, name, cost FROM products WHERE id IN (${ids.map(() => '?').join(',')})`, ids) : [];
    const productMap = new Map(productRows.map((p) => [p.id, p]));
    const lines = Array.isArray(b.lines) ? b.lines : [];
    if (!lines.length) return res.status(400).json({ error: 'La compra necesita al menos una línea' });

    const orderId = await tx(async (conn) => {
      const [r] = await conn.query(
        'INSERT INTO purchase_orders (supplier_id, user_id, state, expected_date, notes) VALUES (?, ?, "draft", ?, ?)',
        [b.supplier_id, req.user.id, b.expected_date || null, b.notes || null]
      );
      for (const l of lines) {
        const prod = l.product_id ? productMap.get(Number(l.product_id)) : null;
        await conn.query(
          'INSERT INTO purchase_order_lines (order_id, product_id, description, qty, price_unit) VALUES (?, ?, ?, ?, ?)',
          [
            r.insertId, prod ? prod.id : null,
            (l.description || (prod && prod.name) || '').slice(0, 200),
            Number(l.qty), Number(l.price_unit ?? (prod ? prod.cost : 0))
          ]
        );
      }
      await recalcTotals(conn, r.insertId);
      const year = new Date().getFullYear();
      await conn.query('UPDATE purchase_orders SET name = ? WHERE id = ?', [`PO-${year}-${String(r.insertId).padStart(4, '0')}`, r.insertId]);
      return r.insertId;
    });

    const row = await q('SELECT * FROM purchase_orders WHERE id = ?', [orderId]);
    res.status(201).json(row[0]);
  } catch (err) { next(err); }
});

// Acciones: confirm | receive | done | cancel
router.post('/:id/action', async (req, res, next) => {
  try {
    const action = (req.body || {}).action;
    const result = await tx(async (conn) => {
      const [rows] = await conn.query('SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE', [req.params.id]);
      const order = rows[0];
      if (!order) throw Object.assign(new Error('Compra no encontrada'), { status: 404 });

      if (action === 'confirm') {
        if (order.state !== 'draft') throw Object.assign(new Error('Solo los borradores pueden confirmarse'), { status: 400 });
        await conn.query("UPDATE purchase_orders SET state = 'confirmed' WHERE id = ?", [order.id]);
      } else if (action === 'receive') {
        if (order.state !== 'confirmed') throw Object.assign(new Error('Debes confirmar la compra antes de recibirla'), { status: 400 });
        const [lines] = await conn.query(
          `SELECT l.* FROM purchase_order_lines l JOIN products p ON p.id = l.product_id
           WHERE l.order_id = ? AND p.type = 'product'`,
          [order.id]
        );
        for (const l of lines) {
          await conn.query('UPDATE products SET qty_available = qty_available + ? WHERE id = ?', [l.qty, l.product_id]);
          await conn.query(
            'INSERT INTO inventory_movements (product_id, type, qty, reference, user_id) VALUES (?, "in", ?, ?, ?)',
            [l.product_id, l.qty, `Compra ${order.name || order.id}`, req.user.id]
          );
        }
        await conn.query("UPDATE purchase_orders SET state = 'received' WHERE id = ?", [order.id]);
      } else if (action === 'done') {
        if (order.state !== 'received') throw Object.assign(new Error('Solo compras recibidas pueden finalizarse'), { status: 400 });
        await conn.query("UPDATE purchase_orders SET state = 'done' WHERE id = ?", [order.id]);
      } else if (action === 'cancel') {
        if (['done', 'cancel'].includes(order.state)) throw Object.assign(new Error('Esta compra ya no puede cancelarse'), { status: 400 });
        if (order.state === 'received') {
          const [lines] = await conn.query(
            `SELECT l.* FROM purchase_order_lines l JOIN products p ON p.id = l.product_id
             WHERE l.order_id = ? AND p.type = 'product'`,
            [order.id]
          );
          for (const l of lines) {
            await conn.query('UPDATE products SET qty_available = qty_available - ? WHERE id = ?', [l.qty, l.product_id]);
            await conn.query(
              'INSERT INTO inventory_movements (product_id, type, qty, reference, user_id) VALUES (?, "out", ?, ?, ?)',
              [l.product_id, l.qty, `Cancelación ${order.name || order.id}`, req.user.id]
            );
          }
        }
        await conn.query("UPDATE purchase_orders SET state = 'cancel' WHERE id = ?", [order.id]);
      } else {
        throw Object.assign(new Error('Acción inválida'), { status: 400 });
      }
      const [updated] = await conn.query('SELECT * FROM purchase_orders WHERE id = ?', [order.id]);
      return updated[0];
    });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
