/* =========================================================
   顾手游电竞 管理后台 - 前端演示逻辑
   数据存储：本机 localStorage（gb_orders / gb_services / gb_settings）
   ========================================================= */
(function () {
  "use strict";

  /* ---------------- 常量 ---------------- */
  var K_ORDERS = "gb_orders";
  var K_SERVICES = "gb_services";
  var K_SETTINGS = "gb_settings";
  var K_AUTH = "gb_admin_auth";

  /* 管理员账号与密码来自独立配置文件 assets/js/admin-auth-config.js（window.GB_ADMIN_AUTH） */
  var AUTH_CFG = window.GB_ADMIN_AUTH || {};
  var ADMIN_USER = String(AUTH_CFG.username || "");
  var ADMIN_PASS = String(AUTH_CFG.password || "");
  var ADMIN_NAME = String(AUTH_CFG.displayName || "") || "管理员";
  var AUTH_READY = ADMIN_USER !== "" && ADMIN_PASS !== "";

  var STATUS_LIST = ["待处理", "进行中", "已完成", "已取消"];
  var GAMES = ["英雄联盟", "王者荣耀", "无畏契约", "永劫无间", "其他游戏"];
  var SERVICES_LIST = ["段位代练", "排位上分", "定级赛", "双排陪玩", "账号托管", "活动代肝"];

  var DEFAULT_SERVICES = [
    { name: "段位代练", price: 68, unit: "小段", orders: 3120, online: true },
    { name: "排位上分", price: 12, unit: "星", orders: 8460, online: true },
    { name: "定级赛", price: 158, unit: "十局", orders: 1240, online: true },
    { name: "双排陪玩", price: 45, unit: "小时", orders: 2680, online: true },
    { name: "账号托管", price: 30, unit: "天", orders: 960, online: true },
    { name: "活动代肝", price: 25, unit: "阶段", orders: 1520, online: false }
  ];

  var RANKERS = [
    { id: "GS-1188", game: "王者荣耀", count: 862, rate: "99.2%" },
    { id: "GS-2071", game: "英雄联盟", count: 741, rate: "98.6%" },
    { id: "GS-3345", game: "无畏契约", count: 628, rate: "98.9%" },
    { id: "GS-0092", game: "永劫无间", count: 517, rate: "99.5%" },
    { id: "GS-4410", game: "英雄联盟", count: 402, rate: "97.8%" }
  ];

  /* ---------------- 工具 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtDate(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v === null || v === undefined ? fallback : v;
    } catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { toast("本地存储写入失败", "err"); return false; }
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function money(n) { return "¥" + Number(n || 0).toLocaleString("zh-CN"); }

  function toast(msg, type) {
    var wrap = $(".toast-wrap");
    if (!wrap) return;
    var el = document.createElement("div");
    el.className = "toast" + (type === "ok" ? " ok" : type === "err" ? " err" : "");
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity .3s, transform .3s";
      el.style.opacity = "0";
      el.style.transform = "translateX(18px)";
      setTimeout(function () { el.remove(); }, 320);
    }, 2400);
  }

  /* ---------------- 演示种子数据 ---------------- */
  function seedOrders() {
    var exist = read(K_ORDERS, null);
    if (exist && exist.length) return exist;

    var names = ["小林", "阿杰", "老王", "Kay", "夜风", "Nina", "阿哲", "橙子",
      "小满", "Stone", "阿伟", "Lulu", "大鹏", "星野"];
    var games = ["英雄联盟", "王者荣耀", "无畏契约", "永劫无间"];
    var svcs = ["段位代练", "排位上分", "定级赛", "双排陪玩", "账号托管", "活动代肝"];
    var stats = ["已完成", "已完成", "进行中", "待处理", "已完成", "待处理", "已完成", "已取消"];
    var froms = ["青铜 II", "白银 IV", "黄金 III", "铂金 I", "钻石 IV", "星耀 III", "铁牌 II", "—"];
    var tos = ["白银 IV", "黄金 I", "铂金 III", "钻石 IV", "大师 V", "王者 20 星", "铜牌 I", "—"];
    var dls = ["不着急（常规排期）", "3 天内完成", "24 小时内加急", "不着急（常规排期）"];
    var buds = ["100 - 300 元", "300 - 800 元", "100 元以内", "800 元以上", "未确定"];
    var notes = [
      "只玩辅助位，希望晚上开始。",
      "账号是小号，没有指定英雄，随便打。",
      "加急，明晚之前必须上段，可以加钱。",
      "希望用打野位上分，谢谢。",
      "",
      "需要保分托管一周，每天打两把即可。",
      "通行证还差 20 级，尽快完成。"
    ];

    var list = [];
    var now = new Date();
    for (var i = 0; i < 16; i++) {
      var d = new Date(now.getTime() - Math.floor(Math.random() * 7) * 86400000
        - Math.floor(Math.random() * 12) * 3600000);
      var svc = svcs[i % svcs.length];
      list.push({
        id: "GS" + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) +
          "-" + (1000 + i * 7 + Math.floor(Math.random() * 90)),
        name: names[i % names.length],
        contact: i % 3 === 0 ? "wx_" + (1000 + i) : (18800000000 + i * 137),
        game: games[i % games.length],
        service: svc,
        from: froms[i % froms.length],
        to: tos[i % tos.length],
        deadline: dls[i % dls.length],
        budget: buds[i % buds.length],
        note: notes[i % notes.length],
        amount: [268, 158, 198, 180, 210, 120][svcs.indexOf(svc)] || 180,
        status: stats[i % stats.length],
        createdAt: fmtDate(d),
        source: "官网联系页"
      });
    }
    write(K_ORDERS, list);
    return list;
  }

  /* ---------------- 数据访问 ---------------- */
  /* 旧品牌时期的订单号前缀（GB）统一为新前缀（GS），避免后台列表里出现旧品牌编号 */
  function migrateOrderIds(list) {
    var changed = false;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (it && typeof it.id === "string" && /^GB/i.test(it.id)) {
        it.id = "GS" + it.id.slice(2);
        changed = true;
      }
    }
    if (changed) write(K_ORDERS, list);
    return list;
  }
  function getOrders() { return migrateOrderIds(read(K_ORDERS, []) || []); }
  function setOrders(list) { return write(K_ORDERS, list); }
  function getServices() {
    var s = read(K_SERVICES, null);
    if (!s || !s.length) { write(K_SERVICES, DEFAULT_SERVICES); return DEFAULT_SERVICES.slice(); }
    return s;
  }
  function setServices(s) { return write(K_SERVICES, s); }
  function getSettings() {

    return read(K_SETTINGS, {
      name: "顾手游电竞",
      slogan: "实名打手 · 进度可视 · 封号包赔"
    });
  }
  function setSettings(s) { return write(K_SETTINGS, s); }

  /* ---------------- 登录 ---------------- */
  function initLogin() {
    var gate = $("#loginGate");
    var shell = $("#adminShell");
    var form = $("#loginForm");
    var errBox = $("#loginError");
    var userText = $("#adminUserText");

    if (userText) { userText.textContent = ADMIN_NAME; }

    function fail(msg) {
      errBox.textContent = msg;
      errBox.classList.add("show");
    }

    function enter() {
      gate.style.display = "none";
      shell.classList.add("show");
      start();
    }

    if (!AUTH_READY) {
      fail("管理员账号尚未配置：请打开 assets/js/admin-auth-config.js，填写 username 与 password 后刷新本页。");
    }

    if (AUTH_READY && sessionStorage.getItem(K_AUTH) === ADMIN_USER) { enter(); return; }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!AUTH_READY) {
        fail("管理员账号尚未配置：请打开 assets/js/admin-auth-config.js，填写 username 与 password 后刷新本页。");
        return;
      }
      var u = $("#lg-user").value.trim();
      var p = $("#lg-pass").value;
      if (u === ADMIN_USER && p === ADMIN_PASS) {
        sessionStorage.setItem(K_AUTH, ADMIN_USER);
        errBox.classList.remove("show");
        enter();
        toast("登录成功，欢迎回来", "ok");
      } else {
        fail("账号或密码错误，请检查后重试。");
      }
    });
  }

  function logout() {
    sessionStorage.removeItem(K_AUTH);
    location.reload();
  }

  /* ---------------- 启动 ---------------- */
  var state = { search: "", status: "", editingId: null };

  function start() {
    seedOrders();
    getServices();
    tickClock();
    setInterval(tickClock, 30000);
    initNavSwitch();
    initActions();
    renderAll();
  }

  function tickClock() {
    var el = $("#nowText");
    if (el) el.textContent = fmtDate(new Date());
  }

  /* ---------------- 侧栏切换 ---------------- */
  function initNavSwitch() {
    $$(".admin-side a").forEach(function (a) {
      a.addEventListener("click", function () {
        var key = a.getAttribute("data-page");
        $$(".admin-side a").forEach(function (x) { x.classList.toggle("active", x === a); });
        $$(".admin-page").forEach(function (p) {
          p.classList.toggle("active", p.getAttribute("data-page") === key);
        });
      });
    });
  }

  /* ---------------- 渲染入口 ---------------- */
  function renderAll() {
    renderDashboard();
    renderOrders();
    renderServices();
    renderMessages();
  }

  /* ---------------- 看板 ---------------- */
  function renderDashboard() {
    var orders = getOrders();
    var today = todayStr();
    var todayCount = orders.filter(function (o) {
      return (o.createdAt || "").indexOf(today) === 0;
    }).length;
    var doing = orders.filter(function (o) { return o.status === "进行中"; }).length;
    var pending = orders.filter(function (o) { return o.status === "待处理"; }).length;
    var amount = orders.reduce(function (s, o) {
      return o.status === "已取消" ? s : s + Number(o.amount || 0);
    }, 0);

    $("#kpiToday").textContent = todayCount;
    $("#kpiTotal").textContent = orders.length;
    $("#kpiAmount").textContent = money(amount);
    $("#kpiDoing").textContent = doing;
    $("#kpiDoingSub").textContent = "待处理 " + pending + " 单";

    renderTrend(orders);
    renderShare(orders);
    renderRankers();
  }

  function renderTrend(orders) {
    var box = $("#trendBars");
    if (!box) return;
    var days = [];
    var now = new Date();
    for (var i = 6; i >= 0; i--) {
      var d = new Date(now.getTime() - i * 86400000);
      days.push({
        label: pad(d.getMonth() + 1) + "/" + pad(d.getDate()),
        key: d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()),
        count: 0
      });
    }
    orders.forEach(function (o) {
      var day = (o.createdAt || "").slice(0, 10);
      days.forEach(function (d) { if (d.key === day) d.count++; });
    });
    // 若某日无订单，补充演示基数，保证图表可见
    days.forEach(function (d, i) {
      if (d.count === 0) d.count = [4, 6, 5, 9, 7, 11, 8][i % 7];
    });
    var max = Math.max.apply(null, days.map(function (d) { return d.count; })) || 1;

    box.innerHTML = days.map(function (d) {
      var h = Math.max(6, Math.round((d.count / max) * 150));
      return '<div class="bar-col"><b>' + d.count + '</b>' +
        '<div class="bar" style="height:' + h + 'px"></div>' +
        '<span>' + d.label + '</span></div>';
    }).join("");
  }

  function renderShare(orders) {
    var box = $("#serviceShare");
    if (!box) return;
    var map = {};
    var total = orders.length || 1;
    orders.forEach(function (o) {
      map[o.service] = (map[o.service] || 0) + 1;
    });
    var keys = Object.keys(map);
    if (!keys.length) {
      box.innerHTML = '<div class="empty"><div class="empty-icon">📊</div><div>暂无数据</div></div>';
      return;
    }
    keys.sort(function (a, b) { return map[b] - map[a]; });
    box.innerHTML = keys.map(function (k) {
      var pct = Math.round((map[k] / total) * 100);
      return '<div style="margin-bottom:16px">' +
        '<div style="display:flex;justify-content:space-between;font-size:13.4px;margin-bottom:7px">' +
        '<span>' + esc(k) + '</span><span style="color:var(--muted)">' + map[k] + ' 单 · ' + pct + '%</span></div>' +
        '<div class="bar-line"><i style="width:' + pct + '%"></i></div></div>';
    }).join("");
  }

  function renderRankers() {
    var body = $("#rankerBody");
    if (!body) return;
    body.innerHTML = RANKERS.map(function (r) {
      return "<tr><td><b>" + esc(r.id) + "</b></td><td>" + esc(r.game) + "</td><td>" +
        r.count + " 单</td><td><span class='pill pill-ok'>" + r.rate + "</span></td></tr>";
    }).join("");
  }

  /* ---------------- 订单 ---------------- */
  function statusPill(s) {
    var cls = s === "已完成" ? "pill-ok" : s === "进行中" ? "pill-info" :
      s === "待处理" ? "pill-warn" : "pill-mute";
    return "<span class='pill " + cls + "'>" + esc(s) + "</span>";
  }

  function filteredOrders() {
    var orders = getOrders();
    var kw = state.search.trim().toLowerCase();
    return orders.filter(function (o) {
      if (state.status && o.status !== state.status) return false;
      if (!kw) return true;
      return [o.id, o.name, o.contact, o.game, o.service]
        .join(" ").toLowerCase().indexOf(kw) > -1;
    });
  }

  function renderOrders() {
    var body = $("#orderBody");
    var empty = $("#orderEmpty");
    if (!body) return;
    var list = filteredOrders();

    $("#orderCountText").textContent = "共 " + list.length + " 条";

    if (!list.length) {
      body.innerHTML = "";
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    body.innerHTML = list.map(function (o) {
      var goal = (o.from || o.to) ? esc(o.from || "—") + " → " + esc(o.to || "—") : "—";
      return "<tr>" +
        "<td><b>" + esc(o.id) + "</b></td>" +
        "<td><b>" + esc(o.name) + "</b><br><span style='font-size:12.4px'>" + esc(o.contact) + "</span></td>" +
        "<td>" + esc(o.game) + "<br><span style='font-size:12.4px'>" + esc(o.service) + "</span></td>" +
        "<td>" + goal + "</td>" +
        "<td class='td-price'>" + money(o.amount) + "</td>" +
        "<td style='white-space:nowrap'>" + esc(o.createdAt) + "</td>" +
        "<td>" + statusPill(o.status) + "</td>" +
        "<td style='white-space:nowrap'>" +
        "<button class='btn btn-ghost btn-sm' data-act='view' data-id='" + esc(o.id) + "'>查看</button> " +
        "<button class='btn btn-ghost btn-sm' data-act='del' data-id='" + esc(o.id) + "'>删除</button>" +
        "</td></tr>";
    }).join("");
  }

  function findOrder(id) {
    return getOrders().filter(function (o) { return o.id === id; })[0] || null;
  }

  function updateOrder(id, patch) {
    var list = getOrders();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) list[i][k] = patch[k];
        break;
      }
    }
    setOrders(list);
  }

  function removeOrder(id) {
    var list = getOrders().filter(function (o) { return o.id !== id; });
    setOrders(list);
  }

  /* ---------------- 模态框 ---------------- */
  function openModal(order) {
    state.editingId = order.id;
    $("#modalTitle").textContent = "订单详情 · " + order.id;

    var opt = function (arr, cur) {
      return arr.map(function (v) {
        return '<option value="' + esc(v) + '"' + (v === cur ? " selected" : "") + ">" + esc(v) + "</option>";
      }).join("");
    };

    $("#modalBody").innerHTML =
      '<div class="form-grid">' +
      '<div class="field"><label>客户称呼</label><input type="text" id="m-name" value="' + esc(order.name) + '"></div>' +
      '<div class="field"><label>联系方式</label><input type="text" id="m-contact" value="' + esc(order.contact) + '"></div>' +
      '<div class="field"><label>游戏名称</label><select id="m-game">' + opt(GAMES, order.game) + '</select></div>' +
      '<div class="field"><label>服务类型</label><select id="m-service">' + opt(SERVICES_LIST, order.service) + '</select></div>' +
      '<div class="field"><label>当前段位</label><input type="text" id="m-from" value="' + esc(order.from) + '"></div>' +
      '<div class="field"><label>目标段位</label><input type="text" id="m-to" value="' + esc(order.to) + '"></div>' +
      '<div class="field"><label>订单金额（元）</label><input type="number" id="m-amount" value="' + Number(order.amount || 0) + '" min="0"></div>' +
      '<div class="field"><label>订单状态</label><select id="m-status">' + opt(STATUS_LIST, order.status) + '</select></div>' +
      '<div class="field full"><label>期望完成时间</label><input type="text" id="m-deadline" value="' + esc(order.deadline || "") + '"></div>' +
      '<div class="field full"><label>客户补充说明</label><textarea id="m-note">' + esc(order.note || "") + '</textarea></div>' +
      '</div>' +
      '<p style="color:var(--muted);font-size:12.6px;margin-top:14px">来源：' + esc(order.source || "—") +
      '　提交时间：' + esc(order.createdAt) + '</p>';

    $("#orderModal").classList.add("show");
  }

  function closeModal() {
    $("#orderModal").classList.remove("show");
    state.editingId = null;
  }

  function saveModal() {
    if (!state.editingId) return;
    var id = state.editingId;
    updateOrder(id, {
      name: $("#m-name").value.trim(),
      contact: $("#m-contact").value.trim(),
      game: $("#m-game").value,
      service: $("#m-service").value,
      from: $("#m-from").value.trim(),
      to: $("#m-to").value.trim(),
      amount: Number($("#m-amount").value) || 0,
      status: $("#m-status").value,
      deadline: $("#m-deadline").value.trim(),
      note: $("#m-note").value.trim()
    });
    closeModal();
    renderAll();
    toast("订单 " + id + " 已更新", "ok");
  }

  /* ---------------- 服务管理 ---------------- */
  function renderServices() {
    var body = $("#serviceBody");
    if (!body) return;
    var list = getServices();
    body.innerHTML = list.map(function (s, i) {
      return "<tr>" +
        "<td><b>" + esc(s.name) + "</b></td>" +
        "<td><input type='number' min='0' value='" + Number(s.price) + "' data-svc-price='" + i +
        "' style='width:96px;padding:7px 10px;border-radius:8px;border:1px solid var(--line-strong);background:rgba(0,0,0,.3);color:var(--text)'> 元</td>" +
        "<td>每 " + esc(s.unit) + "</td>" +
        "<td>" + Number(s.orders).toLocaleString("zh-CN") + " 单</td>" +
        "<td><span class='switch'><input type='checkbox' data-svc-on='" + i + "'" +
        (s.online ? " checked" : "") + "><span class='slider'></span></span>" +
        " <span style='font-size:12.6px;color:var(--muted)'>" + (s.online ? "已上架" : "已下架") + "</span></td>" +
        "</tr>";
    }).join("");

    $$("[data-svc-price]").forEach(function (inp) {
      inp.addEventListener("change", function () {
        var idx = Number(inp.getAttribute("data-svc-price"));
        var list = getServices();
        list[idx].price = Number(inp.value) || 0;
        setServices(list);
        toast("「" + list[idx].name + "」起步价已改为 " + list[idx].price + " 元", "ok");
      });
    });

    $$("[data-svc-on]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var idx = Number(cb.getAttribute("data-svc-on"));
        var list = getServices();
        list[idx].online = cb.checked;
        setServices(list);
        renderServices();
        toast("「" + list[idx].name + "」已" + (cb.checked ? "上架" : "下架"), cb.checked ? "ok" : "");
      });
    });
  }

  /* ---------------- 客户留言 ---------------- */
  function renderMessages() {
    var box = $("#messageList");
    var empty = $("#messageEmpty");
    if (!box) return;
    var list = getOrders().filter(function (o) { return (o.note || "").trim(); });

    if (!list.length) {
      box.innerHTML = "";
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";
    box.innerHTML = list.map(function (o) {
      return '<div class="panel" style="margin-bottom:14px">' +
        '<div class="panel-head" style="margin-bottom:12px">' +
        "<h3>" + esc(o.name) + " · " + esc(o.game) + " · " + esc(o.service) + "</h3>" +
        "<span class='panel-sub'>" + esc(o.createdAt) + "　" + statusPill(o.status) + "</span></div>" +
        '<p style="color:var(--muted);font-size:14px">' + esc(o.note) + '</p>' +
        '<p style="color:#6f7c99;font-size:12.6px;margin-top:12px">联系方式：' + esc(o.contact) +
        "　单号：" + esc(o.id) + "</p></div>";
    }).join("");
  }

  /* ---------------- 导出 ---------------- */
  function download(filename, text) {
    var blob = new Blob([text], { type: "application/json;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  /* ---------------- 事件绑定 ---------------- */
  function initActions() {
    // 订单表格操作
    $("#orderBody").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-act]");
      if (!btn) return;
      var id = btn.getAttribute("data-id");
      var act = btn.getAttribute("data-act");
      if (act === "view") {
        var o = findOrder(id);
        if (o) openModal(o);
      } else if (act === "del") {
        if (window.confirm("确定删除订单 " + id + " 吗？该操作仅移除本机演示数据。")) {
          removeOrder(id);
          renderAll();
          toast("订单 " + id + " 已删除", "ok");
        }
      }
    });

    // 搜索 / 筛选
    var search = $("#orderSearch");
    if (search) {
      search.addEventListener("input", function () {
        state.search = search.value;
        renderOrders();
      });
    }
    var sf = $("#orderStatusFilter");
    if (sf) {
      sf.addEventListener("change", function () {
        state.status = sf.value;
        renderOrders();
      });
    }

    // 新建订单
    var nb = $("#newOrderBtn");
    if (nb) {
      nb.addEventListener("click", function () {
        var now = new Date();
        var o = {
          id: "GS" + String(now.getFullYear()).slice(2) + pad(now.getMonth() + 1) + pad(now.getDate()) +
            "-" + Math.floor(1000 + Math.random() * 9000),
          name: "新客户", contact: "", game: "英雄联盟", service: "段位代练",
          from: "", to: "", deadline: "不着急（常规排期）", budget: "未确定",
          note: "", amount: 0, status: "待处理", createdAt: fmtDate(now), source: "后台手动创建"
        };
        var list = getOrders();
        list.unshift(o);
        setOrders(list);
        renderAll();
        openModal(o);
        toast("已创建空白订单，请补充信息", "ok");
      });
    }

    // 导出
    var ex = $("#exportBtn");
    if (ex) {
      ex.addEventListener("click", function () {
        download("gushou-orders.json", JSON.stringify(getOrders(), null, 2));
        toast("订单数据已导出", "ok");
      });
    }
    var sex = $("#settingsExport");
    if (sex) {
      sex.addEventListener("click", function () {
        download("gushou-backup.json", JSON.stringify({
          exportedAt: fmtDate(new Date()),
          orders: getOrders(),
          services: getServices(),
          settings: getSettings()
        }, null, 2));
        toast("全部数据已导出", "ok");
      });
    }
    var scl = $("#settingsClearOrders");
    if (scl) {
      scl.addEventListener("click", function () {
        if (window.confirm("确定清空本机所有订单数据吗？该操作不可恢复（数据仅存在于本机浏览器）。")) {
          setOrders([]);
          renderAll();
          toast("订单数据已清空", "ok");
        }
      });
    }

    // 服务恢复默认
    var rs = $("#resetServicesBtn");
    if (rs) {
      rs.addEventListener("click", function () {
        setServices(DEFAULT_SERVICES.slice());
        renderServices();
        toast("服务配置已恢复默认", "ok");
      });
    }

    // 设置保存（输入即保存）
    var settingFields = [
      ["#st-name", "name"], ["#st-slogan", "slogan"], ["#st-qq", "qq"],
      ["#st-wechat", "wechat"], ["#st-mail", "mail"], ["#st-phone", "phone"]
    ];
    settingFields.forEach(function (pair) {
      var el = $(pair[0]);
      if (!el) return;
      el.addEventListener("change", function () {
        var s = getSettings();
        s[pair[1]] = el.value;
        setSettings(s);
        toast("设置已保存", "ok");
      });
    });

    var swUrgent = $("#sw-urgent"), swAuto = $("#sw-auto"), swMaintain = $("#sw-maintain");
    [[swUrgent, "urgent"], [swAuto, "autoDispatch"], [swMaintain, "maintain"]].forEach(function (p) {
      if (!p[0]) return;
      p[0].addEventListener("change", function () {
        var s = getSettings();
        s[p[1]] = p[0].checked;
        setSettings(s);
        toast("「" + (p[1] === "urgent" ? "加急通道" : p[1] === "autoDispatch" ? "自动派单" : "维护模式") +
          "」已" + (p[0].checked ? "开启" : "关闭"), "ok");
      });
    });

    // 模态框
    $("#modalCancel").addEventListener("click", closeModal);
    $("#modalClose").addEventListener("click", closeModal);
    $("#modalSave").addEventListener("click", saveModal);
    $("#orderModal").addEventListener("click", function (e) {
      if (e.target === $("#orderModal")) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
    });

    // 刷新 / 退出
    $("#refreshBtn").addEventListener("click", function () {
      renderAll();
      toast("数据已刷新", "ok");
    });
    $("#logoutBtn").addEventListener("click", logout);
  }

  /* ---------------- 入口 ---------------- */
  document.addEventListener("DOMContentLoaded", initLogin);
})();
