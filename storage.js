// Swap this adapter for a cloud API in a later version.
// All data calls should eventually return Promises for remote backends.
const JPRISMStorage=(()=>{
 const KEY='jprism.products.v1';
 const seed=[
 ['RM-001','Premium Raw Material','Raw Materials',245,'kg',30],
 ['PK-014','Carton Box - Medium','Packaging',42,'units',50],
 ['FG-102','Finished Product A','Finished Goods',860,'units',100],
 ['RM-022','Base Ingredient B','Raw Materials',0,'kg',20],
 ['PK-031','Shipping Labels','Packaging',1250,'units',200],
 ['FG-108','Finished Product B','Finished Goods',76,'units',100]
 ].map(([sku,name,cat,qty,unit,minQty])=>({id:sku,sku,name,cat,qty,unit,minQty,cost:0,archived:false}));
 function getProducts(){try{const s=localStorage.getItem(KEY);if(s===null){setProducts(seed);return structuredClone(seed)}const p=JSON.parse(s);if(!Array.isArray(p))throw Error('Invalid stored data');return p}catch(e){if(e instanceof SyntaxError)throw Error('Stored data is corrupt; please recover from a backup.');throw e}}
 function setProducts(products){try{localStorage.setItem(KEY,JSON.stringify(products))}catch(e){throw Error('Could not save to browser storage. Check browser settings or storage limits.')}}
 return {getProducts,setProducts};
})();
