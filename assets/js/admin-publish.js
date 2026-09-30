/* =========================================================
   顾手游电竞 管理后台 -「发布到线上」模块
   ---------------------------------------------------------
   作用：把「内容管理」保存后的内容数据，通过 GitHub API 提交到
         线上仓库的数据文件，触发 GitHub Pages 自动重建（约 1 分钟），
         让所有访客在公网网址上看到最新内容。
   原理：访客浏览器打开网站时，会先读取仓库里的 assets/data/site-data.json，
         因此只要这个文件更新，Pages 重建完成即全站生效。
   Token：由站长自己在 GitHub 生成（该仓库 Contents: Read and write），
          只保存在本机浏览器 localStorage（键名 gb_gh_token），
          不上传任何服务器、也不会随网站文件发布出去。
   依赖：site-data.js（window.GBSite）
   ========================================================= */
(function () {
  "use strict";

  var S = window.GBSite;
  if (!S) return;

  /* ---------------- 发布目标（换仓库 / 换站点时只改这里） ---------------- */
  var CFG = {
    owner: "Gu060125",
    repo: "gushou-esports",
    branch: "main",
    path: "assets/data/site-data.json",
    site: "https://gu060125.github.io/gushou-esports/",
    api: "https://api.github.com"
  };
  var SLUG = CFG.owner + "/" + CFG.repo;
  var COMMITS_URL = "https://github.com/" + SLUG + "/commits/" + CFG.branch;

  var K_TOKEN = "gb_gh_token";
  var K_META = "gb_publish_meta";

  var token = "";
  var busy = false;
  var steps = [];
  var timerSeq = 0;
  var lastTickKey = "";

  /* ---------------- 样式 ---------------- */
  var STYLE = [
    ".pb-flow{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12.6px;color:var(--muted);line-height:2}",
    ".pb-flow span.node{border:1px solid var(--line-strong);border-radius:999px;padding:3px 12px;background:rgba(255,255,255,.03)}",
    ".pb-flow span.arrow{color:var(--line-strong)}",
    ".pb-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}",
    ".pb-row input[type=password],.pb-row input[type=text]{flex:1 1 300px;min-width:220px;font-family:ui-monospace,Consolas,monospace;font-size:13px}",
    ".pb-note{font-size:13px;line-height:1.85;color:var(--muted)}",
    ".pb-note code{background:rgba(255,255,255,.07);border-radius:4px;padding:1px 6px;font-size:12.4px}",
    ".pb-warn{border-left:3px solid #ffcf6b;background:rgba(255,207,107,.07);border-radius:8px;padding:10px 14px;color:#ffd98a;margin-top:12px}",
    ".pb-badge{font-size:12.2px;border-radius:999px;padding:2px 10px;border:1px solid var(--line-strong);color:var(--muted);white-space:nowrap}",
    ".pb-badge.ok{border-color:#3ddc97;color:#7ff0be}",
    ".pb-badge.dirty{border-color:#ffcf6b;color:#ffd98a}",
    ".pb-badge.err{border-color:#ff6b6b;color:#ff9a9a}",
    ".pb-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:12px 18px;margin-bottom:14px}",
    ".pb-grid div{font-size:13.2px;line-height:1.7}",
    ".pb-grid div span{display:block;color:var(--muted);font-size:12.2px}",
    ".pb-grid div b{font-weight:600;word-break:break-all}",
    ".pb-status{font-size:13.2px;line-height:1.9;border-left:3px solid var(--line-strong);border-radius:8px;padding:10px 14px;background:rgba(255,255,255,.03)}",
    ".pb-status code{background:rgba(255,255,255,.07);border-radius:4px;padding:1px 6px;font-size:12.4px}",
    ".pb-check{display:grid;gap:6px;margin:14px 0 4px}",
    ".pb-check p{margin:0;font-size:13px;color:var(--muted);display:flex;gap:8px;align-items:center;flex-wrap:wrap}",
    ".pb-steps{display:grid;gap:9px;margin-top:14px}",
    ".pb-step{display:flex;gap:10px;align-items:flex-start;font-size:13.2px;color:var(--muted);line-height:1.75}",
    ".pb-step .dot{width:19px;height:19px;border-radius:50%;border:1px solid var(--line-strong);display:inline-flex;align-items:center;justify-content:center;font-size:11px;flex:0 0 auto;margin-top:2px}",
    ".pb-step.doing .dot{border-color:#4f8cff;color:#9dc0ff}",
    ".pb-step.ok .dot{border-color:#3ddc97;color:#7ff0be}",
    ".pb-step.err .dot{border-color:#ff6b6b;color:#ff9a9a}",
    ".pb-step.ok b,.pb-step.err b{color:var(--text)}",
    ".pb-help summary{cursor:pointer;font-size:14.5px;font-weight:700;list-style:none;outline:none}",
    ".pb-help summary::-webkit-details-marker{display:none}",
    ".pb-help summary::after{content:'展开';float:right;font-size:12.4px;font-weight:400;color:var(--muted)}",
    ".pb-help[open] summary::after{content:'收起'}",
    ".pb-help table{margin-top:14px}",
    ".pb-help td{font-size:13px;line-height:1.75;vertical-align:top}",
    ".pb-help td:first-child{white-space:nowrap;color:#9dc0ff}"
  ].join("\n");

  /* ---------------- 基础工具 ---------------- */
  function $(id) { return document.getElementById(id); }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function nowStr() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " +
      pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }

  function short(sha) { return String(sha || "").slice(0, 7); }

  function fmtSize(b) {
    if (!b && b !== 0) return "未知大小";
    return b < 1024 ? (b + " B") : (Math.round(b / 1024) + " KB");
  }

  function esc(s) { return S.esc ? S.esc(s) : String(s == null ? "" : s); }

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
    }, 3200);
  }

  /* 结构无关的规范化字符串：用于比较「本机内容」与「线上内容」是否一致 */
  function canon(v) {
    if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
    if (v && typeof v === "object") {
      return "{" + Object.keys(v).sort().map(function (k) {
        return JSON.stringify(k) + ":" + canon(v[k]);
      }).join(",") + "}";
    }
    return JSON.stringify(v === undefined ? null : v);
  }

  /* ---------------- Token 存取（只在本机浏览器） ---------------- */
  function readToken() {
    try { return localStorage.getItem(K_TOKEN) || ""; } catch (e) { return ""; }
  }

  function writeToken(t) {
    try { localStorage.setItem(K_TOKEN, t); return true; } catch (e) { return false; }
  }

  function dropToken() {
    try { localStorage.removeItem(K_TOKEN); return true; } catch (e) { return false; }
  }

  function maskToken(t) {
    if (!t) return "";
    if (t.length <= 14) return "••••••";
    return t.slice(0, 11) + "••••••" + t.slice(-4);
  }

  /* ---------------- 发布记录（只在本机） ---------------- */
  function readMeta() {
    try {
      var raw = localStorage.getItem(K_META);
      var v = raw ? JSON.parse(raw) : null;
      return (v && typeof v === "object") ? v : null;
    } catch (e) { return null; }
  }

  function writeMeta(m) {
    try { localStorage.setItem(K_META, JSON.stringify(m)); return true; } catch (e) { return false; }
  }

  /* ---------------- Base64（UTF-8 安全） ---------------- */
  function b64EncodeUtf8(str) {
    var bytes;
    if (window.TextEncoder) {
      bytes = new TextEncoder().encode(str);
    } else {
      var utf8 = unescape(encodeURIComponent(str));
      bytes = new Uint8Array(utf8.length);
      for (var i = 0; i < utf8.length; i++) bytes[i] = utf8.charCodeAt(i);
    }
    var bin = "";
    var CH = 0x8000;
    for (var j = 0; j < bytes.length; j += CH) {
      bin += String.fromCharCode.apply(null, bytes.subarray(j, Math.min(j + CH, bytes.length)));
    }
    return btoa(bin);
  }

  function b64DecodeUtf8(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (window.TextDecoder) return new TextDecoder("utf-8").decode(bytes);
    var utf8 = "";
    for (var j = 0; j < bytes.length; j++) utf8 += String.fromCharCode(bytes[j]);
    try { return decodeURIComponent(escape(utf8)); } catch (e) { return utf8; }
  }

  /* ---------------- GitHub API ---------------- */
  function api(method, url, body) {
    var headers = {
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    var opt = { method: method, headers: headers, cache: "no-store" };
    if (body) {
      headers["Content-Type"] = "application/json";
      opt.body = JSON.stringify(body);
    }
    return fetch(url, opt).then(function (res) {
      return res.text().then(function (txt) {
        var json = null;
        try { json = txt ? JSON.parse(txt) : null; } catch (e) { json = null; }
        return { ok: res.ok, status: res.status, json: json, text: txt };
      });
    });
  }

  /* 把 API 错误转成中文可操作的说明 */
  function explain(status, json) {
    var msg = (json && json.message) ? json.message : "请求失败";
    if (!status) {
      return "网络请求失败：没能连上 GitHub。请检查本机网络 / 代理是否正常，稍后重试；如果你是用 file:// 直接双击打开本页，请改用线上网址打开后台。";
    }
    if (status === 401) {
      return "Token 无效或已失效（401）：请确认粘贴的是完整 Token（以 github_pat_ 开头）、没有被吊销或过期，然后重新生成一个再试。";
    }
    if (status === 403) {
      return "被拒绝（403）：多数是权限不足——请检查 Token 的仓库访问权限里，" + SLUG + " 已勾选且 Contents（内容）为 Read and write；也可能是提交过于频繁触发限流，稍等几分钟重试。";
    }
    if (status === 404) {
      return "找不到目标（404）：请确认仓库 " + SLUG + " 存在、分支 " + CFG.branch + " 已创建，并且 Token 已授权访问该仓库。";
    }
    if (status === 409) {
      return "版本冲突（409）：线上文件刚刚被改动过。请点「检测线上连接」刷新后再发布一次。";
    }
    if (status === 422) {
      return "提交内容被拒绝（422）：" + msg;
    }
    if (status >= 500) {
      return "GitHub 服务暂时不可用（" + status + "）：这不是你的配置问题，稍后重试即可。";
    }
    return msg + "（HTTP " + status + "）";
  }

  /* ---------------- 步骤面板 ---------------- */
  var STEP_DEFS = [
    { key: "auth", label: "校验 Token 与仓库权限" },
    { key: "read", label: "读取线上数据文件版本" },
    { key: "write", label: "提交数据文件到仓库" },
    { key: "pages", label: "等待 GitHub Pages 重建（约 1 分钟）" }
  ];

  function resetSteps() {
    steps = STEP_DEFS.map(function (s) {
      return { key: s.key, label: s.label, state: "wait", detail: "" };
    });
    renderSteps();
  }

  function setStep(key, state, detail) {
    for (var i = 0; i < steps.length; i++) {
      if (steps[i].key === key) {
        steps[i].state = state;
        if (detail !== undefined && detail !== null) steps[i].detail = detail;
      }
    }
    renderSteps();
  }

  function renderSteps() {
    var box = $("pbSteps");
    if (!box) return;
    box.innerHTML = steps.map(function (s, i) {
      var mark = s.state === "ok" ? "✓" : s.state === "err" ? "✕" : s.state === "doing" ? "…" : (i + 1);
      return '<div class="pb-step ' + s.state + '">' +
        '<span class="dot">' + mark + "</span>" +
        "<span><b>" + esc(s.label) + "</b>" + (s.detail ? "<br>" + s.detail : "") + "</span>" +
        "</div>";
    }).join("");
  }

  /* ---------------- 状态区 ---------------- */
  function renderStatus(justPublished) {
    var box = $("pbStatus");
    if (!box) return;
    var meta = readMeta();
    if (!meta || !meta.at) {
      box.innerHTML = "本机还没有发布记录。填好 Token 后点右上角「立即发布到线上」，即可把当前内容推到公网。";
      return;
    }
    box.innerHTML = "上次发布：<b>" + esc(meta.at) + "</b>" +
      (meta.sha ? " · commit <code>" + esc(short(meta.sha)) + "</code>" : "") +
      '<br>公网网址：<a href="' + esc(CFG.site) + '" target="_blank" rel="noopener">' + esc(CFG.site) + "</a>" +
      '　·　<a href="' + esc(COMMITS_URL) + '" target="_blank" rel="noopener">查看提交记录</a>' +
      (justPublished
        ? '<br><b style="color:#7ff0be">刚刚发布成功</b>：GitHub 正在重建站点，约 1 分钟后打开公网网址即可看到（可在网址后加 <code>?v=1</code> 之类的参数绕过浏览器缓存）。'
        : "");
  }

  /* 发布前检查清单 */
  function contentDirty() {
    var st = $("ctStatus");
    if (!st) return false;
    return /(^|\s)dirty(\s|$)/.test(st.className || "");
  }

  function checkItems() {
    var list = [];
    list.push({
      ok: !!token,
      text: token ? "GitHub Token：已保存到本机浏览器（" + maskToken(token) + "）" : "GitHub Token：未填写"
    });
    var dirty = contentDirty();
    list.push({
      ok: !dirty,
      text: dirty
        ? "内容管理：<b>有未保存的修改</b>（发布的是已保存的内容，请先点「保存并生效」）"
        : "内容管理：已保存"
    });
    var st = S.remoteStatus();
    if (st === "loading") {
      list.push({ ok: true, text: "线上数据：正在读取…" });
    } else if (st === "missing") {
      list.push({ ok: true, text: "线上数据：仓库里还没有数据文件，首次发布会自动创建" });
    } else if (st === "error") {
      list.push({ ok: false, text: "线上数据：未读到（离线 / 未开通 Pages / 本页用 file:// 打开）" });
    } else if (st === "loaded") {
      var same = canon(S.get()) === canon(S.getRemote());
      list.push({
        ok: same,
        text: same ? "线上数据：与本机内容一致" : "线上数据：<b>本机有未发布的修改</b>"
      });
    } else {
      list.push({ ok: true, text: "线上数据：尚未读取（点击「检测线上连接」可读取）" });
    }
    return list;
  }

  function renderCheck() {
    var box = $("pbCheckList");
    if (!box) return;
    box.innerHTML = checkItems().map(function (it) {
      return '<p><span class="pb-badge ' + (it.ok ? "ok" : "dirty") + '">' + (it.ok ? "OK" : "注意") +
        "</span><span>" + it.text + "</span></p>";
    }).join("");
  }

  function tick() {
    var key = JSON.stringify([!!token, contentDirty(), S.remoteStatus(),
      S.remoteStatus() === "loaded" ? (canon(S.get()) === canon(S.getRemote()) ? 1 : 0) : -1]);
    if (key === lastTickKey) return;
    lastTickKey = key;
    renderCheck();
  }

  function setBranchLabel(b) {
    var el = $("pbBranch");
    if (!el) return;
    el.textContent = b + (b === CFG.branch ? "" : "（仓库默认分支）");
  }

  /* ---------------- Token 交互 ---------------- */
  function renderToken() {
    var input = $("pbToken");
    var badge = $("pbTokenState");
    var clearBtn = $("pbTokenClear");
    if (input) {
      input.value = "";
      input.placeholder = token
        ? "已保存：" + maskToken(token) + "（需要更换时，直接粘贴新的 Token 后点「保存 Token」）"
        : "粘贴 github_pat_ 开头的细粒度 Token（只保存在本机浏览器）";
    }
    if (badge) {
      badge.textContent = token ? "已保存到本机" : "未填写";
      badge.className = "pb-badge" + (token ? " ok" : "");
    }
    if (clearBtn) clearBtn.disabled = !token;
    renderCheck();
    lastTickKey = "";
  }

  function saveToken() {
    var input = $("pbToken");
    if (!input) return;
    var v = (input.value || "").trim();
    if (!v) { toast("请先粘贴 GitHub Token", "err"); return; }
    if (!/^(github_pat_|ghp_|github_pat)/.test(v)) {
      toast("这看起来不像 GitHub Token（通常以 github_pat_ 开头）", "err");
      return;
    }
    if (!writeToken(v)) { toast("本机存储不可用，Token 未能保存", "err"); return; }
    token = v;
    renderToken();
    toast("Token 已保存到本机浏览器", "ok");
    ensureRemote();
  }

  function clearToken() {
    if (!token) { toast("当前没有已保存的 Token", ""); return; }
    if (!window.confirm("确定要清除本机保存的 GitHub Token 吗？\n\n清除后「发布到线上」需要重新粘贴 Token。线上网站和已发布内容不受影响。")) return;
    dropToken();
    token = "";
    renderToken();
    toast("已清除本机保存的 Token", "ok");
  }

  function toggleTokenView() {
    var input = $("pbToken");
    var btn = $("pbTokenToggle");
    if (!input || !btn) return;
    var show = input.getAttribute("type") === "password";
    input.setAttribute("type", show ? "text" : "password");
    btn.textContent = show ? "隐藏" : "显示";
  }

  /* ---------------- 线上数据读取 ---------------- */
  function ensureRemote() {
    var st = S.remoteStatus();
    if (st === "loading") return;
    if (st === "loaded" || st === "missing") { tick(); return; }
    S.loadRemote().then(function () { tick(); });
  }

  function fetchRemoteFile(ref) {
    return api("GET", CFG.api + "/repos/" + SLUG + "/contents/" + CFG.path + "?ref=" + encodeURIComponent(ref || activeBranch))
      .then(function (r) {
        if (r.status === 404) return { exists: false, sha: "", data: null, size: 0 };
        if (!r.ok) throw { step: "read", status: r.status, json: r.json };
        var raw = "";
        try { raw = b64DecodeUtf8(String((r.json && r.json.content) || "").replace(/\s/g, "")); }
        catch (e) { raw = ""; }
        var data = null;
        try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
        return { exists: true, sha: (r.json && r.json.sha) || "", data: data, size: (r.json && r.json.size) || 0 };
      });
  }

  /* ---------------- 检测连接 ---------------- */
  function check() {
    if (busy) return;
    if (!token) { toast("请先填写并保存 GitHub Token", "err"); focusToken(); return; }
    if (typeof fetch !== "function") { toast("当前浏览器不支持联网提交，请用 Chrome / Edge 打开后台", "err"); return; }

    busy = true; setBusy();
    resetSteps();
    setStep("auth", "doing", "正在校验 Token 与仓库权限…");

    api("GET", CFG.api + "/repos/" + SLUG)
      .then(function (r) {
        if (!r.ok) throw { step: "auth", status: r.status, json: r.json };
        var p = (r.json && r.json.permissions) || {};
        if (p.push === false) {
          throw { step: "auth", status: 403, json: { message: "Token 对该仓库没有写入权限" } };
        }
        activeBranch = (r.json && r.json.default_branch) || CFG.branch;
        setBranchLabel(activeBranch);
        setStep("auth", "ok", "仓库 " + esc((r.json && r.json.full_name) || SLUG) +
          " · 分支 " + esc(activeBranch) + " · 写入权限正常");
        setStep("read", "doing", "正在读取线上数据文件…");
        return fetchRemoteFile(activeBranch);
      })
      .then(function (info) {
        if (!info.exists) {
          S.setRemoteState("missing");
          setStep("read", "ok", "仓库里还没有 " + esc(CFG.path) + "，首次发布会自动创建");
        } else if (!info.data) {
          S.setRemoteState("error");
          setStep("read", "err", "线上数据文件存在但内容无法解析，下次发布会用本机内容覆盖修正");
        } else {
          S.setRemote(info.data);
          setStep("read", "ok", "线上版本 " + short(info.sha) + " · " + fmtSize(info.size) + " · 已读取");
        }
        setStep("pages", "wait", "");
        tick();
        toast("连接正常，可以发布", "ok");
      })
      .catch(function (err) {
        var st = err && err.status;
        setStep((err && err.step) || "auth", "err", explain(st, err && err.json));
        toast("检测未通过，请查看下方步骤说明", "err");
      })
      .then(function () { busy = false; setBusy(); });
  }

  /* ---------------- 发布到线上 ---------------- */
  function publish() {
    if (busy) return;
    if (!token) { toast("请先填写并保存 GitHub Token", "err"); focusToken(); return; }
    if (typeof fetch !== "function") { toast("当前浏览器不支持联网提交，请用 Chrome / Edge 打开后台", "err"); return; }

    var data = S.get();
    var dirty = contentDirty();
    var sizeKb = Math.max(1, Math.round(JSON.stringify(data).length / 1024));

    var msg = "确定要把当前内容发布到线上吗？\n\n" +
      "仓库：" + SLUG + "\n" +
      "分支：" + activeBranch + "\n" +
      "文件：" + CFG.path + "\n" +
      "内容大小：约 " + sizeKb + " KB\n\n" +
      "提交成功后 GitHub Pages 会自动重建（约 1 分钟），之后所有访客在该网址看到的就是这份内容。";
    if (dirty) msg += "\n\n注意：「内容管理」里还有未保存的修改，它们不会被发布，请先点「保存并生效」。";
    if (!window.confirm(msg)) return;

    busy = true; setBusy();
    resetSteps();
    timerSeq++;
    setStep("auth", "doing", "正在校验 Token 与仓库权限…");

    api("GET", CFG.api + "/repos/" + SLUG)
      .then(function (r) {
        if (!r.ok) throw { step: "auth", status: r.status, json: r.json };
        var p = (r.json && r.json.permissions) || {};
        if (p.push === false) {
          throw { step: "auth", status: 403, json: { message: "Token 对该仓库没有写入权限" } };
        }
        activeBranch = (r.json && r.json.default_branch) || CFG.branch;
        setBranchLabel(activeBranch);
        setStep("auth", "ok", "写入权限正常 · " + esc((r.json && r.json.full_name) || SLUG) +
          " · 分支 " + esc(activeBranch));
        setStep("read", "doing", "正在读取线上数据文件版本…");
        return fetchRemoteFile(activeBranch);
      })
      .then(function (info) {
        if (info.exists) {
          setStep("read", "ok", "线上当前版本 " + short(info.sha) + " · " + fmtSize(info.size) + "，将以本机内容更新");
        } else {
          setStep("read", "ok", "线上还没有该文件，本次发布会创建它");
        }
        setStep("write", "doing", "正在提交数据文件…");
        var body = {
          message: "更新站点内容（后台发布 " + nowStr() + "）",
          content: b64EncodeUtf8(JSON.stringify(data, null, 2) + "\n"),
          branch: activeBranch
        };
        if (info.sha) body.sha = info.sha;
        return api("PUT", CFG.api + "/repos/" + SLUG + "/contents/" + CFG.path, body);
      })
      .then(function (r) {
        if (!r.ok) throw { step: "write", status: r.status, json: r.json };
        var cm = (r.json && r.json.commit) || {};
        var sha = cm.sha || "";
        setStep("write", "ok", "提交成功 · commit " + short(sha) +
          ' · <a href="' + esc(cm.html_url || COMMITS_URL) + '" target="_blank" rel="noopener">查看提交</a>');
        setStep("pages", "doing", "已触发 GitHub Pages 重建，通常 1 分钟内完成…");

        writeMeta({ at: nowStr(), sha: sha, commitUrl: cm.html_url || "", site: CFG.site });
        /* 让本机立刻以「线上已发布数据」为基准 */
        S.setRemote(data);
        renderStatus(true);
        tick();
        toast("发布成功，约 1 分钟后所有访客可见", "ok");

        var seq = timerSeq;
        setTimeout(function () {
          if (seq !== timerSeq) return;
          setStep("pages", "ok", "重建应已完成，打开公网网址核对即可（必要时加 ?v=1 绕过缓存）");
        }, 60000);
      })
      .catch(function (err) {
        var st = err && err.status;
        setStep((err && err.step) || "write", "err", explain(st, err && err.json));
        if (st === 409) setStep("read", "err", "线上文件版本已变化，请点「检测线上连接」刷新后重新发布");
        toast("发布失败，请查看下方步骤说明", "err");
      })
      .then(function () { busy = false; setBusy(); });
  }

  /* ---------------- 按钮状态 ---------------- */
  function setBusy() {
    var ids = ["pbPublish", "pbCheckBtn", "pbTokenSave", "pbTokenClear"];
    ids.forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.disabled = busy;
      if (id === "pbTokenClear") el.disabled = busy || !token;
    });
    var pub = $("pbPublish");
    if (pub) pub.textContent = busy ? "正在处理…" : "立即发布到线上";
    var chk = $("pbCheckBtn");
    if (chk) chk.textContent = busy ? "请稍候…" : "检测线上连接";
  }

  function focusToken() {
    var input = $("pbToken");
    if (!input) return;
    input.focus();
    var panel = input.closest(".panel");
    if (panel && panel.scrollIntoView) panel.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    var page = document.querySelector('.admin-page[data-page="publish"]');
    if (!page) return;

    var style = document.createElement("style");
    style.textContent = STYLE;
    document.head.appendChild(style);

    token = readToken();
    setBranchLabel(CFG.branch);
    renderToken();
    resetSteps();
    renderStatus(false);
    renderCheck();

    var save = $("pbTokenSave");
    if (save) save.addEventListener("click", saveToken);
    var clear = $("pbTokenClear");
    if (clear) clear.addEventListener("click", clearToken);
    var toggle = $("pbTokenToggle");
    if (toggle) toggle.addEventListener("click", toggleTokenView);
    var chk = $("pbCheckBtn");
    if (chk) chk.addEventListener("click", check);
    var pub = $("pbPublish");
    if (pub) pub.addEventListener("click", publish);

    var input = $("pbToken");
    if (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); saveToken(); }
      });
    }

    /* 打开「发布到线上」页时才读取线上数据，用于对比本机是否有未发布修改 */
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest('.admin-side a[data-page="publish"]') : null;
      if (!a) return;
      ensureRemote();
      renderStatus(false);
    });

    setInterval(tick, 2000);

    window.GBPublish = {
      CFG: CFG,
      publish: publish,
      check: check,
      hasToken: function () { return !!token; }
    };
  }

  document.addEventListener("DOMContentLoaded", init);
})();
