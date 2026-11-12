const router = require('express').Router();
const { q, tx } = require('../config/db');

router.use(require('../middleware/auth').auth());

const DEAL_STAGES = ['prospect', 'ai_proposal', 'draga_design', 'quote', 'won', 'lost'];

const dealQuery = `SELECT d.*, p.name AS partner_name
  FROM sales_deals d
  LEFT JOIN partners p ON p.id = d.partner_id`;

router.get('/', async (req, res, next) => {
  try {
    const rows = await q(
      `${dealQuery}
       ORDER BY FIELD(d.stage, ${DEAL_STAGES.map(() => '?').join(',')}), d.sort_order, d.id`,
      DEAL_STAGES
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    const title = String(b.title || '').trim();
    if (!title) return res.status(400).json({ error: 'El título es obligatorio' });
    const stage = DEAL_STAGES.includes(b.stage) ? b.stage : 'prospect';
    const amount = Number(b.amount);
    if (Number.isNaN(amount) || amount < 0) return res.status(400).json({ error: 'Importe inválido' });

    const id = await tx(async (conn) => {
      const [maxRows] = await conn.query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM sales_deals WHERE stage = ?', [stage]);
      const [r] = await conn.query(
        'INSERT INTO sales_deals (title, partner_id, amount, stage, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [title.slice(0, 180), b.partner_id || null, amount, stage, b.notes || null, maxRows[0].next]
      );
      return r.insertId;
    });

    const row = await q(`${dealQuery} WHERE d.id = ?`, [id]);
    res.status(201).json(row[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    const current = await q('SELECT * FROM sales_deals WHERE id = ?', [req.params.id]);
    if (!current[0]) return res.status(404).json({ error: 'Oportunidad no encontrada' });

    const title = b.title !== undefined ? String(b.title).trim() : current[0].title;
    if (!title) return res.status(400).json({ error: 'El título es obligatorio' });
    const amount = b.amount !== undefined ? Number(b.amount) : Number(current[0].amount);
    if (Number.isNaN(amount) || amount < 0) return res.status(400).json({ error: 'Importe inválido' });
    const stage = DEAL_STAGES.includes(b.stage) ? b.stage : current[0].stage;
    const stageChanged = stage !== current[0].stage;

    await tx(async (conn) => {
      let sortOrder = current[0].sort_order;
      if (stageChanged) {
        const [maxRows] = await conn.query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM sales_deals WHERE stage = ?', [stage]);
        sortOrder = maxRows[0].next;
      }
      await conn.query(
        'UPDATE sales_deals SET title = ?, partner_id = ?, amount = ?, stage = ?, notes = ?, sort_order = ? WHERE id = ?',
        [
          title.slice(0, 180),
          b.partner_id !== undefined ? (b.partner_id || null) : current[0].partner_id,
          amount,
          stage,
          b.notes !== undefined ? (b.notes || null) : current[0].notes,
          sortOrder,
          req.params.id
        ]
      );
    });

    const row = await q(`${dealQuery} WHERE d.id = ?`, [req.params.id]);
    res.json(row[0]);
  } catch (err) { next(err); }
});

// Mover una oportunidad a otra etapa y fijar el orden de esa columna.
router.post('/:id/move', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!DEAL_STAGES.includes(b.stage)) return res.status(400).json({ error: 'Etapa inválida' });
    const ids = Array.isArray(b.ids) ? b.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];

    const result = await tx(async (conn) => {
      const [rows] = await conn.query('SELECT id FROM sales_deals WHERE id = ? FOR UPDATE', [req.params.id]);
      if (!rows[0]) throw Object.assign(new Error('Oportunidad no encontrada'), { status: 404 });
      await conn.query('UPDATE sales_deals SET stage = ? WHERE id = ?', [b.stage, req.params.id]);
      for (let i = 0; i < ids.length; i++) {
        await conn.query('UPDATE sales_deals SET sort_order = ? WHERE id = ? AND stage = ?', [i, ids[i], b.stage]);
      }
      const [updated] = await conn.query(`${dealQuery} WHERE d.id = ?`, [req.params.id]);
      return updated[0];
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const rows = await q('SELECT id FROM sales_deals WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Oportunidad no encontrada' });
    await q('DELETE FROM sales_deals WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
