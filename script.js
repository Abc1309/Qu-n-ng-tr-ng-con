(() => {
  "use strict";

  const SAVE_KEY = "quan_ong_truong_save_v1";

  const menu = [
    { id:"bun", name:"Bún rau", emoji:"🍜", price:25000, stock:1, unlock:0 },
    { id:"mi", name:"Mì xào gân bò", emoji:"🍝", price:35000, stock:1, unlock:0 },
    { id:"banhmi", name:"Bánh mì", emoji:"🥖", price:20000, stock:1, unlock:0 },
    { id:"com", name:"Cơm gân bò", emoji:"🍛", price:45000, stock:1, unlock:10 },
    { id:"pho", name:"Phở đặc biệt", emoji:"🍲", price:50000, stock:1, unlock:25 }
  ];

  const defaults = {
    money: 500000,
    revenue: 0,
    served: 0,
    rating: 5,
    stock: 8,
    kitchen: 1,
    tables: 1,
    unlocked: ["bun","mi","banhmi"],
    orders: [],
    nextId: 1
  };

  let state = load();
  let toastTimer = null;

  const $ = id => document.getElementById(id);
  const money = n => `${Math.max(0, Math.round(n)).toLocaleString("vi-VN")}đ`;

  function load(){
    try{
      const raw = localStorage.getItem(SAVE_KEY);
      if(!raw) return structuredClone(defaults);
      const saved = JSON.parse(raw);
      return {...structuredClone(defaults), ...saved};
    }catch(e){
      return structuredClone(defaults);
    }
  }

  function save(){
    try{ localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }catch(e){}
  }

  function notify(message){
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function kitchenTime(){
    return Math.max(550, 1800 - (state.kitchen - 1) * 180);
  }

  function maxOrders(){
    return 2 + (state.tables - 1);
  }

  function upgradeCost(base, level){
    return base * level;
  }

  function render(){
    $("money").textContent = money(state.money);
    $("revenue").textContent = money(state.revenue);
    $("served").textContent = state.served;
    $("rating").textContent = state.rating.toFixed(1);
    $("queueCount").textContent = `${state.orders.length}/${maxOrders()} đơn`;
    $("kitchenLevel").textContent = state.kitchen;
    $("tableLevel").textContent = state.tables;

    renderOrders();
    renderMenu();
    renderStock();
    renderAchievements();

    const kitchenCost = upgradeCost(50000, state.kitchen);
    const tableCost = upgradeCost(80000, state.tables);
    $("kitchenBtn").textContent = `🔥 ${money(kitchenCost)}`;
    $("tableBtn").textContent = `🪑 ${money(tableCost)}`;
    $("kitchenBtn").disabled = state.money < kitchenCost;
    $("tableBtn").disabled = state.money < tableCost;
    $("restockBtn").disabled = state.money < 30000;

    if(state.orders.length === 0){
      $("statusTitle").textContent = "Quán đang chờ khách...";
      $("statusText").textContent = "Bấm “Nhận khách” để bắt đầu ca bán hàng.";
    }else{
      $("statusTitle").textContent = `Đang có ${state.orders.length} khách chờ`;
      $("statusText").textContent = "Chọn một đơn rồi bấm “Nấu món”.";
    }
    $("newCustomerBtn").disabled = state.orders.length >= maxOrders();
    save();
  }

  function renderOrders(){
    const box = $("orders");
    if(!state.orders.length){
      box.innerHTML = `<div class="empty">👨‍🍳 Chưa có đơn hàng.<br>Hãy nhận khách để bắt đầu bán.</div>`;
      return;
    }
    box.innerHTML = state.orders.map(order => {
      const item = menu.find(x => x.id === order.foodId);
      return `<article class="order">
        <div class="order-main">
          <div class="food-emoji">${item.emoji}</div>
          <div>
            <h3>Khách #${order.customerId} · ${item.name}</h3>
            <p>${money(item.price)} · ${order.status === "cooking" ? "🔥 Đang nấu..." : "⏳ Đang chờ"}</p>
          </div>
        </div>
        <div class="order-actions">
          ${order.status === "waiting"
            ? `<button class="secondary cook-btn" data-id="${order.id}">🍳 Nấu món</button>`
            : `<button class="secondary" disabled>Đang chế biến</button>`}
          <button class="small-btn cancel-btn" data-id="${order.id}">Hủy</button>
        </div>
      </article>`;
    }).join("");

    box.querySelectorAll(".cook-btn").forEach(btn => {
      btn.addEventListener("click", () => cookOrder(Number(btn.dataset.id)));
    });
    box.querySelectorAll(".cancel-btn").forEach(btn => {
      btn.addEventListener("click", () => cancelOrder(Number(btn.dataset.id)));
    });
  }

  function renderMenu(){
    $("menu").innerHTML = menu.map(item => {
      const unlocked = state.unlocked.includes(item.id);
      const canUnlock = !unlocked && state.served >= item.unlock;
      return `<article class="food-card ${unlocked ? "" : "locked"}">
        <div class="food-emoji">${unlocked ? item.emoji : "🔒"}</div>
        <div>
          <h3>${item.name}</h3>
          ${unlocked
            ? `<div class="price">${money(item.price)}</div><p>Mất 1 nguyên liệu</p>`
            : `<p>Mở khóa khi phục vụ ${item.unlock} khách.</p>${canUnlock ? `<button class="secondary unlock-btn" data-id="${item.id}">Mở món</button>` : ""}`}
        </div>
      </article>`;
    }).join("");

    $("menu").querySelectorAll(".unlock-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        if(!state.unlocked.includes(id)){
          state.unlocked.push(id);
          notify("🎉 Đã mở món mới!");
          render();
        }
      });
    });
  }

  function renderStock(){
    $("stockList").innerHTML = `
      <div class="stock-row"><div class="stock-icon">🥬</div><div class="stock-info"><strong>Nguyên liệu chung</strong><span>Dùng để phục vụ món ăn</span></div><strong>${state.stock}</strong></div>
      <div class="stock-row"><div class="stock-icon">👨‍🍳</div><div class="stock-info"><strong>Tốc độ bếp</strong><span>Cấp ${state.kitchen}</span></div><strong>${(1800 / kitchenTime()).toFixed(1)}x</strong></div>
      <div class="stock-row"><div class="stock-icon">🪑</div><div class="stock-info"><strong>Số khách tối đa</strong><span>Theo số bàn</span></div><strong>${maxOrders()}</strong></div>
    `;
  }

  function renderAchievements(){
    const list = [
      ["💵", "Đồng tiền đầu tiên", "Kiếm 100.000đ doanh thu", state.revenue >= 100000],
      ["👥", "Quán đông khách", "Phục vụ 10 khách", state.served >= 10],
      ["🔥", "Bếp chuyên nghiệp", "Nâng bếp lên cấp 3", state.kitchen >= 3],
      ["🍜", "Thực đơn phong phú", "Mở 5 món", state.unlocked.length >= 5],
      ["🏆", "Ông chủ thực thụ", "Phục vụ 50 khách", state.served >= 50],
      ["⭐", "Khách quen", "Giữ đánh giá từ 4.8 trở lên", state.rating >= 4.8]
    ];
    $("achievements").innerHTML = list.map(a =>
      `<div class="achievement ${a[3] ? "done" : ""}"><strong>${a[0]} ${a[1]}</strong><span>${a[2]} ${a[3] ? "✓" : ""}</span></div>`
    ).join("");
  }

  function receiveCustomer(){
    if(state.orders.length >= maxOrders()){
      notify("🪑 Hết chỗ! Hãy phục vụ khách trước.");
      return;
    }
    if(state.stock <= 0){
      notify("📦 Hết nguyên liệu! Hãy nhập thêm.");
      return;
    }
    const available = menu.filter(x => state.unlocked.includes(x.id));
    const item = available[Math.floor(Math.random() * available.length)];
    state.orders.push({
      id: Date.now() + Math.floor(Math.random()*1000),
      customerId: state.nextId++,
      foodId: item.id,
      status: "waiting"
    });
    state.stock--;
    notify(`👤 Khách #${state.nextId - 1} gọi ${item.name}`);
    render();
  }

  function cookOrder(orderId){
    const order = state.orders.find(o => o.id === orderId);
    if(!order || order.status !== "waiting") return;
    order.status = "cooking";
    notify("🔥 Đang chế biến món...");
    render();

    setTimeout(() => {
      const idx = state.orders.findIndex(o => o.id === orderId);
      if(idx < 0) return;
      const finished = state.orders[idx];
      const item = menu.find(x => x.id === finished.foodId);
      state.money += item.price;
      state.revenue += item.price;
      state.served++;
      state.orders.splice(idx,1);

      if(Math.random() < 0.08) state.rating = Math.max(3.5, state.rating - 0.1);
      else if(state.rating < 5 && Math.random() < 0.3) state.rating = Math.min(5, state.rating + 0.1);

      notify(`✅ Giao ${item.name}! +${money(item.price)}`);
      render();
    }, kitchenTime());
  }

  function cancelOrder(orderId){
    const idx = state.orders.findIndex(o => o.id === orderId);
    if(idx < 0) return;
    state.orders.splice(idx,1);
    state.stock++;
    state.rating = Math.max(3.5, state.rating - 0.05);
    notify("❌ Đã hủy đơn, khách không hài lòng.");
    render();
  }

  function restock(){
    const cost = 30000;
    if(state.money < cost) return notify("💸 Không đủ tiền nhập nguyên liệu.");
    state.money -= cost;
    state.stock += 8;
    notify("📦 Đã nhập thêm 8 suất nguyên liệu.");
    render();
  }

  function upgradeKitchen(){
    const cost = upgradeCost(50000, state.kitchen);
    if(state.money < cost) return notify("💸 Không đủ tiền nâng cấp bếp.");
    state.money -= cost;
    state.kitchen++;
    notify(`🔥 Bếp lên cấp ${state.kitchen}!`);
    render();
  }

  function upgradeTable(){
    const cost = upgradeCost(80000, state.tables);
    if(state.money < cost) return notify("💸 Không đủ tiền thêm bàn.");
    state.money -= cost;
    state.tables++;
    notify(`🪑 Đã thêm bàn! Tối đa ${maxOrders()} khách.`);
    render();
  }

  function resetGame(){
    if(!confirm("Chơi lại từ đầu? Toàn bộ tiền và nâng cấp sẽ bị xóa.")) return;
    state = structuredClone(defaults);
    save();
    notify("🔄 Đã bắt đầu lại Quán Ông Trường.");
    render();
  }

  $("newCustomerBtn").addEventListener("click", receiveCustomer);
  $("restockBtn").addEventListener("click", restock);
  $("kitchenBtn").addEventListener("click", upgradeKitchen);
  $("tableBtn").addEventListener("click", upgradeTable);
  $("resetBtn").addEventListener("click", resetGame);

  render();
})();
