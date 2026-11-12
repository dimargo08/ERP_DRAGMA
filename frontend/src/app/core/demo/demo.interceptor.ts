import { HttpErrorResponse, HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  createDemoDb,
  DemoDb,
  DemoDeal,
  DemoInvoice,
  DemoLine,
  DemoPartner,
  DemoProduct,
  DemoPurchaseOrder,
  DemoSalesOrder,
  DemoUser,
  monthsAgo,
  nowStamp,
  round2,
  todayISO,
} from './demo-data';

const db: DemoDb = createDemoDb();
const LATENCY = 180;

const ok = <T>(body: T, status = 200): Observable<HttpEvent<unknown>> =>
  of(new HttpResponse({ status, body })).pipe(delay(LATENCY));

const fail = (status: number, message: string): Observable<HttpEvent<unknown>> =>
  throwError(() => new HttpErrorResponse({ status, error: { error: message } })).pipe(delay(120));

const safeUser = (u: DemoUser) => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const partnerName = (id: number) => db.partners.find((p) => p.id === id)?.name ?? '—';
const categoryName = (id: number | null) => db.categories.find((c) => c.id === id)?.name ?? null;
const productSku = (id: number | null) => db.products.find((p) => p.id === id)?.sku ?? null;

const withSku = (l: DemoLine) => ({ ...l, sku: productSku(l.product_id) });
const linesTotal = (lines: DemoLine[]) => round2(lines.reduce((acc, l) => acc + Number(l.qty) * Number(l.price_unit), 0));

function addMovement(productId: number, type: 'in' | 'out' | 'adjust', qty: number, reference: string): void {
  db.movements.push({
    id: ++db.seq.movements,
    product_id: productId,
    type,
    qty,
    reference,
    user_id: db.currentUser?.id ?? 1,
    created_at: nowStamp(),
  });
}

function buildLines(raw: any[]): DemoLine[] {
  return raw.map((l) => {
    const product = db.products.find((p) => p.id === Number(l.product_id));
    return {
      id: ++db.seq.lines,
      product_id: product ? product.id : null,
      description: String(l.description || product?.name || 'Línea').slice(0, 200),
      qty: Number(l.qty),
      price_unit: Number(l.price_unit ?? product?.price ?? 0),
    };
  });
}

