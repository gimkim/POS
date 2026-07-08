const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0
});

const STORAGE_KEY = "event-pos-data-v1";
const DEFAULT_CATEGORY_ID = "general";
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
  { id: crypto.randomUUID(), name: "เสื้อยืด", sku: "TSHIRT", categoryId: "apparel", price: 350, stock: 24, lowStock: 5, image: "" },
  { id: crypto.randomUUID(), name: "กระเป๋าผ้า", sku: "TOTE", categoryId: "goods", price: 180, stock: 18, lowStock: 4, image: "" },
  { id: crypto.randomUUID(), name: "สติกเกอร์", sku: "STICKER", categoryId: "small-item", price: 40, stock: 60, lowStock: 10, image: "" }
];
const sampleCategories = [
  { id: DEFAULT_CATEGORY_ID, name: "ทั่วไป" },
  { id: "apparel", name: "Apparel" },
  { id: "goods", name: "Goods" },
  { id: "small-item", name: "Small item" }
];

const state = loadState();
let activeView = "sell";
let query = "";

const els = {
  productGrid: document.querySelector("#productGrid"),
  stockList: document.querySelector("#stockList"),
  historyList: document.querySelector("#historyList"),
  historyDateInput: document.querySelector("#historyDateInput"),
  selectedDateSales: document.querySelector("#selectedDateSales"),
  selectedDateBills: document.querySelector("#selectedDateBills"),
  selectedDateItems: document.querySelector("#selectedDateItems"),
  topProductList: document.querySelector("#topProductList"),
  topProductsHint: document.querySelector("#topProductsHint"),
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
  categoryDialog: document.querySelector("#categoryDialog"),
  categoryForm: document.querySelector("#categoryForm"),
  categoryList: document.querySelector("#categoryList"),
  categoryNameInput: document.querySelector("#categoryNameInput"),
  receiptDialog: document.querySelector("#receiptDialog"),
  receiptTitle: document.querySelector("#receiptTitle"),
  receiptMeta: document.querySelector("#receiptMeta"),
  receiptItems: document.querySelector("#receiptItems"),
  receiptSubtotal: document.querySelector("#receiptSubtotal"),
  receiptDiscount: document.querySelector("#receiptDiscount"),
  receiptTotal: document.querySelector("#receiptTotal"),
  receiptPaid: document.querySelector("#receiptPaid"),
  receiptChange: document.querySelector("#receiptChange"),
  importZipInput: document.querySelector("#importZipInput"),
  dialogTitle: document.querySelector("#dialogTitle"),
  deleteProductBtn: document.querySelector("#deleteProductBtn"),
  productImage: document.querySelector("#productImage"),
  productImageData: document.querySelector("#productImageData"),
  productImagePreview: document.querySelector("#productImagePreview")
};

document.querySelector("#newProductBtn").addEventListener("click", () => openProductDialog());
document.querySelector("#categoryBtn").addEventListener("click", openCategoryDialog);
document.querySelector("#closeDialogBtn").addEventListener("click", () => els.productDialog.close());
document.querySelector("#closeCategoryBtn").addEventListener("click", () => els.categoryDialog.close());
document.querySelector("#closeReceiptBtn").addEventListener("click", () => els.receiptDialog.close());
document.querySelector("#clearImageBtn").addEventListener("click", () => setImageField(""));
document.querySelector("#clearCartBtn").addEventListener("click", clearCart);
document.querySelector("#checkoutBtn").addEventListener("click", checkout);
document.querySelector("#exportBtn").addEventListener("click", exportData);
document.querySelector("#importBtn").addEventListener("click", () => els.importZipInput.click());
els.importZipInput.addEventListener("change", importDataZip);
els.discountInput.addEventListener("input", renderCart);
els.paidInput.addEventListener("input", renderCart);
els.paymentMethod.addEventListener("change", renderCart);
els.searchInput.addEventListener("input", (event) => {
  query = event.target.value.trim().toLowerCase();
  render();
});
els.productImage.addEventListener("change", handleImagePick);
els.historyDateInput.value = dateKey();
els.historyDateInput.addEventListener("change", () => {
  renderHistory();
});
els.categoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addCategory();
});

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
      migrateCategories(parsed);
      parsed.cart ||= [];
      parsed.receipts ||= [];
      parsed.nextBill ||= 1;
      return parsed;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return {
    categories: sampleCategories,
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
    return [product.name, product.sku, categoryName(product.categoryId)]
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
  const today = dateKey();
  const todayReceipts = state.receipts.filter((receipt) => receiptDateKey(receipt) === today);
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
  if (products.length === 0) return;

  for (const category of groupedProducts(products)) {
    const section = document.createElement("section");
    section.className = "product-group";
    section.innerHTML = `
      <div class="product-group-head">
        <h2>${escapeHtml(category.name)}</h2>
        <span>${category.products.length} รายการ</span>
      </div>
      <div class="product-group-grid"></div>
    `;
    const grid = section.querySelector(".product-group-grid");
    for (const product of category.products) {
      grid.append(createProductCard(product));
    }
    els.productGrid.append(section);
  }
}

