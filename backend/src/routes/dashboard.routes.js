const router = require('express').Router();
const { q } = require('../config/db');
const { auth } = require('../middleware/auth');

router.use(auth());

router.get('/stats', async (req, res, next) => {
  try {
    const [counters, salesByMonth, topProducts, lowStock, recentOrders, revenue] = await Promise.all([
      q(`SELECT
          (SELECT COUNT(*) FROM partners WHERE active = 1 AND type IN ('customer','both')) AS customers,
          (SELECT COUNT(*) FROM partners WHERE active = 1 AND type IN ('supplier','both')) AS suppliers,
          (SELECT COUNT(*) FROM products WHERE active = 1 AND type = 'product') AS products,
          (SELECT COUNT(*) FROM sales_orders WHERE state IN ('draft','sent','sale')) AS open_orders,
          (SELECT COUNT(*) FROM invoices WHERE state = 'posted') AS pending_invoices,
          (SELECT COALESCE(SUM(amount_total),0) FROM invoices WHERE state = 'paid') AS total_collected`),
      q(`SELECT DATE_FORMAT(date_order, '%Y-%m') AS month, COALESCE(SUM(amount_total), 0) AS total
         FROM sales_orders WHERE state IN ('sale','done')
           AND date_order >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
         GROUP BY month ORDER BY month`),
      q(`SELECT l.description, SUM(l.qty) AS qty, SUM(l.subtotal) AS total
         FROM sales_order_lines l JOIN sales_orders o ON o.id = l.order_id
         WHERE o.state IN ('sale','done')
         GROUP BY l.description ORDER BY total DESC LIMIT 5`),
      q(`SELECT id, name, sku, qty_available, min_stock FROM products
         WHERE active = 1 AND type = 'product' AND qty_available <= min_stock
         ORDER BY qty_available LIMIT 8`),
      q(`SELECT so.id, so.name, so.state, so.amount_total, so.date_order, p.name AS partner_name
         FROM sales_orders so JOIN partners p ON p.id = so.partner_id
         ORDER BY so.id DESC LIMIT 8`),
      q(`SELECT COALESCE(SUM(amount_total),0) AS month_revenue FROM invoices
         WHERE state IN ('posted','paid') AND type = 'customer'
           AND invoice_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`)
    ]);

    res.json({
      counters: counters[0],
      salesByMonth,
      topProducts,
      lowStock,
      recentOrders,
      monthRevenue: Number(revenue[0].month_revenue)
    });
  } catch (err) { next(err); }
});

module.exports = router;