export const demoInterceptor: HttpInterceptorFn = (req, next) => {
  const parsed = new URL(req.url, window.location.origin);
  const path = parsed.pathname.replace(/^\/api/, '');
  const method = req.method.toUpperCase();
  const query = parsed.searchParams;
  const body = (req.body ?? {}) as any;

  // ---------- Autenticación ----------
  if (method === 'POST' && path === '/auth/login') {
    const email = String(body.email || '').toLowerCase().trim();
    if (!email || !body.password) return fail(400, 'Email y contraseña requeridos');
    const user = db.users.find((u) => u.email === email && u.active);
    if (!user) return fail(401, 'Credenciales inválidas. En modo demo usa admin@dragma.com o ana@dragma.com.');
    user.last_login = nowStamp();
    db.currentUser = user;
    return ok({ token: 'demo-token', user: safeUser(user) });
  }

  if (method === 'GET' && path === '/auth/me') {
    return db.currentUser ? ok(safeUser(db.currentUser)) : fail(401, 'No autenticado');
  }

  // ---------- Dashboard ----------
  if (method === 'GET' && path === '/dashboard/stats') {
    const activePartners = db.partners.filter((p) => p.active);
    const months: { month: string; total: number }[] = [];
    const monthKeys: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthKeys.push(key);
      months.push({
        month: key,
        total: round2(
          db.sales
            .filter((o) => ['sale', 'done'].includes(o.state) && o.date_order.startsWith(key))
            .reduce((acc, o) => acc + o.amount_total, 0)
        ),
      });
    }

    const topMap = new Map<string, { qty: number; total: number }>();
    for (const order of db.sales.filter((o) => ['sale', 'done'].includes(o.state))) {
      for (const line of order.lines) {
        const entry = topMap.get(line.description) ?? { qty: 0, total: 0 };
        entry.qty += Number(line.qty);
        entry.total = round2(entry.total + Number(line.qty) * Number(line.price_unit));
        topMap.set(line.description, entry);
      }
    }

    const monthKey = monthKeys[monthKeys.length - 1];

    return ok({
      counters: {
        customers: activePartners.filter((p) => p.type === 'customer' || p.type === 'both').length,
        suppliers: activePartners.filter((p) => p.type === 'supplier' || p.type === 'both').length,
        products: db.products.filter((p) => p.active && p.type === 'product').length,
        open_orders: db.sales.filter((o) => ['draft', 'sent', 'sale'].includes(o.state)).length,
        pending_invoices: db.invoices.filter((i) => i.state === 'posted').length,
        total_collected: round2(db.invoices.filter((i) => i.state === 'paid').reduce((acc, i) => acc + i.amount_total, 0)),
      },
      salesByMonth: months,
      topProducts: [...topMap.entries()]
        .map(([description, v]) => ({ description, qty: v.qty, total: v.total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5),
      lowStock: db.products
        .filter((p) => p.active && p.type === 'product' && p.qty_available <= p.min_stock)
        .sort((a, b) => a.qty_available - b.qty_available)
        .slice(0, 8)
        .map((p) => ({ id: p.id, name: p.name, sku: p.sku, qty_available: p.qty_available, min_stock: p.min_stock })),
      recentOrders: [...db.sales]
        .sort((a, b) => b.id - a.id)
        .slice(0, 8)
        .map((o) => ({
          id: o.id,
          name: o.name,
          state: o.state,
          amount_total: o.amount_total,
          date_order: o.date_order,
          partner_name: partnerName(o.partner_id),
        })),
      monthRevenue: round2(
        db.invoices
          .filter((i) => i.type === 'customer' && ['posted', 'paid'].includes(i.state) && i.invoice_date.startsWith(monthKey))
          .reduce((acc, i) => acc + i.amount_total, 0)
      ),
    });
  }

  // ---------- Contactos ----------
  if (method === 'GET' && path === '/partners') {
    let rows = db.partners.map((p) => ({
      ...p,
      sales_count: db.sales.filter((s) => s.partner_id === p.id).length,
      purchases_count: db.purchases.filter((o) => o.supplier_id === p.id).length,
    }));
    const term = (query.get('q') || '').toLowerCase().trim();
    if (term) {
      rows = rows.filter((p) =>
        [p.name, p.email, p.vat].some((v) => (v || '').toLowerCase().includes(term))
      );
    }
    const type = query.get('type') || '';
    if (['customer', 'supplier', 'both'].includes(type)) {
      rows = rows.filter((p) => p.type === type || p.type === 'both');
    }
    return ok(rows.sort((a, b) => b.id - a.id));
  }

  if (method === 'POST' && path === '/partners') {
    if (!body.name || !String(body.name).trim()) return fail(400, 'El nombre es obligatorio');
    if (body.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) return fail(400, 'Email inválido');
    const partner: DemoPartner = {
      id: ++db.seq.partners,
      name: String(body.name).trim(),
      email: body.email || null,
      phone: body.phone || null,
      vat: body.vat || null,
      type: ['customer', 'supplier', 'both'].includes(body.type) ? body.type : 'customer',
      address: body.address || null,
      city: body.city || null,
      country: body.country || null,
      is_company: body.is_company === undefined ? 1 : body.is_company ? 1 : 0,
      active: body.active === undefined ? 1 : body.active ? 1 : 0,
      created_at: nowStamp(),
    };
    db.partners.push(partner);
    return ok(partner, 201);
  }

  const partnerMatch = path.match(/^\/partners\/(\d+)$/);
  if (partnerMatch) {
    const id = Number(partnerMatch[1]);
    const partner = db.partners.find((p) => p.id === id);
    if (!partner) return fail(404, 'Contacto no encontrado');
    if (method === 'GET') return ok(partner);
    if (method === 'PUT') {
      if (!body.name || !String(body.name).trim()) return fail(400, 'El nombre es obligatorio');
      if (body.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) return fail(400, 'Email inválido');
      partner.name = String(body.name).trim();
      partner.email = body.email !== undefined ? body.email || null : partner.email;
      partner.phone = body.phone !== undefined ? body.phone || null : partner.phone;
      partner.vat = body.vat !== undefined ? body.vat || null : partner.vat;
      partner.type = ['customer', 'supplier', 'both'].includes(body.type) ? body.type : partner.type;
      partner.address = body.address !== undefined ? body.address || null : partner.address;
      partner.city = body.city !== undefined ? body.city || null : partner.city;
      partner.country = body.country !== undefined ? body.country || null : partner.country;
      partner.is_company = body.is_company !== undefined ? (body.is_company ? 1 : 0) : partner.is_company;
      partner.active = body.active !== undefined ? (body.active ? 1 : 0) : partner.active;
      return ok(partner);
    }
    if (method === 'DELETE') {
      partner.active = 0;
      return ok({ ok: true });
    }
  }

  // ---------- Productos ----------
  if (method === 'GET' && path === '/products') {
    let rows = db.products.map((p) => ({ ...p, category_name: categoryName(p.category_id) }));
    const term = (query.get('q') || '').toLowerCase().trim();
    if (term) {
      rows = rows.filter((p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term));
    }
    return ok(rows.sort((a, b) => b.id - a.id));
  }

  if (method === 'GET' && path === '/products/categories') {
    return ok([...db.categories].sort((a, b) => a.name.localeCompare(b.name)));
  }

  if (method === 'POST' && path === '/products/categories') {
    const name = String(body.name || '').trim();
    if (!name) return fail(400, 'El nombre de la categoría es obligatorio');
    const category = { id: ++db.seq.categories, name };
    db.categories.push(category);
    return ok(category, 201);
  }

  const stockMatch = path.match(/^\/products\/(\d+)\/stock$/);
  if (method === 'POST' && stockMatch) {
    const product = db.products.find((p) => p.id === Number(stockMatch[1]));
    if (!product) return fail(404, 'Producto no encontrado');
    if (product.type === 'service') return fail(400, 'Los servicios no gestionan stock');
    const type = ['in', 'out', 'adjust'].includes(body.type) ? body.type : 'in';
    const qty = Number(body.qty);
    if (!qty || qty <= 0) return fail(400, 'La cantidad debe ser mayor que cero');
    if (type === 'out' && product.qty_available < qty) {
      return fail(400, `Stock insuficiente (disponible: ${product.qty_available})`);
    }
    product.qty_available = type === 'adjust' ? qty : product.qty_available + (type === 'out' ? -qty : qty);
    addMovement(product.id, type, qty, body.reference || 'Ajuste manual');
    return ok({ id: product.id, qty_available: product.qty_available });
  }

  const productMatch = path.match(/^\/products\/(\d+)$/);
  if (productMatch) {
    const id = Number(productMatch[1]);
    const product = db.products.find((p) => p.id === id);
    if (!product) return fail(404, 'Producto no encontrado');
    if (method === 'GET') return ok({ ...product, category_name: categoryName(product.category_id) });
    if (method === 'PUT') {
      const sku = String(body.sku || product.sku).trim();
      if (db.products.some((p) => p.id !== id && p.sku === sku)) {
        return fail(409, 'Ya existe un producto con esa referencia (SKU)');
      }
      product.name = String(body.name || product.name).trim();
      product.sku = sku;
      product.category_id = body.category_id !== undefined ? (body.category_id || null) : product.category_id;
      product.type = body.type === 'service' ? 'service' : 'product';
      product.price = body.price !== undefined ? Number(body.price) || 0 : product.price;
      product.cost = body.cost !== undefined ? Number(body.cost) || 0 : product.cost;
      product.min_stock = body.min_stock !== undefined ? Number(body.min_stock) || 0 : product.min_stock;
      product.uom = body.uom || product.uom;
      product.active = body.active !== undefined ? (body.active ? 1 : 0) : product.active;
      return ok(product);
    }
    if (method === 'DELETE') {
      product.active = 0;
      return ok({ ok: true });
    }
  }

  if (method === 'POST' && path === '/products') {
    if (!body.name || !String(body.name).trim()) return fail(400, 'El nombre es obligatorio');
    if (!body.sku || !String(body.sku).trim()) return fail(400, 'La referencia (SKU) es obligatoria');
    const sku = String(body.sku).trim();
    if (db.products.some((p) => p.sku === sku)) return fail(409, 'Ya existe un producto con esa referencia (SKU)');
    const product: DemoProduct = {
      id: ++db.seq.products,
      name: String(body.name).trim(),
      sku,
      category_id: body.category_id || null,
      type: body.type === 'service' ? 'service' : 'product',
      price: Number(body.price) || 0,
      cost: Number(body.cost) || 0,
      qty_available: Number(body.qty_available) || 0,
      min_stock: Number(body.min_stock) || 0,
      uom: body.uom || 'Unidad',
      active: body.active === undefined ? 1 : body.active ? 1 : 0,
      created_at: nowStamp(),
    };
    db.products.push(product);
    return ok(product, 201);
  }

  // ---------- Inventario ----------
  if (method === 'GET' && path === '/inventory') {
    const productId = query.get('product_id');
    const rows = db.movements
      .filter((m) => !productId || m.product_id === Number(productId))
      .sort((a, b) => b.id - a.id)
      .map((m) => {
        const product = db.products.find((p) => p.id === m.product_id);
        const user = db.users.find((u) => u.id === m.user_id);
        return {
          ...m,
          product_name: product?.name ?? '—',
          sku: product?.sku ?? '—',
          user_name: user?.name ?? null,
        };
      });
    return ok(rows);
  }

  // ---------- Usuarios ----------
  if (method === 'GET' && path === '/users') {
    return ok(db.users.map((u) => ({ ...u })));
  }

  if (method === 'POST' && path === '/users') {
    if (!body.name || !String(body.name).trim()) return fail(400, 'El nombre es obligatorio');
    if (!body.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) return fail(400, 'Email inválido');
    if (!body.password || String(body.password).length < 4) return fail(400, 'La contraseña debe tener al menos 4 caracteres');
    if (!['admin', 'sales', 'purchase', 'accounting'].includes(body.role)) return fail(400, 'Rol inválido');
    const email = String(body.email).toLowerCase().trim();
    if (db.users.some((u) => u.email === email)) return fail(409, 'Ya existe un usuario con ese email');
    const user: DemoUser = {
      id: ++db.seq.users,
      name: String(body.name).trim(),
      email,
      role: body.role,
      active: body.active === undefined ? 1 : body.active ? 1 : 0,
      last_login: null,
      created_at: nowStamp(),
    };
    db.users.push(user);
    return ok({ ...user }, 201);
  }

  const userMatch = path.match(/^\/users\/(\d+)$/);
  if (userMatch) {
    const id = Number(userMatch[1]);
    const user = db.users.find((u) => u.id === id);
    if (!user) return fail(404, 'Usuario no encontrado');
    if (method === 'PUT') {
      if (body.email) {
        const email = String(body.email).toLowerCase().trim();
        if (db.users.some((u) => u.id !== id && u.email === email)) return fail(409, 'Ya existe un usuario con ese email');
        user.email = email;
      }
      if (body.password && String(body.password).length < 4) return fail(400, 'La contraseña debe tener al menos 4 caracteres');
      if (user.role === 'admin' && body.role && body.role !== 'admin') {
        const admins = db.users.filter((u) => u.role === 'admin' && u.active).length;
        if (admins <= 1) return fail(400, 'Debe existir al menos un administrador activo');
      }
      user.name = String(body.name || user.name).trim();
      user.role = ['admin', 'sales', 'purchase', 'accounting'].includes(body.role) ? body.role : user.role;
      user.active = body.active !== undefined ? (body.active ? 1 : 0) : user.active;
      return ok({ ...user });
    }
    if (method === 'DELETE') {
      if (user.id === (db.currentUser?.id ?? 1)) return fail(400, 'No puedes desactivar tu propio usuario');
      if (user.role === 'admin') {
        const admins = db.users.filter((u) => u.role === 'admin' && u.active).length;
        if (admins <= 1) return fail(400, 'Debe existir al menos un administrador activo');
      }
      user.active = 0;
      return ok({ ok: true });
    }
  }

  // ---------- Embudo de ventas ----------
  const DEAL_STAGES = ['prospect', 'ai_proposal', 'draga_design', 'quote', 'won', 'lost'];
  const dealOut = (d: DemoDeal) => ({ ...d, partner_name: d.partner_id ? partnerName(d.partner_id) : null });

  if (method === 'GET' && path === '/sales/deals') {
    return ok(
      db.deals
        .map(dealOut)
        .sort(
          (a, b) =>
            DEAL_STAGES.indexOf(a.stage) - DEAL_STAGES.indexOf(b.stage) ||
            a.sort_order - b.sort_order ||
            a.id - b.id
        )
    );
  }

  if (method === 'POST' && path === '/sales/deals') {
    const title = String(body.title || '').trim();
    if (!title) return fail(400, 'El título es obligatorio');
    const amount = Number(body.amount);
    if (Number.isNaN(amount) || amount < 0) return fail(400, 'Importe inválido');
    const stage = DEAL_STAGES.includes(body.stage) ? body.stage : 'prospect';
    const maxOrder = db.deals.filter((d) => d.stage === stage).reduce((acc, d) => Math.max(acc, d.sort_order), -1);
    const deal: DemoDeal = {
      id: ++db.seq.deals,
      title: title.slice(0, 180),
      partner_id: body.partner_id ? Number(body.partner_id) : null,
      amount: round2(amount),
      stage,
      notes: body.notes ? String(body.notes) : null,
      sort_order: maxOrder + 1,
      created_at: nowStamp(),
      updated_at: nowStamp(),
    };
    db.deals.push(deal);
    return ok(dealOut(deal), 201);
  }

  const dealMoveMatch = path.match(/^\/sales\/deals\/(\d+)\/move$/);
  if (method === 'POST' && dealMoveMatch) {
    const deal = db.deals.find((d) => d.id === Number(dealMoveMatch[1]));
    if (!deal) return fail(404, 'Oportunidad no encontrada');
    if (!DEAL_STAGES.includes(body.stage)) return fail(400, 'Etapa inválida');
    deal.stage = body.stage;
    deal.updated_at = nowStamp();
    if (Array.isArray(body.ids)) {
      body.ids.forEach((rawId: any, index: number) => {
        const item = db.deals.find((d) => d.id === Number(rawId) && d.stage === deal.stage);
        if (item) item.sort_order = index;
      });
    }
    return ok(dealOut(deal));
  }

  const dealMatch = path.match(/^\/sales\/deals\/(\d+)$/);
  if (dealMatch) {
    const index = db.deals.findIndex((d) => d.id === Number(dealMatch[1]));
    if (index < 0) return fail(404, 'Oportunidad no encontrada');
    const deal = db.deals[index];
    if (method === 'GET') return ok(dealOut(deal));
    if (method === 'PUT') {
      const title = body.title !== undefined ? String(body.title).trim() : deal.title;
      if (!title) return fail(400, 'El título es obligatorio');
      const amount = body.amount !== undefined ? Number(body.amount) : deal.amount;
      if (Number.isNaN(amount) || amount < 0) return fail(400, 'Importe inválido');
      const stage = DEAL_STAGES.includes(body.stage) ? body.stage : deal.stage;
      if (stage !== deal.stage) {
        const maxOrder = db.deals.filter((d) => d.stage === stage).reduce((acc, d) => Math.max(acc, d.sort_order), -1);
        deal.sort_order = maxOrder + 1;
      }
      deal.title = title.slice(0, 180);
      deal.partner_id = body.partner_id !== undefined ? (body.partner_id ? Number(body.partner_id) : null) : deal.partner_id;
      deal.amount = round2(amount);
      deal.stage = stage;
      deal.notes = body.notes !== undefined ? (body.notes ? String(body.notes) : null) : deal.notes;
      deal.updated_at = nowStamp();
      return ok(dealOut(deal));
    }
    if (method === 'DELETE') {
      db.deals.splice(index, 1);
      return ok({ ok: true });
    }
  }

  // ---------- Pedidos de venta ----------
  if (method === 'GET' && path === '/sales/orders') {
    let rows = db.sales.map((o) => ({
      ...o,
      partner_name: partnerName(o.partner_id),
      seller_name: db.users.find((u) => u.id === o.user_id)?.name ?? null,
      lines: undefined,
    }));
    const term = (query.get('q') || '').toLowerCase().trim();
    if (term) {
      rows = rows.filter((o) => o.name.toLowerCase().includes(term) || o.partner_name.toLowerCase().includes(term));
    }
    const state = query.get('state') || '';
    if (['draft', 'sent', 'sale', 'done', 'cancel'].includes(state)) rows = rows.filter((o) => o.state === state);
    return ok(rows.sort((a, b) => b.id - a.id));
  }

  if (method === 'POST' && path === '/sales/orders') {
    if (!body.partner_id) return fail(400, 'Selecciona un cliente');
    if (!Array.isArray(body.lines) || !body.lines.length) return fail(400, 'El pedido necesita al menos una línea');
    const lines = buildLines(body.lines);
    const id = ++db.seq.sales;
    const order: DemoSalesOrder = {
      id,
      name: `SO-${new Date().getFullYear()}-${String(id).padStart(4, '0')}`,
      partner_id: Number(body.partner_id),
      user_id: db.currentUser?.id ?? 1,
      state: 'draft',
      notes: body.notes || null,
      date_order: nowStamp(),
      amount_untaxed: linesTotal(lines),
      amount_total: linesTotal(lines),
      lines,
    };
    db.sales.push(order);
    return ok(order, 201);
  }

  const salesActionMatch = path.match(/^\/sales\/orders\/(\d+)\/action$/);
  if (method === 'POST' && salesActionMatch) {
    const order = db.sales.find((o) => o.id === Number(salesActionMatch[1]));
    if (!order) return fail(404, 'Pedido no encontrado');
    const action = body.action;

    if (action === 'send') {
      if (order.state !== 'draft') return fail(400, 'Solo los borradores pueden enviarse');
      order.state = 'sent';
    } else if (action === 'confirm') {
      if (!['draft', 'sent'].includes(order.state)) return fail(400, 'Este pedido ya no puede confirmarse');
      for (const line of order.lines) {
        const product = db.products.find((p) => p.id === line.product_id && p.type === 'product');
        if (!product) continue;
        if (product.qty_available < line.qty) return fail(400, `Stock insuficiente para "${line.description}"`);
        product.qty_available -= line.qty;
        addMovement(product.id, 'out', line.qty, `Venta ${order.name}`);
      }
      order.state = 'sale';
    } else if (action === 'done') {
      if (order.state !== 'sale') return fail(400, 'Solo pedidos confirmados pueden finalizarse');
      order.state = 'done';
    } else if (action === 'cancel') {
      if (['done', 'cancel'].includes(order.state)) return fail(400, 'Este pedido ya no puede cancelarse');
      if (order.state === 'sale') {
        for (const line of order.lines) {
          const product = db.products.find((p) => p.id === line.product_id && p.type === 'product');
          if (!product) continue;
          product.qty_available += line.qty;
          addMovement(product.id, 'in', line.qty, `Cancelación ${order.name}`);
        }
      }
      order.state = 'cancel';
    } else {
      return fail(400, 'Acción inválida');
    }
    return ok(order);
  }

  const salesMatch = path.match(/^\/sales\/orders\/(\d+)$/);
  if (salesMatch) {
    const index = db.sales.findIndex((o) => o.id === Number(salesMatch[1]));
    if (index < 0) return fail(404, 'Pedido no encontrado');
    const order = db.sales[index];
    if (method === 'GET') {
      const partner = db.partners.find((p) => p.id === order.partner_id);
      return ok({
        ...order,
        partner_name: partner?.name ?? '—',
        partner_email: partner?.email ?? null,
        seller_name: db.users.find((u) => u.id === order.user_id)?.name ?? null,
        lines: order.lines.map(withSku),
      });
    }
    if (method === 'PUT') {
      if (!['draft', 'sent'].includes(order.state)) return fail(400, 'Solo pedidos en Borrador o Enviado son editables');
      if (!Array.isArray(body.lines) || !body.lines.length) return fail(400, 'El pedido necesita al menos una línea');
      order.partner_id = Number(body.partner_id || order.partner_id);
      order.notes = body.notes !== undefined ? body.notes || null : order.notes;
      order.lines = buildLines(body.lines);
      order.amount_untaxed = linesTotal(order.lines);
      order.amount_total = order.amount_untaxed;
      return ok(order);
    }
    if (method === 'DELETE') {
      if (!['draft', 'cancel'].includes(order.state)) return fail(400, 'Solo se eliminan pedidos en Borrador o Cancelado');
      db.sales.splice(index, 1);
      return ok({ ok: true });
    }
  }

  // ---------- Compras ----------
  if (method === 'GET' && path === '/purchases') {
    let rows = db.purchases.map((o) => ({
      ...o,
      supplier_name: partnerName(o.supplier_id),
      buyer_name: db.users.find((u) => u.id === o.user_id)?.name ?? null,
      lines: undefined,
    }));
    const term = (query.get('q') || '').toLowerCase().trim();
    if (term) {
      rows = rows.filter((o) => o.name.toLowerCase().includes(term) || o.supplier_name.toLowerCase().includes(term));
    }
    const state = query.get('state') || '';
    if (['draft', 'confirmed', 'received', 'done', 'cancel'].includes(state)) {
      rows = rows.filter((o) => o.state === state);
    }
    return ok(rows.sort((a, b) => b.id - a.id));
  }

  if (method === 'POST' && path === '/purchases') {
    if (!body.supplier_id) return fail(400, 'Selecciona un proveedor');
    if (!Array.isArray(body.lines) || !body.lines.length) return fail(400, 'La compra necesita al menos una línea');
    const lines = body.lines.map((l: any) => {
      const product = db.products.find((p) => p.id === Number(l.product_id));
      return {
        id: ++db.seq.lines,
        product_id: product ? product.id : null,
        description: String(l.description || product?.name || 'Línea').slice(0, 200),
        qty: Number(l.qty),
        price_unit: Number(l.price_unit ?? product?.cost ?? 0),
      };
    });
    const id = ++db.seq.purchases;
    const order: DemoPurchaseOrder = {
      id,
      name: `PO-${new Date().getFullYear()}-${String(id).padStart(4, '0')}`,
      supplier_id: Number(body.supplier_id),
      user_id: db.currentUser?.id ?? 1,
      state: 'draft',
      expected_date: body.expected_date || null,
      notes: body.notes || null,
      date_order: nowStamp(),
      amount_untaxed: linesTotal(lines),
      amount_total: linesTotal(lines),
      lines,
    };
    db.purchases.push(order);
    return ok(order, 201);
  }

  const purchaseActionMatch = path.match(/^\/purchases\/(\d+)\/action$/);
  if (method === 'POST' && purchaseActionMatch) {
    const order = db.purchases.find((o) => o.id === Number(purchaseActionMatch[1]));
    if (!order) return fail(404, 'Compra no encontrada');
    const action = body.action;

    if (action === 'confirm') {
      if (order.state !== 'draft') return fail(400, 'Solo los borradores pueden confirmarse');
      order.state = 'confirmed';
    } else if (action === 'receive') {
      if (order.state !== 'confirmed') return fail(400, 'Debes confirmar la compra antes de recibirla');
      for (const line of order.lines) {
        const product = db.products.find((p) => p.id === line.product_id && p.type === 'product');
        if (!product) continue;
        product.qty_available += line.qty;
        addMovement(product.id, 'in', line.qty, `Compra ${order.name}`);
      }
      order.state = 'received';
    } else if (action === 'done') {
      if (order.state !== 'received') return fail(400, 'Solo compras recibidas pueden finalizarse');
      order.state = 'done';
    } else if (action === 'cancel') {
      if (['done', 'cancel'].includes(order.state)) return fail(400, 'Esta compra ya no puede cancelarse');
      if (order.state === 'received') {
        for (const line of order.lines) {
          const product = db.products.find((p) => p.id === line.product_id && p.type === 'product');
          if (!product) continue;
          product.qty_available -= line.qty;
          addMovement(product.id, 'out', line.qty, `Cancelación ${order.name}`);
        }
      }
      order.state = 'cancel';
    } else {
      return fail(400, 'Acción inválida');
    }
    return ok(order);
  }

  const purchaseMatch = path.match(/^\/purchases\/(\d+)$/);
  if (method === 'GET' && purchaseMatch) {
    const order = db.purchases.find((o) => o.id === Number(purchaseMatch[1]));
    if (!order) return fail(404, 'Compra no encontrada');
    const supplier = db.partners.find((p) => p.id === order.supplier_id);
    return ok({
      ...order,
      supplier_name: supplier?.name ?? '—',
      supplier_email: supplier?.email ?? null,
      buyer_name: db.users.find((u) => u.id === order.user_id)?.name ?? null,
      lines: order.lines.map(withSku),
    });
  }

  // ---------- Facturas ----------
  if (method === 'GET' && path === '/invoices') {
    let rows = db.invoices.map((i) => ({ ...i, partner_name: partnerName(i.partner_id), lines: undefined }));
    const term = (query.get('q') || '').toLowerCase().trim();
    if (term) {
      rows = rows.filter((i) => i.number.toLowerCase().includes(term) || i.partner_name.toLowerCase().includes(term));
    }
    const state = query.get('state') || '';
    if (['draft', 'posted', 'paid', 'cancel'].includes(state)) rows = rows.filter((i) => i.state === state);
    const type = query.get('type') || '';
    if (['customer', 'supplier'].includes(type)) rows = rows.filter((i) => i.type === type);
    return ok(rows.sort((a, b) => b.id - a.id));
  }

  if (method === 'POST' && path === '/invoices') {
    if (!body.partner_id) return fail(400, 'Selecciona el contacto de la factura');
    if (!Array.isArray(body.lines) || !body.lines.length) return fail(400, 'La factura necesita al menos una línea');
    for (const l of body.lines) {
      if (!(Number(l.qty) > 0) || !(Number(l.price_unit ?? 0) >= 0)) {
        return fail(400, 'Revisa cantidades y precios de las líneas');
      }
    }
    const lines = buildLines(body.lines);
    const untaxed = linesTotal(lines);
    const taxRate = Number(body.tax_rate ?? 21);
    const tax = round2((untaxed * taxRate) / 100);
    const id = ++db.seq.invoices;
    const invoice: DemoInvoice = {
      id,
      number: `FAC-${new Date().getFullYear()}-${String(id).padStart(4, '0')}`,
      partner_id: Number(body.partner_id),
      type: body.type === 'supplier' ? 'supplier' : 'customer',
      state: 'draft',
      invoice_date: body.invoice_date || todayISO(),
      due_date: body.due_date || null,
      tax_rate: taxRate,
      amount_untaxed: untaxed,
      amount_tax: tax,
      amount_total: round2(untaxed + tax),
      lines,
    };
    db.invoices.push(invoice);
    return ok(invoice, 201);
  }

  const invoiceActionMatch = path.match(/^\/invoices\/(\d+)\/action$/);
  if (method === 'POST' && invoiceActionMatch) {
    const invoice = db.invoices.find((i) => i.id === Number(invoiceActionMatch[1]));
    if (!invoice) return fail(404, 'Factura no encontrada');
    const action = body.action;
    if (action === 'post') {
      if (invoice.state !== 'draft') return fail(400, 'Solo las facturas borrador pueden publicarse');
      invoice.state = 'posted';
    } else if (action === 'pay') {
      if (invoice.state !== 'posted') return fail(400, 'Solo facturas publicadas pueden marcarse como pagadas');
      invoice.state = 'paid';
    } else if (action === 'cancel') {
      if (invoice.state === 'paid') return fail(400, 'Una factura pagada no puede cancelarse');
      invoice.state = 'cancel';
    } else {
      return fail(400, 'Acción inválida');
    }
    return ok(invoice);
  }

  const invoiceMatch = path.match(/^\/invoices\/(\d+)$/);
  if (invoiceMatch) {
    const index = db.invoices.findIndex((i) => i.id === Number(invoiceMatch[1]));
    if (index < 0) return fail(404, 'Factura no encontrada');
    const invoice = db.invoices[index];
    if (method === 'GET') {
      const partner = db.partners.find((p) => p.id === invoice.partner_id);
      return ok({
        ...invoice,
        partner_name: partner?.name ?? '—',
        vat: partner?.vat ?? null,
        address: partner?.address ?? null,
        city: partner?.city ?? null,
        lines: invoice.lines.map(withSku),
      });
    }
    if (method === 'DELETE') {
      if (!['draft', 'cancel'].includes(invoice.state)) return fail(400, 'Solo se eliminan facturas en Borrador o Cancelado');
      db.invoices.splice(index, 1);
      return ok({ ok: true });
    }
  }

  return fail(404, `Ruta no encontrada en modo demo: ${method} ${path}`);
};
