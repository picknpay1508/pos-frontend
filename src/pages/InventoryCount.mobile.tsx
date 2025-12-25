import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const TENANT_ID = "c1feb59d-ac1d-4ab4-b2b2-f679be78cffb";

type Category = { id: string; name: string };
type Subcategory = { id: string; name: string; supplier_name: string | null; category_id: string };

type Product = {
  id?: string;
  barcode: string;
  name: string;
  category_id: string | null;
  subcategory_name: string | null;
  supplier_name: string | null;
  size: string | null;
  flavor: string | null;
  Nicotine: number | null;
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

export default function InventoryCountMobile() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanningRef = useRef(false);

  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [addQty, setAddQty] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const categoryById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  const [cameraSupported, setCameraSupported] = useState(true);

  /* Load master data */
  useEffect(() => {
    supabase.from("categories").select("id,name").eq("tenant_id", TENANT_ID).order("name")
      .then(({ data }) => setCategories(data || []));
    supabase.from("subcategories").select("id,name,supplier_name,category_id").eq("tenant_id", TENANT_ID).order("name")
      .then(({ data }) => setSubcategories(data || []));
  }, []);

  /* Camera barcode scanning (BarcodeDetector) */
  useEffect(() => {
    // @ts-ignore
    if (!("BarcodeDetector" in window)) {
      setCameraSupported(false);
      return;
    }

    let stream: MediaStream | null = null;
    let raf = 0;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // @ts-ignore
        const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });

        const tick = async () => {
          if (!videoRef.current || scanningRef.current) {
            raf = requestAnimationFrame(tick);
            return;
          }
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const raw = barcodes[0].rawValue;
              if (raw && raw !== barcode) {
                scanningRef.current = true;
                setBarcode(raw);
                await fetchProduct(raw);
                scanningRef.current = false;
              }
            }
          } catch {
            // ignore detection errors
          }
          raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
      } catch {
        setCameraSupported(false);
      }
    }

    start();

    return () => {
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchProduct(code: string) {
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

  async function saveAndAddInventory() {
    if (!product) return;

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
      subcategory_name: product.subcategory_name,
      supplier_name: product.supplier_name,
      size: product.size,
      flavor: product.flavor,
      Nicotine: product.Nicotine,
      sell_price: product.sell_price,
      is_active: true,
    };

    let productId = product.id;

    if (!productId) {
      const { data, error } = await supabase.from("products").insert(payload).select("id").single();
      if (error) { alert(error.message); setLoading(false); return; }
      productId = data.id;
    } else {
      const { error } = await supabase.from("products").update(payload).eq("id", productId);
      if (error) { alert(error.message); setLoading(false); return; }
    }

    const { error: invErr } = await supabase.from("inventory_adjustments").insert({
      tenant_id: TENANT_ID,
      product_id: productId,
      qty_added: addQty,
      reason: "stock_count",
    });
    if (invErr) { alert(invErr.message); setLoading(false); return; }

    setBarcode("");
    setProduct(null);
    setAddQty(0);
    setLoading(false);
  }

  // Optional Photo->Auto-fill (requires Edge Function). If you don’t want it now, leave it.
  async function handlePhoto(file: File) {
    if (!file) return;
    const base64 = await fileToBase64(file);

    // This calls a Supabase Edge Function you must create (code provided below)
    const { data, error } = await supabase.functions.invoke("extract-product", {
      body: { image_base64: base64 },
    });

    if (error) {
      alert("Auto-fill failed");
      return;
    }

    // data: { name?, flavor?, size?, nicotine? }
    setProduct((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        name: data?.name ?? prev.name,
        flavor: data?.flavor ?? prev.flavor,
        size: data?.size ?? prev.size,
        Nicotine: data?.nicotine ?? prev.Nicotine,
      };
    });
  }

  const selectedCategoryName = product?.category_id ? categoryById.get(product.category_id)?.name || "" : "";
  const showFlavor = !!product?.category_id && isVapeCategoryName(selectedCategoryName);
  const showNicotine = !!product?.subcategory_name && needsNicotineBySubcategoryName(product.subcategory_name);

  return (
    <div style={{ maxWidth: 560, margin: "20px auto", background: "#fff", padding: 16, borderRadius: 10 }}>
      <h2 style={{ marginBottom: 12 }}>Inventory (Mobile)</h2>

      {cameraSupported ? (
        <video ref={videoRef} style={{ width: "100%", borderRadius: 8, background: "#000" }} playsInline />
      ) : (
        <div style={{ padding: 10, background: "#f5f5f5", borderRadius: 8 }}>
          Camera barcode scan not supported. Use manual barcode entry below.
        </div>
      )}

      <label style={{ marginTop: 12, display: "block" }}>Barcode</label>
      <input
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && fetchProduct(barcode)}
        placeholder="Enter barcode"
        style={{ width: "100%", padding: 12, fontSize: 16, marginTop: 6 }}
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
            onChange={(e) => setProduct({ ...product, category_id: e.target.value || null, subcategory_name: null, supplier_name: null })}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {product.category_id && (
            <>
              <label style={{ marginTop: 12, display: "block" }}>Subcategory (includes supplier)</label>
              <select
                value={product.subcategory_name ?? ""}
                onChange={(e) => {
                  const sc = subcategories.find((s) => s.name === e.target.value && s.category_id === product.category_id);
                  if (!sc) return;
                  setProduct({ ...product, subcategory_name: sc.name, supplier_name: sc.supplier_name });
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
                onChange={(e) => setProduct({ ...product, Nicotine: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="mg/ml"
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </>
          )}

          <label style={{ marginTop: 12, display: "block" }}>Sell price</label>
          <input
            type="number"
            value={product.sell_price ?? ""}
            onChange={(e) => setProduct({ ...product, sell_price: e.target.value === "" ? null : Number(e.target.value) })}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />

          <label style={{ marginTop: 12, display: "block" }}>Add quantity</label>
          <input
            type="number"
            value={addQty}
            onChange={(e) => setAddQty(Number(e.target.value))}
            style={{ width: 140, padding: 10, marginTop: 6, fontSize: 18, fontWeight: "bold", textAlign: "center" }}
          />

          <button
            onClick={saveAndAddInventory}
            disabled={loading}
            style={{ width: "100%", marginTop: 16, padding: 14, fontSize: 18, background: "#0f766e", color: "#fff", border: "none", borderRadius: 8 }}
          >
            {loading ? "Saving..." : "Save & Add Inventory"}
          </button>

          {/* OPTIONAL: Photo -> Auto-fill */}
          <div style={{ marginTop: 14 }}>
            <label style={{ display: "block" }}>Take photo (optional autofill)</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePhoto(f);
              }}
              style={{ marginTop: 6 }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
