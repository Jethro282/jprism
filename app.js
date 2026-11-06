
const modules = [
  ['dashboard','◫','Dashboard','A clear view of your business, all in one place.'],
  ['inventory','▤','Inventory','Manage product master data, purchasing units and stock.'],
  ['work-orders','▣','Work Orders','Plan and monitor work orders.'],
  ['stock-received','↧','Stock Received','Record incoming stock in cartons or individual units.'],
  ['adjustments','⇄','Adjustments','Review stock movements and corrections.'],
  ['production','⚙','Production','Coordinate production and material requirements.'],
  ['suppliers','♧','Suppliers','Manage your supplier relationships.'],
  ['reports','▥','Reports','Explore stock and operational insights.']
];

const $ = id => document.getElementById(id);

const escapeHtml = s => String(s ?? '').replace(
  /[&<>"']/g,
  c => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[c])
);

const fmt = n => Number(n).toLocaleString('en-AU',{
  maximumFractionDigits:6
});

const money = n => Number(n).toLocaleString('en-AU',{
  style:'currency',
  currency:'AUD'
});

let current = 'welcome';

$('nav').innerHTML = modules.map(
  ([id,icon,label]) =>
    `<button class="nav" data-page="${id}">
      <span class="navicon">${icon}</span>${label}
    </button>`
).join('');

function badge(status) {
  return `<span class="tag ${
    status === 'Low Stock' ? 'low' :
    status === 'Out of Stock' ? 'out' : ''
  }">${escapeHtml(status)}</span>`;
}

function table(items,actions=false) {
  return `
  <div class="tablewrap">
    <table>
      <thead>
        <tr>
          <th>SKU</th>
          <th>Product</th>
          <th>Category</th>
          <th>On Hand</th>
          <th>Purchase Unit</th>
          <th>Status</th>
          ${actions ? '<th>Actions</th>' : ''}
        </tr>
      </thead>
      <tbody>
      ${items.length ? items.map(p => `
        <tr>
          <td>${escapeHtml(p.sku)}</td>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.cat)}</td>
          <td>${fmt(p.qty)} ${escapeHtml(p.unit)}</td>
          <td>${p.purchaseUnit
            ? `1 ${escapeHtml(p.purchaseUnit)} = ${fmt(p.factor)} ${escapeHtml(p.unit)}`
            : '—'}</td>
          <td>${badge(p.status)}</td>
          ${actions ? `
            <td class="table-actions">
              <button class="btn" data-edit="${escapeHtml(p.id)}">Edit</button>
              <button class="btn" data-move="${escapeHtml(p.id)}">Movement</button>
              <button class="btn danger" data-archive="${escapeHtml(p.id)}">Archive</button>
            </td>` : ''}
        </tr>
      `).join('') : `
        <tr>
          <td colspan="${actions ? 7 : 6}">No matching products.</td>
        </tr>`}
      </tbody>
    </table>
  </div>`;
}

function dashboard() {
  const p = JPRISMInventory.all();
  const transactions = JPRISMInventory.ledger();

  const metrics = [
    ['Total Products',fmt(p.length),'Active product records'],
    ['Low Stock Items',fmt(p.filter(x => x.status === 'Low Stock').length),'At or below minimum'],
    ['Recorded Movements',fmt(transactions.length),'Stored in this browser'],
    ['Inventory Value',money(p.reduce((sum,x) => sum + x.qty*x.cost,0)),'Indicative base-unit cost']
  ];

  return `
    <div class="metrics">
      ${metrics.map(([a,b,c]) => `
        <div class="card">
          <div class="metriclabel">${a}</div>
          <div class="metricvalue">${b}</div>
          <div class="hint">${c}</div>
        </div>
      `).join('')}
    </div>

    <div class="grid2">
      <section class="card">
        <div class="cardhead">
          <h2>Inventory snapshot</h2>
          <button class="btn" data-go="inventory">
            View all inventory →
          </button>
        </div>
        ${table(p.slice(0,5))}
      </section>

      <section class="card">
        <div class="cardhead">
          <h2>Recent movements</h2>
          <span class="tag">Browser data</span>
        </div>
        <div class="activity">
          ${transactions.length
            ? transactions.slice(0,6).map(t => {
                const product = p.find(x => x.id === t.productId);
                return `
                  <div class="event">
                    <span class="dot"></span>
                    <div>
                      <strong>${escapeHtml(t.type)} · ${escapeHtml(product?.name || 'Archived product')}</strong>
                      <p>${fmt(t.qty)} ${escapeHtml(product?.unit || 'units')} · ${escapeHtml(t.reference || 'No reference')}</p>
                    </div>
                  </div>`;
              }).join('')
            : '<p class="hint">No movements yet.</p>'}
        </div>
      </section>
    </div>`;
}

