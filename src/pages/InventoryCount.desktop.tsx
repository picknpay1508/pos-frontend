import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const TENANT_ID = "c1feb59d-ac1d-4ab4-b2b2-f679be78cffb";

/* ================= TYPES ================= */

type Category = {
  id: string;      // UUID
  name: string;
};

type Subcategory = {
  id: string;
  name: string;    // TEXT (e.g. "Loose Tobacco")
  supplier_name: string | null;
  category_id: string; // UUID (parent category)
};

type Product = {
  id?: string;
  barcode: string;
  name: string;

  category_id: string | null; // UUID ONLY

  // SNAPSHOTS (TEXT)
  subcategory_name: string | null;
  supplier_name: string | null;

  // OPTIONAL FIELDS
  size: string | null;
  flavor: string | null;
  Nicotine: number | null;

  sell_price: number | null;
};

/* ================= HELPERS ================= */

function isVapeCategory(categoryName: string) {
  const x = categoryName.toLowerCase();
  return (
    x.includes("vape") ||
    x.includes("disposable") ||
    x.includes("pod") ||
    x.includes("eliquid") ||
    x.includes("ejuice")
  );
}

function needsNicotine(subcategoryName: string) {
  const x = subcategoryName.toLowerCase();
  return x.includes("eliquid") || x.includes("ejuice") || x.includes("pod");
}

/* ================= COMPONENT ================= */

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
    const map = new Map<string, Category>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
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

  /* ================= BARCODE LOOKUP ================= */

  async function fetchProduct(code: string) {
    const now = Date.now();
    if (now - lastScanRef.current < 500) return;
    lastScanRef.current = now;

    setProduct(null);

    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("tenant_id", TENANT_ID)
      .eq("barcode", code)
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

    if (
      !product.name ||
      !product.category_id ||
      !product.subcategory_name ||
      !product.supplier_name ||
      product.sell_price === null
    ) {
      alert("Please complete product name, category, subcategory, and price.");
      return;
    }

    if (addQty <= 0) {
      alert("Quantity must be greater than 0.");
      return;
    }

    setLoading(true);

    const payload = {
      tenant_id: TENANT_ID,
      barcode: product.barcode,
      name: product.name,
      category_id: product.category_id, // UUID ONLY

      // SNAPSHOTS (TEXT)
      subcategory_name: product.subcategory_name,
      supplier_name: product.supplier_name,

      // OPTIONAL
      size: product.size,
      flavor: product.flavor,
      Nicotine: product.Nicotine,

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
        alert(error.message);
        setLoading(false);
        return;
      }

      productId = data.id;
    } else {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", productId);

      if (error) {
        alert(error.message);
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

    // RESET
    setBarcode("");
    setProduct(null);
    setAddQty(0);
    setTimeout(() => barcodeRef.current?.focus(), 50);
    setLoading(false);
  }

  /* ================= UI ================= */

  const selectedCategoryName =
    product?.category_id && categoryById.get(product.category_id)
      ? categoryById.get(product.category_id)!.name
      : "";

  const showFlavor = isVapeCategory(selectedCategoryName);
  const showNicotine =
    product?.subcategory_name ? needsNicotine(product.subcategory_name) : false;

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", padding: 24 }}>
      <h2>Inventory Stock Count</h2>

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
          {/* NAME */}
          <input
            placeholder="Product name"
            value={product.name}
            onChange={(e) =>
              setProduct({ ...product, name: e.target.value })
            }
            style={{ width: "100%", marginTop: 12, padding: 10 }}
          />

          {/* CATEGORY (UUID) */}
          <select
            value={product.category_id ?? ""}
            onChange={(e) =>
              setProduct({
                ...product,
                category_id: e.target.value || null, // UUID
                subcategory_name: null,
                supplier_name: null,
              })
            }
            style={{ width: "100%", marginTop: 12, padding: 10 }}
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* SUBCATEGORY (TEXT SNAPSHOT) */}
          {product.category_id && (
            <select
              value={product.subcategory_name ?? ""}
              onChange={(e) => {
                const sc = subcategories.find(
                  (s) =>
                    s.category_id === product.category_id &&
                    s.name === e.target.value
                );
                if (!sc) return;

                setProduct({
                  ...product,
                  subcategory_name: sc.name,
                  supplier_name: sc.supplier_name,
                });

                setTimeout(() => qtyRef.current?.focus(), 50);
              }}
              style={{ width: "100%", marginTop: 12, padding: 10 }}
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
          )}

          {/* OPTIONAL FIELDS */}
          <input
            placeholder="Size (optional)"
            value={product.size ?? ""}
            onChange={(e) =>
              setProduct({ ...product, size: e.target.value || null })
            }
            style={{ width: "100%", marginTop: 12, padding: 10 }}
          />

          {showFlavor && (
            <input
              placeholder="Flavor (optional)"
              value={product.flavor ?? ""}
              onChange={(e) =>
                setProduct({ ...product, flavor: e.target.value || null })
              }
              style={{ width: "100%", marginTop: 12, padding: 10 }}
            />
          )}

          {showNicotine && (
            <input
              type="number"
              placeholder="Nicotine (optional)"
              value={product.Nicotine ?? ""}
              onChange={(e) =>
                setProduct({
                  ...product,
                  Nicotine:
                    e.target.value === ""
                      ? null
                      : Number(e.target.value),
                })
              }
              style={{ width: "100%", marginTop: 12, padding: 10 }}
            />
          )}

          <input
            type="number"
            placeholder="Sell price"
            value={product.sell_price ?? ""}
            onChange={(e) =>
              setProduct({
                ...product,
                sell_price:
                  e.target.value === ""
                    ? null
                    : Number(e.target.value),
              })
            }
            style={{ width: "100%", marginTop: 12, padding: 10 }}
          />

          {/* QTY */}
          <input
            ref={qtyRef}
            type="number"
            value={addQty}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setAddQty(Number(e.target.value))}
            style={{
              width: 120,
              marginTop: 12,
              padding: 10,
              fontSize: 20,
              textAlign: "center",
            }}
          />

          <button
            onClick={saveAndAddInventory}
            disabled={loading}
            style={{ width: "100%", marginTop: 16, padding: 14 }}
          >
            {loading ? "Saving..." : "Save & Add Inventory"}
          </button>
        </>
      )}
    </div>
  );
}
