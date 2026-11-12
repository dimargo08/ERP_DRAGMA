const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

module.exports = async function seed() {
  const [existing] = await pool.query('SELECT COUNT(*) AS c FROM users');
  if (existing[0].c > 0) {
    console.log('ℹ Los datos demo ya existen, se omiten');
    return;
  }

  console.log('→ Insertando datos demo de Dragma...');
  const hash = await bcrypt.hash('admin123', 10);
  const hashAna = await bcrypt.hash('ana123', 10);
  const hashCarlos = await bcrypt.hash('carlos123', 10);
  const hashEva = await bcrypt.hash('eva123', 10);

  await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES
     ('Admin Dragma', 'admin@dragma.com', ?, 'admin'),
     ('Ana Ventas', 'ana@dragma.com', ?, 'sales'),
     ('Carlos Compras', 'carlos@dragma.com', ?, 'purchase'),
     ('Eva Contabilidad', 'eva@dragma.com', ?, 'accounting')`,
    [hash, hashAna, hashCarlos, hashEva]
  );

  await pool.query(
    `INSERT INTO product_categories (name) VALUES
     ('Materias Primas'), ('Componentes'), ('Herramientas'),
     ('Servicios'), ('Embalaje')`
  );

  await pool.query(
    `INSERT INTO products (name, sku, category_id, type, price, cost, qty_available, min_stock) VALUES
     ('Lingote de Acero Reforzado', 'MAT-001', 1, 'product', 12.50, 8.00, 240, 50),
     ('Placa de Carbono 2mm', 'MAT-002', 1, 'product', 18.00, 11.00, 150, 40),
     ('Engranaje de Titanio G7', 'CMP-001', 2, 'product', 45.00, 28.00, 80, 20),
     ('Rodamiento HD-608', 'CMP-002', 2, 'product', 6.20, 3.40, 320, 60),
     ('Pintura Epoxi Roja Dragma', 'MAT-003', 1, 'product', 14.90, 9.00, 90, 30),
     ('Prensa Hidráulica PH-200', 'HW-001', 3, 'product', 1250.00, 900.00, 4, 1),
     ('Torno CNC TC-50', 'HW-002', 3, 'product', 15800.00, 12000.00, 2, 0),
     ('Caja de Cartón Doble', 'EMB-001', 5, 'product', 1.20, 0.60, 800, 100),
     ('Film Plástico 50m', 'EMB-002', 5, 'product', 8.50, 5.00, 45, 50),
     ('Servicio de Corte Láser (hora)', 'SRV-001', 4, 'service', 25.00, 0.00, 0, 0)`
  );

  await pool.query(
    `INSERT INTO partners (name, email, phone, vat, type, address, city, country) VALUES
     ('Comercial Fuego Norte S.A.', 'ventas@fuegonorte.com', '+34 911 220 101', 'ESA12345678', 'customer', 'Av. de la Industria 45', 'Madrid', 'España'),
     ('Distribuidora Ámbar Ltda.', 'pedidos@ambar.cl', '+56 2 2345 6789', 'CLB98765432', 'customer', 'Los Laureles 1200', 'Santiago', 'Chile'),
     ('Industrias Korvax S.L.', 'info@korvax.es', '+34 933 110 220', 'ESB87654321', 'customer', 'Pol. Ind. Nord 12', 'Barcelona', 'España'),
     ('Tiendas Wyrm & Co.', 'compras@wyrmco.mx', '+52 55 1234 5678', 'MXWYR010203', 'both', 'Insurgentes Sur 800', 'CDMX', 'México'),
     ('Metalúrgica Escama S.A.', 'contacto@mescama.com', '+34 976 445 500', 'ESC11223344', 'supplier', 'Ctra. Zaragoza km 8', 'Zaragoza', 'España'),
     ('Suministros Ígneo S.R.L.', 'ventas@igneo.ar', '+54 11 5555 6666', 'ARIG30555666', 'supplier', 'Av. Siempre Viva 742', 'Buenos Aires', 'Argentina'),
     ('Grupo Basilio Hermanos', 'gerencia@basilio.pe', '+51 1 480 9090', 'PEBAS204060', 'both', 'Jr. Unión 350', 'Lima', 'Perú')`
  );

  // Pedidos históricos para el gráfico del dashboard (últimos 6 meses)
  const now = new Date();
  let soId = 0;
  for (let i = 5; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 12 + (i % 10), 10, 30);
    const total = [4200, 5860, 3980, 6740, 5120][5 - i];
    const [r] = await pool.query(
      `INSERT INTO sales_orders (name, partner_id, user_id, state, date_order, amount_untaxed, amount_total)
       VALUES (?, ?, 2, 'done', ?, ?, ?)`,
      [`SO-${d.getFullYear()}-${String(100 + i).padStart(4, '0')}`, 1 + (i % 3), d.toISOString().slice(0, 19).replace('T', ' '), total, total]
    );
    soId = r.insertId;
    await pool.query(
      `INSERT INTO sales_order_lines (order_id, product_id, description, qty, price_unit)
       VALUES (?, 1, 'Lingote de Acero Reforzado', 100, 12.50), (?, 4, 'Rodamiento HD-608', 200, 6.20)`,
      [soId, soId]
    );
  }

  // Pedido actual en curso
  const today = now.toISOString().slice(0, 19).replace('T', ' ');
  await pool.query(
    `INSERT INTO sales_orders (name, partner_id, user_id, state, date_order, notes, amount_untaxed, amount_total)
     VALUES (?, 3, 2, 'sale', ?, 'Entrega urgente solicitada por el cliente.', 1560, 1560)`,
    [`SO-${now.getFullYear()}-0110`, today]
  );
  await pool.query(
    `INSERT INTO sales_order_lines (order_id, product_id, description, qty, price_unit) VALUES
     (6, 3, 'Engranaje de Titanio G7', 20, 45.00),
     (6, 10, 'Servicio de Corte Láser (hora)', 24, 25.00),
     (6, 8, 'Caja de Cartón Doble', 30, 1.20)`
  );

  // Compra confirmada pendiente de recibir
  await pool.query(
    `INSERT INTO purchase_orders (name, supplier_id, user_id, state, date_order, expected_date, amount_untaxed, amount_total)
     VALUES (?, 5, 3, 'confirmed', ?, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 2760, 2760)`,
    [`PO-${now.getFullYear()}-0001`, today]
  );
  await pool.query(
    `INSERT INTO purchase_order_lines (order_id, product_id, description, qty, price_unit) VALUES
     (1, 9, 'Film Plástico 50m', 300, 8.20),
     (1, 1, 'Lingote de Acero Reforzado', 60, 7.60)`
  );

  // Facturas
  await pool.query(
    `INSERT INTO invoices (number, partner_id, type, sale_order_id, state, invoice_date, due_date, tax_rate, amount_untaxed, amount_tax, amount_total)
     VALUES
     ('FAC-${now.getFullYear()}-0001', 1, 'customer', NULL, 'paid', DATE_SUB(CURDATE(), INTERVAL 35 DAY), DATE_SUB(CURDATE(), INTERVAL 5 DAY), 21, 4200, 882, 5082),
     ('FAC-${now.getFullYear()}-0002', 2, 'customer', 6, 'posted', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 21, 1560, 327.60, 1887.60),
     ('FAC-${now.getFullYear()}-0003', 5, 'supplier', NULL, 'draft', CURDATE(), NULL, 21, 2760, 579.60, 3339.60)`
  );

  console.log('✔ Datos demo insertados');
};
