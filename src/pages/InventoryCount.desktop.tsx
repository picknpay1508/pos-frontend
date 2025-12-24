import { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Html5QrcodeScanner } from "html5-qrcode";

const TENANT_ID = "DEV_TENANT_ID"; // temporary for dev

export default function InventoryCountDesktop() {
    const lastScanRef = useRef<number>(0);
    const barcodeRef = useRef<HTMLInputElement | null>(null);
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [addQty, setAddQty] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const [subcategories, setSubcategories] = useState<{
  id: number;
  name: string;
  supplier_name: string | null;
  category_id: number | null;
}[]>([]);

useEffect(() => {
  async function loadSubcategories() {
    const { data, error } = await supabase
      .from("subcategories")
      .select("id, name, supplier_name, category_id")
      .eq("tenant_id", TENANT_ID)
      .order("name");

    if (error) {
      console.error("Failed to load subcategories", error);
      return;
    }

    setSubcategories(data || []);
  }

  loadSubcategories();
}, []);


const subcategoryById = new Map(
  subcategories.map((s) => [s.id, s])
);

const beepRef = useRef<HTMLAudioElement | null>(null);


  useEffect(() => {
    supabase.from("categories").select("*").then(({ data }) => {
      setCategories(data || []);
    });
  }, []);

  useEffect(() => {
  if (!showScanner) return;

  const scanner = new Html5QrcodeScanner(
    "qr-reader",
    {
      fps: 10,
      qrbox: { width: 250, height: 150 },
    },
    false
  );

  scanner.render(
    (decodedText) => {
      setBarcode(decodedText);
      fetchProduct(decodedText);
      scanner.clear();
      setShowScanner(false);
    },
    () => {}
  );

  return () => {
    scanner.clear().catch(() => {});
  };
}, [showScanner]);


 async function fetchProduct(code: string) {
  setProduct(null);

  const now = Date.now();
  if (now - lastScanRef.current < 500) return;
  lastScanRef.current = now;

  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("barcode", code)
    .single();

  if (data) {
    setProduct(data);
    // DO NOT load subcategories here
  } else {
    setProduct({
      barcode: code,
      name: "",
      category_id: null,
      subcategory_id: null,
      subcategory_name: null,
      supplier_name: null,
      sell_price: null
    });
  }
}


 
  async function saveAndAddInventory() {
    if (!product || addQty <= 0) return;

    setLoading(true);

  let productId = product.id;

if (!productId) {
  const { data: newProduct, error } = await supabase
    .from("products")
    .insert({
      tenant_id: TENANT_ID,
      barcode: product.barcode,
      name: product.name,
      category_id: product.category_id,
      subcategory_id: product.subcategory_id,
      sell_price: product.sell_price,
      is_active: true
    })
    .select()
    .single();

  if (error) {
    alert("Failed to create product");
    setLoading(false);
    return;
  }

  productId = newProduct.id;
}

   setBarcode("");
setProduct(null);
setAddQty(0);

setTimeout(() => {
  barcodeRef.current?.focus();
}, 50);

await supabase
  .from("inventory_adjustments")
  .insert({
    tenant_id: TENANT_ID,
    product_id: productId,
    qty_added: addQty,
    reason: "stock_count"
  });

setBarcode("");
setProduct(null);
setAddQty(0);

setTimeout(() => {
  barcodeRef.current?.focus();
}, 50);

setLoading(false);

  }
return (
  <div style={{ padding: 24, maxWidth: 600 }}>
    
    <audio ref={beepRef} src="/beep.mp3" preload="auto" />

    <h2>Inventory Stock Count</h2>

    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <input
        placeholder="Scan or enter barcode"
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && fetchProduct(barcode)}
        style={{ flex: 1, padding: 8 }}
      />


  <button onClick={() => setShowScanner(true)}>
    Scan
  </button>
</div>

{showScanner && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "#000000cc",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
    }}
  >
    <div id="qr-reader" style={{ width: 300 }} />

    <button
      onClick={() => setShowScanner(false)}
      style={{ marginTop: 12, padding: 10 }}
    >
      Close
    </button>
  </div>
)}


      {product && (
        <div style={{ border: "1px solid #ccc", padding: 16 }}>
          <div>
            <label>Product Name</label>
            <input
              value={product.name}
              onChange={(e) =>
                setProduct({ ...product, name: e.target.value })
              }
            />
          </div>
<label style={{ display: "block", marginTop: 10 }}>
  Subcategory (includes supplier)
</label>

<select
  value={product?.subcategory_id ?? ""}
  onChange={(e) => {
    const selectedId = e.target.value
      ? Number(e.target.value)
      : null;

    const selectedSubcategory = selectedId
      ? subcategoryById.get(selectedId)
      : null;

    setProduct((prev: any) => {
      if (!prev) return prev;

      if (!selectedSubcategory) {
        return {
          ...prev,
          subcategory_id: null
        };
      }

      return {
        ...prev,
        subcategory_id: selectedSubcategory.id,

        // SNAPSHOTS (LOCKED)
        subcategory_name: selectedSubcategory.name,
        supplier_name: selectedSubcategory.supplier_name
      };
    });
  }}
  style={{ width: "100%", padding: 8 }}
>
  <option value="">-- Select subcategory --</option>

  {subcategories.map((sc) => (
    <option key={sc.id} value={sc.id}>
      {sc.name} — {sc.supplier_name}
    </option>
  ))}
</select>

          <div>
            <label>Category</label>
            <select
              value={product.category_id}
              onChange={(e) => {
                setProduct({
                  ...product,
                  category_id: e.target.value,
                  subcategory_id: ""
                });
                
              }}
            >
              <option value="">Select</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Subcategory</label>
            <select
              value={product.subcategory_id}
              onChange={(e) =>
                setProduct({
                  ...product,
                  subcategory_id: e.target.value
                })
              }
            >
              <option value="">Select</option>
              {subcategories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Sell Price</label>
            <input
              type="number"
              value={product.sell_price}
              onChange={(e) =>
                setProduct({
                  ...product,
                  sell_price: Number(e.target.value)
                })
              }
            />
          </div>

          <div style={{ marginTop: 8 }}>
            <strong>Current Quantity:</strong> {product.quantity || 0}
          </div>

          <div>
            <label>Add Quantity</label>
            <input
              type="number"
              value={addQty}
              onChange={(e) => setAddQty(Number(e.target.value))}
            />
          </div>

          <button
            onClick={saveAndAddInventory}
            disabled={loading}
            style={{ marginTop: 12 }}
          >
            {loading ? "Saving..." : "Save & Add Inventory"}
          </button>
        </div>
      )}
    </div>
  );
}
