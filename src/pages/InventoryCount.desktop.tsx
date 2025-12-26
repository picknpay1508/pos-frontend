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

  /* RIGHT PANEL STATE */
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
      .select(`
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
      `)
      .eq("tenant_id", TENANT_ID)
      .order("updated_at", { ascending: false })
      .limit(15);

    setRecent(data || []);
  }

  /* ================= BARCODE SCAN ================= */

  async function handleBarcodeScan(index: number, barcode: string) {
    const updated = [...rows];
    updated[index].barcode = barcode;
    setRows(updated);

    if (!barcode) return;

    const { data } = await supabase
      .from("products")
      .select("quantity, flavor, Nicotine")
      .eq("tenant_id", TENANT_ID)
      .eq("barcode", barcode)
      .maybeSingle();

    updated[index].currentQty = data?.quantity ?? 0;
    updated[index].flavor = data?.flavor ?? "";
    updated[index].nicotine =
      data?.Nicotine !== null && data?.Nicotine !== undefined
        ? String(data.Nicotine)
        : "";

    setRows([...updated]);
  }

  /* ================= SAVE ================= */

  async function saveAll() {
    if (!categoryId || !subcategoryId || !brand || !sellPrice) {
      alert("Category, Subcategory, Brand and Sell Price are required.");
      return;
    }

    const sc = subcategories.find((s) => s.id === subcategoryId);
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

      const categoryName = categoryById.get(categoryId)?.name ?? null;

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
      } else if (qtyToAdd > 0) {
        await supabase
          .from("products")
          .update({ quantity: (existing.quantity ?? 0) + qtyToAdd })
          .eq("id", existing.id);
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

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "360px 1fr",
        gap: 24,
        padding: 24,
        alignItems: "start",
      }}
    >
      {/* ================= LEFT PANEL ================= */}
      <div>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button onClick={() => setActiveTab("category")}>Category</button>
          <button onClick={() => setActiveTab("recent")}>Recent</button>
        </div>

        {activeTab === "category" && (
          <div style={{ display: "grid", gap: 14 }}>
            <Field label="Category *">
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setSubcategoryId("");
                }}
              >
                <option value="">Select</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Subcategory *">
              <select
                value={subcategoryId}
                onChange={(e) => setSubcategoryId(e.target.value)}
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
            </Field>

            <Field label="Brand *">
              <input value={brand} onChange={(e) => setBrand(e.target.value)} />
            </Field>

            <Field label="Model">
              <input value={model} onChange={(e) => setModel(e.target.value)} />
            </Field>

            <Field label="Sell Price *">
              <input
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
              />
            </Field>
          </div>
        )}

        {activeTab === "recent" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recent.map((r, i) => (
              <div
                key={i}
                style={{ border: "1px solid #ddd", padding: 10, cursor: "pointer" }}
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
                <div>{r.category_name} / {r.subcategory_name}</div>
                <div>Flavor: {r.flavor || "-"} | Nic: {r.Nicotine ?? "-"}</div>
                <div>Qty: {r.quantity} | ${r.sell_price}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================= RIGHT PANEL ================= */}
      <div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1fr",
            gap: 8,
            fontWeight: 600,
            marginBottom: 6,
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
              gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1fr",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <input
              ref={(el) => {
                barcodeRefs.current[i] = el;
              }}
              value={row.barcode}
              onChange={(e) => handleBarcodeScan(i, e.target.value)}
            />
            <input value={row.currentQty ?? ""} disabled />
            <input
              value={row.flavor}
              onChange={(e) => {
                const next = [...rows];
                next[i].flavor = e.target.value;
                setRows(next);
              }}
            />
            <input
              value={row.nicotine}
              onChange={(e) => {
                const next = [...rows];
                next[i].nicotine = e.target.value;
                setRows(next);
              }}
            />
            <input
              value={row.qty}
              onChange={(e) => {
                const next = [...rows];
                next[i].qty = e.target.value;
                setRows(next);
              }}
            />
          </div>
        ))}

        <button onClick={saveAll} disabled={loading} style={{ marginTop: 12 }}>
          Save All
        </button>
      </div>
    </div>
  );
}

/* ================= FIELD WRAPPER ================= */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}
