/* =========================================================
   顾手游电竞 · 账号模块（注册 / 登录 / 退出 / 导航状态）
   依赖：assets/js/supabase-config.js
   页面：login.html、register.html、chat.html 以及各公开页的导航账号入口
   ========================================================= */
(function () {
  "use strict";

  var CACHE_KEY = "gb_chat_user";   // 本地缓存的用户摘要，仅用于导航展示，不作为鉴权凭据

  /* ---------------- 工具 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function toast(msg, type) {
    if (window.GB_toast) window.GB_toast(msg, type);
    else if (type === "err") alert(msg);
  }
  function qs(name) {
    var m = new RegExp("[?&]" + name + "=([^&]*)").exec(location.search);
    return m ? decodeURIComponent(m[1]) : "";
  }

  function cacheUser(u) {
    try {
      if (u) localStorage.setItem(CACHE_KEY, JSON.stringify(u));
      else localStorage.removeItem(CACHE_KEY);
    } catch (e) { /* 隐私模式下忽略 */ }
  }
  function readCachedUser() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch (e) { return null; }
  }

  /* ---------------- 会话与资料 ---------------- */
  function getClient() { return window.GB_SUPABASE.getClient(); }

  function getSession() {
    return getClient().then(function (sb) {
      return sb.auth.getSession().then(function (r) { return r.data ? r.data.session : null; });
    });
  }

  function getProfile(userId) {
    return getClient().then(function (sb) {
      return sb.from("profiles").select("id, username, display_name, avatar_url").eq("id", userId).maybeSingle();
    }).then(function (r) {
      if (r.error) throw r.error;
      return r.data;
    });
  }

  /* 当前登录用户 + 资料摘要（未登录返回 null） */
  function currentUser() {
    return getSession().then(function (session) {
      if (!session || !session.user) return null;
      var u = session.user;
      return getProfile(u.id).catch(function () { return null; }).then(function (p) {
        var summary = {
          id: u.id,
          email: u.email,
          username: (p && p.username) || (u.user_metadata && u.user_metadata.username) || "",
          display_name: (p && p.display_name) || (u.user_metadata && u.user_metadata.display_name) || (u.email || "").split("@")[0],
          avatar_url: (p && p.avatar_url) || ""
        };
        cacheUser(summary);
        return summary;
      });
    });
  }

  /* 未登录则跳转登录页，并带上回跳地址 */
  function requireLogin(nextUrl) {
    return currentUser().then(function (user) {
      if (user) return user;
      var next = nextUrl || (location.pathname.split("/").pop() || "chat.html") + location.search;
      location.replace("login.html?next=" + encodeURIComponent(next));
      return null;
    });
  }

  function signOut() {
    return getClient().then(function (sb) {
      return sb.auth.signOut();
    }).then(function () {
      cacheUser(null);
      toast("已退出登录", "ok");
      setTimeout(function () { location.href = "index.html"; }, 500);
    });
  }

  function signIn(email, password) {
    return getClient().then(function (sb) {
      return sb.auth.signInWithPassword({ email: email, password: password });
    }).then(function (r) {
      if (r.error) throw r.error;
      if (!r.data.session) throw new Error("登录未成功，请先完成邮箱验证");
      return r.data.session;
    });
  }

  /* 注册：username 写入 user_metadata，由数据库触发器落库到 profiles */
  function signUp(email, password, username) {
    var redirectTo = location.href.replace(/register\.html.*$/, "chat.html");
    return getClient().then(function (sb) {
      return sb.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { username: username, display_name: username },
          emailRedirectTo: redirectTo
        }
      });
    }).then(function (r) {
      if (r.error) throw r.error;
      return r.data;   // { user, session }；session 为空表示还需邮箱验证
    });
  }

  /* ---------------- 导航栏账号入口（公开页使用，不加载 SDK） ---------------- */
  function initNavAccount() {
    var box = $(".nav-actions");
    if (!box || $(".nav-account", box)) return;

    var chip = document.createElement("a");
    chip.className = "btn btn-ghost btn-sm nav-account";
    chip.href = "chat.html";

    var cached = readCachedUser();
    if (cached && (cached.display_name || cached.username)) {
      chip.textContent = (cached.display_name || cached.username) + " · 聊天室";
    } else {
      chip.textContent = "登录 / 聊天室";
      chip.href = "login.html?next=" + encodeURIComponent("chat.html");
    }
    box.appendChild(chip);

    /* 如果本页加载了 SDK（登录/注册/聊天页之外的场景一般不会），顺手校准一次 */
    if (window.GB_SUPABASE && window.GB_SUPABASE.isConfigured && window.GB_SUPABASE.isConfigured()) {
      currentUser().then(function (user) {
        if (!user) return;
        chip.textContent = (user.display_name || user.username) + " · 聊天室";
        chip.href = "chat.html";
      }).catch(function () { /* 静默 */ });
    }
  }

  /* ---------------- 登录页 ---------------- */
  function initLoginPage() {
    var form = $("#loginForm");
    if (!form) return;

    if (!window.GB_SUPABASE.isConfigured()) { showSetupBanner(); return; }

    var alertOk = $("#loginSuccess");
    var alertErr = $("#loginError");
    var btn = $("#loginBtn");

    function setErr(msg) {
      if (alertErr) { alertErr.textContent = msg; alertErr.classList.add("show"); }
      if (alertOk) alertOk.classList.remove("show");
    }
    function setOk(msg) {
      if (alertOk) { alertOk.textContent = msg; alertOk.classList.add("show"); }
      if (alertErr) alertErr.classList.remove("show");
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = $("#loginEmail").value.trim();
      var pwd = $("#loginPassword").value;

      if (!email || email.indexOf("@") < 0) return setErr("请填写正确的邮箱地址");
      if (!pwd || pwd.length < 6) return setErr("密码至少 6 位");

      btn.disabled = true;
      btn.textContent = "登录中…";

      signIn(email, pwd)
        .then(currentUser)
        .then(function (user) {
          setOk("登录成功，正在进入聊天室…");
          var next = qs("next") || "chat.html";
          setTimeout(function () { location.href = next; }, 600);
          return user;
        })
        .catch(function (err) {
          var msg = (err && err.message) || "登录失败";
          if (/Invalid login credentials/i.test(msg)) msg = "邮箱或密码不正确";
          if (/Email not confirmed/i.test(msg)) msg = "邮箱尚未验证，请先到邮箱点击验证链接";
          setErr(msg);
        })
        .then(function () {
          btn.disabled = false;
          btn.textContent = "登 录";
        });
    });

    /* 已登录用户直接进聊天室 */
    currentUser().then(function (u) {
      if (u) setOk("你已登录：" + (u.display_name || u.username) + "，可点下方按钮直接进入聊天室");
    }).catch(function () { /* 未登录，正常忽略 */ });
  }

  /* ---------------- 注册页 ---------------- */
  function initRegisterPage() {
    var form = $("#registerForm");
    if (!form) return;

    if (!window.GB_SUPABASE.isConfigured()) { showSetupBanner(); return; }

    var alertOk = $("#regSuccess");
    var alertErr = $("#regError");
    var btn = $("#registerBtn");

    function setErr(msg) {
      if (alertErr) { alertErr.textContent = msg; alertErr.classList.add("show"); }
      if (alertOk) alertOk.classList.remove("show");
    }
    function setOk(msg) {
      if (alertOk) { alertOk.textContent = msg; alertOk.classList.add("show"); }
      if (alertErr) alertErr.classList.remove("show");
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var username = $("#regUsername").value.trim();
      var email = $("#regEmail").value.trim();
      var pwd = $("#regPassword").value;
      var pwd2 = $("#regPassword2").value;

      if (username.length < 2 || username.length > 20) return setErr("昵称需 2-20 个字符");
      if (!/^[\u4e00-\u9fa5A-Za-z0-9_]+$/.test(username)) return setErr("昵称只能包含中文、字母、数字和下划线");
      if (!email || email.indexOf("@") < 0) return setErr("请填写正确的邮箱地址");
      if (!pwd || pwd.length < 6) return setErr("密码至少 6 位");
      if (pwd !== pwd2) return setErr("两次输入的密码不一致");
      if (!$("#regAgree").checked) return setErr("请先阅读并同意用户协议");

      btn.disabled = true;
      btn.textContent = "提交中…";

      signUp(email, pwd, username)
        .then(function (data) {
          if (data.session) {
            setOk("注册成功，正在进入聊天室…");
            cacheUser({
              id: data.user.id, email: data.user.email,
              username: username, display_name: username, avatar_url: ""
            });
            setTimeout(function () { location.href = "chat.html"; }, 700);
          } else {
            setOk("注册成功！验证邮件已发送到 " + email + "，请点击邮件中的链接完成验证后返回登录。");
            form.reset();
          }
        })
        .catch(function (err) {
          var msg = (err && err.message) || "注册失败";
          if (/already registered|already been registered/i.test(msg)) msg = "该邮箱已注册，请直接登录";
          if (/Password should be at least/i.test(msg)) msg = "密码强度不足，请至少 6 位";
          setErr(msg);
        })
        .then(function () {
          btn.disabled = false;
          btn.textContent = "注 册";
        });
    });
  }

  /* ---------------- 未配置时的引导条 ---------------- */
  function showSetupBanner() {
    var box = document.createElement("div");
    box.className = "alert alert-info show setup-banner";
    box.innerHTML = "账号与聊天功能尚未接入后端：请打开 <code>assets/js/supabase-config.js</code>，" +
      "填入 Supabase 的 Project URL 与 anon key，并在 SQL Editor 执行 <code>sql/supabase-schema.sql</code>。" +
      ' 详见 <a href="ACCOUNT-CHAT-GUIDE.md">部署与使用说明</a>。';
    var anchor = $("main") || document.body;
    anchor.insertBefore(box, anchor.firstChild);
  }

  /* ---------------- 导出 ---------------- */
  window.GB_AUTH = {
    getClient: getClient,
    getSession: getSession,
    currentUser: currentUser,
    requireLogin: requireLogin,
    signIn: signIn,
    signUp: signUp,
    signOut: signOut,
    getProfile: getProfile,
    cacheUser: cacheUser,
    readCachedUser: readCachedUser,
    showSetupBanner: showSetupBanner,
    toast: toast
  };

  document.addEventListener("DOMContentLoaded", function () {
    initNavAccount();
    initLoginPage();
    initRegisterPage();
    /* 备注：聊天室内的「账号信息」弹窗由 chat.js 接管，避免同一表单被绑定两次提交 */

    /* 各页右上角的"退出登录"按钮 */
    document.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest("[data-gb-signout]") : null;
      if (b) { e.preventDefault(); signOut(); }
    });
  });

})();