function inventory() {
  const p = JPRISMInventory.all();

  return `
    <section class="card">
      <div class="cardhead">
        <h2>Product catalogue</h2>
        <button class="btn primary" id="new-product">
          + Add product
        </button>
      </div>

      <div class="editor" id="editor" hidden></div>

      <div class="toolbar">
        <input id="search" type="search"
          placeholder="Search SKU, product or supplier…"
          aria-label="Search inventory">

        <select id="category" aria-label="Filter category">
          <option value="">All categories</option>
          ${JPRISMInventory.categories.map(c =>
            `<option>${c}</option>`
          ).join('')}
        </select>

        <button class="btn" id="export-data">
          Export backup
        </button>

        <label class="btn" style="cursor:pointer">
          Import backup
          <input id="import-data" type="file"
            accept=".json,application/json" hidden>
        </label>
      </div>

      <p class="hint">
        ${p.length} active products · Balances calculated from movements · Demo browser storage only
      </p>

      <div id="results">${table(p,true)}</div>
    </section>`;
}

function options(values,selected) {
  return values.map(v => `
    <option value="${escapeHtml(v)}"
      ${v === selected ? 'selected' : ''}>
      ${escapeHtml(v)}
    </option>`
  ).join('');
}

function editor(id) {
  const p = JPRISMInventory.all(true).find(x => x.id === id) || {
    sku:'',
    name:'',
    description:'',
    type:'Raw Material',
    cat:'Raw Materials',
    unit:'units',
    purchaseUnit:'',
    factor:1,
    minQty:0,
    reorderQty:0,
    cost:0,
    supplier:'',
    batchTracked:false,
    expiryTracked:false
  };

  const el = $('editor');
  el.hidden = false;

  el.innerHTML = `
    <form id="product-form" class="card">
      <div class="cardhead">
        <h2>${id ? 'Edit' : 'Add'} product</h2>
        <button type="button" class="btn" id="cancel-editor">Close</button>
      </div>

      <div class="form-grid">
        <label>SKU *
          <input name="sku" required maxlength="40"
            value="${escapeHtml(p.sku)}">
        </label>

        <label>Product name *
          <input name="name" required maxlength="120"
            value="${escapeHtml(p.name)}">
        </label>

        <label>Product type *
          <select name="type">
            ${options(JPRISMInventory.types,p.type)}
          </select>
        </label>

        <label>Category *
          <select name="cat">
            ${options(JPRISMInventory.categories,p.cat)}
          </select>
        </label>

        <label>Base stock unit *
          <select name="unit">
            ${options(JPRISMInventory.units,p.unit)}
          </select>
        </label>

        <label>Purchasing unit
          <select name="purchaseUnit">
            <option value="">Same as base unit</option>
            ${options(JPRISMInventory.units,p.purchaseUnit)}
          </select>
        </label>

        <label>Base units per purchasing unit *
          <input name="factor" type="number"
            step="any" min="0.000001" required
            value="${p.factor}">
        </label>

        <label>Preferred supplier
          <input name="supplier" maxlength="120"
            value="${escapeHtml(p.supplier)}">
        </label>

        <label>Minimum stock
          <input name="minQty" type="number"
            min="0" step="any" required
            value="${p.minQty}">
        </label>

        <label>Reorder quantity
          <input name="reorderQty" type="number"
            min="0" step="any" required
            value="${p.reorderQty}">
        </label>

        <label>Unit cost in AUD (per base unit)
          <input name="cost" type="number"
            min="0" step="any" required
            value="${p.cost}">
        </label>

        <label>Description
          <input name="description" maxlength="500"
            value="${escapeHtml(p.description)}">
        </label>
      </div>

      <div class="check-row">
        <label>
          <input type="checkbox" name="batchTracked"
            ${p.batchTracked ? 'checked' : ''}>
          Track batches
        </label>

        <label>
          <input type="checkbox" name="expiryTracked"
            ${p.expiryTracked ? 'checked' : ''}>
          Track expiry dates (design flag)
        </label>
      </div>

      <p class="hint">
        Example: Base unit = boxes; purchasing unit = cartons;
        conversion = 25. Stock is not edited here.
      </p>

      <div class="actions">
        <button type="submit" class="btn primary">Save product</button>
        <button type="button" class="btn" id="cancel-bottom">Cancel</button>
      </div>
    </form>`;

  const close = () => el.hidden = true;

  $('cancel-editor').onclick = close;
  $('cancel-bottom').onclick = close;

  $('product-form').onsubmit = e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));

    try {
      JPRISMInventory.save({
        ...d,
        id:id || undefined,
        factor:Number(d.factor),
        minQty:Number(d.minQty),
        reorderQty:Number(d.reorderQty),
        cost:Number(d.cost),
        batchTracked:!!d.batchTracked,
        expiryTracked:!!d.expiryTracked
      });

      render('inventory');
    } catch(err) {
      alert(err.message);
    }
  };

  el.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function movementForm(id,defaultType='receipt') {
  const p = JPRISMInventory.all().find(x => x.id === id);
  if (!p) return;

  const el = $('editor');
  el.hidden = false;

  const types = [
    'opening','receipt','issue',
    'adjustment-in','adjustment-out'
  ];

  el.innerHTML = `
    <form id="movement-form" class="card">
      <div class="cardhead">
        <h2>Record stock movement · ${escapeHtml(p.name)}</h2>
        <button type="button" class="btn" id="cancel-editor">
          Close
        </button>
      </div>

      <p class="hint">
        Current balance: ${fmt(p.qty)} ${escapeHtml(p.unit)}.
        Stock is always stored in base units.
      </p>

      <div class="form-grid">
        <label>Movement type
          <select name="type">
            ${options(types,defaultType)}
          </select>
        </label>

        <label>Quantity
          <input name="enteredQty" type="number"
            min="0.000001" step="any" required>
        </label>

        <label>Entered unit
          <select name="enteredUnit">
            <option value="${escapeHtml(p.unit)}">
              ${escapeHtml(p.unit)} (base)
            </option>
            ${p.purchaseUnit && p.purchaseUnit !== p.unit
              ? `<option value="${escapeHtml(p.purchaseUnit)}">
                   ${escapeHtml(p.purchaseUnit)} (× ${fmt(p.factor)})
                 </option>`
              : ''}
          </select>
        </label>

        <label>Batch number ${p.batchTracked ? '*' : '(optional)'}
          <input name="batch" ${p.batchTracked ? 'required' : ''}
            maxlength="100">
        </label>

        <label>Reference / PO / packing order
          <input name="reference" maxlength="100">
        </label>

        <label>Notes
          <input name="note" maxlength="500">
        </label>
      </div>

      <p id="conversion-preview" class="statusline"></p>

      <p class="hint">
        Issues and adjustment-outs cannot make total or batch stock
        negative. This is a basic transaction prototype,
        not a complete packing-order workflow.
      </p>

      <div class="actions">
        <button class="btn primary" type="submit">
          Post movement
        </button>
      </div>
    </form>`;

  $('cancel-editor').onclick = () => el.hidden = true;

  const form = $('movement-form');

  const update = () => {
    const d = Object.fromEntries(new FormData(form));
    const factor = d.enteredUnit === p.unit ? 1 : p.factor;
    const amount = Number(d.enteredQty || 0) * factor;

    $('conversion-preview').textContent =
      `${fmt(Number(d.enteredQty) || 0)} ${d.enteredUnit} = ${fmt(amount)} ${p.unit}`;
  };

  form.addEventListener('input',update);
  form.addEventListener('change',update);
  update();

  form.onsubmit = e => {
    e.preventDefault();

    try {
      JPRISMInventory.transact({
        ...Object.fromEntries(new FormData(form)),
        productId:id
      });
      render(current);
    } catch(err) {
      alert(err.message);
    }
  };

  el.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function bindInventory() {
  const p = JPRISMInventory.all();

  $('new-product').onclick = () => editor(null);

  $('export-data').onclick = () =>
    JPRISMInventory.exportBackup();

  $('import-data').onchange = async e => {
    const f = e.target.files[0];

    if (
      !f ||
      !confirm('Replace ALL JPRISM v0.3A browser data with this backup?')
    ) return;

    try {
      await JPRISMInventory.importBackup(f);
      render('inventory');
    } catch(err) {
      alert(err.message);
    }
  };

  const filter = () => {
    const q = $('search').value.trim().toLowerCase();
    const c = $('category').value;

    $('results').innerHTML = table(
      p.filter(x =>
        (!c || x.cat === c) &&
        [x.sku,x.name,x.supplier].some(
          v => String(v).toLowerCase().includes(q)
        )
      ),
      true
    );
  };

  $('search').addEventListener('input',filter);
  $('category').addEventListener('change',filter);

  $('results').onclick = e => {
    const edit = e.target.closest('[data-edit]');
    const move = e.target.closest('[data-move]');
    const archive = e.target.closest('[data-archive]');

    if (edit) editor(edit.dataset.edit);
    if (move) movementForm(move.dataset.move);

    if (
      archive &&
      confirm('Archive this product? It must have a zero stock balance.')
    ) {
      try {
        JPRISMInventory.archive(archive.dataset.archive);
        render('inventory');
      } catch(err) {
        alert(err.message);
      }
    }
  };
}

function receipts() {
  const p = JPRISMInventory.all();

  return `
    <section class="card">
      <div class="cardhead">
        <h2>Goods receiving · transaction preview</h2>
        <span class="tag">v0.3A</span>
      </div>

      <p class="muted" style="margin-bottom:15px">
        Choose a product, enter cartons or base units,
        and post a receipt. Full multi-line goods receipts
        and supplier purchase orders come later.
      </p>

      <div class="toolbar">
        <select id="receipt-product">
          <option value="">Select product…</option>
          ${p.map(x => `
            <option value="${escapeHtml(x.id)}">
              ${escapeHtml(x.sku)} · ${escapeHtml(x.name)}
            </option>`
          ).join('')}
        </select>

        <button class="btn primary" id="start-receipt">
          Record receipt
        </button>
      </div>

      <div class="editor" id="editor" hidden></div>
    </section>`;
}

function adjustments() {
  const t = JPRISMInventory.ledger();
  const p = JPRISMInventory.all(true);

  return `
    <section class="card">
      <div class="cardhead">
        <h2>Stock transaction history</h2>
        <span class="tag">${t.length} movements</span>
      </div>

      <p class="hint">
        For adjustments, open Inventory → Movement and choose
        adjustment-in or adjustment-out.
      </p>

      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Product</th>
              <th>Type</th>
              <th>Entered</th>
              <th>Base change</th>
              <th>Reference / Batch</th>
            </tr>
          </thead>
          <tbody>
          ${t.length ? t.map(x => {
            const product = p.find(y => y.id === x.productId);

            return `
              <tr>
                <td>${escapeHtml(new Date(x.date).toLocaleString('en-AU'))}</td>
                <td>${escapeHtml(product?.sku || x.productId)}</td>
                <td>${escapeHtml(x.type)}</td>
                <td>${fmt(x.enteredQty)} ${escapeHtml(x.enteredUnit)}</td>
                <td>${fmt(x.qty)} ${escapeHtml(product?.unit || '')}</td>
                <td>${escapeHtml(x.reference)}
                  ${x.batch ? '· ' + escapeHtml(x.batch) : ''}
                </td>
              </tr>`;
          }).join('') : `
            <tr>
              <td colspan="6">No stock transactions yet.</td>
            </tr>`}
          </tbody>
        </table>
      </div>
    </section>`;
}

function placeholder(id) {
  const info = {
    'work-orders':[
      '▣','Work order management',
      'Work orders, recipes and automatic material consumption are planned for a later stage.'
    ],
    production:[
      '⚙','Production planning',
      'Build recipes, material requirements and production runs.'
    ],
    suppliers:[
      '♧','Supplier directory',
      'Supplier records and multiple supplier-specific pack sizes are planned.'
    ],
    reports:[
      '▥','Reporting and analytics',
      'Additional reporting will follow the inventory ledger.'
    ]
  }[id];

  return `
    <div class="empty">
      <div class="emptyicon">${info[0]}</div>
      <h2>${info[1]}</h2>
      <p>${info[2]}</p>
      <p style="margin-top:14px">
        <span class="tag">Planned</span>
      </p>
    </div>`;
}

function closeMenu() {
  $('sidebar').classList.remove('open');
  $('overlay').classList.remove('show');
}

function render(id) {
  if (!id || id === 'welcome') {
    $('welcome').hidden = false;
    document.querySelector('.app').hidden = true;
    current = 'welcome';
    closeMenu();

    if (location.hash !== '#welcome') {
      location.hash = 'welcome';
    }
    return;
  }

  if (!modules.some(x => x[0] === id)) {
    id = 'dashboard';
  }

  $('welcome').hidden = true;
  document.querySelector('.app').hidden = false;
  current = id;

  const m = modules.find(x => x[0] === id);

  $('title').textContent = m[2];
  $('crumb').textContent = m[2];
  $('subtitle').textContent = m[3];

  $('nav').querySelectorAll('.nav').forEach(b => {
    b.classList.toggle('active',b.dataset.page === id);

    if (b.dataset.page === id) {
      b.setAttribute('aria-current','page');
    } else {
      b.removeAttribute('aria-current');
    }
  });

  $('page').innerHTML =
    id === 'dashboard' ? dashboard() :
    id === 'inventory' ? inventory() :
    id === 'stock-received' ? receipts() :
    id === 'adjustments' ? adjustments() :
    placeholder(id);

  if (location.hash !== '#' + id) {
    location.hash = id;
  }

  closeMenu();

  if (id === 'inventory') {
    bindInventory();
  }

  if (id === 'stock-received') {
    $('start-receipt').onclick = () => {
      const id = $('receipt-product').value;

      if (!id) {
        alert('Select a product first');
        return;
      }

      movementForm(id,'receipt');
    };
  }
}

$('enter-demo').onclick = () => render('dashboard');

document.querySelector('.brand').style.cursor = 'pointer';
document.querySelector('.brand').onclick = () => render('welcome');

document.addEventListener('click',e => {
  const n = e.target.closest('[data-page]');
  const go = e.target.closest('[data-go]');

  if (n) render(n.dataset.page);
  if (go) render(go.dataset.go);
});

$('menu').onclick = () => {
  $('sidebar').classList.add('open');
  $('overlay').classList.add('show');
};

$('overlay').onclick = closeMenu;

$('tour').onclick = () => alert(
  'JPRISM v0.3A: products, purchasing conversions and basic ' +
  'stock transactions are saved only in this browser. ' +
  'Work orders, shared database and authentication are not implemented.'
);

window.addEventListener('hashchange',() => {
  const id = location.hash.slice(1);
  if (id !== current) render(id);
});

try {
  render(location.hash.slice(1) || 'welcome');
} catch(err) {
  alert('JPRISM could not load its browser data: ' + err.message);
}
