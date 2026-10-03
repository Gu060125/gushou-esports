/* =========================================================
   顾手游电竞 · Supabase 集中配置（唯一需要修改的后端配置文件）
   ---------------------------------------------------------
   使用步骤：
     1. 登录 https://supabase.com 新建免费项目
     2. Project Settings → API，复制 Project URL 与 anon public key
     3. 把下面的 url / anonKey 换掉（其余项一般无需改动）
     4. 在 SQL Editor 执行 sql/supabase-schema.sql
   ---------------------------------------------------------
   安全说明：
     · anon key 是"公开密钥"，放在前端页面里是官方设计，本身不构成泄露；
       数据安全完全由数据库的 RLS 策略保证（见 sql/supabase-schema.sql 第 5 节）。
     · 千万不要把 service_role key 写进前端文件。
   ========================================================= */
(function () {
  "use strict";

  var CONFIG = {
    /* ---------- 必填：把这两行换成你自己的项目信息 ---------- */
    url: "https://YOUR-PROJECT-REF.supabase.co",     // ← 例：https://abcdefghijklmn.supabase.co
    anonKey: "YOUR_SUPABASE_ANON_KEY",               // ← 例：eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....

    /* ---------- 存储 ---------- */
    bucket: "chat-images",        // 图片私有桶，由 SQL 脚本自动创建

    /* ---------- SDK 加载地址（国内网络访问 jsdelivr 慢时可换第二个） ---------- */
    sdk: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js",
    sdkFallback: "https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js",

    /* ---------- 图片压缩参数（发送前在浏览器本地压缩，省流量省额度） ---------- */
    maxSourceBytes: 10 * 1024 * 1024,   // 单张原图上限 10MB，超过直接拒绝
    compressMaxEdge: 1600,              // 压缩后最长边像素
    compressQuality: 0.72,              // 初始 JPEG 质量
    compressTargetBytes: 500 * 1024,    // 目标体积 500KB（达标即停）
    maxUploadBytes: 1024 * 1024,        // 压缩后硬上限 1MB，仍超标会被拒绝

    /* ---------- 业务参数 ---------- */
    messagePageSize: 200,         // 单个会话一次拉取的消息条数
    signUrlExpires: 3600,         // 图片临时链接有效期（秒）
    typingTimeout: 3000           // "对方正在输入"提示的保持时长（毫秒）
  };

  var state = { client: null, sdkPromise: null };

  function isConfigured() {
    return !!CONFIG.url &&
           !!CONFIG.anonKey &&
           CONFIG.url.indexOf("YOUR-PROJECT-REF") === -1 &&
           CONFIG.anonKey.indexOf("YOUR_SUPABASE_ANON_KEY") === -1;
  }

  /* 动态加载 supabase-js（只有登录/注册/聊天页才会用到，首页不加载） */
  function loadSdk() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    if (state.sdkPromise) return state.sdkPromise;

    state.sdkPromise = new Promise(function (resolve, reject) {
      var tried = [];
      function inject(src, next) {
        tried.push(src);
        var s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = function () {
          if (window.supabase && window.supabase.createClient) resolve();
          else next();
        };
        s.onerror = function () { next(); };
        document.head.appendChild(s);
      }
      function fail() {
        reject(new Error("Supabase JS SDK 加载失败，请检查网络：" + tried.join(" / ")));
      }
      inject(CONFIG.sdk, function () { inject(CONFIG.sdkFallback, fail); });
    });
    return state.sdkPromise;
  }

  /* 单例客户端 */
  function getClient() {
    if (state.client) return Promise.resolve(state.client);
    if (!isConfigured()) {
      return Promise.reject(new Error("尚未配置 Supabase 项目地址与匿名 key，请编辑 assets/js/supabase-config.js"));
    }
    return loadSdk().then(function () {
      state.client = window.supabase.createClient(CONFIG.url, CONFIG.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      return state.client;
    });
  }

  window.GB_SUPABASE = {
    cfg: CONFIG,
    isConfigured: isConfigured,
    loadSdk: loadSdk,
    getClient: getClient,
    /* 配置说明页，缺配置时的引导链接 */
    guideUrl: "ACCOUNT-CHAT-GUIDE.md"
  };
})();
