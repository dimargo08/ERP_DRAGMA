const router = require('express').Router();
const { q, tx } = require('../config/db');
const { auth } = require('../middleware/auth');

router.use(auth());

const round2 = (n) => Math.round(n * 100) / 100;

async function recalcTotals(conn, orderId) {
  const [rows] = await conn.query('SELECT COALESCE(SUM(subtotal), 0) AS t FROM sales_order_lines WHERE order_id = ?', [orderId]);
  const total = round2(Number(rows[0].t));
  await conn.query('UPDATE sales_orders SET amount_untaxed = ?, amount_total = ? WHERE id = ?', [total, total, orderId]);
  return total;
}

router.get('/', async (req, res, next) => {
  try {
    const params = [];
    let where = 'WHERE 1 = 1';
    const term = (req.query.q || '').toString().trim();
    const state = (req.query.state || '').toString();
    if (term) {
      where += ' AND (so.name LIKE ? OR p.name LIKE ?)';
      params.push(`%${term}%`, `%${term}%`);
    }
    if (['draft', 'sent', 'sale', 'done', 'cancel'].includes(state)) {
      where += ' AND so.state = ?';
      params.push(state);
    }
    const rows = await q(
      `SELECT so.*, p.name AS partner_name, u.name AS seller_name
       FROM sales_orders so
       JOIN partners p ON p.id = so.partner_id
       LEFT JOIN users u ON u.id = so.user_id
       ${where} ORDER BY so.id DESC LIMIT 300`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const orders = await q(
      `SELECT so.*, p.name AS partner_name, p.email AS partner_email, u.name AS seller_name
       FROM sales_orders so
       JOIN partners p ON p.id = so.partner_id
       LEFT JOIN users u ON u.id = so.user_id
       WHERE so.id = ?`,
      [req.params.id]
    );
    if (!orders[0]) return res.status(404).json({ error: 'Pedido no encontrado' });
    const lines = await q(
      `SELECT l.*, p.sku FROM sales_order_lines l LEFT JOIN products p ON p.id = l.product_id WHERE l.order_id = ? ORDER BY l.id`,
      [req.params.id]
    );
    res.json({ ...orders[0], lines });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.partner_id) return res.status(400).json({ error: 'Selecciona un cliente' });
    const lines = Array.isArray(b.lines) ? b.lines : [];
    if (!lines.length) return res.status(400).json({ error: 'El pedido necesita al menos una línea' });

    const ids = lines.map((l) => Number(l.product_id)).filter(Boolean);
    const productRows = ids.length ? await q(`SELECT id, name, price FROM products WHERE id IN (${ids.map(() => '?').join(',')})`, ids) : [];
    const productMap = new Map(productRows.map((p) => [p.id, p]));

    const orderId = await tx(async (conn) => {
      const [r] = await conn.query(
        'INSERT INTO sales_orders (partner_id, user_id, state, notes, date_order) VALUES (?, ?, "draft", ?, NOW())',
        [b.partner_id, req.user.id, b.notes || null]
      );
      for (const l of lines) {
        const prod = l.product_id ? productMap.get(Number(l.product_id)) : null;
        await conn.query(
          'INSERT INTO sales_order_lines (order_id, product_id, description, qty, price_unit) VALUES (?, ?, ?, ?, ?)',
          [
            r.insertId, prod ? prod.id : null,
            (l.description || (prod && prod.name) || '').slice(0, 200),
            Number(l.qty), Number(l.price_unit ?? (prod ? prod.price : 0))
          ]
        );
      }
      await recalcTotals(conn, r.insertId);
      const year = new Date().getFullYear();
      await conn.query('UPDATE sales_orders SET name = ? WHERE id = ?', [`SO-${year}-${String(r.insertId).padStart(4, '0')}`, r.insertId]);
      return r.insertId;
    });

    const row = await q('SELECT * FROM sales_orders WHERE id = ?', [orderId]);
    res.status(201).json(row[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    const current = await q('SELECT * FROM sales_orders WHERE id = ?', [req.params.id]);
    if (!current[0]) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (!['draft', 'sent'].includes(current[0].state)) {
      return res.status(400).json({ error: 'Solo pedidos en Borrador o Enviado son editables' });
    }
    const lines = Array.isArray(b.lines) ? b.lines : [];
    if (!lines.length) return res.status(400).json({ error: 'El pedido necesita al menos una línea' });

    await tx(async (conn) => {
      await conn.query('UPDATE sales_orders SET partner_id = ?, notes = ? WHERE id = ?', [
        b.partner_id || current[0].partner_id,
        b.notes !== undefined ? b.notes : current[0].notes,
        req.params.id
      ]);
      await conn.query('DELETE FROM sales_order_lines WHERE order_id = ?', [req.params.id]);
      for (const l of lines) {
        await conn.query(
          'INSERT INTO sales_order_lines (order_id, product_id, description, qty, price_unit) VALUES (?, ?, ?, ?, ?)',
          [req.params.id, l.product_id || null, (l.description || 'Línea').slice(0, 200), Number(l.qty), Number(l.price_unit ?? 0)]
        );
      }
      await recalcTotals(conn, req.params.id);
    });

    const row = await q('SELECT * FROM sales_orders WHERE id = ?', [req.params.id]);
    res.json(row[0]);
  } catch (err) { next(err); }
});

// Acciones: send | confirm | done | cancel
router.post('/:id/action', async (req, res, next) => {
  try {
    const action = (req.body || {}).action;
    const result = await tx(async (conn) => {
      const [rows] = await conn.query('SELECT * FROM sales_orders WHERE id = ? FOR UPDATE', [req.params.id]);
      const order = rows[0];
      if (!order) throw Object.assign(new Error('Pedido no encontrado'), { status: 404 });

      if (action === 'send') {
        if (order.state !== 'draft') throw Object.assign(new Error('Solo los borradores pueden enviarse'), { status: 400 });
        await conn.query("UPDATE sales_orders SET state = 'sent' WHERE id = ?", [order.id]);
      } else if (action === 'confirm') {
        if (!['draft', 'sent'].includes(order.state)) throw Object.assign(new Error('Este pedido ya no puede confirmarse'), { status: 400 });
        const [lines] = await conn.query(
          `SELECT l.* FROM sales_order_lines l JOIN products p ON p.id = l.product_id
           WHERE l.order_id = ? AND p.type = 'product'`,
          [order.id]
        );
        for (const l of lines) {
          const [prods] = await conn.query('SELECT qty_available FROM products WHERE id = ? FOR UPDATE', [l.product_id]);
          if (Number(prods[0].qty_available) < Number(l.qty)) {
            throw Object.assign(new Error(`Stock insuficiente para "${l.description}"`), { status: 400 });
          }
          await conn.query('UPDATE products SET qty_available = qty_available - ? WHERE id = ?', [l.qty, l.product_id]);
          await conn.query(
            'INSERT INTO inventory_movements (product_id, type, qty, reference, user_id) VALUES (?, "out", ?, ?, ?)',
            [l.product_id, l.qty, `Venta ${order.name || order.id}`, req.user.id]
          );
        }
        await conn.query("UPDATE sales_orders SET state = 'sale' WHERE id = ?", [order.id]);
      } else if (action === 'done') {
        if (order.state !== 'sale') throw Object.assign(new Error('Solo pedidos confirmados pueden finalizarse'), { status: 400 });
        await conn.query("UPDATE sales_orders SET state = 'done' WHERE id = ?", [order.id]);
      } else if (action === 'cancel') {
        if (['done', 'cancel'].includes(order.state)) throw Object.assign(new Error('Este pedido ya no puede cancelarse'), { status: 400 });
        if (['sale', 'done'].includes(order.state)) {
          const [lines] = await conn.query(
            `SELECT l.* FROM sales_order_lines l JOIN products p ON p.id = l.product_id
             WHERE l.order_id = ? AND p.type = 'product'`,
            [order.id]
          );
          for (const l of lines) {
            await conn.query('UPDATE products SET qty_available = qty_available + ? WHERE id = ?', [l.qty, l.product_id]);
            await conn.query(
              'INSERT INTO inventory_movements (product_id, type, qty, reference, user_id) VALUES (?, "in", ?, ?, ?)',
              [l.product_id, l.qty, `Cancelación ${order.name || order.id}`, req.user.id]
            );
          }
        }
        await conn.query("UPDATE sales_orders SET state = 'cancel' WHERE id = ?", [order.id]);
      } else {
        throw Object.assign(new Error('Acción inválida'), { status: 400 });
      }

      const [updated] = await conn.query('SELECT * FROM sales_orders WHERE id = ?', [order.id]);
      return updated[0];
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const rows = await q('SELECT state FROM sales_orders WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (!['draft', 'cancel'].includes(rows[0].state)) {
      return res.status(400).json({ error: 'Solo se eliminan pedidos en Borrador o Cancelado' });
    }
    await q('DELETE FROM sales_orders WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
