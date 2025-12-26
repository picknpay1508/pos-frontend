import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const TENANT_ID = "c1feb59d-ac1d-4ab4-b2b2-f679be78cffb";
const ROWS = 10;

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
  qty: string; // qty to add
};

export default function InventoryCountDesktop() {
  const barcodeRefs = useRef<Array<HTMLInputElement | null>>([]);

  // LEFT PANEL (MASTER)
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [sellPrice, setSellPrice] = useState("");

  // RIGHT PANEL (ROWS)
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

  async function handleBarcodeScan(index: number, barcode: string) {
    // update barcode immediately (so staff sees what they scanned)
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], barcode };
      return next;
    });

    if (!barcode) return;

    const { data } = await supabase
      .from("products")
      .select("quantity, flavor, Nicotine")
      .eq("tenant_id", TENANT_ID)
      .eq("barcode", barcode)
      .maybeSingle();

    setRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        currentQty: data ? (data.quantity ?? 0) : 0,
        flavor: data?.flavor ?? next[index].flavor ?? "",
        nicotine:
          data?.Nicotine === null || data?.Nicotine === undefined
            ? next[index].nicotine ?? ""
            : String(data.Nicotine),
      };
      return next;
    });
  }

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

      const categoryName = categoryById.get(categoryId)?.name || null;

      if (!existing?.id) {
        // create new product
        const { error } = await supabase.from("products").insert({
          tenant_id: TENANT_ID,
          barcode: row.barcode,
          name: brand,
          model: model || null,
          category_id: categoryId,
          category_name: categoryName,
          subcategory_name: sc.name,
          supplier_name: sc.supplier_name,
          flavor: row.flavor || null,
          Nicotine: row.nicotine ? Number(row.nicotine) : null,
          sell_price: Number(sellPrice),
          quantity: qtyToAdd, // if blank => 0
          is_active: true,
        });

        if (error) {
          console.error("Insert error:", error.message);
          continue;
        }
      } else {
        // update existing product master info (snapshots) + optional attributes
        await supabase
          .from("products")
          .update({
            name: brand,
            model: model || null,
            category_id: categoryId,
            category_name: categoryName,
            subcategory_name: sc.name,
            supplier_name: sc.supplier_name,
            flavor: row.flavor || null,
            Nicotine: row.nicotine ? Number(row.nicotine) : null,
            sell_price: Number(sellPrice),
            is_active: true,
          })
          .eq("id", existing.id);

        // add quantity only if > 0
        if (qtyToAdd > 0) {
          await supabase
            .from("products")
            .update({ quantity: (existing.quantity ?? 0) + qtyToAdd })
            .eq("id", existing.id);
        }
      }
    }

    // reset right panel only
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

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: "#111827",
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
    background: "#fff",
  };

  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    borderRadius: 12,
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    padding: 16,
  };

  return (
    <div style={{ display: "flex", gap: 20, padding: 20 }}>
      {/* LEFT PANEL */}
      <div style={{ width: 340 }}>
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, marginBottom: 14 }}>Master Product Info</h3>

          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={labelStyle}>Category *</div>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setSubcategoryId("");
                }}
                style={inputStyle}
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
              <div style={labelStyle}>Subcategory *</div>
              <select
                value={subcategoryId}
                onChange={(e) => setSubcategoryId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select</option>
                {subcategories
                  .filter((s) => s.category_id === categoryId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.supplier_name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <div style={labelStyle}>Brand *</div>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <div style={labelStyle}>Model</div>
              <input value={model} onChange={(e) => setModel(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <div style={labelStyle}>Sell Price *</div>
              <input
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                style={inputStyle}
                placeholder="e.g. 16.99"
              />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flex: 1 }}>
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h3 style={{ marginTop: 0, marginBottom: 14 }}>Bulk Entry (10 items)</h3>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Tip: scan barcode → edit fields → Save All
            </div>
          </div>

          {/* Header row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2.2fr 0.7fr 1.4fr 0.8fr 0.8fr",
              gap: 10,
              marginBottom: 8,
              fontSize: 12,
              fontWeight: 700,
              color: "#374151",
            }}
          >
            <div>Barcode</div>
            <div>In Stock</div>
            <div>Flavor</div>
            <div>Nic</div>
            <div>Add Qty</div>
          </div>

          {rows.map((row, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "2.2fr 0.7fr 1.4fr 0.8fr 0.8fr",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <input
                ref={(el) => {
                  barcodeRefs.current[i] = el;
                }}
                placeholder="Scan barcode"
                value={row.barcode}
                onChange={(e) => handleBarcodeScan(i, e.target.value)}
                style={{
                  ...inputStyle,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  letterSpacing: "0.5px",
                }}
              />

              <input
                value={row.currentQty ?? ""}
                disabled
                style={{
                  ...inputStyle,
                  background: "#f3f4f6",
                  fontWeight: 700,
                  textAlign: "center",
                }}
              />

              <input
                placeholder="Flavor"
                value={row.flavor}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...next[i], flavor: e.target.value };
                  setRows(next);
                }}
                style={inputStyle}
              />

              <input
                placeholder="Nic"
                value={row.nicotine}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...next[i], nicotine: e.target.value };
                  setRows(next);
                }}
                style={inputStyle}
              />

              <input
                placeholder="Qty"
                value={row.qty}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...next[i], qty: e.target.value };
                  setRows(next);
                }}
                style={{
                  ...inputStyle,
                  textAlign: "center",
                  fontWeight: 700,
                  border: "2px solid #16a34a",
                }}
              />
            </div>
          ))}

          <button
            onClick={saveAll}
            disabled={loading}
            style={{
              marginTop: 12,
              padding: 14,
              width: "100%",
              fontSize: 16,
              fontWeight: 700,
              background: loading ? "#9ca3af" : "#16a34a",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 6px 16px rgba(22,163,74,0.35)",
            }}
          >
            {loading ? "Saving..." : "Save All"}
          </button>
        </div>
      </div>
    </div>
  );
}
