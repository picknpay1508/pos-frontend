import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const TENANT_ID = "c1feb59d-ac1d-4ab4-b2b2-f679be78cffb";
const ROWS = 10;

/* ================= TYPES ================= */

type Category = { id: string; name: string };

type Subcategory = {
  id: string;
  name: string;
  supplier_name: string | null;
  category_id: string;
};

type BulkRow = {
  barcode: string;
  currentQty: number | null;
  flavor: string;
  nicotine: string;
  qty: string;
};

/* ================= COMPONENT ================= */

export default function InventoryCountDesktop() {
  const barcodeRefs = useRef<Array<HTMLInputElement | null>>([]);

  /* LEFT PANEL (MASTER) */
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [sellPrice, setSellPrice] = useState("");

  /* RIGHT PANEL (ROWS) */
  const [rows, setRows] = useState<BulkRow[]>(
    Array.from({ length: ROWS }, () => ({
      barcode: "",
      currentQty: null,
      flavor: "",
      nicotine: "",
      qty: "",
    }))
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(false);

  const subcategoryById = useMemo(
    () => new Map(subcategories.map((s) => [s.id, s])),
    [subcategories]
  );

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  /* ================= LOAD DATA ================= */

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

  async function handleBarcodeScan(index: number, barcode: string) {
    const updated = [...rows];
    updated[index] = { ...updated[index], barcode };
    setRows(updated);

    if (!barcode) return;

    const { data } = await supabase
      .from("products")
      .select("quantity")
      .eq("tenant_id", TENANT_ID)
      .eq("barcode", barcode)
      .maybeSingle();

    updated[index] = {
      ...updated[index],
      currentQty: data ? data.quantity ?? 0 : 0,
    };

    setRows([...updated]);
  }

  /* ================= SAVE ALL ================= */

  async function saveAll() {
    if (!categoryId || !subcategoryId || !brand || !sellPrice) {
      alert("Category, Subcategory, Brand and Sell Price are required.");
      return;
    }

    const sc = subcategoryById.get(subcategoryId);
    if (!sc) return;

    setLoading(true);

    for (const row of rows) {
      if (!row.barcode) continue;

      const qtyToAdd = Number(row.qty || 0);

      const { data: existing } = await supabase
        .from("products")
        .select("id, quantity")
        .eq("tenant_id", TENANT_ID)
        .eq("barcode", row.barcode)
        .maybeSingle();

      let productId: string | null = existing?.id ?? null;

      if (!productId) {
        const { data, error } = await supabase
          .from("products")
          .insert({
            tenant_id: TENANT_ID,
            barcode: row.barcode,
            name: brand,
            model: model || null,
            category_id: categoryId,
            category_name: categoryById.get(categoryId)?.name || null,
            subcategory_name: sc.name,
            supplier_name: sc.supplier_name,
            flavor: row.flavor || null,
            Nicotine: row.nicotine ? Number(row.nicotine) : null,
            sell_price: Number(sellPrice),
            quantity: qtyToAdd,
            is_active: true,
          })
          .select("id")
          .single();

        if (error) continue;
        productId = data.id;
      } else if (qtyToAdd > 0) {
        await supabase
          .from("products")
          .update({ quantity: (existing?.quantity ?? 0) + qtyToAdd })
          .eq("id", productId);
      }
    }

    setRows(
      Array.from({ length: ROWS }, () => ({
        barcode: "",
        currentQty: null,
        flavor: "",
        nicotine: "",
        qty: "",
      }))
    );

    barcodeRefs.current[0]?.focus();
    setLoading(false);
  }

  /* ================= UI ================= */

  const input: React.CSSProperties = {
    padding: 10,
    borderRadius: 6,
    border: "1px solid #ccc",
  };

  return (
    <div style={{ display: "flex", gap: 24, padding: 24 }}>
      {/* LEFT PANEL */}
      <div style={{ width: 320 }}>
        <h3>Master Product Info</h3>

        <label>Category *</label>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={input}>
          <option value="">Select</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <label>Subcategory *</label>
        <select value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)} style={input}>
          <option value="">Select</option>
          {subcategories
            .filter((s) => s.category_id === categoryId)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.supplier_name}
              </option>
            ))}
        </select>

        <label>Brand *</label>
        <input value={brand} onChange={(e) => setBrand(e.target.value)} style={input} />

        <label>Model</label>
        <input value={model} onChange={(e) => setModel(e.target.value)} style={input} />

        <label>Sell Price *</label>
        <input value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} style={input} />
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flex: 1 }}>
        <h3>Bulk Entry (10 items)</h3>

        {rows.map((row, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <input
              ref={(el) => {
                barcodeRefs.current[i] = el;
              }}
              placeholder="Barcode"
              value={row.barcode}
              onChange={(e) => handleBarcodeScan(i, e.target.value)}
              style={input}
            />
            <input value={row.currentQty ?? ""} disabled style={input} />
            <input
              placeholder="Flavor"
              value={row.flavor}
              onChange={(e) => {
                const r = [...rows];
                r[i] = { ...r[i], flavor: e.target.value };
                setRows(r);
              }}
              style={input}
            />
            <input
              placeholder="Nic"
              value={row.nicotine}
              onChange={(e) => {
                const r = [...rows];
                r[i] = { ...r[i], nicotine: e.target.value };
                setRows(r);
              }}
              style={input}
            />
            <input
              placeholder="Qty"
              value={row.qty}
              onChange={(e) => {
                const r = [...rows];
                r[i] = { ...r[i], qty: e.target.value };
                setRows(r);
              }}
              style={input}
            />
          </div>
        ))}

        <button
          onClick={saveAll}
          disabled={loading}
          style={{
            marginTop: 16,
            padding: 14,
            width: "100%",
            fontSize: 16,
            fontWeight: 600,
            background: loading ? "#9ca3af" : "#16a34a",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Saving..." : "Save All"}
        </button>
      </div>
    </div>
  );
}
