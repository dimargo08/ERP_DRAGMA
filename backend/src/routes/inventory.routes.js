const router = require('express').Router();
const { q } = require('../config/db');
const { auth } = require('../middleware/auth');

router.use(auth());

router.get('/', async (req, res, next) => {
  try {
    const params = [];
    let where = 'WHERE 1 = 1';
    if (req.query.product_id) {
      where += ' AND m.product_id = ?';
      params.push(req.query.product_id);
    }
    const rows = await q(
      `SELECT m.*, p.name AS product_name, p.sku, u.name AS user_name
       FROM inventory_movements m
       JOIN products p ON p.id = m.product_id
       LEFT JOIN users u ON u.id = m.user_id
       ${where} ORDER BY m.id DESC LIMIT 300`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
