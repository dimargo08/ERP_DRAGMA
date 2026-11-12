-- ============================================================
-- DRAGMA ERP · Esquema de base de datos (MySQL 8+ / MariaDB 10.5+)
-- Importar sobre la base de datos ya creada (phpMyAdmin en cPanel).
-- ATENCIÓN: elimina y recrea las tablas; úsalo solo en una instalación nueva.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS invoice_lines, invoices, sales_deals, sales_order_lines, sales_orders,
  purchase_order_lines, purchase_orders, inventory_movements, products,
  product_categories, partners, users;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------- Usuarios ----------
CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role          ENUM('admin','sales','purchase','accounting') NOT NULL DEFAULT 'sales',
  active        TINYINT(1) NOT NULL DEFAULT 1,
  last_login    DATETIME NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Contactos (clientes / proveedores) ----------
CREATE TABLE partners (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(180) NOT NULL,
  email      VARCHAR(160) NULL,
  phone      VARCHAR(40) NULL,
  vat        VARCHAR(30) NULL,
  type       ENUM('customer','supplier','both') NOT NULL DEFAULT 'customer',
  address    VARCHAR(255) NULL,
  city       VARCHAR(100) NULL,
  country    VARCHAR(100) NULL,
  is_company TINYINT(1) NOT NULL DEFAULT 1,
  active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_partners_name (name)
) ENGINE=InnoDB;

-- ---------- Productos ----------
CREATE TABLE product_categories (
  id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE products (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(180) NOT NULL,
  sku           VARCHAR(40) NOT NULL UNIQUE,
  category_id   INT UNSIGNED NULL,
  type          ENUM('product','service') NOT NULL DEFAULT 'product',
  price         DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost          DECIMAL(12,2) NOT NULL DEFAULT 0,
  qty_available DECIMAL(12,2) NOT NULL DEFAULT 0,
  min_stock     DECIMAL(12,2) NOT NULL DEFAULT 0,
  uom           VARCHAR(20) NOT NULL DEFAULT 'Unidad',
  active        TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id)
    REFERENCES product_categories(id) ON DELETE SET NULL,
  INDEX idx_products_name (name)
) ENGINE=InnoDB;

-- ---------- Movimientos de inventario ----------
CREATE TABLE inventory_movements (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  type       ENUM('in','out','adjust') NOT NULL,
  qty        DECIMAL(12,2) NOT NULL,
  reference  VARCHAR(80) NULL,
  user_id    INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mov_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_mov_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_mov_product (product_id, created_at)
) ENGINE=InnoDB;

-- ---------- Ventas ----------
CREATE TABLE sales_orders (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(24) NULL UNIQUE,
  partner_id     INT UNSIGNED NOT NULL,
  user_id        INT UNSIGNED NULL,
  state          ENUM('draft','sent','sale','done','cancel') NOT NULL DEFAULT 'draft',
  date_order     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes          TEXT NULL,
  amount_untaxed DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_total   DECIMAL(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_so_partner FOREIGN KEY (partner_id) REFERENCES partners(id),
  CONSTRAINT fk_so_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_so_state (state, date_order)
) ENGINE=InnoDB;

CREATE TABLE sales_order_lines (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id    INT UNSIGNED NOT NULL,
  product_id  INT UNSIGNED NULL,
  description VARCHAR(200) NOT NULL,
  qty         DECIMAL(12,2) NOT NULL DEFAULT 1,
  price_unit  DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal    DECIMAL(14,2) AS (qty * price_unit) STORED,
  CONSTRAINT fk_sol_order FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_sol_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_sol_order (order_id)
) ENGINE=InnoDB;

-- ---------- Embudo de ventas (oportunidades por etapas) ----------
CREATE TABLE sales_deals (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title      VARCHAR(180) NOT NULL,
  partner_id INT UNSIGNED NULL,
  amount     DECIMAL(12,2) NOT NULL DEFAULT 0,
  stage      ENUM('prospect','ai_proposal','draga_design','quote','won','lost')
             NOT NULL DEFAULT 'prospect',
  notes      TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_deal_partner FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL,
  INDEX idx_deal_stage (stage, sort_order)
) ENGINE=InnoDB;

-- ---------- Compras ----------
CREATE TABLE purchase_orders (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(24) NULL UNIQUE,
  supplier_id    INT UNSIGNED NOT NULL,
  user_id        INT UNSIGNED NULL,
  state          ENUM('draft','confirmed','received','done','cancel') NOT NULL DEFAULT 'draft',
  date_order     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expected_date  DATE NULL,
  notes          TEXT NULL,
  amount_untaxed DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_total   DECIMAL(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id) REFERENCES partners(id),
  CONSTRAINT fk_po_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_po_state (state, date_order)
) ENGINE=InnoDB;

CREATE TABLE purchase_order_lines (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id    INT UNSIGNED NOT NULL,
  product_id  INT UNSIGNED NULL,
  description VARCHAR(200) NOT NULL,
  qty         DECIMAL(12,2) NOT NULL DEFAULT 1,
  price_unit  DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal    DECIMAL(14,2) AS (qty * price_unit) STORED,
  CONSTRAINT fk_pol_order FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_pol_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_pol_order (order_id)
) ENGINE=InnoDB;

-- ---------- Facturación ----------
CREATE TABLE invoices (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  number            VARCHAR(24) NULL UNIQUE,
  partner_id        INT UNSIGNED NOT NULL,
  type              ENUM('customer','supplier') NOT NULL DEFAULT 'customer',
  sale_order_id     INT UNSIGNED NULL,
  purchase_order_id INT UNSIGNED NULL,
  state             ENUM('draft','posted','paid','cancel') NOT NULL DEFAULT 'draft',
  invoice_date      DATE NULL,
  due_date          DATE NULL,
  tax_rate          DECIMAL(5,2) NOT NULL DEFAULT 21.00,
  amount_untaxed    DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_tax        DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_total      DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_inv_partner FOREIGN KEY (partner_id) REFERENCES partners(id),
  CONSTRAINT fk_inv_so FOREIGN KEY (sale_order_id) REFERENCES sales_orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_inv_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
  INDEX idx_inv_state (type, state, invoice_date)
) ENGINE=InnoDB;

CREATE TABLE invoice_lines (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id  INT UNSIGNED NOT NULL,
  product_id  INT UNSIGNED NULL,
  description VARCHAR(200) NOT NULL,
  qty         DECIMAL(12,2) NOT NULL DEFAULT 1,
  price_unit  DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal    DECIMAL(14,2) AS (qty * price_unit) STORED,
  CONSTRAINT fk_il_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  CONSTRAINT fk_il_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_il_invoice (invoice_id)
) ENGINE=InnoDB;
