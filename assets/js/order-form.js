/* =========================================================
   顾手游电竞 - 前台需求表单逻辑（本地演示：写入 localStorage）
   ========================================================= */
(function () {
  "use strict";

  var STORE_KEY = "gb_orders";

  function getOrders() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveOrders(list) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
  }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function nowStr() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function genId() {
    var d = new Date();
    return "GS" + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) +
      "-" + Math.floor(1000 + Math.random() * 9000);
  }

  /* 按服务类型给出参考价（演示用） */
  var PRICE_MAP = {
    "段位代练": 268,
    "排位上分": 158,
    "定级赛": 198,
    "双排陪玩": 180,
    "账号托管": 210,
    "活动代肝": 120
  };

  function initForm() {
    var form = document.getElementById("orderForm");
    if (!form) return;

    var okBox = document.getElementById("formSuccess");
    var errBox = document.getElementById("formError");

    function showBox(box, msg) {
      okBox.classList.remove("show");
      errBox.classList.remove("show");
      box.textContent = msg;
      box.classList.add("show");
      box.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function mark(field, bad) {
      var wrap = field.closest(".field");
      if (wrap) wrap.classList.toggle("invalid", bad);
      return bad;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var name = form.querySelector("#f-name");
      var contact = form.querySelector("#f-contact");
      var game = form.querySelector("#f-game");
      var service = form.querySelector("#f-service");

      var bad = false;
      bad = mark(name, !name.value.trim()) || bad;
      bad = mark(contact, !contact.value.trim()) || bad;
      bad = mark(game, !game.value) || bad;
      bad = mark(service, !service.value) || bad;

      if (bad) {
        showBox(errBox, "请先补全带 * 的必填项后再提交。");
        return;
      }

      var order = {
        id: genId(),
        name: name.value.trim(),
        contact: contact.value.trim(),
        game: game.value,
        service: service.value,
        from: (form.querySelector("#f-from").value || "").trim(),
        to: (form.querySelector("#f-to").value || "").trim(),
        deadline: form.querySelector("#f-deadline").value,
        budget: form.querySelector("#f-budget").value,
        note: (form.querySelector("#f-note").value || "").trim(),
        amount: PRICE_MAP[service.value] || 0,
        status: "待处理",
        createdAt: nowStr(),
        source: "官网联系页"
      };

      var list = getOrders();
      list.unshift(order);

      if (saveOrders(list)) {
        showBox(okBox, "提交成功！需求单号 " + order.id + "，客服将在 18 分钟内联系你。可在「管理后台」查看该订单。");
        if (window.GB_toast) window.GB_toast("需求已提交，单号 " + order.id, "ok");
        form.reset();
        document.querySelectorAll("#orderForm .field.invalid").forEach(function (f) {
          f.classList.remove("invalid");
        });
      } else {
        showBox(errBox, "本地存储不可用（可能处于隐私模式），需求未能保存，请直接联系客服。");
      }
    });

    form.addEventListener("reset", function () {
      okBox.classList.remove("show");
      errBox.classList.remove("show");
      document.querySelectorAll("#orderForm .field.invalid").forEach(function (f) {
        f.classList.remove("invalid");
      });
    });

    ["#f-name", "#f-contact", "#f-game", "#f-service"].forEach(function (sel) {
      var el = form.querySelector(sel);
      if (!el) return;
      el.addEventListener("input", function () { mark(el, false); });
      el.addEventListener("change", function () { mark(el, false); });
    });
  }

  document.addEventListener("DOMContentLoaded", initForm);
})();
