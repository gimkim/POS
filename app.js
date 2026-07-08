const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0
});

const STORAGE_KEY = "event-pos-data-v1";
const PAYMENT_LABELS = {
  cash: "เงินสด",
  transfer: "โอน"
};
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240">
      <rect width="320" height="240" rx="22" fill="#e6efec"/>
      <circle cx="160" cy="92" r="38" fill="#8fb8b2"/>
      <path d="M70 196c25-43 54-65 88-65s63 22 92 65H70Z" fill="#0f766e" opacity=".78"/>
      <path d="M58 58h204v124H58z" fill="none" stroke="#bdd0cc" stroke-width="10" stroke-linejoin="round"/>
      <text x="160" y="222" text-anchor="middle" fill="#657372" font-family="Arial, sans-serif" font-size="18" font-weight="700">NO PHOTO</text>
    </svg>
  `);

const sampleProducts = [
  { id: crypto.randomUUID(), name: "เสื้อยืด", sku: "TSHIRT", category: "Apparel", price: 350, stock: 24, lowStock: 5, image: "" },
  { id: crypto.randomUUID(), name: "กระเป๋าผ้า", sku: "TOTE", category: "Goods", price: 180, stock: 18, lowStock: 4, image: "" },
  { id: crypto.randomUUID(), name: "สติกเกอร์", sku: "STICKER", category: "Small item", price: 40, stock: 60, lowStock: 10, image: "" }
];

const state = loadState();
let activeView = "sell";
let query = "";

const els = {
  productGrid: document.querySelector("#productGrid"),
  stockList: document.querySelector("#stockList"),
  historyList: document.querySelector("#historyList"),
  productEmpty: document.querySelector("#productEmpty"),
  historyEmpty: document.querySelector("#historyEmpty"),
  cartItems: document.querySelector("#cartItems"),
  emptyCart: document.querySelector("#emptyCart"),
  subtotal: document.querySelector("#subtotal"),
  grandTotal: document.querySelector("#grandTotal"),
  changeDue: document.querySelector("#changeDue"),
  billNumber: document.querySelector("#billNumber"),
  customerInput: document.querySelector("#customerInput"),
  paymentMethod: document.querySelector("#paymentMethod"),
  discountInput: document.querySelector("#discountInput"),
  paidInput: document.querySelector("#paidInput"),
  searchInput: document.querySelector("#searchInput"),
  todaySales: document.querySelector("#todaySales"),
  todayBills: document.querySelector("#todayBills"),
  lowStockCount: document.querySelector("#lowStockCount"),
  productDialog: document.querySelector("#productDialog"),
  productForm: document.querySelector("#productForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  deleteProductBtn: document.querySelector("#deleteProductBtn"),
  productImage: document.querySelector("#productImage"),
  productImageData: document.querySelector("#productImageData"),
  productImagePreview: document.querySelector("#productImagePreview")
};

document.querySelector("#newProductBtn").addEventListener("click", () => openProductDialog());
document.querySelector("#closeDialogBtn").addEventListener("click", () => els.productDialog.close());
document.querySelector("#clearImageBtn").addEventListener("click", () => setImageField(""));
document.querySelector("#clearCartBtn").addEventListener("click", clearCart);
document.querySelector("#checkoutBtn").addEventListener("click", checkout);
document.querySelector("#exportBtn").addEventListener("click", exportData);
els.discountInput.addEventListener("input", renderCart);
els.paidInput.addEventListener("input", renderCart);
els.paymentMethod.addEventListener("change", renderCart);
els.searchInput.addEventListener("input", (event) => {
  query = event.target.value.trim().toLowerCase();
  render();
});
els.productImage.addEventListener("change", handleImagePick);

for (const name of ["sell", "stock", "history"]) {
  document.querySelector(`#${name}Tab`).addEventListener("click", () => switchView(name));
}

els.productForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveProductFromForm();
});

