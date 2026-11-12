const router = require('express').Router();
const { q, tx } = require('../config/db');
const { auth } = require('../middleware/auth');

router.use(auth());

const round2 = (n) => Math.round(n * 100) / 100;

router.get('/', async (req, res, next) => {
  try {
    const params = [];
    let where = 'WHERE 1 = 1';
    const term = (req.query.q || '').toString().trim();
    const state = (req.query.state || '').toString();
    const type = (req.query.type || '').toString();
    if (term) {
      where += ' AND (i.number LIKE ? OR p.name LIKE ?)';
      params.push(`%${term}%`, `%${term}%`);
    }
    if (['draft', 'posted', 'paid', 'cancel'].includes(state)) {
      where += ' AND i.state = ?';
      params.push(state);
    }
    if (['customer', 'supplier'].includes(type)) {
      where += ' AND i.type = ?';
      params.push(type);
    }
    const rows = await q(
      `SELECT i.*, p.name AS partner_name
       FROM invoices i JOIN partners p ON p.id = i.partner_id
       ${where} ORDER BY i.id DESC LIMIT 300`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const invoices = await q(
      `SELECT i.*, p.name AS partner_name, p.vat, p.address, p.city
       FROM invoices i JOIN partners p ON p.id = i.partner_id WHERE i.id = ?`,
      [req.params.id]
    );
    if (!invoices[0]) return res.status(404).json({ error: 'Factura no encontrada' });
    const lines = await q(
      `SELECT l.*, p.sku FROM invoice_lines l LEFT JOIN products p ON p.id = l.product_id WHERE l.invoice_id = ? ORDER BY l.id`,
      [req.params.id]
    );
    res.json({ ...invoices[0], lines });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.partner_id) return res.status(400).json({ error: 'Selecciona el contacto de la factura' });
    const lines = Array.isArray(b.lines) ? b.lines : [];
    if (!lines.length) return res.status(400).json({ error: 'La factura necesita al menos una línea' });
    for (const l of lines) {
      if (!(Number(l.qty) > 0) || !(Number(l.price_unit ?? 0) >= 0)) {
        return res.status(400).json({ error: 'Revisa cantidades y precios de las líneas' });
      }
    }
    const type = ['customer', 'supplier'].includes(b.type) ? b.type : 'customer';
    const taxRate = Number(b.tax_rate ?? 21);

    const invoiceId = await tx(async (conn) => {
      const untaxed = round2(lines.reduce((acc, l) => acc + Number(l.qty) * Number(l.price_unit ?? 0), 0));
      const tax = round2(untaxed * taxRate / 100);
      const [r] = await conn.query(
        `INSERT INTO invoices (partner_id, type, sale_order_id, purchase_order_id, state, invoice_date, due_date, tax_rate, amount_untaxed, amount_tax, amount_total)
         VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)`,
        [
          b.partner_id, type, b.sale_order_id || null, b.purchase_order_id || null,
          b.invoice_date || new Date().toISOString().slice(0, 10), b.due_date || null,
          taxRate, untaxed, tax, round2(untaxed + tax)
        ]
      );
      for (const l of lines) {
        await conn.query(
          'INSERT INTO invoice_lines (invoice_id, product_id, description, qty, price_unit) VALUES (?, ?, ?, ?, ?)',
          [r.insertId, l.product_id || null, (l.description || 'Línea').slice(0, 200), Number(l.qty), Number(l.price_unit ?? 0)]
        );
      }
      const year = new Date().getFullYear();
      await conn.query('UPDATE invoices SET number = ? WHERE id = ?', [`FAC-${year}-${String(r.insertId).padStart(4, '0')}`, r.insertId]);
      return r.insertId;
    });

    const row = await q('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    res.status(201).json(row[0]);
  } catch (err) { next(err); }
});

// Acciones: post | pay | cancel
router.post('/:id/action', async (req, res, next) => {
  try {
    const action = (req.body || {}).action;
    const states = { post: ['draft', 'posted'], pay: ['posted', 'paid'] };
    if (!['post', 'pay', 'cancel'].includes(action)) return res.status(400).json({ error: 'Acción inválida' });

    const rows = await q('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    const inv = rows[0];
    if (!inv) return res.status(404).json({ error: 'Factura no encontrada' });

    if (action === 'post') {
      if (inv.state !== 'draft') return res.status(400).json({ error: 'Solo las facturas borrador pueden publicarse' });
      await q("UPDATE invoices SET state = 'posted' WHERE id = ?", [inv.id]);
    } else if (action === 'pay') {
      if (inv.state !== 'posted') return res.status(400).json({ error: 'Solo facturas publicadas pueden marcarse como pagadas' });
      await q("UPDATE invoices SET state = 'paid' WHERE id = ?", [inv.id]);
    } else {
      if (inv.state === 'paid') return res.status(400).json({ error: 'Una factura pagada no puede cancelarse' });
      await q("UPDATE invoices SET state = 'cancel' WHERE id = ?", [inv.id]);
    }
    const updated = await q('SELECT * FROM invoices WHERE id = ?', [inv.id]);
    res.json(updated[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const rows = await q('SELECT state FROM invoices WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Factura no encontrada' });
    if (!['draft', 'cancel'].includes(rows[0].state)) {
      return res.status(400).json({ error: 'Solo se eliminan facturas en Borrador o Cancelado' });
    }
    await q('DELETE FROM invoices WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
