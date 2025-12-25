import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const TENANT_ID = "c1feb59d-ac1d-4ab4-b2b2-f679be78cffb";

type Category = { id: string; name: string };

type Subcategory = {
  id: string;
  name: string; // TEXT
  supplier_name: string | null;
  category_id: string; // UUID
};

type Product = {
  id?: string;
  barcode: string;
  name: string;

  category_id: string | null; // UUID only

  // SNAPSHOTS (TEXT)
  subcategory_name: string | null;
  supplier_name: string | null;

  // OPTIONAL
  size: string | null;
  flavor: string | null;
  Nicotine: number | null;

  sell_price: number | null;
};

function isVapeCategory(categoryName: string) {
  const x = categoryName.toLowerCase();
  return (
    x.includes("vape") ||
    x.includes("disposable") ||
    x.includes("pod") ||
    x.includes("pods") ||
    x.includes("eliquid") ||
    x.includes("ejuice") ||
    x.includes("e-juice")
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

  // UI-only: store chosen subcategory row id so selection never “gets lost”
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>("");

  const [addQty, setAddQty] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const subcategoryById = useMemo(() => new Map(subcategories.map((s) => [s.id, s])), [subcategories]);

  useEffect(() => {
    supabase
      .from("categories")
      .select("id, name")
      .eq("tenant_id", TENANT_ID)
      .order("name")
      .then(({ data }) => setCategories((data || []) as Category[]));

    supabase
      .from("subcategories")
      .select("id, name, supplier_name, category_id")
      .eq("tenant_id", TENANT_ID)
      .order("name")
      .then(({ data }) => setSubcategories((data || []) as Subcategory[]));
  }, []);

  async function fetchProduct(code: string) {
    const now = Date.now();
    if (now - lastScanRef.current < 500) return;
    lastScanRef.current = now;

    setProduct(null);
    setSelectedSubcategoryId("");
    setAddQty(0);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("tenant_id", TENANT_ID)
      .eq("barcode", code)
      .single();

    if (error || !data) {
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
      return;
    }

    const loaded: Product = {
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
    };

    setProduct(loaded);

    // try to re-select the matching subcategory row in UI
    if (loaded.category_id && loaded.subcategory_name) {
      const match = subcategories.find(
        (s) =>
          s.category_id === loaded.category_id &&
          s.name === loaded.subcategory_name &&
          (loaded.supplier_name ? s.supplier_name === loaded.supplier_name : true)
      );
      if (match) setSelectedSubcategoryId(match.id);
    }

    setTimeout(() => qtyRef.current?.focus(), 50);
  }

  async function saveAndAddInventory() {
    if (!product) return;

    // Ensure we have a selected subcategory row
    const sc = selectedSubcategoryId ? subcategoryById.get(selectedSubcategoryId) : undefined;

    if (!product.name) {
      alert("Product name is required.");
      return;
    }
    if (!product.category_id) {
      alert("Category is required.");
      return;
    }
    if (!sc) {
      alert("Please select subcategory (supplier).");
      return;
    }
    if (product.sell_price === null) {
      alert("Sell price is required.");
      return;
    }
    if (addQty <= 0) {
      alert("Add quantity must be greater than 0.");
      return;
    }

    setLoading(true);

    // SNAPSHOTS written at inventory time
    const payload: any = {
      tenant_id: TENANT_ID,
      barcode: product.barcode,
      name: product.name,
      category_id: product.category_id, // UUID

      subcategory_name: sc.name, // TEXT
      supplier_name: sc.supplier_name ?? null, // TEXT

      size: product.size ?? null,
      flavor: product.flavor ?? null,
      Nicotine: product.Nicotine ?? null,

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

    // reset
    setBarcode("");
    setProduct(null);
    setSelectedSubcategoryId("");
    setAddQty(0);
    setTimeout(() => barcodeRef.current?.focus(), 50);
    setLoading(false);
  }

  const selectedCategoryName =
    product?.category_id ? categoryById.get(product.category_id)?.name || "" : "";

  const showFlavor = !!product?.category_id && isVapeCategory(selectedCategoryName);

  const showNicotine =
    !!product?.subcategory_name && needsNicotineBySubcategoryName(product.subcategory_name);

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
          <label style={{ marginTop: 12, display: "block" }}>Product name</label>
          <input
            value={product.name}
            onChange={(e) => setProduct({ ...product, name: e.target.value })}
            placeholder="Product name"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />

          <label style={{ marginTop: 12, display: "block" }}>Category</label>
          <select
            value={product.category_id ?? ""}
            onChange={(e) => {
              const newCat = e.target.value || null;
              setProduct({
                ...product,
                category_id: newCat,
                subcategory_name: null,
                supplier_name: null,
              });
              setSelectedSubcategoryId("");
            }}
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
                value={selectedSubcategoryId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedSubcategoryId(id);

                  const sc = subcategoryById.get(id);
                  if (!sc) return;

                  setProduct({
                    ...product,
                    subcategory_name: sc.name,
                    supplier_name: sc.supplier_name ?? null,
                  });

                  setTimeout(() => qtyRef.current?.focus(), 50);
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

          <label style={{ marginTop: 12, display: "block" }}>Size (optional)</label>
          <input
            value={product.size ?? ""}
            onChange={(e) => setProduct({ ...product, size: e.target.value || null })}
            placeholder="Size"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />

          {showFlavor && (
            <>
              <label style={{ marginTop: 12, display: "block" }}>Flavor (optional)</label>
              <input
                value={product.flavor ?? ""}
                onChange={(e) => setProduct({ ...product, flavor: e.target.value || null })}
                placeholder="Flavor"
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </>
          )}

          {showNicotine && (
            <>
              <label style={{ marginTop: 12, display: "block" }}>Nicotine (optional)</label>
              <input
                type="number"
                value={product.Nicotine ?? ""}
                onChange={(e) =>
                  setProduct({
                    ...product,
                    Nicotine: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                placeholder="mg/ml"
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </>
          )}

          <label style={{ marginTop: 12, display: "block" }}>Sell price</label>
          <input
            type="number"
            value={product.sell_price ?? ""}
            onChange={(e) =>
              setProduct({
                ...product,
                sell_price: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />

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
