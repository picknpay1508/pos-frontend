import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
)

type Product = {
  id: string
  barcode: string
  name: string
  category: string | null
  subcategory: string | null
  brand: string | null
  size: string | null
  flavor: string | null
  nicotine: string | null
  qty: number
  sell_price: number
  updated_at: string
}

export default function InventoryCountDesktop() {
  const [barcode, setBarcode] = useState("")
  const [product, setProduct] = useState<Product | null>(null)
  const [recent, setRecent] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* -----------------------------
     Fetch product by barcode
  ------------------------------ */
  const fetchByBarcode = async (code: string) => {
    if (!code) return

    setLoading(true)
    setError(null)
    setProduct(null)

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("barcode", code)
      .single()

    if (error) {
      setError("Product not found")
    } else {
      setProduct(data)
      refreshRecent()
    }

    setLoading(false)
  }

  /* -----------------------------
     Fetch recent 15 edited/added
  ------------------------------ */
  const refreshRecent = async () => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(15)

    if (data) setRecent(data)
  }

  useEffect(() => {
    refreshRecent()
  }, [])

  /* -----------------------------
     UI
  ------------------------------ */
  return (
    <div className="h-full w-full grid grid-cols-[420px_1fr] gap-6 p-6 bg-gray-50">

      {/* LEFT PANEL */}
      <div className="bg-white border rounded-lg p-5 space-y-6">

        <h2 className="text-lg font-semibold">
          Inventory Count
        </h2>

        {/* Barcode Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Barcode
          </label>

          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") fetchByBarcode(barcode)
            }}
            placeholder="Scan or type barcode"
            className="w-full h-11 px-3 border rounded-md font-mono text-base"
          />
        </div>

        {/* Status */}
        {loading && (
          <div className="text-sm text-gray-500">
            Searching…
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Product Details */}
        {product && (
          <div className="border-t pt-4 space-y-3">

            <div className="text-base font-semibold">
              {product.name}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">

              <Detail label="Barcode" value={product.barcode} mono />
              <Detail label="Category" value={product.category} />
              <Detail label="Subcategory" value={product.subcategory} />
              <Detail label="Brand" value={product.brand} />
              <Detail label="Size" value={product.size} />
              <Detail label="Flavor" value={product.flavor} />
              <Detail label="Nicotine" value={product.nicotine} />
              <Detail label="Quantity" value={product.qty?.toString()} />
              <Detail
                label="Sell Price"
                value={`$${product.sell_price.toFixed(2)}`}
              />

            </div>
          </div>
        )}

      </div>

      {/* RIGHT PANEL */}
      <div className="bg-white border rounded-lg p-5 overflow-hidden">

        <h3 className="text-lg font-semibold mb-4">
          Recent (Last 15)
        </h3>

        <div className="overflow-y-auto max-h-full divide-y">
          {recent.map((p) => (
            <div
              key={p.id}
              className="py-3 px-2 cursor-pointer hover:bg-gray-50"
              onClick={() => {
                setBarcode(p.barcode)
                fetchByBarcode(p.barcode)
              }}
            >
              <div className="font-medium text-sm">
                {p.name}
              </div>

              <div className="text-xs text-gray-500 grid grid-cols-2 gap-x-3 mt-1">
                <span>{p.category}</span>
                <span>{p.subcategory}</span>
                <span>{p.brand}</span>
                <span>{p.size}</span>
                <span>{p.flavor}</span>
                <span>{p.nicotine}</span>
                <span>Qty: {p.qty}</span>
                <span>${p.sell_price.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}

/* -----------------------------
   Reusable Detail Row
------------------------------ */
function Detail({
  label,
  value,
  mono = false,
}: {
  label: string
  value?: string | null
  mono?: boolean
}) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-sm ${mono ? "font-mono" : ""}`}>
        {value || "—"}
      </div>
    </div>
  )
}