function createProductCard(product) {
  const template = document.querySelector("#productTemplate");
  const card = template.content.firstElementChild.cloneNode(true);
  const photo = card.querySelector(".product-photo");
  photo.src = productImage(product);
  photo.alt = product.name;
  card.querySelector(".category").textContent = categoryName(product.categoryId);
  card.querySelector("h3").textContent = product.name;
  card.querySelector(".sku").textContent = product.sku || "ไม่มีรหัส";
  card.querySelector(".price").textContent = money.format(product.price);
  const stock = card.querySelector(".stock");
  stock.textContent = `เหลือ ${product.stock}`;
  stock.classList.toggle("low", product.stock > 0 && product.stock <= product.lowStock);
  stock.classList.toggle("out", product.stock <= 0);
  card.classList.toggle("out", product.stock <= 0);
  card.addEventListener("click", () => addToCart(product.id));
  return card;
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
          <p class="history-meta">${escapeHtml(product.sku || "ไม่มีรหัส")} · ${escapeHtml(categoryName(product.categoryId))} · ${money.format(product.price)}</p>
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
  const selectedDate = els.historyDateInput.value || dateKey();
  const receipts = state.receipts.filter((receipt) => receiptDateKey(receipt) === selectedDate);
  renderHistorySummary(receipts);
  els.historyEmpty.hidden = receipts.length > 0;
  for (const receipt of [...receipts].reverse()) {
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

function renderHistorySummary(receipts) {
  const totalSales = receipts.reduce((sum, receipt) => sum + receipt.total, 0);
  const totalItems = receipts.reduce((sum, receipt) => sum + receipt.items.reduce((itemSum, item) => itemSum + item.qty, 0), 0);
  els.selectedDateSales.textContent = money.format(totalSales);
  els.selectedDateBills.textContent = receipts.length.toString();
  els.selectedDateItems.textContent = totalItems.toString();

  const products = summarizeTopProducts(receipts);
  els.topProductList.textContent = "";
  els.topProductsHint.textContent = products.length ? "เรียงตามจำนวนชิ้นที่ขายได้" : "ยังไม่มีสินค้าขายในวันนี้";
  for (const product of products.slice(0, 5)) {
    const row = document.createElement("div");
    row.className = "top-product-row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(product.name)}</strong>
        <small>${product.qty} ชิ้น · ${money.format(product.total)}</small>
      </div>
      <span>${money.format(product.total)}</span>
    `;
    els.topProductList.append(row);
  }
}

function summarizeTopProducts(receipts) {
  const byProduct = new Map();
  for (const receipt of receipts) {
    for (const item of receipt.items) {
      const key = item.productId || item.sku || item.name;
      const current = byProduct.get(key) || { name: item.name, qty: 0, total: 0 };
      current.qty += item.qty;
      current.total += item.total;
      byProduct.set(key, current);
    }
  }
  return [...byProduct.values()].sort((a, b) => b.qty - a.qty || b.total - a.total);
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
  renderCategoryOptions(product?.categoryId || "");
  els.dialogTitle.textContent = product ? "แก้ไขสินค้า" : "เพิ่มสินค้า";
  els.deleteProductBtn.hidden = !product;
  document.querySelector("#productId").value = product?.id || "";
  document.querySelector("#productName").value = product?.name || "";
  document.querySelector("#productSku").value = product?.sku || "";
  document.querySelector("#productCategory").value = product?.categoryId || DEFAULT_CATEGORY_ID;
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
    categoryId: document.querySelector("#productCategory").value || DEFAULT_CATEGORY_ID,
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

function openCategoryDialog() {
  renderCategories();
  els.categoryNameInput.value = "";
  els.categoryDialog.showModal();
}

function addCategory() {
  const name = els.categoryNameInput.value.trim();
  if (!name) return;
  const exists = state.categories.some((category) => category.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    alert("มีหมวดหมู่นี้อยู่แล้ว");
    return;
  }
  state.categories.push({ id: uniqueCategoryId(name), name });
  els.categoryNameInput.value = "";
  saveState();
  renderCategories();
  render();
}

function deleteCategory(id) {
  if (id === DEFAULT_CATEGORY_ID) return;
  const category = state.categories.find((item) => item.id === id);
  if (!category) return;
  const used = state.products.some((product) => product.categoryId === id);
  if (used) {
    alert("หมวดหมู่นี้มีสินค้าอยู่ ให้ย้ายสินค้าไปหมวดอื่นก่อนลบ");
    return;
  }
  if (!confirm(`ลบหมวดหมู่ “${category.name}” ใช่ไหม?`)) return;
  state.categories = state.categories.filter((item) => item.id !== id);
  saveState();
  renderCategories();
  render();
}

function renderCategories() {
  els.categoryList.textContent = "";
  for (const category of state.categories) {
    const count = state.products.filter((product) => product.categoryId === category.id).length;
    const row = document.createElement("div");
    row.className = "category-row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(category.name)}</strong>
        <small>${count} รายการ</small>
      </div>
      <button class="ghost danger" type="button" ${category.id === DEFAULT_CATEGORY_ID ? "disabled" : ""}>ลบ</button>
    `;
    row.querySelector("button").addEventListener("click", () => deleteCategory(category.id));
    els.categoryList.append(row);
  }
}

function renderCategoryOptions(selectedId = "") {
  const select = document.querySelector("#productCategory");
  select.textContent = "";
  for (const category of state.categories) {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    select.append(option);
  }
  select.value = state.categories.some((category) => category.id === selectedId) ? selectedId : DEFAULT_CATEGORY_ID;
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
  els.receiptTitle.textContent = `#${String(receipt.billNo).padStart(4, "0")}`;
  els.receiptMeta.innerHTML = `
    <div><span>เวลา</span><strong>${formatDate(receipt.createdAt)}</strong></div>
    <div><span>ลูกค้า</span><strong>${escapeHtml(receipt.customerName || "ไม่ระบุ")}</strong></div>
    <div><span>จ่ายด้วย</span><strong>${paymentLabel(receipt.paymentMethod)}</strong></div>
  `;
  els.receiptItems.textContent = "";
  for (const item of receipt.items) {
    const row = document.createElement("div");
    row.className = "receipt-item";
    row.innerHTML = `
      <img src="${item.image || PLACEHOLDER_IMAGE}" alt="${escapeHtml(item.name)}">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <small>${escapeHtml(item.sku || "ไม่มีรหัส")} · ${money.format(item.price)} x ${item.qty}</small>
      </div>
      <span>${money.format(item.total)}</span>
    `;
    els.receiptItems.append(row);
  }
  const paid = Number(receipt.paid || 0);
  els.receiptSubtotal.textContent = money.format(receipt.subtotal || receipt.total);
  els.receiptDiscount.textContent = money.format(receipt.discount || 0);
  els.receiptTotal.textContent = money.format(receipt.total);
  els.receiptPaid.textContent = money.format(paid);
  els.receiptChange.textContent = money.format(Math.max(0, paid - receipt.total));
  els.receiptDialog.showModal();
}

async function exportData() {
  const { data, imageFiles } = await buildPortableExport();
  const files = [
    {
      path: "data.json",
      bytes: new TextEncoder().encode(JSON.stringify(data, null, 2))
    },
    ...imageFiles
  ];
  const blob = createZip(files);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `event-pos-${dateKey()}.zip`;
  link.click();
  URL.revokeObjectURL(url);
}

async function buildPortableExport() {
  const data = JSON.parse(JSON.stringify(state));
  const imageFiles = [];
  const seenImages = new Map();

  for (const product of data.products || []) {
    product.imageFile = await addImageFile(product.image, `product-${product.id || crypto.randomUUID()}`, imageFiles, seenImages);
    delete product.image;
  }

  for (const receipt of data.receipts || []) {
    for (const item of receipt.items || []) {
      item.imageFile = await addImageFile(item.image, `receipt-${receipt.billNo || "bill"}-${item.productId || item.sku || item.name}`, imageFiles, seenImages);
      delete item.image;
    }
  }

  return { data, imageFiles };
}

async function addImageFile(dataUrl, fallbackName, imageFiles, seenImages) {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return "";
  if (seenImages.has(dataUrl)) return seenImages.get(dataUrl);
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return "";
  const ext = imageExtension(parsed.mime);
  const path = `images/${safeFileName(fallbackName)}-${imageFiles.length + 1}.${ext}`;
  imageFiles.push({ path, bytes: parsed.bytes });
  seenImages.set(dataUrl, path);
  return path;
}

async function importDataZip(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    const entries = readZip(new Uint8Array(await file.arrayBuffer()));
    const dataBytes = entries.get("data.json");
    if (!dataBytes) throw new Error("missing data.json");
    const imported = JSON.parse(new TextDecoder().decode(dataBytes));
    restoreImages(imported, entries);
    migrateCategories(imported);
    imported.cart ||= [];
    imported.receipts ||= [];
    imported.nextBill ||= 1;
    if (!Array.isArray(imported.products)) imported.products = [];
    if (!Array.isArray(imported.categories)) imported.categories = [{ id: DEFAULT_CATEGORY_ID, name: "ทั่วไป" }];
    if (!confirm("นำเข้าข้อมูลจาก ZIP นี้ไหม? ข้อมูลในเครื่องนี้จะถูกแทนที่ทั้งหมด")) return;
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, imported);
    saveState();
    render();
    alert("นำเข้าข้อมูลเรียบร้อยแล้ว");
  } catch (error) {
    alert("นำเข้า ZIP ไม่สำเร็จ กรุณาเลือกไฟล์ที่ export จาก Event POS");
  }
}