els.deleteProductBtn.addEventListener("click", () => {
  const id = document.querySelector("#productId").value;
  const product = findProduct(id);
  if (!product || !confirm(`ลบสินค้า “${product.name}” ใช่ไหม?`)) return;
  state.products = state.products.filter((item) => item.id !== id);
  state.cart = state.cart.filter((item) => item.productId !== id);
  saveState();
  els.productDialog.close();
  render();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

render();

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      parsed.products = (parsed.products || []).map((product) => ({ image: "", ...product }));
      parsed.cart ||= [];
      parsed.receipts ||= [];
      parsed.nextBill ||= 1;
      return parsed;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return {
    products: sampleProducts,
    cart: [],
    receipts: [],
    nextBill: 1
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function switchView(name) {
  activeView = name;
  for (const view of ["sell", "stock", "history"]) {
    document.querySelector(`#${view}View`).classList.toggle("active", view === name);
    document.querySelector(`#${view}Tab`).classList.toggle("active", view === name);
  }
  render();
}

function filteredProducts() {
  if (!query) return [...state.products];
  return state.products.filter((product) => {
    return [product.name, product.sku, product.category]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}

function render() {
  renderSummary();
  renderProducts();
  renderStock();
  renderHistory();
  renderCart();
}

function renderSummary() {
  const today = new Date().toISOString().slice(0, 10);
  const todayReceipts = state.receipts.filter((receipt) => receipt.createdAt.slice(0, 10) === today);
  const sales = todayReceipts.reduce((sum, receipt) => sum + receipt.total, 0);
  const low = state.products.filter((product) => product.stock > 0 && product.stock <= product.lowStock).length;
  els.todaySales.textContent = money.format(sales);
  els.todayBills.textContent = todayReceipts.length.toString();
  els.lowStockCount.textContent = low.toString();
  els.billNumber.textContent = `#${String(state.nextBill).padStart(4, "0")}`;
}

function renderProducts() {
  const products = filteredProducts();
  els.productGrid.textContent = "";
  els.productEmpty.hidden = products.length > 0;
  const template = document.querySelector("#productTemplate");

  for (const product of products) {
    const card = template.content.firstElementChild.cloneNode(true);
    const photo = card.querySelector(".product-photo");
    photo.src = productImage(product);
    photo.alt = product.name;
    card.querySelector(".category").textContent = product.category || "ทั่วไป";
    card.querySelector("h3").textContent = product.name;
    card.querySelector(".sku").textContent = product.sku || "ไม่มีรหัส";
    card.querySelector(".price").textContent = money.format(product.price);
    const stock = card.querySelector(".stock");
    stock.textContent = `เหลือ ${product.stock}`;
    stock.classList.toggle("low", product.stock > 0 && product.stock <= product.lowStock);
    stock.classList.toggle("out", product.stock <= 0);
    card.classList.toggle("out", product.stock <= 0);
    card.addEventListener("click", () => addToCart(product.id));
    els.productGrid.append(card);
  }
}

function renderStock() {
  els.stockList.textContent = "";
  for (const product of filteredProducts()) {
    const row = document.createElement("article");
    row.className = "stock-row";
    row.innerHTML = `
      <div class="stock-product">
        <img class="stock-photo" src="${productImage(product)}" alt="${escapeHtml(product.name)}">
        <div>
          <h3>${escapeHtml(product.name)}</h3>
          <p class="history-meta">${escapeHtml(product.sku || "ไม่มีรหัส")} · ${escapeHtml(product.category || "ทั่วไป")} · ${money.format(product.price)}</p>
        </div>
      </div>
      <div class="stock-actions">
        <button type="button" aria-label="ลดสต็อก">−</button>
        <input type="number" min="0" step="1" value="${product.stock}" inputmode="numeric" aria-label="สต็อก ${escapeHtml(product.name)}">
        <button type="button" aria-label="เพิ่มสต็อก">+</button>
        <button class="ghost" type="button">แก้ไข</button>
      </div>
    `;
    const [minus, input, plus, edit] = row.querySelectorAll("button, input");
    minus.addEventListener("click", () => updateStock(product.id, product.stock - 1));
    input.addEventListener("change", () => updateStock(product.id, Number(input.value)));
    plus.addEventListener("click", () => updateStock(product.id, product.stock + 1));
    edit.addEventListener("click", () => openProductDialog(product));
    els.stockList.append(row);
  }
}

function renderHistory() {
  els.historyList.textContent = "";
  els.historyEmpty.hidden = state.receipts.length > 0;
  for (const receipt of [...state.receipts].reverse()) {
    const row = document.createElement("article");
    row.className = "history-row";
    const itemCount = receipt.items.reduce((sum, item) => sum + item.qty, 0);
    row.innerHTML = `
      <div>
        <h3>#${String(receipt.billNo).padStart(4, "0")} · ${money.format(receipt.total)}</h3>
        <p class="history-meta">${formatDate(receipt.createdAt)} · ${receipt.customerName || "ไม่ระบุลูกค้า"} · ${paymentLabel(receipt.paymentMethod)} · ${itemCount} ชิ้น</p>
      </div>
      <button class="ghost" type="button">ดูรายละเอียด</button>
    `;
    row.querySelector("button").addEventListener("click", () => showReceipt(receipt));
    els.historyList.append(row);
  }
}

function addToCart(productId) {
  const product = findProduct(productId);
  if (!product || product.stock <= 0) return;
  const existing = state.cart.find((item) => item.productId === productId);
  const currentQty = existing ? existing.qty : 0;
  if (currentQty >= product.stock) return;
  if (existing) existing.qty += 1;
  else state.cart.push({ productId, qty: 1 });
  saveState();
  renderCart();
}

function renderCart() {
  els.cartItems.textContent = "";
  els.emptyCart.hidden = state.cart.length > 0;

  for (const line of state.cart) {
    const product = findProduct(line.productId);
    if (!product) continue;
    const row = document.createElement("div");
    row.className = "cart-line";
    row.innerHTML = `
      <img class="cart-thumb" src="${productImage(product)}" alt="${escapeHtml(product.name)}">
      <div>
        <strong>${escapeHtml(product.name)}</strong>
        <small>${money.format(product.price)} · เหลือ ${product.stock}</small>
        <div class="qty-controls">
          <button type="button">−</button>
          <span>${line.qty}</span>
          <button type="button">+</button>
        </div>
      </div>
      <div class="line-total">${money.format(product.price * line.qty)}</div>
    `;
    const [minus, plus] = row.querySelectorAll("button");
    minus.addEventListener("click", () => changeCartQty(product.id, line.qty - 1));
    plus.addEventListener("click", () => changeCartQty(product.id, line.qty + 1));
    els.cartItems.append(row);
  }

  const subtotal = getSubtotal();
  const discount = getDiscount();
  const total = Math.max(0, subtotal - discount);
  const paid = Number(els.paidInput.value || 0);
  els.subtotal.textContent = money.format(subtotal);
  els.grandTotal.textContent = money.format(total);
  els.changeDue.textContent = money.format(Math.max(0, paid - total));
}

function changeCartQty(productId, qty) {
  const product = findProduct(productId);
  if (!product) return;
  if (qty <= 0) state.cart = state.cart.filter((item) => item.productId !== productId);
  else {
    const line = state.cart.find((item) => item.productId === productId);
    line.qty = Math.min(qty, product.stock);
  }
  saveState();
  renderCart();
}

function getSubtotal() {
  return state.cart.reduce((sum, line) => {
    const product = findProduct(line.productId);
    return product ? sum + product.price * line.qty : sum;
  }, 0);
}

function getDiscount() {
  return Math.max(0, Number(els.discountInput.value || 0));
}

function checkout() {
  if (state.cart.length === 0) return;
  const items = state.cart.map((line) => {
    const product = findProduct(line.productId);
    return {
      productId: line.productId,
      name: product.name,
      sku: product.sku,
      image: product.image || "",
      price: product.price,
      qty: line.qty,
      total: product.price * line.qty
    };
  });
  for (const item of items) {
    const product = findProduct(item.productId);
    product.stock = Math.max(0, product.stock - item.qty);
  }
  const subtotal = getSubtotal();
  const discount = getDiscount();
  const total = Math.max(0, subtotal - discount);
  state.receipts.push({
    billNo: state.nextBill,
    createdAt: new Date().toISOString(),
    customerName: els.customerInput.value.trim(),
    paymentMethod: els.paymentMethod.value,
    items,
    subtotal,
    discount,
    total,
    paid: Number(els.paidInput.value || 0)
  });
  state.nextBill += 1;
  state.cart = [];
  els.customerInput.value = "";
  els.paymentMethod.value = "cash";
  els.discountInput.value = "0";
  els.paidInput.value = "";
  saveState();
  render();
}

function clearCart() {
  state.cart = [];
  els.customerInput.value = "";
  els.paymentMethod.value = "cash";
  els.discountInput.value = "0";
  els.paidInput.value = "";
  saveState();
  renderCart();
}

function updateStock(id, stock) {
  const product = findProduct(id);
  if (!product) return;
  product.stock = Math.max(0, Number.isFinite(stock) ? Math.floor(stock) : 0);
  saveState();
  render();
}

function openProductDialog(product = null) {
  els.dialogTitle.textContent = product ? "แก้ไขสินค้า" : "เพิ่มสินค้า";
  els.deleteProductBtn.hidden = !product;
  document.querySelector("#productId").value = product?.id || "";
  document.querySelector("#productName").value = product?.name || "";
  document.querySelector("#productSku").value = product?.sku || "";
  document.querySelector("#productCategory").value = product?.category || "";
  document.querySelector("#productPrice").value = product?.price ?? "";
  document.querySelector("#productStock").value = product?.stock ?? "";
  document.querySelector("#productLowStock").value = product?.lowStock ?? 3;
  setImageField(product?.image || "");
  els.productImage.value = "";
  els.productDialog.showModal();
}

function saveProductFromForm() {
  const id = document.querySelector("#productId").value;
  const product = {
    id: id || crypto.randomUUID(),
    name: document.querySelector("#productName").value.trim(),
    sku: document.querySelector("#productSku").value.trim(),
    category: document.querySelector("#productCategory").value.trim(),
    image: els.productImageData.value,
    price: Math.max(0, Number(document.querySelector("#productPrice").value || 0)),
    stock: Math.max(0, Math.floor(Number(document.querySelector("#productStock").value || 0))),
    lowStock: Math.max(0, Math.floor(Number(document.querySelector("#productLowStock").value || 0)))
  };
  if (!product.name) return;
  const index = state.products.findIndex((item) => item.id === id);
  if (index >= 0) state.products[index] = product;
  else state.products.push(product);
  saveState();
  els.productDialog.close();
  render();
}

function handleImagePick(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("กรุณาเลือกไฟล์รูปภาพ");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => setImageField(String(reader.result || "")));
  reader.readAsDataURL(file);
}

function setImageField(value) {
  els.productImageData.value = value;
  els.productImagePreview.src = value || PLACEHOLDER_IMAGE;
}

function showReceipt(receipt) {
  const lines = receipt.items
    .map((item) => `${item.name} x${item.qty} = ${money.format(item.total)}`)
    .join("\n");
  alert(
    `#${String(receipt.billNo).padStart(4, "0")}\n` +
      `${formatDate(receipt.createdAt)}\n` +
      `ลูกค้า: ${receipt.customerName || "ไม่ระบุ"}\n` +
      `จ่ายด้วย: ${paymentLabel(receipt.paymentMethod)}\n\n` +
      `${lines}\n\n` +
      `ส่วนลด ${money.format(receipt.discount)}\n` +
      `รวมสุทธิ ${money.format(receipt.total)}`
  );
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `event-pos-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function findProduct(id) {
  return state.products.find((product) => product.id === id);
}

function productImage(product) {
  return product?.image || PLACEHOLDER_IMAGE;
}

function paymentLabel(value) {
  return PAYMENT_LABELS[value] || PAYMENT_LABELS.cash;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
