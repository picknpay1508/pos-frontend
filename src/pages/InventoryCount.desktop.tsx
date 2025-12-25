import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const TENANT_ID = "c1feb59d-ac1d-4ab4-b2b2-f679be78cffb";

/* ================= TYPES ================= */

type Category = { id: string; name: string };

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

  // snapshots (stored in products)
  subcategory_name: string | null;
  supplier_name: string | null;

  // optional attributes (stored in products)
  size: string | null;
  flavor: string | null;
  Nicotine: number | null; // NOTE: matches your DB column name in screenshot

  sell_price: number | null;
};

function isVapeCategoryName(categoryName: string) {
  const x = categoryName.toLowerCase();
  return (
    x.includes("vape") ||
    x.includes("disposable") ||
    x.includes("pod") ||
    x.includes("pods") ||
    x.includes("eliquid") ||
    x.includes("ejuice") ||
    x.includes("e-juice") ||
    x.includes("juice")
  );
}

function needsNicotineBySubcategoryName(subcategoryName: string) {
  const x = subcategoryName.toLowerCase();
  return x.includes("eliquid") || x.includes("ejuice") || x.includes("e-juice") || x.includes("pod") || x.includes("pods");
}

export default function InventoryCountDesktop() {
  const barcodeRef = useRef<HTMLInputElement | null>(null);
  const qtyRef = useRef<HTMLInputElement | null>(null);
  const lastScanRef = useRef<number>(0);

  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [addQty, setAddQty] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  const categoryById = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  /* ================= LOAD MASTER DATA ================= */

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

  /* ================= BARCODE SEARCH ================= */

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
        category_id: data.category_id ?? null,
        subcategory_name: data.subcategory_name ?? null,
        supplier_name: data.supplier_name ?? null,
        size: data.size ?? null,
        flavor: data.flavor ?? null,
        Nicotine: data.Nicotine ?? null,
        sell_price: data.sell_price ?? null,
      });

      // If already categorized, jump to qty (POS speed)
      setTimeout(() => qtyRef.current?.focus(), 50);
    } else {
      setProduct({
        barcode: code,
        name: "",
        category_id: null,
        subcategory_name: null,
        supplier_name: null,
        size: null,
        flavor: null,
        Nicotine: null,
        sell_price: null,
      });
    }
  }

  /* ================= SAVE ================= */

  async function saveAndAddInventory() {
    if (!product) return;

    // Basic required fields
    if (!product.name || !product.category_id || !product.subcategory_name || !product.supplier_name || product.sell_price === null) {
      alert("Please complete: Product name, Category, Subcategory, Sell price.");
      return;
    }
    if (addQty <= 0) {
      alert("Add quantity must be greater than 0.");
      return;
    }

    setLoading(true);

    const payload: any = {
      tenant_id: TENANT_ID,
      barcode: product.barcode,
      name: product.name,
      category_id: product.category_id,

      // snapshots
      subcategory_name: product.subcategory_name,
      supplier_name: product.supplier_name,

      // optional attributes
      size: product.size,
      flavor: product.flavor,
      Nicotine: product.Nicotine,

      sell_price: product.sell_price,
      is_active: true,
    };

    let productId = product.id;

    if (!productId) {
      const { data, error } = await supabase.from("products").insert(payload).select("id").single();
      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }
      productId = data.id;
    } else {
      const { error } = await supabase.from("products").update(payload).eq("id", productId);
      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }
    }

    const { error: invErr } = await supabase.from("inventory_adjustments").insert({
      tenant_id: TENANT_ID,
      product_id: productId,
      qty_added: addQty,
      reason: "stock_count",
    });

    if (invErr) {
      alert(invErr.message);
      setLoading(false);
      return;
    }

    // Reset
    setBarcode("");
    setProduct(null);
    setAddQty(0);
    setTimeout(() => barcodeRef.current?.focus(), 50);
    setLoading(false);
  }

  /* ================= UI HELPERS ================= */

  const selectedCategoryName = product?.category_id ? categoryById.get(product.category_id)?.name || "" : "";
  const showFlavor = !!product?.category_id && isVapeCategoryName(selectedCategoryName);
  const showNicotine = !!product?.subcategory_name && needsNicotineBySubcategoryName(product.subcategory_name);

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "40px auto",
        background: "#fff",
        padding: 24,
        borderRadius: 10,
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
      }}
    >
      <h2 style={{ marginBottom: 16 }}>Inventory Stock Count</h2>

      {/* BARCODE */}
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
          {/* PRODUCT NAME */}
          <label style={{ marginTop: 12, display: "block" }}>Product name</label>
          <input
            placeholder="Product name"
            value={product.name}
            onChange={(e) => setProduct({ ...product, name: e.target.value })}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />

          {/* CATEGORY */}
          <label style={{ marginTop: 12, display: "block" }}>Category</label>
          <select
            value={product.category_id ?? ""}
            onChange={(e) =>
              setProduct({
                ...product,
                category_id: e.target.value || null,
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

          {/* SUBCATEGORY */}
          {product.category_id && (
            <>
              <label style={{ marginTop: 12, display: "block" }}>Subcategory (includes supplier)</label>
              <select
                value={product.subcategory_name ?? ""}
                onChange={(e) => {
                  const sc = subcategories.find((s) => s.name === e.target.value && s.category_id === product.category_id);
                  if (!sc) return;

                  setProduct({
                    ...product,
                    subcategory_name: sc.name,
                    supplier_name: sc.supplier_name,
                  });

                  setTimeout(() => qtyRef.current?.focus(), 50);
                }}
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              >
                <option value="">Select subcategory (supplier)</option>
                {subcategories
                  .filter((s) => s.category_id === product.category_id)
                  .map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} — {s.supplier_name}
                    </option>
                  ))}
              </select>
            </>
          )}

          {/* OPTIONAL SIZE (ALL CATEGORIES) */}
          <label style={{ marginTop: 12, display: "block" }}>Size (optional)</label>
          <input
            placeholder="Size (e.g. 20K puffs, 60ml, 2ml)"
            value={product.size ?? ""}
            onChange={(e) => setProduct({ ...product, size: e.target.value || null })}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />

          {/* OPTIONAL FLAVOR (ONLY VAPE CATEGORIES) */}
          {showFlavor && (
            <>
              <label style={{ marginTop: 12, display: "block" }}>Flavor (optional)</label>
              <input
                placeholder="Flavor (e.g. Blue Razz, Mango Ice)"
                value={product.flavor ?? ""}
                onChange={(e) => setProduct({ ...product, flavor: e.target.value || null })}
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </>
          )}

          {/* OPTIONAL NICOTINE (ELIQUID/EJUICE/PODS SUBCATEGORIES) */}
          {showNicotine && (
            <>
              <label style={{ marginTop: 12, display: "block" }}>Nicotine (optional)</label>
              <input
                type="number"
                placeholder="Nicotine (mg/ml)"
                value={product.Nicotine ?? ""}
                onChange={(e) => setProduct({ ...product, Nicotine: e.target.value === "" ? null : Number(e.target.value) })}
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </>
          )}

          {/* SELL PRICE */}
          <label style={{ marginTop: 12, display: "block" }}>Sell price</label>
          <input
            type="number"
            value={product.sell_price ?? ""}
            onChange={(e) => setProduct({ ...product, sell_price: e.target.value === "" ? null : Number(e.target.value) })}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />

          {/* ADD QTY (SMALL, SELECT 0 ON FOCUS) */}
          <label style={{ marginTop: 14, display: "block" }}>Add quantity</label>
          <input
            ref={qtyRef}
            type="number"
            value={addQty}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setAddQty(Number(e.target.value))}
            style={{
              width: 120,
              padding: "10px 12px",
              marginTop: 6,
              fontSize: 20,
              fontWeight: "bold",
              textAlign: "center",
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
