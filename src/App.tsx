import { useState } from "react";
import InventoryCount from "./pages/InventoryCount";
import CategoryAdmin from "./pages/CategoryAdmin";

export default function App() {
  const [screen, setScreen] = useState<"inventory" | "categories">("inventory");

  return (
    <div style={{ padding: 24 }}>
      {/* TOP MENU */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setScreen("inventory")}
          style={{ marginRight: 8 }}
        >
          Inventory
        </button>

        <button onClick={() => setScreen("categories")}>
          Categories
        </button>
      </div>

      {/* SCREENS */}
      {screen === "inventory" && <InventoryCount />}
      {screen === "categories" && <CategoryAdmin />}
    </div>
  );
}
