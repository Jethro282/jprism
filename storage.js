
/* JPRISM v0.3A browser adapter.
   Replace this adapter with an async API later. */

const JPRISMStorage = (() => {
  const KEY = 'jprism.state.v3a';
  const OLD = 'jprism.products.v1';

  const defaults = [
    ['RM-001','Premium Raw Material','Raw Materials',245,'kg',30],
    ['PK-014','Carton Box - Medium','Packaging',42,'units',50],
    ['FG-102','Finished Product A','Finished Goods',860,'units',100],
    ['RM-022','Base Ingredient B','Raw Materials',0,'kg',20],
    ['PK-031','Shipping Labels','Packaging',1250,'units',200],
    ['FG-108','Finished Product B','Finished Goods',76,'units',100]
  ].map(([sku,name,cat,qty,unit,minQty]) => ({
    id: crypto.randomUUID(),
    sku,name,cat,qty,unit,minQty,
    cost:0,
    archived:false
  }));

  function upgrade(old) {
    const products = [];
    const transactions = [];

    for (const p of old) {
      const id = String(p.id || crypto.randomUUID());

      products.push({
        id,
        sku:String(p.sku || ''),
        name:String(p.name || ''),
        description:'',
        type:p.cat === 'Packaging'
          ? 'Packaging'
          : p.cat === 'Finished Goods'
            ? 'Finished Good'
            : 'Raw Material',
        cat:p.cat || 'Other',
        unit:p.unit || 'units',
        purchaseUnit:'',
        factor:1,
        minQty:Number(p.minQty) || 0,
        reorderQty:0,
        cost:Number(p.cost) || 0,
        supplier:'',
        batchTracked:false,
        expiryTracked:false,
        archived:!!p.archived,
        createdAt:new Date().toISOString(),
        updatedAt:new Date().toISOString()
      });

      if (Number(p.qty) > 0) {
        transactions.push({
          id:crypto.randomUUID(),
          productId:id,
          type:'opening',
          qty:Number(p.qty),
          enteredQty:Number(p.qty),
          enteredUnit:p.unit || 'units',
          factor:1,
          batch:'',
          reference:'v0.2 migration',
          note:'Opening balance imported from previous browser prototype',
          date:new Date().toISOString()
        });
      }
    }

    return {version:3,products,transactions};
  }

  function read() {
    const saved = localStorage.getItem(KEY);

    if (saved !== null) {
      let data;

      try {
        data = JSON.parse(saved);
      } catch {
        throw Error(
          'JPRISM data is unreadable. Do not clear your browser; restore from a backup.'
        );
      }

      if (
        data.version !== 3 ||
        !Array.isArray(data.products) ||
        !Array.isArray(data.transactions)
      ) {
        throw Error('Unsupported JPRISM data version');
      }

      return data;
    }

    let old;

    try {
      old = localStorage.getItem(OLD);
      old = old === null ? defaults : JSON.parse(old);

      if (!Array.isArray(old)) {
        throw Error('Invalid legacy products');
      }
    } catch {
      throw Error(
        'Existing v0.2 data cannot be migrated. Export a v0.2 backup before proceeding.'
      );
    }

    const state = upgrade(old);
    write(state);
    return state;
  }

  function write(state) {
    try {
      localStorage.setItem(KEY,JSON.stringify(state));
    } catch {
      throw Error(
        'Browser storage is full or blocked. Export a backup and check browser settings.'
      );
    }
  }

  return {read,write};
})();
