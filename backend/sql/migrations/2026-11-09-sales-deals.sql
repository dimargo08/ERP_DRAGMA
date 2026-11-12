-- Embudo de ventas: oportunidades por etapas.
-- Importar una sola vez sobre una base de datos existente (no borra datos).

CREATE TABLE IF NOT EXISTS sales_deals (
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
