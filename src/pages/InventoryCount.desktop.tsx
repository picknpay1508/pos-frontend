import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const TENANT_ID = "c1feb59d-ac1d-4ab4-b2b2-f679be78cffb";

/* ================= TYPES ================= */

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

  // Brand (required)
  name: string;

  // Optional
  model: string | null;

  category_id: string | null;
  category_name: string | null;

  subcategory_name: string | null;
  supplier_name: string | null;

  size: string | null;
  flavor: string | null;
  Nicotine: number | null;

  sell_price: number | null;
  quantity: number;
};

/* ================= COMPONENT ================= */

export default function InventoryCountDesktop() {
  const barcodeRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const lastScanRef = useRef<number>(0);

  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState("");
  const [addQty, setAddQty] = useState(0);
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [modelOptions, setModelOptions] = useState<string[]>([]);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const subcategoryById = useMemo(
    () => new Map(subcategories.map((s) => [s.id, s])),
    [subcategories]
  );

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

    supabase
      .from("products")
      .select("name, model")
      .eq("tenant_id", TENANT_ID)
      .then(({ data }) => {
        setBrandOptions(
          [...new Set((data || []).map((p) => p.name).filter(Boolean))]
        );
        setModelOptions(
          [...new Set((data || []).map((p) => p.model).filter(Boolean))]
        );
      });
  }, []);

  /* ================= BARCODE LOOKUP ================= */

  async function fetchProduct(code: string) {
    const now = Date.now();
    if (now - lastScanRef.current < 500) return;
    lastScanRef.current = now;

    setProduct(null);
    setAddQty(0);
    setSelectedSubcategoryId("");

    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("tenant_id", TENANT_ID)
      .eq("barcode", code)
      .single();

    if (!data) {
      setProduct({
        barcode: code,
        name: "",
        model: null,
        category_id: null,
        category_name: null,
        subcategory_name: null,
        supplier_name: null,
        size: null,
        flavor: null,
        Nicotine: null,
        sell_price: null,
        quantity: 0,
      });
      return;
    }

    setProduct({
      id: data.id,
      barcode: data.barcode,
      name: data.name,
      model: data.model,
      category_id: data.category_id,
      category_name: data.category_name,
      subcategory_name: data.subcategory_name,
      supplier_name: data.supplier_name,
      size: data.size,
      flavor: data.flavor,
      Nicotine: data.Nicotine,
      sell_price: data.sell_price,
      quantity: data.quantity || 0,
    });

    const match = subcategories.find(
      (s) =>
        s.name === data.subcategory_name &&
        s.supplier_name === data.supplier_name
    );
    if (match) setSelectedSubcategoryId(match.id);

    setTimeout(() => qtyRef.current?.focus(), 50);
  }

  /* ================= SAVE ================= */

  async function saveAndAddInventory() {
    if (!product) return;

    const sc = selectedSubcategoryId
      ? subcategoryById.get(selectedSubcategoryId)
      : null;

    if (!product.name || !product.category_id || !sc || !product.sell_price) {
      alert("Brand, Category, Subcategory and Price are required.");
      return;
    }

    setLoading(true);

    const payload = {
      tenant_id: TENANT_ID,
      barcode: product.barcode,
      name: product.name,
      model: product.model,
      category_id: product.category_id,
      category_name: categoryById.get(product.category_id)?.name || null,
      subcategory_name: sc.name,
      supplier_name: sc.supplier_name,
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
      await supabase.from("products").update(payload).eq("id", productId);
    }

    if (addQty > 0) {
  const newQty = product.quantity + addQty;

  await supabase
    .from("products")
    .update({ quantity: newQty })
    .eq("id", productId);
}


    setBarcode("");
    setProduct(null);
    setSelectedSubcategoryId("");
    setAddQty(0);
    setTimeout(() => barcodeRef.current?.focus(), 50);
    setLoading(false);
  }

  /* ================= UI ================= */

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", padding: 24 }}>
      <h2>Inventory Stock Count</h2>

      <label>Barcode</label>
      <input
        ref={barcodeRef}
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && fetchProduct(barcode)}
        style={{ width: "100%", padding: 10 }}
      />

      {product && (
        <>
          <label>Brand *</label>
          <input
            list="brands"
            value={product.name}
            onChange={(e) =>
              setProduct({ ...product, name: e.target.value })
            }
            style={{ width: "100%", padding: 10 }}
          />

          <label>Model (optional)</label>
          <input
            list="models"
            value={product.model || ""}
            onChange={(e) =>
              setProduct({ ...product, model: e.target.value || null })
            }
            style={{ width: "100%", padding: 10 }}
          />

          <label>Category *</label>
          <select
            value={product.category_id ?? ""}
            onChange={(e) => {
              setProduct({
                ...product,
                category_id: e.target.value || null,
                category_name:
                  categoryById.get(e.target.value)?.name || null,
                subcategory_name: null,
                supplier_name: null,
              });
              setSelectedSubcategoryId("");
            }}
            style={{ width: "100%", padding: 10 }}
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <label>Subcategory / Supplier *</label>
          <select
            value={selectedSubcategoryId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedSubcategoryId(id);
              const sc = subcategoryById.get(id);
              if (!sc) return;
              setProduct({
                ...product,
                subcategory_name: sc.name,
                supplier_name: sc.supplier_name,
              });
            }}
            style={{ width: "100%", padding: 10 }}
          >
            <option value="">Select subcategory</option>
            {subcategories
              .filter((s) => s.category_id === product.category_id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.supplier_name}
                </option>
              ))}
          </select>

          <label>Current Quantity</label>
          <div>{product.quantity}</div>

          <label>Size</label>
          <input
            value={product.size || ""}
            onChange={(e) =>
              setProduct({ ...product, size: e.target.value || null })
            }
            style={{ width: "100%", padding: 10 }}
          />

          <label>Flavor</label>
          <input
            value={product.flavor || ""}
            onChange={(e) =>
              setProduct({ ...product, flavor: e.target.value || null })
            }
            style={{ width: "100%", padding: 10 }}
          />

          <label>Nicotine</label>
          <input
            type="number"
            value={product.Nicotine ?? ""}
            onChange={(e) =>
              setProduct({
                ...product,
                Nicotine:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            style={{ width: "100%", padding: 10 }}
          />

          <label>Sell Price *</label>
          <input
            type="number"
            value={product.sell_price ?? ""}
            onChange={(e) =>
              setProduct({
                ...product,
                sell_price:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            style={{ width: "100%", padding: 10 }}
          />

          <label>Add Quantity *</label>
          <input
            ref={qtyRef}
            type="number"
            value={addQty}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setAddQty(Number(e.target.value))}
            style={{ width: 140, padding: 10 }}
          />

          <button
  onClick={saveAndAddInventory}
  disabled={loading}
  style={{
    width: "100%",
    marginTop: 20,
    padding: "16px 0",
    fontSize: 18,
    fontWeight: 600,
    backgroundColor: loading ? "#9ca3af" : "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: loading ? "not-allowed" : "pointer",
  }}
>

            {loading ? "Saving..." : "Save & Add Inventory"}
          </button>
        </>
      )}

      <datalist id="brands">
        {brandOptions.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>

      <datalist id="models">
        {modelOptions.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
    </div>
  );
}
