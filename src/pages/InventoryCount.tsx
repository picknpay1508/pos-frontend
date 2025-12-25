import InventoryCountDesktop from "./InventoryCount.desktop";
import InventoryCountMobile from "./InventoryCount.mobile";

const isMobile = () =>
  typeof navigator !== "undefined" &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export default function InventoryCount() {
  return isMobile() ? <InventoryCountMobile /> : <InventoryCountDesktop />;
}