function restoreImages(data, entries) {
  for (const product of data.products || []) {
    product.image = imageFileToDataUrl(product.imageFile, entries) || product.image || "";
    delete product.imageFile;
  }
  for (const receipt of data.receipts || []) {
    for (const item of receipt.items || []) {
      item.image = imageFileToDataUrl(item.imageFile, entries) || item.image || "";
      delete item.imageFile;
    }
  }
}

function imageFileToDataUrl(path, entries) {
  if (!path) return "";
  const bytes = entries.get(path);
  if (!bytes) return "";
  const mime = mimeFromPath(path);
  return `data:${mime};base64,${uint8ToBase64(bytes)}`;
}

function findProduct(id) {
  return state.products.find((product) => product.id === id);
}

function categoryName(id) {
  return state.categories.find((category) => category.id === id)?.name || "ทั่วไป";
}

function groupedProducts(products) {
  return state.categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      products: products.filter((product) => (product.categoryId || DEFAULT_CATEGORY_ID) === category.id)
    }))
    .filter((category) => category.products.length > 0);
}

function migrateCategories(data) {
  const categories = new Map();
  const hasSavedCategories = Array.isArray(data.categories);
  if (hasSavedCategories) {
    for (const category of data.categories) {
      if (category?.id && category?.name) categories.set(category.id, category);
    }
  }

  for (const product of data.products || []) {
    if (product.categoryId && categories.has(product.categoryId)) continue;
    if (product.categoryId && !hasSavedCategories) {
      const sampleCategory = sampleCategories.find((category) => category.id === product.categoryId);
      if (sampleCategory) {
        categories.set(sampleCategory.id, sampleCategory);
        continue;
      }
    }
    const legacyName = product.category?.trim() || "ทั่วไป";
    const existing = [...categories.values()].find((category) => category.name.toLowerCase() === legacyName.toLowerCase());
    const category = existing || { id: uniqueCategoryId(legacyName, categories), name: legacyName };
    categories.set(category.id, category);
    product.categoryId = category.id;
    delete product.category;
  }

  if (!categories.has(DEFAULT_CATEGORY_ID)) categories.set(DEFAULT_CATEGORY_ID, { id: DEFAULT_CATEGORY_ID, name: "ทั่วไป" });
  data.categories = [...categories.values()];
}

