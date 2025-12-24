import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const TENANT_ID = "c1feb59d-ac1d-4ab4-b2b2-f679be78cffb";



type Subcategory = {
  id: string;
  name: string;
  supplier_name: string | null;
};


type Category = {
  id: string;
  name: string;
  gst_rate: number;
  pst_rate: number;
  subcategories?: Subcategory[];
};

export default function CategoryAdmin() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [gst, setGst] = useState<number>(5);
  const [pst, setPst] = useState<number>(0);

 const [subName, setSubName] = useState("");
const [categoryId, setCategoryId] = useState("");
const [supplierName, setSupplierName] = useState("");
const [sizeLabel, setSizeLabel] = useState("");
const [sizeValue, setSizeValue] = useState("");


  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
  const { data, error } = await supabase
    .from("categories")
.select(`
  id,
  name,
  gst_rate,
  pst_rate,
  subcategories (
    id,
    name,
    supplier_name,
    size_label,
    size_value
  )
`)
.eq("tenant_id", TENANT_ID)
.order("name");


  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  setCategories(data || []);
};


  const addCategory = async () => {
    if (!name) {
      alert("Category name required");
      return;
    }

  const { error } = await supabase.from("categories").insert({
  tenant_id: TENANT_ID,
  name,
  gst_rate: gst,
  pst_rate: pst,
  is_active: true,
});

if (error) {
  alert(error.message);
  return;
}


    setName("");
    setGst(5);
    setPst(0);
    loadCategories();
  };

  const addSubcategory = async () => {
    if (!subName || !categoryId) {
      alert("Select category and enter subcategory name");
      return;
    }

    const { error } = await supabase.from("subcategories").insert({
  tenant_id: TENANT_ID,
  category_id: categoryId,
  name: subName,
  supplier_name: supplierName || null,
  size_label: sizeLabel || null,
  size_value: sizeValue || null,
  is_active: true,
});



    if (error) {
      alert(error.message);
      return;
    }

setSubName("");
setSupplierName("");
setSizeLabel("");
setSizeValue("");
loadCategories();

    setSubName("");
    loadCategories();
  };

  return  (
    <div style={{ display: "flex", gap: 40, padding: 20 }}>
      

      {/* LEFT SIDE — FORMS */}
      <div style={{ width: 500 }}>
        <h2>Categories</h2>

        <input
          placeholder="Category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        />

        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <label>GST %</label>
            <input
              type="number"
              value={gst}
              onChange={(e) => setGst(Number(e.target.value))}
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label>PST %</label>
            <input
              type="number"
              value={pst}
              onChange={(e) => setPst(Number(e.target.value))}
              style={{ width: "100%", padding: 8 }}
            />
          </div>
        </div>

        <button onClick={addCategory} style={{ marginTop: 10 }}>
          Add Category
        </button>

        <hr style={{ margin: "24px 0" }} />

        <h2>Subcategories</h2>

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        >
          <option value="">Select category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <input
          placeholder="Subcategory name"
          value={subName}
          onChange={(e) => setSubName(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        />

<input
  placeholder="Supplier (e.g. Imperial Tobacco)"
  value={supplierName}
  onChange={(e) => setSupplierName(e.target.value)}
  style={{ width: "100%", padding: 8, marginBottom: 8 }}
/>

<div style={{ display: "flex", gap: 8 }}>
  <input
    placeholder="Size label (e.g. Puffs, Nicotine, Weight)"
    value={sizeLabel}
    onChange={(e) => setSizeLabel(e.target.value)}
    style={{ flex: 1, padding: 8 }}
  />
  <input
    placeholder="Size value (e.g. 6000, 20mg, 50g)"
    value={sizeValue}
    onChange={(e) => setSizeValue(e.target.value)}
    style={{ flex: 1, padding: 8 }}
  />
</div>

        <button onClick={addSubcategory}>Add Subcategory</button>
      </div>

      {/* RIGHT SIDE — LIST */}
      <div style={{ width: 400 }}>
  <h3>Existing Categories</h3>

  {categories.length === 0 && (
    <p style={{ color: "#777" }}>No categories yet</p>
  )}

  {categories.map((c) => (
    <div key={c.id} style={{ marginBottom: 20 }}>
      <strong>
        {c.name} (GST {c.gst_rate}% / PST {c.pst_rate}%)
      </strong>

      <ul style={{ marginTop: 6 }}>
        {c.subcategories && c.subcategories.length > 0 ? (
          c.subcategories.map((s) => (
            <li key={s.id}>
              {s.name}
{s.supplier_name && ` — ${s.supplier_name}`}

            </li>
          ))
        ) : (
          <li style={{ fontStyle: "italic", color: "#777" }}>
            No subcategories
          </li>
        )}
      </ul>
    </div>
  ))}
</div>

    </div>
  );
}
