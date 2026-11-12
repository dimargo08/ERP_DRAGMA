export interface DemoUser {
  id: number;
  name: string;
  email: string;
  role: string;
  active: number;
  last_login: string | null;
  created_at: string;
}

export interface DemoCategory {
  id: number;
  name: string;
}

export interface DemoProduct {
  id: number;
  name: string;
  sku: string;
  category_id: number | null;
  type: 'product' | 'service';
  price: number;
  cost: number;
  qty_available: number;
  min_stock: number;
  uom: string;
  active: number;
  created_at: string;
}

export interface DemoPartner {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  vat: string | null;
  type: 'customer' | 'supplier' | 'both';
  address: string | null;
  city: string | null;
  country: string | null;
  is_company: number;
  active: number;
  created_at: string;
}

export interface DemoLine {
  id: number;
  product_id: number | null;
  description: string;
  qty: number;
  price_unit: number;
}

export interface DemoSalesOrder {
  id: number;
  name: string;
  partner_id: number;
  user_id: number;
  state: 'draft' | 'sent' | 'sale' | 'done' | 'cancel';
  notes: string | null;
  date_order: string;
  amount_untaxed: number;
  amount_total: number;
  lines: DemoLine[];
}

export interface DemoPurchaseOrder {
  id: number;
  name: string;
  supplier_id: number;
  user_id: number;
  state: 'draft' | 'confirmed' | 'received' | 'done' | 'cancel';
  expected_date: string | null;
  notes: string | null;
  date_order: string;
  amount_untaxed: number;
  amount_total: number;
  lines: DemoLine[];
}

export interface DemoInvoice {
  id: number;
  number: string;
  partner_id: number;
  type: 'customer' | 'supplier';
  state: 'draft' | 'posted' | 'paid' | 'cancel';
  invoice_date: string;
  due_date: string | null;
  tax_rate: number;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  lines: DemoLine[];
}

export interface DemoMovement {
  id: number;
  product_id: number;
  type: 'in' | 'out' | 'adjust';
  qty: number;
  reference: string | null;
  user_id: number | null;
  created_at: string;
}

