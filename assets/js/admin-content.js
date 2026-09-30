/* =========================================================
   顾手游电竞 管理后台 -「内容管理」编辑器
   ---------------------------------------------------------
   依赖：site-data.js（window.GBSite）
   数据：与前台共用同一份 localStorage 数据（键名 gb_site_v1）
   保存后前台页面刷新即生效。
   ========================================================= */
(function () {
  "use strict";

  var S = window.GBSite;
  if (!S) return;

  var K_LEGACY_SERVICES = "gb_services";
  var K_LEGACY_SETTINGS = "gb_settings";
  var K_MIGRATED = "gb_site_migrated_v1";

  /* ---------------- 选项 ---------------- */
  var TONE_OPTIONS = [
    { v: "ok", t: "可接单（绿色）" },
    { v: "hot", t: "需预约（橙色）" },
    { v: "warn", t: "名额紧张（黄色）" },
    { v: "info", t: "按需报价（蓝色）" },
    { v: "mute", t: "已停止（灰色）" }
  ];
  var COPY_OPTIONS = [
    { v: "true", t: "显示「复制」按钮" },
    { v: "false", t: "不显示" }
  ];

  function f(k, l, t, o) { return { k: k, l: l, t: t || "text", o: o || null }; }
  function area(k, l) { return f(k, l, "area"); }

  /* ---------------- 内容结构定义 ---------------- */
  var SCHEMA = [
    {
      id: "brand", icon: "🏷️", title: "品牌信息与页脚",
      hint: "站点名称、副标题、标语与页脚文案，所有前台页面共用。",
      fields: [
        f("brand.name", "站点名称", "text"),
        f("brand.short", "站点副标题", "text"),
        f("brand.slogan", "站点标语", "text"),
        area("brand.footerDesc", "页脚简介"),
        f("footer.copyright", "页脚版权信息", "text"),
        f("footer.tip", "页脚提示语", "text"),
        f("footer.services", "页脚「热门服务」列表（每行一项）", "lines"),
        f("footer.contactLines", "页脚「联系方式」列表（每行一项）", "lines")
      ],
      lists: [
        { path: "footer.nav", label: "页脚导航链接", itemFields: [f("text", "链接文字"), f("href", "跳转地址")] }
      ]
    },
    {
      id: "hero", icon: "🚀", title: "首页 · 首屏大图区",
      hint: "首页最上方的标题、简介、按钮文字与数据条。",
      fields: [
        f("hero.eyebrow", "顶部小标题", "text"),
        f("hero.titleHtml", "主标题（支持 HTML）", "html"),
        area("hero.lead", "副标题 / 简介"),
        f("hero.primaryText", "主按钮文字", "text"),
        f("hero.secondaryText", "次按钮文字", "text"),
        f("hero.boardTitle", "进度看板标题", "text"),
        f("hero.boardLive", "进度看板角标文字", "text")
      ],
      lists: [
        { path: "hero.stats", label: "数据条", itemFields: [f("value", "数值"), f("label", "说明")] },
        { path: "hero.board", label: "进度看板条目", itemFields: [f("badge", "段位标签"), f("title", "标题"), f("sub", "副标题"), f("value", "进度值")] }
      ]
    },
    {
      id: "industry", icon: "🏭", title: "首页 · 产业介绍",
      hint: "首页「游戏代练产业」区块：需求端、供给端、商业模式等卡片。",
      fields: [
        f("industry.eyebrow", "顶部小标题", "text"),
        f("industry.titleHtml", "区块标题（支持 HTML）", "html"),
        area("industry.desc", "区块简介")
      ],
      lists: [
        { path: "industry.cards", label: "产业介绍卡片", itemFields: [f("icon", "图标"), f("num", "编号标签"), f("title", "标题"), area("text", "正文")] }
      ]
    },
    {
      id: "metrics", icon: "📊", title: "首页 · 平台数据",
      hint: "首页「平台服务数据」里的数值卡片。",
      lists: [
        { path: "metrics", label: "数据卡片", itemFields: [f("value", "数值"), f("label", "说明")] }
      ]
    },
    {
      id: "advantages", icon: "🛡️", title: "首页 · 核心优势",
      hint: "首页「为什么选择我们」四项保障。",
      fields: [
        f("advantages.eyebrow", "顶部小标题", "text"),
        f("advantages.titleHtml", "区块标题（支持 HTML）", "html"),
        area("advantages.desc", "区块简介")
      ],
      lists: [
        { path: "advantages.items", label: "优势条目", itemFields: [f("icon", "图标"), f("title", "标题"), area("text", "正文")] }
      ]
    },
    {
      id: "steps", icon: "🧭", title: "首页 · 服务流程",
      hint: "首页「四步完成一单」的流程步骤。",
      fields: [
        f("steps.eyebrow", "顶部小标题", "text"),
        f("steps.title", "区块标题", "text"),
        area("steps.desc", "区块简介")
      ],
      lists: [
        { path: "steps.items", label: "流程步骤", itemFields: [f("title", "步骤名"), area("text", "说明")] }
      ]
    },
    {
      id: "cta", icon: "📣", title: "首页与服务页 · 行动号召条",
      hint: "页面底部的引导条标题与按钮文字。",
      fields: [
        f("cta.home.title", "首页 · 标题", "text"),
        area("cta.home.desc", "首页 · 说明"),
        f("cta.home.primaryText", "首页 · 主按钮", "text"),
        f("cta.home.secondaryText", "首页 · 次按钮", "text"),
        f("cta.services.title", "服务页 · 标题", "text"),
        area("cta.services.desc", "服务页 · 说明"),
        f("cta.services.primaryText", "服务页 · 按钮", "text")
      ]
    },
    {
      id: "servicesMeta", icon: "🗂️", title: "服务页 · 页头与区块文案",
      hint: "服务项目页顶部的标题与说明文字。",
      fields: [
        f("servicesPage.eyebrow", "页头小标题", "text"),
        f("servicesPage.title", "页头标题", "text"),
        area("servicesPage.desc", "页头说明"),
        f("servicesIntro.eyebrow", "区块小标题", "text"),
        f("servicesIntro.title", "区块标题", "text"),
        area("servicesIntro.desc", "区块说明")
      ]
    },
    {
      id: "servicesItems", icon: "🎮", title: "服务项目与价格",
      hint: "前台服务卡片（首页价目入口、服务页六大服务）。关闭「是否上架」后该服务不再展示，联系页的下拉选项也会同步移除。",
      lists: [
        {
          path: "services.items", label: "服务项目",
          itemFields: [
            f("online", "是否上架", "bool"),
            f("icon", "图标", "text"),
            f("tag", "角标（可留空）", "text"),
            f("name", "服务名称", "text"),
            f("price", "价格（例：¥ 68）", "text"),
            f("unit", "计价单位（例：起 / 小段）", "text"),
            area("desc", "服务说明"),
            f("features", "服务要点（每行一条）", "lines")
          ]
        }
      ]
    },
    {
      id: "pricing", icon: "💰", title: "服务页 · 分游戏价目表",
      hint: "价目表按「游戏」字段自动分组生成标签页，同一游戏的多行会归到同一个标签。",
      fields: [
        f("pricing.eyebrow", "区块小标题", "text"),
        f("pricing.title", "区块标题", "text"),
        area("pricing.desc", "区块说明"),
        area("pricing.note", "表格下方注释")
      ],
      lists: [
        {
          path: "pricing.rows", label: "价目表行", titleKey: ["game", "range"],
          itemFields: [
            f("game", "游戏", "text"),
            f("service", "服务项目", "text"),
            f("range", "段位区间", "text"),
            f("price", "参考单价", "text"),
            f("hours", "预计工时", "text"),
            f("status", "状态文字", "text"),
            f("tone", "状态颜色", "select", { opts: TONE_OPTIONS })
          ]
        }
      ]
    },
    {
      id: "guarantee", icon: "📜", title: "服务页 · 保障条款与常见问题",
      hint: "保障条款正文支持换行；常见问题两组分别对应服务页与联系页。",
      fields: [
        f("guarantee.eyebrow", "保障区小标题", "text"),
        f("guarantee.title", "保障区标题", "text"),
        area("guarantee.desc", "保障区说明")
      ],
      lists: [
        { path: "guarantee.items", label: "保障条款", itemFields: [f("title", "条款标题"), area("text", "条款正文（可换行）")] },
        { path: "faq.services", label: "服务页 · 常见问题", itemFields: [f("q", "问题"), area("a", "回答")] },
        { path: "faq.contact", label: "联系页 · 常见问题", itemFields: [f("q", "问题"), area("a", "回答")] }
      ]
    },
    {
      id: "contactPage", icon: "☎️", title: "联系页 · 页头与表单文案",
      hint: "联系页顶部标题、表单区域与问题区文案。",
      fields: [
        f("contactPage.eyebrow", "页头小标题", "text"),
        f("contactPage.title", "页头标题", "text"),
        area("contactPage.desc", "页头说明"),
        f("contact.formTitle", "表单标题", "text"),
        area("contact.formDesc", "表单说明"),
        area("contact.formNote", "表单下方提示"),
        f("contact.faqEyebrow", "问题区小标题", "text"),
        f("contact.faqTitle", "问题区标题", "text")
      ]
    },
    {
      id: "contactInfo", icon: "💬", title: "联系方式与咨询渠道",
      hint: "这里的「客服 QQ / 微信 / 邮箱 / 热线」是联系页展示的账号信息；页脚里重复出现的那一份在「品牌信息与页脚」分组中单独维护。",
      fields: [
        f("contact.title", "联系方式区块标题", "text"),
        area("contact.desc", "联系方式区块说明"),
        f("contact.qrTitle", "二维码卡片标题", "text"),
        f("contact.qrDesc", "二维码卡片说明", "text"),
        area("contact.qrNote", "二维码占位文字"),
        f("contact.channelsEyebrow", "渠道区小标题", "text"),
        f("contact.channelsTitle", "渠道区标题", "text"),
        area("contact.channelsDesc", "渠道区说明")
      ],
      lists: [
        {
          path: "contact.items", label: "联系方式条目",
          itemFields: [
            f("icon", "图标", "text"),
            f("label", "名称（例：客服 QQ）", "text"),
            f("value", "账号 / 内容", "text"),
            f("note", "补充说明", "text"),
            f("copy", "复制按钮", "select", { opts: COPY_OPTIONS, cast: "bool" })
          ]
        },
        {
          path: "contact.channels", label: "其他沟通渠道",
          itemFields: [f("icon", "图标"), f("title", "标题"), area("text", "正文")]
        }
      ]
    }
  ];

  /* ---------------- 样式 ---------------- */
  var STYLE = [
    ".ct-group{padding:0;overflow:hidden;margin-bottom:16px}",
    ".ct-summary{display:flex;align-items:center;gap:10px;padding:16px 20px;cursor:pointer;list-style:none;font-size:15.5px;font-weight:700}",
    ".ct-summary::-webkit-details-marker{display:none}",
    ".ct-summary .ct-ic{font-size:17px}",
    ".ct-summary .ct-sub{margin-left:auto;font-size:12.6px;font-weight:400;color:var(--muted);max-width:58%;text-align:right}",
    ".ct-summary::after{content:'▾';color:var(--muted);font-size:13px;transition:transform .2s}",
    ".ct-group[open] .ct-summary::after{transform:rotate(180deg)}",
    ".ct-body{padding:2px 20px 20px;border-top:1px solid var(--line-strong)}",
    ".ct-item{border:1px solid var(--line-strong);border-radius:12px;padding:14px 16px;margin-bottom:14px;background:rgba(255,255,255,.02)}",
    ".ct-item-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}",
    ".ct-item-head b{font-size:13.6px}",
    ".ct-del{background:transparent;border:1px solid var(--line-strong);color:var(--muted);border-radius:8px;padding:3px 10px;font-size:12.4px;cursor:pointer}",
    ".ct-del:hover{border-color:#ff6b6b;color:#ff8a8a}",
    ".ct-status{font-size:12.8px;color:var(--muted)}",
    ".ct-status.dirty{color:#ffcf6b}",
    ".ct-links a{font-size:13px;color:inherit;text-decoration:underline;margin-right:14px}",
    ".ct-notice{font-size:13px;line-height:1.75;border-left:3px solid var(--line-strong);padding:10px 14px;border-radius:8px;background:rgba(255,255,255,.03);margin-bottom:14px;color:var(--muted)}",
    ".ct-notice.warn{border-left-color:#ffcf6b;color:#ffd98a}",
    ".ct-toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center}",
    ".ct-empty{color:var(--muted);font-size:13.2px;padding:6px 0 12px}"
  ].join("\n");

  /* ---------------- 运行时状态 ---------------- */
  var draft = null;
  var dirty = false;
  var root = null;
  var LIST_DEFS = {};

  function buildListIndex() {
    SCHEMA.forEach(function (g) {
      (g.lists || []).forEach(function (L) { LIST_DEFS[L.path] = L; });
    });
  }

  /* ---------------- HTML 构造 ---------------- */
  function attr(path, type, cast) {
    return ' data-path="' + S.esc(path) + '" data-type="' + S.esc(type) + '"' + (cast ? ' data-cast="' + S.esc(cast) + '"' : "");
  }

  function controlHTML(path, o, val, type, cast) {
    if (type === "bool") {
      return '<span class="switch"><input type="checkbox"' + attr(path, "bool") + (val ? " checked" : "") +
        '><span class="slider"></span></span>';
    }
    if (type === "select") {
      var opts = (o.o && o.o.opts) || [];
      return "<select" + attr(path, "select", cast) + ">" + opts.map(function (op) {
        return '<option value="' + S.esc(op.v) + '"' + (String(val) === String(op.v) ? " selected" : "") +
          ">" + S.esc(op.t) + "</option>";
      }).join("") + "</select>";
    }
    if (type === "area" || type === "html" || type === "lines") {
      var rows = type === "html" ? 4 : (type === "lines" ? 4 : 3);
      return "<textarea rows=\"" + rows + "\"" + attr(path, type) + ">" + S.esc(val) + "</textarea>";
    }
    return '<input type="text"' + attr(path, "text") + ' value="' + S.esc(val) + '">';
  }

  function fieldHTML(o, path) {
    var type = o.t || "text";
    var val = S.getPath(draft, path);
    if (type === "lines") val = Array.isArray(val) ? val.join("\n") : (val || "");
    if (type === "bool") val = val !== false;
    var full = (type === "area" || type === "html" || type === "lines" || type === "bool");
    return '<div class="field' + (full ? " full" : "") + '"><label>' + S.esc(o.l) + "</label>" +
      controlHTML(path, o, val, type, o.o && o.o.cast) + "</div>";
  }

  var SKIP_KEYS = { icon: 1, copy: 1, online: 1, tone: 1, tag: 1, href: 1, badge: 1, num: 1, hours: 1, status: 1 };

  function itemTitle(def, it, idx) {
    var i, v;
    if (def.titleKey) {
      var tk = Array.isArray(def.titleKey) ? def.titleKey : [def.titleKey];
      var parts = [];
      tk.forEach(function (k) {
        var x = it ? it[k] : "";
        if (x && typeof x !== "object") parts.push(String(x));
      });
      if (parts.length) return (idx + 1) + " · " + parts.join(" · ");
    }
    var order = ["name", "label", "title", "q", "text", "value"];
    for (i = 0; i < order.length; i++) {
      v = it ? it[order[i]] : "";
      if (v && typeof v !== "object") return (idx + 1) + " · " + String(v);
    }
    if (it && typeof it === "object") {
      for (var k in it) {
        if (!Object.prototype.hasOwnProperty.call(it, k) || SKIP_KEYS[k]) continue;
        v = it[k];
        if (v && typeof v !== "object") return (idx + 1) + " · " + String(v);
      }
    }
    return (idx + 1) + " · 未命名条目";
  }

  function listHTML(def) {
    var arr = S.getPath(draft, def.path) || [];
    var holder = '<div class="ct-list" data-holder="' + S.esc(def.path) + '" data-label="' + S.esc(def.label) + '">';
    arr.forEach(function (it, i) {
      holder += '<div class="ct-item"><div class="ct-item-head"><b>' + S.esc(itemTitle(def, it, i)) + "</b>" +
        '<button type="button" class="ct-del" data-list="' + S.esc(def.path) + '" data-idx="' + i + '">删除此项</button></div>' +
        '<div class="form-grid">';
      (def.itemFields || []).forEach(function (o) {
        holder += fieldHTML(o, def.path + "." + i + "." + o.k);
      });
      holder += "</div></div>";
    });
    if (!arr.length) holder += '<div class="ct-empty">当前没有任何条目，点击下方按钮新增。</div>';
    holder += '<button type="button" class="btn btn-ghost btn-sm ct-add" data-list="' + S.esc(def.path) + '">+ 新增一项</button></div>';
    return '<div class="ct-block" data-block="' + S.esc(def.path) + '" style="margin-top:18px">' +
      '<h4 style="font-size:14.4px;margin-bottom:10px">' + S.esc(def.label) + "（共 " +
      '<span data-count="' + S.esc(def.path) + '">' + arr.length + "</span> 项）</h4>" + holder + "</div>";
  }

  function groupHTML(g) {
    var body = "";
    if (g.fields && g.fields.length) {
      body += '<div class="form-grid">' + g.fields.map(function (o) { return fieldHTML(o, o.k); }).join("") + "</div>";
    }
    (g.lists || []).forEach(function (L) { body += listHTML(L); });
    return '<details class="panel ct-group" data-group="' + S.esc(g.id) + '" open>' +
      '<summary class="ct-summary"><span class="ct-ic">' + g.icon + "</span><b>" + S.esc(g.title) + "</b>" +
      '<span class="ct-sub">' + S.esc(g.hint || "") + "</span></summary>" +
      '<div class="ct-body">' + body + "</div></details>";
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    if (!root) return;
    root.innerHTML = SCHEMA.map(groupHTML).join("");
  }

  function refreshList(path) {
    var def = LIST_DEFS[path];
    if (!def || !root) return;
    var target = null;
    root.querySelectorAll("[data-block]").forEach(function (el) {
      if (el.getAttribute("data-block") === path) target = el;
    });
    if (!target) return;
    var wrap = document.createElement("div");
    wrap.innerHTML = listHTML(def);
    target.parentNode.replaceChild(wrap.firstChild, target);
  }

  /* ---------------- 取值 / 赋值 ---------------- */
  function setVal(path, val, type, cast) {
    if (type === "bool") val = !!val;
    if (type === "lines") {
      val = String(val == null ? "" : val).split("\n").map(function (s) { return s.trim(); })
        .filter(function (s) { return s.length > 0; });
    }
    if (cast === "bool") val = (String(val) === "true");
    S.setPath(draft, path, val);
  }

  function markDirty() {
    dirty = true;
    updateStatus();
  }

  function updateStatus() {
    var box = document.getElementById("ctStatus");
    if (!box) return;
    var notice = document.getElementById("ctNotice");
    if (dirty) {
      box.className = "ct-status dirty";
      box.textContent = "● 有未保存的修改，点击右上角「保存并生效」后前台才会更新。";
      if (notice) { notice.className = "ct-notice warn"; notice.textContent = "你有未保存的内容修改，请点击「保存并生效」。"; }
    } else {
      box.className = "ct-status";
      box.textContent = "○ 当前内容已保存：前台页面刷新（F5）即可看到效果。";
      if (notice) {
        notice.className = "ct-notice";
        notice.textContent = "本页修改保存在本机浏览器，与前台页面共用同一份数据；保存后到前台刷新即可看到效果。";
      }
    }
  }

  /* ---------------- 事件 ---------------- */
  function onInput(e) {
    var t = e.target;
    var path = t.getAttribute && t.getAttribute("data-path");
    if (!path) return;
    var type = t.getAttribute("data-type");
    var cast = t.getAttribute("data-cast");
    var raw = (type === "bool") ? t.checked : t.value;
    setVal(path, raw, type, cast);
    markDirty();

    if (type === "text" || type === "select") {
      // 同步列表条目标题与条数
      var holder = t.closest ? t.closest(".ct-list") : null;
      var listPath = holder ? holder.getAttribute("data-holder") : null;
      var item = t.closest ? t.closest(".ct-item") : null;
      if (listPath && item) {
        var segs = path.split(".");
        var idx = Number(segs[segs.length - 2]);
        var def = LIST_DEFS[listPath];
        var arr = S.getPath(draft, listPath);
        var label = item.querySelector("b");
        if (def && Array.isArray(arr) && arr[idx] && label) {
          label.textContent = itemTitle(def, arr[idx], idx);
        }
      }
      refreshCounts();
    }
  }

  function refreshCounts() {
    root.querySelectorAll("[data-count]").forEach(function (el) {
      var arr = S.getPath(draft, el.getAttribute("data-count"));
      el.textContent = Array.isArray(arr) ? arr.length : 0;
    });
  }

  function onClick(e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;

    /* 让「开关」的滑块可点击（本编辑器内的 switch 依赖脚本切换） */
    if (t.classList && t.classList.contains("slider") && t.parentNode) {
      var cb = t.parentNode.querySelector('input[type="checkbox"]');
      if (cb && cb.getAttribute("data-path")) {
        cb.checked = !cb.checked;
        setVal(cb.getAttribute("data-path"), cb.checked, "bool");
        markDirty();
        return;
      }
    }

    if (t.classList && t.classList.contains("ct-del")) {
      var path = t.getAttribute("data-list");
      var idx = Number(t.getAttribute("data-idx"));
      var arr = S.getPath(draft, path);
      if (!Array.isArray(arr)) return;
      var name = arr[idx] && arr[idx].name ? "「" + arr[idx].name + "」" : "第 " + (idx + 1) + " 项";
      if (!window.confirm("确定要删除 " + name + " 吗？删除后点击「保存并生效」时正式写入；不保存则刷新页面即可还原。")) return;
      arr.splice(idx, 1);
      S.setPath(draft, path, arr);
      markDirty();
      refreshList(path);
      return;
    }

    if (t.classList && t.classList.contains("ct-add")) {
      var p2 = t.getAttribute("data-list");
      var list = S.getPath(draft, p2) || [];
      var def = LIST_DEFS[p2];
      var proto = S.getPath(S.DEFAULTS, p2) || [];
      var sample = proto.length ? S.clone(proto[0]) : {};
      list.push(sample);
      S.setPath(draft, p2, list);
      markDirty();
      refreshList(p2);
      return;
    }
  }

  /* ---------------- 保存 / 恢复 / 导出 ---------------- */
  function toast(msg, type) {
    var wrap = document.querySelector(".toast-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "toast-wrap";
      document.body.appendChild(wrap);
    }
    var el2 = document.createElement("div");
    el2.className = "toast" + (type === "ok" ? " ok" : type === "err" ? " err" : "");
    el2.textContent = msg;
    wrap.appendChild(el2);
    setTimeout(function () {
      el2.style.transition = "opacity .3s, transform .3s";
      el2.style.opacity = "0";
      el2.style.transform = "translateX(18px)";
      setTimeout(function () { el2.remove(); }, 320);
    }, 2800);
  }

  function doSave() {
    if (!draft) return;
    if (S.save(draft)) {
      dirty = false;
      draft = S.get();
      updateStatus();
      toast("内容已保存，前台页面刷新后立即生效", "ok");
    } else {
      toast("保存失败：当前浏览器禁用了本地存储", "err");
    }
  }

  function doReset() {
    if (!window.confirm("确定要恢复默认内容吗？你在「内容管理」中保存过的所有修改都会被清除，前台将回到初始示例文案。此操作不可撤销。")) return;
    S.reset();
    draft = S.get();
    dirty = false;
    render();
    updateStatus();
    toast("已恢复默认内容", "ok");
  }

  function doExport() {
    var text = JSON.stringify(S.get(), null, 2);
    var blob = new Blob([text], { type: "application/json;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "gushou-site-content.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    toast("已导出当前站点内容 JSON", "ok");
  }

  /* ---------------- 旧版数据同步（gb_services / gb_settings） ---------------- */
  var ALIAS = { "活动代肝": "代肝" };

  function keyOf(s) {
    var k = String(s == null ? "" : s).replace(/[\s\/·、]/g, "");
    return ALIAS[k] || k;
  }

  function readJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function itemVal(data, label) {
    var arr = (data.contact && data.contact.items) || [];
    for (var i = 0; i < arr.length; i++) if (arr[i].label === label) return arr[i].value;
    return "";
  }

  /* 旧版站点设置里的品牌字串可能残留旧品牌（如「顾手游电竞GameBoost 极速代练」）：
     先按站点统一的品牌迁移词典清洗，并消掉重复的品牌名，避免旧品牌回流到前台 */
  function cleanBrandText(v) {
    var s = String(v == null ? "" : v);
    if (window.GBSite && typeof GBSite.brandText === "function") s = GBSite.brandText(s);
    return s.replace(/(顾手游电竞)+/g, "顾手游电竞").trim();
  }

  /* 清洗旧键 gb_settings（旧版「站点设置」）里的品牌字串，改脏了就写回，避免旧品牌再次被同步进站点内容 */
  function cleanLegacySettings() {
    var st = readJSON(K_LEGACY_SETTINGS);
    if (!st || typeof st !== "object") return st;
    var nameFixed = st.name ? cleanBrandText(st.name) : "";
    var sloganFixed = st.slogan ? cleanBrandText(st.slogan) : "";
    var dirty = (nameFixed && nameFixed !== String(st.name).trim()) ||
      (sloganFixed && sloganFixed !== String(st.slogan).trim());
    if (!dirty) return st;
    var out = {};
    for (var k in st) if (Object.prototype.hasOwnProperty.call(st, k)) out[k] = st[k];
    out.name = nameFixed || st.name;
    out.slogan = sloganFixed || st.slogan;
    try { localStorage.setItem(K_LEGACY_SETTINGS, JSON.stringify(out)); } catch (e) { /* 忽略 */ }
    return out;
  }

  function applyLegacy(silent) {
    var sv = readJSON(K_LEGACY_SERVICES);
    var st = cleanLegacySettings();
    if (!sv && !st) return false;

    var data = S.get();
    var changed = false;
    var contactChanged = false;

    if (Array.isArray(sv) && data.services && data.services.items) {
      data.services.items.forEach(function (item) {
        var hit = null;
        for (var i = 0; i < sv.length; i++) {
          var L = sv[i];
          if (!L || !L.name) continue;
          var a = keyOf(item.name), b = keyOf(L.name);
          if (a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0) { hit = L; break; }
        }
        if (!hit) return;
        var price = "¥ " + (Number(hit.price) || 0);
        if (item.price !== price) { item.price = price; changed = true; }
        if (hit.unit) {
          var unit = "起 / " + hit.unit;
          if (item.unit !== unit) { item.unit = unit; changed = true; }
        }
        var online = hit.online !== false;
        if (item.online !== online) { item.online = online; changed = true; }
      });
    }

    if (st && typeof st === "object") {
      if (st.name) {
        var nm = String(st.name).trim();
        var sp = nm.indexOf(" ");
        var main = sp > 0 ? nm.slice(0, sp) : nm;
        var sub = sp > 0 ? nm.slice(sp + 1).trim() : "";
        if (main && data.brand.name !== main) { data.brand.name = main; changed = true; }
        if (sub && data.brand.short !== sub) { data.brand.short = sub; changed = true; }
      }
      if (st.slogan && data.brand.slogan !== st.slogan) { data.brand.slogan = st.slogan; changed = true; }

      [["客服 QQ", st.qq], ["客服微信", st.wechat], ["商务邮箱", st.mail], ["客服热线", st.phone]]
        .forEach(function (pair) {
          if (!pair[1]) return;
          (data.contact.items || []).forEach(function (it) {
            if (it.label === pair[0] && it.value !== pair[1]) { it.value = pair[1]; changed = true; contactChanged = true; }
          });
        });

      if (contactChanged) {
        var lines = [];
        var qq = itemVal(data, "客服 QQ"), wx = itemVal(data, "客服微信");
        var ml = itemVal(data, "商务邮箱"), ph = itemVal(data, "客服热线");
        if (qq) lines.push("客服QQ：" + qq);
        if (wx) lines.push("微信：" + wx);
        if (ml) lines.push("邮箱：" + ml);
        if (ph) lines.push("服务热线：" + ph);
        lines.push("服务时间：7×24 小时");
        data.footer.contactLines = lines;
      }
    }

    if (changed) S.save(data);
    if (changed && !silent) {
      draft = S.get();
      render();
      updateStatus();
    }
    return changed;
  }

  function migrateOnce() {
    try {
      cleanLegacySettings(); /* 先清洗旧键里的旧品牌字串 */
      if (localStorage.getItem(K_MIGRATED) === "1") return;
      if (S.isCustomized()) { localStorage.setItem(K_MIGRATED, "1"); return; }
      applyLegacy(true);
      localStorage.setItem(K_MIGRATED, "1");
    } catch (e) { /* 忽略：本地存储不可用时不影响编辑器使用 */ }
  }

  function legacySig() {
    return (localStorage.getItem(K_LEGACY_SERVICES) || "") + "||" + (localStorage.getItem(K_LEGACY_SETTINGS) || "");
  }

  var lastSig = null;
  function tickLegacy() {
    var sig = legacySig();
    if (lastSig === null) { lastSig = sig; return; }
    if (sig === lastSig) return;
    if (dirty) return;
    lastSig = sig;
    if (applyLegacy(false)) toast("已同步「服务管理 / 站点设置」中的修改到前台内容", "ok");
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    root = document.getElementById("ctRoot");
    if (!root) return;

    var style = document.createElement("style");
    style.textContent = STYLE;
    document.head.appendChild(style);

    buildListIndex();
    migrateOnce();

    draft = S.get();
    render();
    updateStatus();

    root.addEventListener("input", onInput);
    root.addEventListener("change", onInput);
    root.addEventListener("click", onClick);

    var save = document.getElementById("ctSave");
    if (save) save.addEventListener("click", doSave);
    var reset = document.getElementById("ctReset");
    if (reset) reset.addEventListener("click", doReset);
    var exp = document.getElementById("ctExport");
    if (exp) exp.addEventListener("click", doExport);

    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        var page = document.querySelector('.admin-page[data-page="content"]');
        if (page && page.classList.contains("active")) { e.preventDefault(); doSave(); }
      }
    });
    window.addEventListener("beforeunload", function (e) {
      if (!dirty) return "";
      e.preventDefault();
      e.returnValue = "";
      return "";
    });

    setInterval(tickLegacy, 1500);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
