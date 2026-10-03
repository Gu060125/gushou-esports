/* =========================================================
   顾手游电竞 · 聊天室（一对一 / 群聊 / 实时消息 / 图片压缩发送）
   依赖：assets/js/supabase-config.js、assets/js/account.js、assets/js/main.js（toast）
   页面：chat.html
   ========================================================= */
(function () {
  "use strict";

  var GB = window.GB_SUPABASE;
  var AUTH = window.GB_AUTH;

  var $ = function (s) { return document.querySelector(s); };

  var state = {
    sb: null,
    me: null,
    convs: [],
    activeId: null,
    messages: [],
    profiles: {},        // userId -> profile
    signed: {},          // storage path -> { url, exp }
    channel: null,
    typingChannel: null,
    typingTimer: null,
    lastTypingSent: 0,
    pendingImage: null,  // { blob, width, height, size, url, name }
    convFilter: "",
    groupPicked: [],
    addPicked: [],
    dayCache: {}
  };

  /* =======================================================
     基础工具
     ======================================================= */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function toast(msg, type) { if (AUTH) AUTH.toast(msg, type); }
  function initials(name) {
    var n = String(name || "?").trim();
    return n ? n.slice(0, 1).toUpperCase() : "?";
  }
  function fmtSize(bytes) {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  }
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtTime(iso) {
    var d = new Date(iso);
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }
  function fmtConvTime(iso) {
    if (!iso) return "";
    var d = new Date(iso), now = new Date();
    var sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return fmtTime(iso);
    var y = new Date(now.getTime() - 86400000);
    if (d.toDateString() === y.toDateString()) return "昨天";
    return (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }
  function dayLabel(iso) {
    var d = new Date(iso), now = new Date();
    if (d.toDateString() === now.toDateString()) return "今天";
    var y = new Date(now.getTime() - 86400000);
    if (d.toDateString() === y.toDateString()) return "昨天";
    return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }

  /* 会话展示名 */
  function convTitle(conv) {
    if (conv.type === "group") return conv.title || "群聊";
    var peer = conv.peer;
    if (peer) return peer.display_name || peer.username || "对方";
    return "一对一聊天";
  }
  function convSub(conv) {
    if (conv.type === "group") {
      var n = (conv.member_ids || []).length;
      return n + " 位成员";
    }
    return "一对一私聊";
  }
  function cachedProfiles(conv) {
    (conv.member_profiles || []).forEach(function (p) { state.profiles[p.id] = p; });
    if (conv.peer) state.profiles[conv.peer.id] = conv.peer;
  }
  function nameOf(userId) {
    if (state.me && userId === state.me.id) return "我";
    var p = state.profiles[userId];
    return (p && (p.display_name || p.username)) || "未知用户";
  }

  /* =======================================================
     启动
     ======================================================= */
  document.addEventListener("DOMContentLoaded", function () {
    if (!GB.isConfigured()) {
      renderSetupNotice();
      return;
    }
    AUTH.requireLogin("chat.html").then(function (me) {
      if (!me) return;
      state.me = me;
      renderMe();
      return GB.getClient().then(function (sb) {
        state.sb = sb;
        bindEvents();
        return Promise.all([loadConversations()]);
      }).then(function () {
        subscribeRealtime();
        bindAuthEvents();
      });
    }).catch(function (err) {
      toast((err && err.message) || "初始化失败", "err");
    });
  });

  function renderSetupNotice() {
    var body = $("#msgList");
    if (body) {
      body.innerHTML = '<div class="chat-empty"><span class="ce-icon">⚙</span>' +
        "聊天室尚未接入后端。<br>请编辑 <code>assets/js/supabase-config.js</code> 填入 Supabase 项目地址与 anon key，" +
        "并在 SQL Editor 执行 <code>sql/supabase-schema.sql</code>。</div>";
    }
    AUTH.showSetupBanner();
  }

  function renderMe() {
    var av = $("#meAvatar"), nm = $("#meName"), un = $("#meUsername");
    if (av) av.textContent = initials(state.me.display_name || state.me.username);
    if (nm) nm.textContent = state.me.display_name || state.me.username || "未命名";
    if (un) un.textContent = "@" + (state.me.username || "-") + " · " + (state.me.email || "");
  }

  function bindAuthEvents() {
    state.sb.auth.onAuthStateChange(function (event) {
      if (event === "SIGNED_OUT") location.replace("login.html?next=chat.html");
      if (event === "TOKEN_REFRESHED" && !state.me) location.reload();
    });
  }

  /* =======================================================
     事件绑定
     ======================================================= */
  function bindEvents() {
    var btnOut = $("#btnSignOut");
    if (btnOut) btnOut.addEventListener("click", function () { AUTH.signOut(); });

    var btnNew = $("#btnNewChat");
    if (btnNew) btnNew.addEventListener("click", openNewChatModal);

    var btnProfile = $("#btnProfile");
    if (btnProfile) btnProfile.addEventListener("click", function () {
      openMask("#profileMask");
      if ($("#profileId")) $("#profileId").value = state.me.id;
      if ($("#profileEmail")) $("#profileEmail").value = state.me.email || "";
    });

    var search = $("#convSearch");
    if (search) search.addEventListener("input", function () {
      state.convFilter = this.value.trim().toLowerCase();
      renderConvList();
    });

    var composer = $("#composer");
    if (composer) composer.addEventListener("submit", function (e) {
      e.preventDefault();
      sendMessage(collectComposer());
    });

    var input = $("#msgInput");
    if (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendMessage(collectComposer());
        }
      });
      input.addEventListener("input", function () {
        autoGrow(this);
        sendTyping();
      });
    }

    var pick = $("#btnPickImage");
    var file = $("#fileInput");
    if (pick && file) {
      pick.addEventListener("click", function () { file.click(); });
      file.addEventListener("change", function () {
        var f = this.files && this.files[0];
        this.value = "";
        if (f) pickImage(f);
      });
    }

    /* 会话内的群管理 */
    var btnAdd = $("#btnAddMember");
    if (btnAdd) btnAdd.addEventListener("click", openAddMemberModal);

    var btnRename = $("#btnRenameGroup");
    if (btnRename) btnRename.addEventListener("click", renameGroup);

    var btnLeave = $("#btnLeaveGroup");
    if (btnLeave) btnLeave.addEventListener("click", leaveGroup);

    /* 新建会话弹窗 */
    bindMaskClose("#newChatMask", "#newChatClose");
    var us = $("#userSearch");
    if (us) us.addEventListener("input", debounce(function () {
      searchUsers(this.value, "#userResult", function (u) { pickDirect(u); });
    }, 300));
    var gs = $("#groupSearch");
    if (gs) gs.addEventListener("input", debounce(function () {
      searchUsers(this.value, "#groupResult", function (u) { toggleGroupPick(u); });
    }, 300));
    var gc = $("#btnCreateGroup");
    if (gc) gc.addEventListener("click", createGroup);

    /* 拉人弹窗 */
    bindMaskClose("#addMemberMask", "#addMemberClose");
    var as = $("#addSearch");
    if (as) as.addEventListener("input", debounce(function () {
      searchUsers(this.value, "#addResult", function (u) { toggleAddPick(u); });
    }, 300));
    var ac = $("#btnConfirmAdd");
    if (ac) ac.addEventListener("click", confirmAddMembers);

    /* 编辑昵称 */
    bindMaskClose("#profileMask", "#profileClose");
    var pf = $("#profileForm");
    if (pf) pf.addEventListener("submit", saveProfile);

    /* 图片放大 */
    bindMaskClose("#imgViewerMask", "#imgViewerClose");
    document.addEventListener("click", function (e) {
      var img = e.target && e.target.closest ? e.target.closest(".msg-bubble img") : null;
      if (img) {
        $("#imgViewerImg").src = img.src;
        openMask("#imgViewerMask");
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") document.querySelectorAll(".modal-mask").forEach(function (m) { m.hidden = true; });
    });
  }

  function bindMaskClose(maskSel, btnSel) {
    var mask = $(maskSel);
    if (!mask) return;
    var btn = $(btnSel);
    if (btn) btn.addEventListener("click", function () { mask.hidden = true; });
    mask.addEventListener("click", function (e) { if (e.target === mask) mask.hidden = true; });
  }
  function openMask(sel) { var m = $(sel); if (m) m.hidden = false; }
  function debounce(fn, wait) {
    var t;
    return function () {
      var self = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, wait);
    };
  }
  function autoGrow(el) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 150) + "px";
  }
  function collectComposer() {
    var body = ($("#msgInput").value || "").trim();
    return { body: body, image: state.pendingImage };
  }

  /* =======================================================
     会话列表
     ======================================================= */
  function loadConversations() {
    return state.sb.from("conversation_overview").select("*")
      .order("last_message_at", { ascending: false })
      .then(function (r) {
        if (r.error) throw r.error;
        state.convs = r.data || [];
        state.convs.forEach(cachedProfiles);
        var missing = [];
        state.convs.forEach(function (c) {
          (c.member_ids || []).forEach(function (id) {
            if (!state.profiles[id] && missing.indexOf(id) < 0) missing.push(id);
          });
        });
        return ensureProfiles(missing);
      })
      .then(function () {
        renderConvList();
        if (state.activeId) {
          var cur = findConv(state.activeId);
          if (cur) renderChatHeader(cur);
        }
      })
      .catch(function (err) {
        $("#convList").innerHTML = '<div class="side-empty">会话加载失败：' + esc((err && err.message) || "未知错误") + "</div>";
      });
  }

  function findConv(id) {
    for (var i = 0; i < state.convs.length; i++) if (state.convs[i].id === id) return state.convs[i];
    return null;
  }

  function renderConvList() {
    var box = $("#convList");
    if (!box) return;
    var list = state.convs.filter(function (c) {
      if (!state.convFilter) return true;
      return convTitle(c).toLowerCase().indexOf(state.convFilter) >= 0;
    });

    if (!list.length) {
      box.innerHTML = '<div class="side-empty">还没有会话<br>点击上方「新建会话」开始聊天</div>';
      return;
    }

    box.innerHTML = list.map(function (c) {
      var title = convTitle(c);
      var lm = c.last_message;
      var preview = lm
        ? (lm.body ? lm.body : (lm.image_path ? "[图片]" : "暂无消息"))
        : "暂无消息";
      if (lm && lm.sender_id === state.me.id && lm.body) preview = "我：" + preview;
      var unread = Number(c.unread_count || 0);
      return '' +
        '<div class="conv-item' + (c.id === state.activeId ? " active" : "") + '" data-conv="' + c.id + '">' +
          '<span class="avatar sm' + (c.type === "group" ? "" : " mute") + '">' + esc(initials(title)) + "</span>" +
          '<div class="conv-main">' +
            '<div class="conv-top">' +
              '<span class="conv-name">' + esc(title) + "</span>" +
              '<span class="conv-time">' + esc(fmtConvTime(c.last_message_at)) + "</span>" +
            "</div>" +
            '<div class="conv-preview">' + esc(preview) + "</div>" +
          "</div>" +
          (c.type === "group" ? '<span class="conv-tag">群</span>' : "") +
          (unread > 0 ? '<span class="badge-unread">' + (unread > 99 ? "99+" : unread) + "</span>" : "") +
        "</div>";
    }).join("");

    box.querySelectorAll("[data-conv]").forEach(function (el) {
      el.addEventListener("click", function () {
        openConversation(el.getAttribute("data-conv"));
      });
    });
  }

  function renderChatHeader(conv) {
    $("#chatTitle").textContent = convTitle(conv);
    var sub = convSub(conv);
    if (conv.type === "group") {
      var names = (conv.member_profiles || []).map(function (p) { return p.display_name || p.username; });
      if (names.length) sub = names.join("、");
    }
    $("#chatSub").textContent = sub;

    var isGroup = conv.type === "group";
    var meRole = (conv.member_profiles || []).filter(function (p) { return p.id === state.me.id; })[0];
    var isOwner = !!(meRole && meRole.role === "owner");
    if ($("#btnAddMember")) $("#btnAddMember").hidden = !(isGroup && isOwner);
    if ($("#btnRenameGroup")) $("#btnRenameGroup").hidden = !(isGroup && isOwner);
    if ($("#btnLeaveGroup")) $("#btnLeaveGroup").hidden = !isGroup;
  }

  /* =======================================================
     打开会话 / 消息加载
     ======================================================= */
  function openConversation(id) {
    if (!id) return;
    var conv = findConv(id);
    if (!conv) return;
    state.activeId = id;
    renderConvList();
    renderChatHeader(conv);
    setComposerEnabled(true);
    $("#msgList").innerHTML = '<div class="chat-empty">正在加载消息…</div>';

    markRead(id);

    state.sb.from("messages").select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(GB.cfg.messagePageSize)
      .then(function (r) {
        if (r.error) throw r.error;
        state.messages = r.data || [];
        var senders = [];
        state.messages.forEach(function (m) {
          if (!state.profiles[m.sender_id] && senders.indexOf(m.sender_id) < 0) senders.push(m.sender_id);
        });
        return ensureProfiles(senders);
      })
      .then(function () { return resolveSignedUrls(state.messages); })
      .then(function () {
        renderMessages();
        joinTypingChannel(id);
      })
      .catch(function (err) {
        $("#msgList").innerHTML = '<div class="chat-empty">消息加载失败：' + esc((err && err.message) || "未知错误") + "</div>";
      });
  }

  function markRead(convId) {
    var conv = findConv(convId);
    if (conv) conv.unread_count = 0;
    return state.sb.from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", convId)
      .eq("user_id", state.me.id)
      .then(function () { renderConvList(); })
      .catch(function () { /* 已读位更新失败不阻塞聊天 */ });
  }

  function setComposerEnabled(on) {
    $("#msgInput").disabled = !on;
    $("#btnSend").disabled = !on;
    $("#btnPickImage").disabled = !on;
    $("#msgInput").placeholder = on ? "输入消息，Enter 发送，Shift+Enter 换行" : "请先选择左侧会话";
  }

  function renderMessages() {
    var box = $("#msgList");
    if (!state.messages.length) {
      box.innerHTML = '<div class="chat-empty"><span class="ce-icon">💬</span>还没有消息，发送第一条打个招呼吧</div>';
      return;
    }
    var html = "", lastDay = "";
    var isGroup = state.activeId ? (findConv(state.activeId) || {}).type === "group" : false;

    state.messages.forEach(function (m) {
      var day = dayLabel(m.created_at);
      if (day !== lastDay) {
        html += '<div class="msg-day">' + esc(day) + "</div>";
        lastDay = day;
      }
      html += messageHtml(m, isGroup);
    });
    box.innerHTML = html;
    box.querySelectorAll("[data-img]").forEach(function (img) {
      img.addEventListener("load", function () { img.classList.remove("lazy-pending"); });
    });
    scrollToBottom(true);
  }

  function messageHtml(m, isGroup) {
    var mine = m.sender_id === state.me.id;
    var url = m.image_path ? (state.signed[m.image_path] || "") : "";
    var media = "";
    if (m.image_path) {
      media = '<div class="msg-bubble media">' +
        (url
          ? '<img data-img src="' + esc(url) + '" alt="聊天图片" loading="lazy">'
          : '<span style="color:#94a2c2;font-size:12.5px">图片加载中…</span>') +
        "</div>" +
        '<div class="msg-filesize">' + esc(fmtSize(m.image_size)) + "</div>";
    }
    var text = m.body ? '<div class="msg-bubble">' + esc(m.body) + "</div>" : "";

    return '' +
      '<div class="msg-row ' + (mine ? "me" : "other") + '" data-msg="' + m.id + '">' +
        '<span class="avatar sm mute">' + esc(initials(mine ? "我" : nameOf(m.sender_id))) + "</span>" +
        '<div class="msg-body">' +
          '<div class="msg-meta"><span>' + esc(mine ? "我" : (isGroup ? nameOf(m.sender_id) : "")) + "</span>" +
            "<span>" + esc(fmtTime(m.created_at)) + "</span></div>" +
          text + media +
        "</div>" +
      "</div>";
  }

  function scrollToBottom(force) {
    var box = $("#msgList");
    if (!box) return;
    var nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 140;
    if (force || nearBottom) box.scrollTop = box.scrollHeight;
  }

  /* 私有桶图片 → 临时可访问链接（带本地缓存，避免重复请求） */
  function resolveSignedUrls(msgs) {
    var paths = [], now = Date.now();
    msgs.forEach(function (m) {
      if (!m.image_path) return;
      var c = state.signed[m.image_path];
      if (!c || c.exp < now + 60000) {
        if (paths.indexOf(m.image_path) < 0) paths.push(m.image_path);
      }
    });
    if (!paths.length) return Promise.resolve();

    return state.sb.storage.from(GB.cfg.bucket).createSignedUrls(paths, GB.cfg.signUrlExpires)
      .then(function (r) {
        if (r.error) throw r.error;
        (r.data || []).forEach(function (item) {
          if (item.signedUrl) {
            state.signed[item.path || item.signedUrl] = { url: item.signedUrl, exp: now + GB.cfg.signUrlExpires * 1000 };
            state.signed[item.path] = { url: item.signedUrl, exp: now + GB.cfg.signUrlExpires * 1000 };
          }
        });
        /* 兜底：按顺序回填（部分版本不返回 path 字段） */
        if (!r.data || !r.data.length) return;
        paths.forEach(function (p, i) {
          var item = (r.data || [])[i];
          if (item && item.signedUrl) state.signed[p] = { url: item.signedUrl, exp: now + GB.cfg.signUrlExpires * 1000 };
        });
      })
      .catch(function () { /* 拿不到链接时气泡内提示"图片加载中" */ });
  }

  function ensureProfiles(ids) {
    var need = (ids || []).filter(function (id) { return id && !state.profiles[id]; });
    if (!need.length) return Promise.resolve();
    return state.sb.from("profiles").select("id, username, display_name, avatar_url").in("id", need)
      .then(function (r) {
        if (r.error) throw r.error;
        (r.data || []).forEach(function (p) { state.profiles[p.id] = p; });
      })
      .catch(function () { /* 资料拿不到不阻断消息展示 */ });
  }

  /* =======================================================
     发送消息
     ======================================================= */
  function sendMessage(payload) {
    if (!state.activeId) return;
    var body = payload.body;
    var img = payload.image;
    if (!body && !img) return;

    if (!img) {
      var input = $("#msgInput");
      input.value = "";
      autoGrow(input);
      insertMessage({ body: body });
      return;
    }

    var convId = state.activeId;
    var path = convId + "/" + state.me.id + "/" + Date.now() + "-" +
      Math.random().toString(36).slice(2, 8) + ".jpg";

    $("#btnSend").disabled = true;
    toast("正在上传图片…");

    state.sb.storage.from(GB.cfg.bucket)
      .upload(path, img.blob, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" })
      .then(function (r) {
        if (r.error) throw r.error;
        var input = $("#msgInput");
        var text = (input.value || "").trim();
        input.value = "";
        autoGrow(input);
        clearPendingImage();
        return insertMessage({
          body: text,
          image_path: path,
          image_w: img.width,
          image_h: img.height,
          image_size: img.size
        });
      })
      .catch(function (err) {
        toast((err && err.message) || "图片发送失败", "err");
      })
      .then(function () { $("#btnSend").disabled = false; });
  }

  function insertMessage(row) {
    var convId = state.activeId;
    var payload = Object.assign({ conversation_id: convId, sender_id: state.me.id }, row);

    /* 先本地占位，实时回调到达后按 id 去重 */
    var temp = Object.assign({ id: "tmp-" + Date.now(), created_at: new Date().toISOString(), __pending: true }, payload);
    state.messages.push(temp);
    renderMessages();

    return state.sb.from("messages").insert(payload).select().maybeSingle().then(function (r) {
      if (r.error) throw r.error;
      var idx = state.messages.indexOf(temp);
      if (idx >= 0) state.messages.splice(idx, 1);
      if (r.data && !state.messages.some(function (m) { return m.id === r.data.id; })) {
        state.messages.push(r.data);
      }
      state.messages.sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
      return resolveSignedUrls(state.messages).then(renderMessages);
    }).catch(function (err) {
      var idx = state.messages.indexOf(temp);
      if (idx >= 0) state.messages.splice(idx, 1);
      renderMessages();
      toast((err && err.message) || "消息发送失败", "err");
    });
  }

  /* =======================================================
     图片选择与压缩
     ======================================================= */
  function pickImage(file) {
    if (!/^image\//i.test(file.type)) return toast("请选择图片文件", "err");
    if (file.size > GB.cfg.maxSourceBytes) {
      return toast("原图 " + fmtSize(file.size) + " 超过 " + fmtSize(GB.cfg.maxSourceBytes) + " 上限，请先裁剪", "err");
    }

    var chip = $("#imgChip");
    chip.hidden = false;
    chip.innerHTML = '<div class="ic-info"><b>' + esc(file.name) + "</b>压缩中… 原图 " + fmtSize(file.size) + "</div>";

    compressImage(file).then(function (out) {
      if (state.pendingImage && state.pendingImage.url) URL.revokeObjectURL(state.pendingImage.url);
      out.url = URL.createObjectURL(out.blob);
      out.name = file.name;
      state.pendingImage = out;
      renderImageChip();
    }).catch(function (err) {
      chip.hidden = true;
      chip.innerHTML = "";
      toast((err && err.message) || "图片处理失败", "err");
    });
  }

  function renderImageChip() {
    var chip = $("#imgChip"), img = state.pendingImage;
    if (!img) { chip.hidden = true; chip.innerHTML = ""; return; }
    chip.hidden = false;
    chip.innerHTML =
      '<img src="' + esc(img.url) + '" alt="待发送图片">' +
      '<div class="ic-info">' +
        "<b>" + esc(img.name || "图片") + "</b>" +
        img.width + "×" + img.height + " · 压缩后 " + fmtSize(img.size) +
      "</div>" +
      '<button type="button" class="ic-del" title="移除">✕</button>';
    chip.querySelector(".ic-del").addEventListener("click", clearPendingImage);
  }

  function clearPendingImage() {
    if (state.pendingImage && state.pendingImage.url) URL.revokeObjectURL(state.pendingImage.url);
    state.pendingImage = null;
    renderImageChip();
  }

  /* 浏览器本地压缩：canvas 重绘 + 逐级降质量，必要时再降分辨率 */
  function compressImage(file) {
    var maxEdge = GB.cfg.compressMaxEdge;
    var target = GB.cfg.compressTargetBytes;
    var hardMax = GB.cfg.maxUploadBytes;
    var qualities = [GB.cfg.compressQuality, 0.62, 0.52, 0.44];
    var edge = maxEdge;

    return loadBitmap(file).then(function (bmp) {
      var chain = Promise.resolve();
      var result = null;

      for (var round = 0; round < 4; round++) {
        (function (edgeNow) {
          chain = chain.then(function () {
            if (result && result.size <= hardMax) return;
            var scale = Math.min(1, edgeNow / Math.max(bmp.width, bmp.height));
            var w = Math.max(1, Math.round(bmp.width * scale));
            var h = Math.max(1, Math.round(bmp.height * scale));
            var qChain = Promise.resolve();
            qualities.forEach(function (q) {
              qChain = qChain.then(function () {
                if (result && result.size <= target) return;
                return canvasBlob(bmp, w, h, q).then(function (blob) {
                  result = { blob: blob, width: w, height: h, size: blob.size };
                });
              });
            });
            return qChain;
          });
        })(edge);
        edge = Math.round(edge * 0.75);
      }

      return chain.then(function () {
        if (typeof bmp.close === "function") bmp.close();
        if (!result) throw new Error("图片压缩失败");
        if (result.size > hardMax) {
          throw new Error("图片压缩后仍为 " + fmtSize(result.size) + "，超过 " + fmtSize(hardMax) + " 上限，请换一张更小的图片");
        }
        return result;
      });
    });
  }

  function loadBitmap(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file).catch(function () { return loadViaImg(file); });
    }
    return loadViaImg(file);
  }

  function loadViaImg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("图片解码失败")); };
      img.src = url;
    });
  }

  function canvasBlob(source, w, h, quality) {
    return new Promise(function (resolve, reject) {
      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);          // JPEG 无透明通道，先铺白底避免透明区域变黑
      ctx.drawImage(source, 0, 0, w, h);
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error("图片压缩失败（浏览器不支持 canvas 导出）"));
      }, "image/jpeg", quality);
    });
  }

  /* =======================================================
     实时订阅
     ======================================================= */
  function subscribeRealtime() {
    state.channel = state.sb.channel("gb-chat-room")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, function (p) {
        onIncomingMessage(p.new);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, function (p) {
        var row = p.new;
        var idx = state.messages.findIndex(function (m) { return m.id === row.id; });
        if (idx >= 0 && row.conversation_id === state.activeId) {
          state.messages[idx] = row;
          renderMessages();
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, function () {
        loadConversations();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_members" }, function (p) {
        if (p.new && p.new.user_id === state.me.id) loadConversations();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "conversation_members" }, function () {
        loadConversations();
      })
      .subscribe(function (status) {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setTimeout(subscribeRealtime, 5000);   // 网络抖动自动重连
        }
      });
  }

  function onIncomingMessage(row) {
    if (!row) return;
    if (row.conversation_id === state.activeId) {
      if (!state.messages.some(function (m) { return m.id === row.id; })) {
        state.messages.push(row);
        state.messages.sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
        var senderId = row.sender_id;
        ensureProfiles([senderId]).then(function () {
          return row.image_path ? resolveSignedUrls([row]) : null;
        }).then(function () {
          renderMessages();
          if (row.sender_id !== state.me.id) markRead(state.activeId);
        });
      }
      clearTypingHint();
      return;
    }
    /* 其他会话：只刷新列表（未读数由视图计算） */
    if (row.sender_id !== state.me.id) {
      loadConversations();
    }
  }

  /* 打字状态（broadcast，不落库） */
  function joinTypingChannel(convId) {
    if (state.typingChannel) {
      state.sb.removeChannel(state.typingChannel);
      state.typingChannel = null;
    }
    state.typingChannel = state.sb.channel("typing:" + convId, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, function (msg) {
        var p = msg.payload || {};
        if (p.user_id === state.me.id) return;
        showTypingHint((p.name || "对方") + " 正在输入…");
      })
      .subscribe();
  }

  function sendTyping() {
    if (!state.typingChannel) return;
    var now = Date.now();
    if (now - state.lastTypingSent < 2000) return;
    state.lastTypingSent = now;
    state.typingChannel.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: state.me.id, name: state.me.display_name || state.me.username }
    });
  }

  function showTypingHint(text) {
    var el = $("#typingHint");
    if (!el) return;
    el.textContent = text;
    clearTimeout(state.typingTimer);
    state.typingTimer = setTimeout(clearTypingHint, GB.cfg.typingTimeout);
  }
  function clearTypingHint() {
    var el = $("#typingHint");
    if (el) el.textContent = "";
  }

  /* =======================================================
     新建会话 / 群管理
     ======================================================= */
  function openNewChatModal() {
    state.groupPicked = [];
    renderChips("#groupChips", state.groupPicked, function (id) { removeGroupPick(id); });
    if ($("#groupTitle")) $("#groupTitle").value = "";
    $("#userResult").innerHTML = '<div class="list-hint">输入昵称或账号开始搜索</div>';
    $("#groupResult").innerHTML = '<div class="list-hint">输入昵称或账号，点击加入群聊</div>';
    openMask("#newChatMask");
    searchUsers("", "#userResult", function (u) { pickDirect(u); });
  }

  function searchUsers(keyword, targetSel, onClick) {
    var box = $(targetSel);
    if (!box) return;
    var q = String(keyword || "").trim();
    var query = state.sb.from("profiles")
      .select("id, username, display_name, avatar_url")
      .neq("id", state.me.id)
      .limit(20);

    if (q) query = query.or("display_name.ilike.%" + q + "%,username.ilike.%" + q + "%");
    else query = query.order("created_at", { ascending: false }).limit(12);

    query.then(function (r) {
      if (r.error) throw r.error;
      var list = r.data || [];
      if (!list.length) {
        box.innerHTML = '<div class="list-hint">没有匹配的用户</div>';
        return;
      }
      box.innerHTML = list.map(function (u) {
        var picked = (targetSel === "#groupResult"
          ? state.groupPicked.some(function (x) { return x.id === u.id; })
          : state.addPicked.some(function (x) { return x.id === u.id; }));
        return '' +
          '<div class="user-option' + (picked ? " picked" : "") + '" data-uid="' + u.id + '">' +
            '<span class="avatar sm mute">' + esc(initials(u.display_name || u.username)) + "</span>" +
            '<div class="uo-main"><b>' + esc(u.display_name || u.username) + "</b>" +
              "<span>@" + esc(u.username) + "</span></div>" +
            (picked ? '<span class="pill pill-info">已选</span>' : '<span class="pill pill-mute">选择</span>') +
          "</div>";
      }).join("");
      box.querySelectorAll("[data-uid]").forEach(function (el) {
        var uid = el.getAttribute("data-uid");
        var user = list.filter(function (x) { return x.id === uid; })[0];
        el.addEventListener("click", function () { onClick(user); });
      });
    }).catch(function (err) {
      box.innerHTML = '<div class="list-hint">搜索失败：' + esc((err && err.message) || "未知错误") + "</div>";
    });
  }

  function pickDirect(user) {
    if (!user) return;
    $("#newChatMask").hidden = true;
    toast("正在打开与 " + (user.display_name || user.username) + " 的会话…");
    state.sb.rpc("create_direct_conversation", { p_other: user.id }).then(function (r) {
      if (r.error) throw r.error;
      return loadConversations().then(function () { openConversation(r.data); });
    }).catch(function (err) {
      toast((err && err.message) || "创建会话失败", "err");
    });
  }

  function toggleGroupPick(user) {
    if (!user) return;
    var i = state.groupPicked.findIndex(function (x) { return x.id === user.id; });
    if (i >= 0) state.groupPicked.splice(i, 1);
    else state.groupPicked.push(user);
    renderChips("#groupChips", state.groupPicked, removeGroupPick);
    searchUsers($("#groupSearch").value, "#groupResult", function (u) { toggleGroupPick(u); });
  }
  function removeGroupPick(id) {
    state.groupPicked = state.groupPicked.filter(function (x) { return x.id !== id; });
    renderChips("#groupChips", state.groupPicked, removeGroupPick);
  }

  function renderChips(sel, list, onRemove) {
    var box = $(sel);
    if (!box) return;
    box.innerHTML = list.map(function (u) {
      return '<span class="chip" data-id="' + u.id + '">' +
        esc(u.display_name || u.username) + ' <button type="button" title="移除">✕</button></span>';
    }).join("");
    box.querySelectorAll(".chip button").forEach(function (b) {
      b.addEventListener("click", function () {
        onRemove(b.parentNode.getAttribute("data-id"));
      });
    });
  }

  function createGroup() {
    if (!state.groupPicked.length) return toast("请至少选择一位成员", "err");
    var title = ($("#groupTitle").value || "").trim();
    var ids = state.groupPicked.map(function (u) { return u.id; });

    $("#btnCreateGroup").disabled = true;
    state.sb.rpc("create_group_conversation", { p_title: title, p_members: ids }).then(function (r) {
      if (r.error) throw r.error;
      $("#newChatMask").hidden = true;
      return loadConversations().then(function () { openConversation(r.data); });
    }).catch(function (err) {
      toast((err && err.message) || "创建群聊失败", "err");
    }).then(function () {
      $("#btnCreateGroup").disabled = false;
    });
  }

  function openAddMemberModal() {
    if (!state.activeId) return;
    state.addPicked = [];
    if (!state.addPicked.length) renderChips("#addChips", state.addPicked, removeAddPick);
    $("#addResult").innerHTML = '<div class="list-hint">输入昵称或账号，点击选择要拉入的成员</div>';
    openMask("#addMemberMask");
  }
  function toggleAddPick(user) {
    if (!user) return;
    var i = state.addPicked.findIndex(function (x) { return x.id === user.id; });
    if (i >= 0) state.addPicked.splice(i, 1);
    else state.addPicked.push(user);
    renderChips("#addChips", state.addPicked, removeAddPick);
    searchUsers($("#addSearch").value, "#addResult", function (u) { toggleAddPick(u); });
  }
  function removeAddPick(id) {
    state.addPicked = state.addPicked.filter(function (x) { return x.id !== id; });
    renderChips("#addChips", state.addPicked, removeAddPick);
  }
  function confirmAddMembers() {
    if (!state.addPicked.length) return toast("请先选择成员", "err");
    var ids = state.addPicked.map(function (u) { return u.id; });
    $("#btnConfirmAdd").disabled = true;
    state.sb.rpc("add_group_members", { p_conversation: state.activeId, p_members: ids }).then(function (r) {
      if (r.error) throw r.error;
      $("#addMemberMask").hidden = true;
      toast("已添加 " + (r.data || ids.length) + " 位成员", "ok");
      return loadConversations();
    }).catch(function (err) {
      toast((err && err.message) || "添加失败", "err");
    }).then(function () {
      $("#btnConfirmAdd").disabled = false;
    });
  }

  function renameGroup() {
    if (!state.activeId) return;
    var conv = findConv(state.activeId);
    var name = window.prompt("请输入新的群聊名称", conv ? (conv.title || "") : "");
    if (name === null) return;
    name = name.trim();
    if (!name) return toast("群名称不能为空", "err");
    state.sb.from("conversations").update({ title: name }).eq("id", state.activeId).then(function (r) {
      if (r.error) throw r.error;
      toast("群名称已更新", "ok");
      return loadConversations();
    }).catch(function (err) {
      toast((err && err.message) || "修改失败", "err");
    });
  }

  function leaveGroup() {
    if (!state.activeId) return;
    if (!window.confirm("确定退出该群聊吗？退出后将不再接收该群消息。")) return;
    state.sb.rpc("leave_conversation", { p_conversation: state.activeId }).then(function (r) {
      if (r.error) throw r.error;
      state.activeId = null;
      state.messages = [];
      $("#msgList").innerHTML = '<div class="chat-empty"><span class="ce-icon">💬</span>选择一个会话开始聊天</div>';
      $("#chatTitle").textContent = "选择一个会话";
      $("#chatSub").textContent = "从左侧选择会话，或新建一对一 / 群聊";
      setComposerEnabled(false);
      toast("已退出群聊", "ok");
      return loadConversations();
    }).catch(function (err) {
      toast((err && err.message) || "退群失败", "err");
    });
  }

  function saveProfile(e) {
    e.preventDefault();
    var name = ($("#profileName").value || "").trim();
    if (!name) return toast("昵称不能为空", "err");

    state.sb.from("profiles").update({ display_name: name }).eq("id", state.me.id).then(function (r) {
      if (r.error) throw r.error;
      state.me.display_name = name;
      if (AUTH) AUTH.cacheUser(state.me);
      renderMe();
      $("#profileMask").hidden = true;
      toast("资料已更新", "ok");
    }).catch(function (err) {
      toast((err && err.message) || "更新失败", "err");
    });
  }
})();
