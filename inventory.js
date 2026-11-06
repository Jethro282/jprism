
/* JPRISM v0.3A
   Product master data and transaction-ledger rules.
   No UI or DOM dependencies except backup file handling.
*/

const JPRISMInventory = (() => {
  const types = [
    'Raw Material','Packaging','Finished Good',
    'Consumable','Service','Other'
  ];

  const units = [
    'units','boxes','cartons','kg','g','L','mL','pallets'
  ];

  const categories = [
    'Raw Materials','Packaging','Finished Goods',
    'Consumables','Other'
  ];

  const round = n =>
    Math.round((n + Number.EPSILON) * 1e6) / 1e6;

  const finite = n =>
    typeof n === 'number' && Number.isFinite(n);

  function state() {
    return JPRISMStorage.read();
  }

  function balance(s,id) {
    return round(
      s.transactions
        .filter(t => t.productId === id)
        .reduce((a,t) => a + t.qty,0)
    );
  }

  function all(includeArchived = false) {
    const s = state();

    return s.products
      .filter(p => includeArchived || !p.archived)
      .map(p => {
        const qty = balance(s,p.id);

        return {
          ...p,
          qty,
          status:qty <= 0
            ? 'Out of Stock'
            : qty <= p.minQty
              ? 'Low Stock'
              : 'In Stock'
        };
      });
  }

  function ledger(id) {
    return state().transactions
      .filter(t => !id || t.productId === id)
      .slice()
      .reverse();
  }

  function save(p) {
    const s = state();

    const sku = String(p.sku || '').trim();
    const name = String(p.name || '').trim();
    const unit = String(p.unit || '');
    const cat = String(p.cat || '');
    const type = String(p.type || '');
    const purchaseUnit = String(p.purchaseUnit || '');
    const factor = Number(p.factor);
    const minQty = Number(p.minQty);
    const reorderQty = Number(p.reorderQty);
    const cost = Number(p.cost);

    if (
      !sku || sku.length > 40 ||
      !name || name.length > 120
    ) {
      throw Error(
        'SKU (max 40 characters) and product name (max 120) are required.'
      );
    }

    if (
      !types.includes(type) ||
      !categories.includes(cat) ||
      !units.includes(unit)
    ) {
      throw Error(
        'Select a valid product type, category and base unit.'
      );
    }

    if (purchaseUnit && !units.includes(purchaseUnit)) {
      throw Error('Invalid purchasing unit.');
    }

    if (
      ![factor,minQty,reorderQty,cost].every(
        n => finite(n) && n >= 0
      ) || factor <= 0
    ) {
      throw Error(
        'Conversion, thresholds and cost must be valid positive/non-negative numbers.'
      );
    }

    if (!purchaseUnit && factor !== 1) {
      throw Error(
        'Set a purchasing unit to use a conversion factor.'
      );
    }

    if (purchaseUnit === unit && factor !== 1) {
      throw Error(
        'Matching purchase and base units must have a conversion factor of 1.'
      );
    }

    if (p.expiryTracked && !p.batchTracked) {
      throw Error(
        'Expiry tracking requires batch tracking.'
      );
    }

    if (
      s.products.some(
        x => x.sku.toLowerCase() === sku.toLowerCase() &&
             x.id !== p.id
      )
    ) {
      throw Error(
        'This SKU already exists, including archived products.'
      );
    }

    const index = s.products.findIndex(
      x => x.id === p.id
    );

    const previous = s.products[index];

    if (
      previous &&
      s.transactions.some(
        t => t.productId === previous.id
      ) &&
      previous.unit !== unit
    ) {
      throw Error(
        'Base unit cannot change after stock transactions exist. Create a new SKU instead.'
      );
    }

    if (
      previous &&
      previous.batchTracked &&
      !p.batchTracked &&
      s.transactions.some(
        t => t.productId === previous.id && t.batch
      )
    ) {
      throw Error(
        'Cannot disable batch tracking when batch transactions exist.'
      );
    }

    const now = new Date().toISOString();

    const record = {
      id:previous?.id || crypto.randomUUID(),
      sku,
      name,
      description:String(p.description || '')
        .trim().slice(0,500),
      type,
      cat,
      unit,
      purchaseUnit,
      factor,
      minQty,
      reorderQty,
      cost,
      supplier:String(p.supplier || '')
        .trim().slice(0,120),
      batchTracked:!!p.batchTracked,
      expiryTracked:!!p.expiryTracked,
      archived:previous?.archived || false,
      createdAt:previous?.createdAt || now,
      updatedAt:now
    };

    if (index >= 0) {
      s.products[index] = record;
    } else {
      s.products.push(record);
    }

    JPRISMStorage.write(s);
    return record;
  }

  function archive(id) {
    const s = state();
    const p = s.products.find(x => x.id === id);

    if (!p) throw Error('Product not found');

    if (balance(s,id) !== 0) {
      throw Error(
        'Only zero-balance products can be archived.'
      );
    }

    p.archived = true;
    p.updatedAt = new Date().toISOString();
    JPRISMStorage.write(s);
  }

  function transact({
    productId,type,enteredQty,enteredUnit,
    batch,reference,note
  }) {
    const s = state();

    const p = s.products.find(
      x => x.id === productId && !x.archived
    );

    if (!p) {
      throw Error('Choose an active product.');
    }

    if (
      ![
        'opening','receipt','issue',
        'adjustment-in','adjustment-out'
      ].includes(type)
    ) {
      throw Error('Invalid movement type.');
    }

    const qtyIn = Number(enteredQty);
    const unit = String(enteredUnit || p.unit);

    if (!finite(qtyIn) || qtyIn <= 0) {
      throw Error(
        'Quantity must be greater than zero.'
      );
    }

    if (
      unit !== p.unit &&
      unit !== p.purchaseUnit
    ) {
      throw Error(
        'Select the base or purchasing unit for this product.'
      );
    }

    const factor = unit === p.unit ? 1 : p.factor;
    const absolute = round(qtyIn * factor);

    if (absolute <= 0) {
      throw Error(
        'Quantity is too small to record.'
      );
    }

    if (
      type === 'opening' &&
      s.transactions.some(
        t => t.productId === productId
      )
    ) {
      throw Error(
        'Opening balance is only available before the first transaction.'
      );
    }

    if (
      p.batchTracked &&
      !String(batch || '').trim()
    ) {
      throw Error(
        'Batch number is required for this product.'
      );
    }

    if (
      ['issue','adjustment-out'].includes(type) &&
      p.batchTracked
    ) {
      const b = String(batch).trim();

      const available = round(
        s.transactions
          .filter(
            t => t.productId === productId &&
                 t.batch === b
          )
          .reduce(
            (sum,t) => sum + t.qty,0
          )
      );

      if (available < absolute) {
        throw Error(
          'Not enough stock in the selected batch.'
        );
      }
    }

    const signed = [
      'issue','adjustment-out'
    ].includes(type) ? -absolute : absolute;

    if (
      balance(s,productId) + signed < -1e-6
    ) {
      throw Error(
        'Insufficient stock. Negative stock is not allowed in this prototype.'
      );
    }

    s.transactions.push({
      id:crypto.randomUUID(),
      productId,
      type,
      qty:signed,
      enteredQty:qtyIn,
      enteredUnit:unit,
      factor,
      batch:String(batch || '').trim(),
      reference:String(reference || '')
        .trim().slice(0,100),
      note:String(note || '')
        .trim().slice(0,500),
      date:new Date().toISOString()
    });

    JPRISMStorage.write(s);
  }

  function exportBackup() {
    const blob = new Blob(
      [
        JSON.stringify(
          {format:'jprism-v3a',data:state()},
          null,2
        )
      ],
      {type:'application/json'}
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = 'jprism-v03a-backup.json';
    a.click();

    setTimeout(
      () => URL.revokeObjectURL(url),2000
    );
  }

  async function importBackup(file) {
    if (file.size > 5_000_000) {
      throw Error('Backup exceeds 5 MB');
    }

    const b = JSON.parse(await file.text());

    if (
      b.format !== 'jprism-v3a' ||
      b.data?.version !== 3 ||
      !Array.isArray(b.data.products) ||
      !Array.isArray(b.data.transactions)
    ) {
      throw Error('Invalid v0.3A backup');
    }

    const ids = new Set();
    const skus = new Set();

    for (const p of b.data.products) {
      if (
        typeof p.id !== 'string' ||
        !p.id ||
        typeof p.sku !== 'string' ||
        !p.sku ||
        typeof p.name !== 'string' ||
        !p.name ||
        !units.includes(p.unit) ||
        !categories.includes(p.cat) ||
        !types.includes(p.type) ||
        !finite(p.factor) ||
        p.factor <= 0 ||
        !finite(p.minQty) ||
        p.minQty < 0 ||
        ids.has(p.id) ||
        skus.has(p.sku.toLowerCase())
      ) {
        throw Error(
          'Backup contains invalid or duplicate products'
        );
      }

      ids.add(p.id);
      skus.add(p.sku.toLowerCase());
    }

    const txIds = new Set();

    for (const t of b.data.transactions) {
      if (
        typeof t.id !== 'string' ||
        txIds.has(t.id) ||
        !ids.has(t.productId) ||
        !finite(t.qty) ||
        !finite(t.enteredQty) ||
        !finite(t.factor) ||
        t.factor <= 0 ||
        ![
          'opening','receipt','issue',
          'adjustment-in','adjustment-out'
        ].includes(t.type) ||
        !units.includes(t.enteredUnit)
      ) {
        throw Error(
          'Backup contains invalid transactions'
        );
      }

      txIds.add(t.id);
    }

    JPRISMStorage.write(b.data);
  }

  return {
    types,units,categories,
    all,ledger,save,archive,transact,
    exportBackup,importBackup
  };
})();
