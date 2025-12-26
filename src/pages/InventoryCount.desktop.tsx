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

type RecentProduct = {
  category_id: string | null;
  category_name: string | null;
  subcategory_name: string | null;
  supplier_name: string | null;
  name: string;
  model: string | null;
  size: string | null;
  flavor: string | null;
  Nicotine: number | null;
  quantity: number | null;
  sell_price: number | null;
};

/* ================= COMPONENT ================= */

export default function InventoryCountDesktop() {
  const barcodeRefs = useRef<Array<HTMLInputElement | null>>([]);

  /* LEFT PANEL STATE */
  const [activeTab, setActiveTab] = useState<"category" | "recent">("category");

  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [sellPrice, setSellPrice] = useState("");

  /* RIGHT PANEL */
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
  const [recent, setRecent] = useState<RecentProduct[]>([]);
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

    loadRecent();
  }, []);

  async function loadRecent() {
    const { data } = await supabase
      .from("products")
      .select(
        `
        category_id,
        category_name,
        subcategory_name,
        supplier_name,
        name,
        model,
        size,
        flavor,
        Nicotine,
        quantity,
        sell_price
      `
      )
      .eq("tenant_id", TENANT_ID)
      .order("updated_at", { ascending: false })
      .limit(15);

    setRecent(data || []);
  }

  /* ================= BARCODE LOOKUP ================= */

  async function handleBarcodeScan(index: number, barcode: string) {
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
        currentQty: data ? data.quantity ?? 0 : 0,
        flavor: data?.flavor ?? "",
        nicotine:
          data?.Nicotine === null || data?.Nicotine === undefined
            ? ""
            : String(data.Nicotine),
      };
      return next;
    });
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

      const categoryName = categoryById.get(categoryId)?.name || null;

      if (!existing?.id) {
        await supabase.from("products").insert({
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
          quantity: qtyToAdd,
          is_active: true,
        });
      } else {
        if (qtyToAdd > 0) {
          await supabase
            .from("products")
            .update({ quantity: (existing.quantity ?? 0) + qtyToAdd })
            .eq("id", existing.id);
        }
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
    loadRecent();
    setLoading(false);
  }

  /* ================= UI ================= */

  const label = { fontSize: 13, fontWeight: 600, marginBottom: 4 };
  const input = {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #d1d5db",
  };

  return (
    <div style={{ display: "flex", gap: 20, padding: 20 }}>
      {/* LEFT PANEL */}
      <div style={{ width: 360 }}>
        <div style={{ marginBottom: 10 }}>
          <button onClick={() => setActiveTab("category")}>
            Category
          </button>
          <button
            onClick={() => setActiveTab("recent")}
            style={{ marginLeft: 8 }}
          >
            Recent
          </button>
        </div>

        {activeTab === "category" && (
          <>
            <div style={label}>Category *</div>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setSubcategoryId("");
              }}
              style={input}
            >
              <option value="">Select</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <div style={label}>Subcategory *</div>
            <select
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              style={input}
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

            <div style={label}>Brand *</div>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} style={input} />

            <div style={label}>Model</div>
            <input value={model} onChange={(e) => setModel(e.target.value)} style={input} />

            <div style={label}>Sell Price *</div>
            <input value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} style={input} />
          </>
        )}

        {activeTab === "recent" && (
          <div style={{ fontSize: 12 }}>
            {recent.map((r, i) => (
              <div
                key={i}
                style={{
                  padding: 8,
                  borderBottom: "1px solid #e5e7eb",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setCategoryId(r.category_id || "");
                  const sc = subcategories.find(
                    (s) =>
                      s.name === r.subcategory_name &&
                      s.supplier_name === r.supplier_name
                  );
                  setSubcategoryId(sc?.id || "");
                  setBrand(r.name);
                  setModel(r.model || "");
                  setSellPrice(r.sell_price ? String(r.sell_price) : "");
                  setActiveTab("category");
                }}
              >
                <strong>{r.name}</strong>
                <div>
                  {r.category_name} / {r.subcategory_name}
                </div>
                <div>
                  {r.size} {r.flavor} {r.Nicotine ? `${r.Nicotine}mg` : ""}
                </div>
                <div>
                  Qty: {r.quantity} | ${r.sell_price}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flex: 1 }}>
        {rows.map((row, i) => (
          <input
            key={i}
            ref={(el) => {
              barcodeRefs.current[i] = el;
            }}
            placeholder="Barcode"
            value={row.barcode}
            onChange={(e) => handleBarcodeScan(i, e.target.value)}
            style={input}
          />
        ))}

        <button onClick={saveAll} disabled={loading}>
          Save All
        </button>
      </div>
    </div>
  );
}
