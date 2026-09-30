/* =========================================================
   顾手游电竞 游戏代练业务站 - 前台公共交互脚本
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 移动端导航 ---------- */
  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var links = document.querySelector(".nav-links");
    if (!toggle || !links) return;
    toggle.addEventListener("click", function () {
      links.classList.toggle("open");
    });
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A") links.classList.remove("open");
    });
  }

  /* ---------- 返回顶部 ---------- */
  function initToTop() {
    var btn = document.querySelector(".to-top");
    if (!btn) return;
    window.addEventListener("scroll", function () {
      btn.classList.toggle("show", window.scrollY > 400);
    });
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---------- FAQ 折叠 ----------
     用事件委托绑定：线上已发布数据异步加载后会重新渲染列表，委托绑定不受影响 */
  function initFaq() {
    document.addEventListener("click", function (e) {
      var q = e.target && e.target.closest ? e.target.closest(".faq-q") : null;
      if (!q) return;
      var item = q.closest(".faq-item");
      if (item) item.classList.toggle("open");
    });
  }

  /* ---------- 通用标签切换 [data-tabs]（事件委托） ---------- */
  function initTabs() {
    document.addEventListener("click", function (e) {
      var tab = e.target && e.target.closest ? e.target.closest(".tab") : null;
      if (!tab || !tab.getAttribute || !tab.getAttribute("data-tab")) return;
      var root = tab.closest("[data-tabs]");
      if (!root) return;
      var tabs = root.querySelectorAll(".tab");
      var panels = root.querySelectorAll(".tab-panel");
      tabs.forEach(function (t) { t.classList.toggle("active", t === tab); });
      panels.forEach(function (p) {
        p.classList.toggle("active", p.getAttribute("data-panel") === tab.getAttribute("data-tab"));
      });
    });
  }

  /* ---------- Toast 提示 ---------- */
  function toast(msg, type) {
    var wrap = document.querySelector(".toast-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "toast-wrap";
      document.body.appendChild(wrap);
    }
    var el = document.createElement("div");
    el.className = "toast" + (type === "ok" ? " ok" : type === "err" ? " err" : "");
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity .3s, transform .3s";
      el.style.opacity = "0";
      el.style.transform = "translateX(18px)";
      setTimeout(function () { el.remove(); }, 320);
    }, 2600);
  }
  window.GB_toast = toast;

  /* ---------- 复制到剪贴板（事件委托） ---------- */
  function initCopy() {
    document.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("[data-copy]") : null;
      if (!btn) return;
      var text = btn.getAttribute("data-copy");
      var done = function () { toast("已复制：" + text, "ok"); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
      } else {
        fallbackCopy(text, done);
      }
    });
  }

  function fallbackCopy(text, cb) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); cb(); } catch (e) { toast("复制失败，请手动复制", "err"); }
    ta.remove();
  }

  /* ---------- 滚动淡入 ---------- */
  function initReveal() {
    if (!("IntersectionObserver" in window)) return;
    var els = document.querySelectorAll(".reveal");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.style.animation = "fadeUp .6s ease both";
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initToTop();
    initFaq();
    initTabs();
    initCopy();
    initReveal();
  });
})();
