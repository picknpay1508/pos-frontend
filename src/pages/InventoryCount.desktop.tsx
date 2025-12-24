import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const TENANT_ID = "c1feb59d-ac1d-4ab4-b2b2-f679be78cffb";

type Category = {
  id: string;
  name: string;
};

type Subcategory = {
  id: string;
  name: string;
  supplier_name: string | null;
  category_id: string;
};

type Product = {
  id?: string;
  barcode: string;
  name: string;
  category_id: string | null;
  subcategory_id: string | null;
  subcategory_name: string | null;
  supplier_name: string | null;
  sell_price: number | null;
};

export default function InventoryCountDesktop() {
  const barcodeRef = useRef<HTMLInputElement | null>(null);
  const lastScanRef = useRef<number>(0);

  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [addQty, setAddQty] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  /* ---------- LOAD MASTER DATA ---------- */
  useEffect(() => {
    supabase
      .from("categories")
      .select("id, name")
      .eq("tenant_id", TENANT_ID)
      .order("name")
      .then(({ data }) => setCategories(data || []));

    supabase
      .from("subcategories")
      .select("id, name, supplier_name, category_id")
      .eq("tenant_id", TENANT_ID)
      .order("name")
      .then(({ data }) => setSubcategories(data || []));
  }, []);

  /* ---------- BARCODE SEARCH ---------- */
  async function fetchProduct(code: string) {
    const now = Date.now();
    if (now - lastScanRef.current < 500) return;
    lastScanRef.current = now;

    setProduct(null);

    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("barcode", code)
      .eq("tenant_id", TENANT_ID)
      .single();

    if (data) {
      setProduct({
        id: data.id,
        barcode: data.barcode,
        name: data.name,
        category_id: data.category_id,
        subcategory_id: data.subcategory_id,
        subcategory_name: data.subcategory_name,
        supplier_name: data.supplier_name,
        sell_price: data.sell_price,
      });
    } else {
      setProduct({
        barcode: code,
        name: "",
        category_id: null,
        subcategory_id: null,
        subcategory_name: null,
        supplier_name: null,
        sell_price: null,
      });
    }
  }

  /* ---------- SAVE INVENTORY ---------- */
  async function saveAndAddInventory() {
    if (!product || addQty <= 0) return;

    setLoading(true);

    const payload = {
      tenant_id: TENANT_ID,
      barcode: product.barcode,
      name: product.name,
      category_id: product.category_id,
      subcategory_id: product.subcategory_id,
      subcategory_name: product.subcategory_name,
      supplier_name: product.supplier_name,
      sell_price: product.sell_price,
      is_active: true,
    };

    let productId = product.id;

    if (!productId) {
      const { data, error } = await supabase
        .from("products")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        alert("Failed to create product");
        setLoading(false);
        return;
      }

      productId = data.id;
    } else {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", productId)
        .eq("tenant_id", TENANT_ID);

      if (error) {
        alert("Failed to update product");
        setLoading(false);
        return;
      }
    }

    await supabase.from("inventory_adjustments").insert({
      tenant_id: TENANT_ID,
      product_id: productId,
      qty_added: addQty,
      reason: "stock_count",
    });

    setBarcode("");
    setProduct(null);
    setAddQty(0);
    setTimeout(() => barcodeRef.current?.focus(), 50);
    setLoading(false);
  }

  /* ---------- UI ---------- */
  return (
    <div
      style={{
        maxWidth: 520,
        margin: "40px auto",
        background: "#fff",
        padding: 24,
        borderRadius: 10,
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
      }}
    >
      <h2 style={{ marginBottom: 16 }}>Inventory Stock Count</h2>

      <input
        ref={barcodeRef}
        placeholder="Scan barcode"
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && fetchProduct(barcode)}
        style={{ width: "100%", padding: 12, fontSize: 16 }}
      />

      {product && (
        <>
          <input
            placeholder="Product name"
            value={product.name}
            onChange={(e) =>
              setProduct({ ...product, name: e.target.value })
            }
            style={{ width: "100%", padding: 10, marginTop: 12 }}
          />

          <label style={{ marginTop: 12, display: "block" }}>Category</label>
          <select
            value={product.category_id ?? ""}
            onChange={(e) =>
              setProduct({
                ...product,
                category_id: e.target.value || null,
                subcategory_id: null,
                subcategory_name: null,
                supplier_name: null,
              })
            }
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {product.category_id && (
            <>
              <label style={{ marginTop: 12, display: "block" }}>
                Subcategory (includes supplier)
              </label>
              <select
                value={product.subcategory_id ?? ""}
                onChange={(e) => {
                  const sc = subcategories.find(
                    (s) => s.id === e.target.value
                  );
                  if (!sc) return;

                  setProduct({
                    ...product,
                    subcategory_id: sc.id,
                    subcategory_name: sc.name,
                    supplier_name: sc.supplier_name,
                  });
                }}
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              >
                <option value="">Select subcategory (supplier)</option>
                {subcategories
                  .filter((s) => s.category_id === product.category_id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.supplier_name}
                    </option>
                  ))}
              </select>
            </>
          )}

          <label style={{ marginTop: 12, display: "block" }}>Sell price</label>
          <input
            type="number"
            value={product.sell_price ?? ""}
            onChange={(e) =>
              setProduct({ ...product, sell_price: Number(e.target.value) })
            }
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />

          <label style={{ marginTop: 14, display: "block" }}>
            Add quantity
          </label>
          <input
            type="number"
            value={addQty}
            onChange={(e) => setAddQty(Number(e.target.value))}
            style={{
              width: "100%",
              padding: 14,
              marginTop: 6,
              fontSize: 18,
              textAlign: "center",
              fontWeight: "bold",
            }}
          />

          <button
            onClick={saveAndAddInventory}
            disabled={loading}
            style={{
              width: "100%",
              marginTop: 18,
              padding: 14,
              fontSize: 18,
              background: "#0f766e",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {loading ? "Saving..." : "Save & Add Inventory"}
          </button>
        </>
      )}
    </div>
  );
}