export interface DemoDeal {
  id: number;
  title: string;
  partner_id: number | null;
  amount: number;
  stage: 'prospect' | 'ai_proposal' | 'draga_design' | 'quote' | 'won' | 'lost';
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DemoDb {
  users: DemoUser[];
  categories: DemoCategory[];
  products: DemoProduct[];
  partners: DemoPartner[];
  sales: DemoSalesOrder[];
  purchases: DemoPurchaseOrder[];
  invoices: DemoInvoice[];
  movements: DemoMovement[];
  deals: DemoDeal[];
  currentUser: DemoUser | null;
  seq: {
    users: number;
    categories: number;
    products: number;
    partners: number;
    sales: number;
    purchases: number;
    invoices: number;
    lines: number;
    movements: number;
    deals: number;
  };
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

const pad2 = (n: number): string => String(n).padStart(2, '0');

export function stamp(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function nowStamp(): string {
  return stamp(new Date());
}

export function monthsAgo(months: number, day: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  d.setHours(10, 30, 0, 0);
  return stamp(d);
}

export function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayISO(): string {
  return `${new Date().getFullYear()}-${pad2(new Date().getMonth() + 1)}-${pad2(new Date().getDate())}`;
}

export function createDemoDb(): DemoDb {
  const year = new Date().getFullYear();
  let lineSeq = 0;

  const users: DemoUser[] = [
    { id: 1, name: 'Admin Dragma', email: 'admin@dragma.com', role: 'admin', active: 1, last_login: monthsAgo(0, 5), created_at: monthsAgo(8, 1) },
    { id: 2, name: 'Ana Ventas', email: 'ana@dragma.com', role: 'sales', active: 1, last_login: monthsAgo(0, 4), created_at: monthsAgo(7, 3) },
    { id: 3, name: 'Carlos Compras', email: 'carlos@dragma.com', role: 'purchase', active: 1, last_login: monthsAgo(0, 2), created_at: monthsAgo(7, 4) },
    { id: 4, name: 'Eva Contabilidad', email: 'eva@dragma.com', role: 'accounting', active: 1, last_login: monthsAgo(1, 18), created_at: monthsAgo(6, 9) },
  ];

  const categories: DemoCategory[] = [
    { id: 1, name: 'Materias Primas' },
    { id: 2, name: 'Componentes' },
    { id: 3, name: 'Herramientas' },
    { id: 4, name: 'Servicios' },
    { id: 5, name: 'Embalaje' },
  ];

  const products: DemoProduct[] = [
    { id: 1, name: 'Lingote de Acero Reforzado', sku: 'MAT-001', category_id: 1, type: 'product', price: 12.5, cost: 8, qty_available: 240, min_stock: 50, uom: 'Unidad', active: 1, created_at: monthsAgo(8, 2) },
    { id: 2, name: 'Placa de Carbono 2mm', sku: 'MAT-002', category_id: 1, type: 'product', price: 18, cost: 11, qty_available: 150, min_stock: 40, uom: 'Unidad', active: 1, created_at: monthsAgo(8, 2) },
    { id: 3, name: 'Engranaje de Titanio G7', sku: 'CMP-001', category_id: 2, type: 'product', price: 45, cost: 28, qty_available: 80, min_stock: 20, uom: 'Unidad', active: 1, created_at: monthsAgo(7, 6) },
    { id: 4, name: 'Rodamiento HD-608', sku: 'CMP-002', category_id: 2, type: 'product', price: 6.2, cost: 3.4, qty_available: 320, min_stock: 60, uom: 'Unidad', active: 1, created_at: monthsAgo(7, 6) },
    { id: 5, name: 'Pintura Epoxi Roja Dragma', sku: 'MAT-003', category_id: 1, type: 'product', price: 14.9, cost: 9, qty_available: 90, min_stock: 30, uom: 'Unidad', active: 1, created_at: monthsAgo(6, 12) },
    { id: 6, name: 'Prensa Hidráulica PH-200', sku: 'HW-001', category_id: 3, type: 'product', price: 1250, cost: 900, qty_available: 4, min_stock: 1, uom: 'Unidad', active: 1, created_at: monthsAgo(6, 12) },
    { id: 7, name: 'Torno CNC TC-50', sku: 'HW-002', category_id: 3, type: 'product', price: 15800, cost: 12000, qty_available: 2, min_stock: 0, uom: 'Unidad', active: 1, created_at: monthsAgo(6, 12) },
    { id: 8, name: 'Servicio de Corte Láser (hora)', sku: 'SRV-001', category_id: 4, type: 'service', price: 75, cost: 40, qty_available: 0, min_stock: 0, uom: 'h', active: 1, created_at: monthsAgo(6, 13) },
    { id: 9, name: 'Servicio de Mantenimiento Anual', sku: 'SRV-002', category_id: 4, type: 'service', price: 1200, cost: 700, qty_available: 0, min_stock: 0, uom: 'servicio', active: 1, created_at: monthsAgo(6, 13) },
    { id: 10, name: 'Film Plástico 50m', sku: 'EMB-001', category_id: 5, type: 'product', price: 6.5, cost: 4, qty_available: 45, min_stock: 50, uom: 'Rollo', active: 1, created_at: monthsAgo(8, 2) },
    { id: 11, name: 'Caja de Cartón Doble', sku: 'EMB-002', category_id: 5, type: 'product', price: 1.2, cost: 0.7, qty_available: 500, min_stock: 100, uom: 'Unidad', active: 1, created_at: monthsAgo(8, 2) },
    { id: 12, name: 'Disolvente Industrial 5L', sku: 'MAT-004', category_id: 1, type: 'product', price: 9.8, cost: 6.1, qty_available: 12, min_stock: 25, uom: 'Bidón', active: 1, created_at: monthsAgo(5, 8) },
    { id: 13, name: 'Abrasivo de Corte', sku: 'CMP-003', category_id: 2, type: 'product', price: 3.9, cost: 2.2, qty_available: 180, min_stock: 50, uom: 'Unidad', active: 1, created_at: monthsAgo(5, 8) },
    { id: 14, name: 'Aceite Hidráulico 20L', sku: 'MAT-005', category_id: 1, type: 'product', price: 32, cost: 20, qty_available: 60, min_stock: 15, uom: 'Garrafa', active: 1, created_at: monthsAgo(5, 8) },
  ];

  const partners: DemoPartner[] = [
    { id: 1, name: 'Comercial Fuego Norte S.A.', email: 'compras@fuegonorte.es', phone: '+34 944 112 233', vat: 'A48001122', type: 'customer', address: 'Calle Gran Vía 45', city: 'Bilbao', country: 'España', is_company: 1, active: 1, created_at: monthsAgo(8, 3) },
    { id: 2, name: 'Industrias Korvax S.L.', email: 'pedidos@korvax.es', phone: '+34 915 556 677', vat: 'B81223344', type: 'customer', address: 'Polígono Las Mercedes 12', city: 'Madrid', country: 'España', is_company: 1, active: 1, created_at: monthsAgo(8, 3) },
    { id: 3, name: 'Distribuidora Ámbar Ltda.', email: 'admin@ambar.pt', phone: '+351 213 445 566', vat: 'PT501223344', type: 'customer', address: 'Rua das Flores 88', city: 'Lisboa', country: 'Portugal', is_company: 1, active: 1, created_at: monthsAgo(7, 11) },
    { id: 4, name: 'Talleres Roca Verde', email: 'taller@rocaverde.es', phone: '+34 963 778 899', vat: 'B46778899', type: 'customer', address: 'Camino del Río 4', city: 'Valencia', country: 'España', is_company: 1, active: 1, created_at: monthsAgo(6, 5) },
    { id: 5, name: 'Acero Ibérico S.L.', email: 'ventas@aceroiberico.es', phone: '+34 976 223 344', vat: 'B50112233', type: 'supplier', address: 'Polígono Centrovía 22', city: 'Zaragoza', country: 'España', is_company: 1, active: 1, created_at: monthsAgo(8, 4) },
    { id: 6, name: 'Componentes Nova S.A.', email: 'cuentas@cnova.es', phone: '+34 931 667 788', vat: 'A62445566', type: 'supplier', address: 'Calle Industria 7', city: 'Barcelona', country: 'España', is_company: 1, active: 1, created_at: monthsAgo(8, 4) },
    { id: 7, name: 'Logística Pyrinex', email: 'info@pyrinex.com', phone: '+33 5 61 22 33 44', vat: 'FR778899001', type: 'both', address: 'Zone Portuaire 3', city: 'Toulouse', country: 'Francia', is_company: 1, active: 1, created_at: monthsAgo(5, 19) },
    { id: 8, name: 'Suministros Delta', email: 'compras@delta-sum.es', phone: '+34 954 889 900', vat: 'B41889900', type: 'supplier', address: 'Av. de la Industria 61', city: 'Sevilla', country: 'España', is_company: 1, active: 1, created_at: monthsAgo(4, 2) },
    { id: 9, name: 'Cliente Inactivo S.L.', email: 'antiguo@inactivo.es', phone: null, vat: 'B12345678', type: 'customer', address: null, city: 'Murcia', country: 'España', is_company: 1, active: 0, created_at: monthsAgo(8, 5) },
  ];

  const line = (productId: number | null, qty: number, price?: number, description?: string): DemoLine => {
    const product = products.find((p) => p.id === productId);
    return {
      id: ++lineSeq,
      product_id: productId,
      description: description ?? product?.name ?? 'Línea',
      qty,
      price_unit: price ?? product?.price ?? 0,
    };
  };

  const sumLines = (lines: DemoLine[]): number => round2(lines.reduce((acc, l) => acc + l.qty * l.price_unit, 0));

  const salesOrder = (
    id: number,
    partnerId: number,
    userId: number,
    state: DemoSalesOrder['state'],
    date: string,
    lines: DemoLine[],
    notes: string | null = null
  ): DemoSalesOrder => {
    const total = sumLines(lines);
    return {
      id,
      name: `SO-${year}-${String(id).padStart(4, '0')}`,
      partner_id: partnerId,
      user_id: userId,
      state,
      notes,
      date_order: date,
      amount_untaxed: total,
      amount_total: total,
      lines,
    };
  };

  const sales: DemoSalesOrder[] = [
    salesOrder(1, 3, 2, 'done', monthsAgo(5, 12), [line(4, 400), line(3, 40), line(11, 700)]),
    salesOrder(2, 2, 1, 'done', monthsAgo(3, 18), [line(6, 2), line(8, 20), line(1, 100), line(10, 100), line(11, 700)]),
    salesOrder(3, 3, 2, 'sale', monthsAgo(2, 9), [line(1, 200), line(9, 1), line(11, 280, 1)]),
    salesOrder(4, 1, 2, 'done', monthsAgo(1, 21), [line(6, 2), line(2, 150), line(4, 100)], 'Entrega en dos plazos'),
    salesOrder(5, 3, 2, 'sale', monthsAgo(0, 2), [line(8, 40), line(9, 1)]),
    salesOrder(6, 2, 1, 'sent', monthsAgo(0, 4), [line(3, 24), line(4, 50), line(5, 10)]),
    salesOrder(7, 1, 2, 'draft', monthsAgo(0, 5), [line(11, 50), line(10, 10)], 'Pendiente de confirmar dirección'),
    salesOrder(8, 4, 1, 'cancel', monthsAgo(2, 20), [line(3, 20)]),
  ];

  const purchase = (
    id: number,
    supplierId: number,
    state: DemoPurchaseOrder['state'],
    date: string,
    expected: string | null,
    lines: DemoLine[]
  ): DemoPurchaseOrder => {
    const total = sumLines(lines);
    return {
      id,
      name: `PO-${year}-${String(id).padStart(4, '0')}`,
      supplier_id: supplierId,
      user_id: 3,
      state,
      expected_date: expected,
      notes: null,
      date_order: date,
      amount_untaxed: total,
      amount_total: total,
      lines,
    };
  };

  const purchases: DemoPurchaseOrder[] = [
    purchase(1, 5, 'confirmed', monthsAgo(0, 3), daysFromNow(10), [line(1, 100, 8), line(2, 50, 11)]),
    purchase(2, 6, 'draft', monthsAgo(0, 5), null, [line(4, 200, 3.4), line(3, 20, 28)]),
    purchase(3, 8, 'received', monthsAgo(2, 7), null, [line(10, 200, 4), line(11, 1000, 0.7)]),
    purchase(4, 5, 'done', monthsAgo(4, 11), null, [line(14, 50, 20), line(12, 40, 6.1)]),
    purchase(5, 6, 'cancel', monthsAgo(1, 15), null, [line(3, 30, 28)]),
  ];

  const invoice = (
    id: number,
    partnerId: number,
    type: DemoInvoice['type'],
    state: DemoInvoice['state'],
    date: string,
    dueDate: string | null,
    lines: DemoLine[]
  ): DemoInvoice => {
    const untaxed = sumLines(lines);
    const tax = round2(untaxed * 0.21);
    return {
      id,
      number: `FAC-${year}-${String(id).padStart(4, '0')}`,
      partner_id: partnerId,
      type,
      state,
      invoice_date: date,
      due_date: dueDate,
      tax_rate: 21,
      amount_untaxed: untaxed,
      amount_tax: tax,
      amount_total: round2(untaxed + tax),
      lines,
    };
  };

  const invoices: DemoInvoice[] = [
    invoice(1, 1, 'customer', 'paid', monthsAgo(1, 21), monthsAgo(0, 21).slice(0, 10), [line(6, 2), line(2, 150)]),
    invoice(2, 3, 'customer', 'posted', monthsAgo(0, 2), daysFromNow(25), [line(8, 40)]),
    invoice(3, 2, 'customer', 'posted', monthsAgo(0, 3), daysFromNow(20), [line(3, 20)]),
    invoice(4, 5, 'supplier', 'draft', monthsAgo(0, 4), daysFromNow(30), [line(1, 100, 8)]),
    invoice(5, 3, 'customer', 'paid', monthsAgo(2, 9), monthsAgo(1, 9).slice(0, 10), [line(1, 200), line(9, 1)]),
    invoice(6, 4, 'customer', 'draft', monthsAgo(0, 5), daysFromNow(30), [line(11, 50)]),
    invoice(7, 8, 'supplier', 'paid', monthsAgo(3, 7), monthsAgo(2, 7).slice(0, 10), [line(10, 200, 4)]),
  ];

  const movement = (
    id: number,
    productId: number,
    type: DemoMovement['type'],
    qty: number,
    reference: string,
    userId: number,
    date: string
  ): DemoMovement => ({ id, product_id: productId, type, qty, reference, user_id: userId, created_at: date });

  const movements: DemoMovement[] = [
    movement(1, 4, 'out', 400, `Venta SO-${year}-0001`, 2, monthsAgo(5, 12)),
    movement(2, 3, 'out', 40, `Venta SO-${year}-0001`, 2, monthsAgo(5, 12)),
    movement(3, 11, 'out', 700, `Venta SO-${year}-0001`, 2, monthsAgo(5, 12)),
    movement(4, 14, 'in', 50, `Compra PO-${year}-0004`, 3, monthsAgo(4, 11)),
    movement(5, 12, 'in', 40, `Compra PO-${year}-0004`, 3, monthsAgo(4, 11)),
    movement(6, 10, 'in', 200, `Compra PO-${year}-0003`, 3, monthsAgo(2, 7)),
    movement(7, 11, 'in', 1000, `Compra PO-${year}-0003`, 3, monthsAgo(2, 7)),
    movement(8, 6, 'out', 2, `Venta SO-${year}-0004`, 2, monthsAgo(1, 21)),
    movement(9, 2, 'out', 150, `Venta SO-${year}-0004`, 2, monthsAgo(1, 21)),
    movement(10, 4, 'out', 100, `Venta SO-${year}-0004`, 2, monthsAgo(1, 21)),
    movement(11, 10, 'adjust', 45, 'Recuento anual', 1, monthsAgo(0, 5)),
    movement(12, 12, 'adjust', 12, 'Recuento anual', 1, monthsAgo(0, 5)),
  ];

  const deals: DemoDeal[] = [
    { id: 1, title: 'Auditoría digital Grupo Roca', partner_id: 4, amount: 2400, stage: 'prospect', notes: 'Primera llamada realizada', sort_order: 0, created_at: monthsAgo(1, 8), updated_at: monthsAgo(0, 3) },
    { id: 2, title: 'Renovación de flota Pyrinex', partner_id: 7, amount: 6800, stage: 'prospect', notes: null, sort_order: 1, created_at: monthsAgo(1, 2), updated_at: monthsAgo(0, 2) },
    { id: 3, title: 'Nuevo ERP para Korvax', partner_id: 2, amount: 12000, stage: 'prospect', notes: 'Pendiente reunión técnica', sort_order: 2, created_at: monthsAgo(0, 6), updated_at: monthsAgo(0, 4) },
    { id: 4, title: 'Propuesta IA para Fuego Norte', partner_id: 1, amount: 4500, stage: 'ai_proposal', notes: 'Generada con asistente IA', sort_order: 0, created_at: monthsAgo(1, 12), updated_at: monthsAgo(0, 4) },
    { id: 5, title: 'Chatbot comercial Ámbar', partner_id: 3, amount: 3200, stage: 'ai_proposal', notes: null, sort_order: 1, created_at: monthsAgo(0, 9), updated_at: monthsAgo(0, 5) },
    { id: 6, title: 'Rediseño de marca Roca Verde', partner_id: 4, amount: 2800, stage: 'draga_design', notes: 'Primera versión en revisión', sort_order: 0, created_at: monthsAgo(1, 20), updated_at: monthsAgo(0, 3) },
    { id: 7, title: 'Landing de producto Dragma', partner_id: 7, amount: 1500, stage: 'draga_design', notes: null, sort_order: 1, created_at: monthsAgo(0, 12), updated_at: monthsAgo(0, 2) },
    { id: 8, title: 'Implantación módulo de ventas', partner_id: 2, amount: 8900, stage: 'quote', notes: 'Cotización enviada, esperando respuesta', sort_order: 0, created_at: monthsAgo(2, 3), updated_at: monthsAgo(0, 1) },
    { id: 9, title: 'Automatización de cotizaciones', partner_id: 1, amount: 2100, stage: 'quote', notes: null, sort_order: 1, created_at: monthsAgo(1, 25), updated_at: monthsAgo(0, 2) },
    { id: 10, title: 'Migración ERP Korvax', partner_id: 2, amount: 7400, stage: 'won', notes: 'Contrato firmado', sort_order: 0, created_at: monthsAgo(3, 14), updated_at: monthsAgo(1, 6) },
    { id: 11, title: 'Portal de clientes Delta', partner_id: 8, amount: 1800, stage: 'lost', notes: 'Eligieron otra solución', sort_order: 0, created_at: monthsAgo(2, 11), updated_at: monthsAgo(1, 15) },
  ];

  return {
    users,
    categories,
    products,
    partners,
    sales,
    purchases,
    invoices,
    movements,
    deals,
    currentUser: null,
    seq: {
      users: users.length,
      categories: categories.length,
      products: products.length,
      partners: partners.length,
      sales: sales.length,
      purchases: purchases.length,
      invoices: invoices.length,
      lines: lineSeq,
      movements: movements.length,
      deals: deals.length,
    },
  };
}