function uniqueCategoryId(name, existingCategories = null) {
  const source = existingCategories || new Map(state.categories.map((category) => [category.id, category]));
  const base = slugify(name) || "category";
  let id = base;
  let suffix = 2;
  while (source.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function receiptDateKey(receipt) {
  return dateKey(receipt.createdAt);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/);
  if (!match) return null;
  const mime = match[1];
  const isBase64 = Boolean(match[2]);
  const payload = match[3];
  const bytes = isBase64
    ? base64ToUint8(payload)
    : new TextEncoder().encode(decodeURIComponent(payload));
  return { mime, bytes };
}

function createZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { date, time } = dosDateTime(new Date());

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const bytes = file.bytes;
    const crc = crc32(bytes);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, time, true);
    localView.setUint16(12, date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, bytes.length, true);
    localView.setUint32(22, bytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    localParts.push(local, bytes);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, date, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, bytes.length, true);
    centralView.setUint32(24, bytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length + bytes.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}

function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("invalid zip");
  const entryCount = view.getUint16(eocd + 10, true);
  let centralOffset = view.getUint32(eocd + 16, true);
  const entries = new Map();
  const decoder = new TextDecoder();

  for (let i = 0; i < entryCount; i += 1) {
    if (view.getUint32(centralOffset, true) !== 0x02014b50) throw new Error("invalid central directory");
    const method = view.getUint16(centralOffset + 10, true);
    if (method !== 0) throw new Error("unsupported zip compression");
    const compressedSize = view.getUint32(centralOffset + 20, true);
    const nameLength = view.getUint16(centralOffset + 28, true);
    const extraLength = view.getUint16(centralOffset + 30, true);
    const commentLength = view.getUint16(centralOffset + 32, true);
    const localOffset = view.getUint32(centralOffset + 42, true);
    const name = decoder.decode(bytes.slice(centralOffset + 46, centralOffset + 46 + nameLength));
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    entries.set(name, bytes.slice(dataStart, dataStart + compressedSize));
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function dosDateTime(dateValue) {
  const year = Math.max(1980, dateValue.getFullYear());
  const date = ((year - 1980) << 9) | ((dateValue.getMonth() + 1) << 5) | dateValue.getDate();
  const time = (dateValue.getHours() << 11) | (dateValue.getMinutes() << 5) | Math.floor(dateValue.getSeconds() / 2);
  return { date, time };
}

function base64ToUint8(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return btoa(binary);
}

function imageExtension(mime) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/svg+xml") return "svg";
  return "img";
}

function mimeFromPath(path) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "svg") return "image/svg+xml";
  return "application/octet-stream";
}

function safeFileName(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "image";
}
