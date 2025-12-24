import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const TENANT_ID = "DEV_TENANT_ID"; // temporary for dev

export default function InventoryCount() {
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [addQty, setAddQty] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("categories").select("*").then(({ data }) => {
      setCategories(data || []);
    });
  }, []);

  async function fetchProduct(code: string) {
    setProduct(null);

    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("barcode", code)
      .single();

    if (data) {
      setProduct(data);
      loadSubcategories(data.category_id);
    } else {
      setProduct({
        barcode: code,
        name: "",
        category_id: "",
        subcategory_id: "",
        sell_price: "",
        quantity: 0
      });
    }
  }

  async function loadSubcategories(categoryId: string) {
    const { data } = await supabase
      .from("subcategories")
      .select("*")
      .eq("category_id", categoryId);

    setSubcategories(data || []);
  }

  async function saveAndAddInventory() {
    if (!product || addQty <= 0) return;

    setLoading(true);

    const { data: savedProduct, error } = await supabase
      .from("products")
      .upsert({
        tenant_id: TENANT_ID,
        barcode: product.barcode,
        name: product.name,
        category_id: product.category_id,
        subcategory_id: product.subcategory_id,
        sell_price: product.sell_price,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      alert("Failed to save product");
      setLoading(false);
      return;
    }

    await supabase
      .from("products")
      .update({ quantity: (savedProduct.quantity || 0) + addQty })
      .eq("id", savedProduct.id);

    setBarcode("");
    setProduct(null);
    setAddQty(0);
    setSubcategories([]);
    setLoading(false);
  }

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h2>Inventory Stock Count</h2>

      <input
        placeholder="Scan or enter barcode"
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && fetchProduct(barcode)}
        style={{ width: "100%", padding: 8, marginBottom: 12 }}
      />

      {product && (
        <div style={{ border: "1px solid #ccc", padding: 16 }}>
          <div>
            <label>Product Name</label>
            <input
              value={product.name}
              onChange={(e) =>
                setProduct({ ...product, name: e.target.value })
              }
            />
          </div>

          <div>
            <label>Category</label>
            <select
              value={product.category_id}
              onChange={(e) => {
                setProduct({
                  ...product,
                  category_id: e.target.value,
                  subcategory_id: ""
                });
                loadSubcategories(e.target.value);
              }}
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
            <label>Subcategory</label>
            <select
              value={product.subcategory_id}
              onChange={(e) =>
                setProduct({
                  ...product,
                  subcategory_id: e.target.value
                })
              }
            >
              <option value="">Select</option>
              {subcategories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Sell Price</label>
            <input
              type="number"
              value={product.sell_price}
              onChange={(e) =>
                setProduct({
                  ...product,
                  sell_price: Number(e.target.value)
                })
              }
            />
          </div>

          <div style={{ marginTop: 8 }}>
            <strong>Current Quantity:</strong> {product.quantity || 0}
          </div>

          <div>
            <label>Add Quantity</label>
            <input
              type="number"
              value={addQty}
              onChange={(e) => setAddQty(Number(e.target.value))}
            />
          </div>

          <button
            onClick={saveAndAddInventory}
            disabled={loading}
            style={{ marginTop: 12 }}
          >
            {loading ? "Saving..." : "Save & Add Inventory"}
          </button>
        </div>
      )}
    </div>
  );
}
