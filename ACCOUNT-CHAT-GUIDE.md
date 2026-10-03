# 顾手游电竞 · 用户账号与即时聊天 部署 / 使用说明

本文档说明本次新增的**用户注册 / 登录**与**即时聊天（文字 + 压缩图片，不含视频）**功能：如何用 Supabase 免费版把后端跑起来、如何在线上部署、日常怎么用、出问题怎么排查。

- 后端方案：**Supabase 免费版**（Auth 账号体系 + Postgres 数据库 + Storage 图片存储 + Realtime 实时推送），零成本、无需自建服务器。
- 前端形态：与现有站点完全一致的**纯静态页面**，可直接部署到既有的 GitHub Pages（`https://gu060125.github.io/gushou-esports/`）。
- 安全底线：数据库开启 **RLS 行级安全**，所有数据访问都以「登录用户的身份」判定，前端只放**匿名公开 key（anon key）**，绝不放 `service_role` key。

---

## 一、新增文件清单

| 文件 | 类型 | 作用 |
| --- | --- | --- |
| `login.html` | 新增页面 | 登录页（邮箱 + 密码），已登录时自动展示「进入聊天室」入口 |
| `register.html` | 新增页面 | 注册页（昵称 + 邮箱 + 密码 + 确认密码 + 协议勾选） |
| `chat.html` | 新增页面 | 聊天室主页：左侧会话列表、右侧消息区、新建会话 / 建群 / 拉人 / 资料弹窗 |
| `assets/js/supabase-config.js` | 新增脚本 | **唯一需要改的后端配置文件**：项目地址、匿名 key、图片压缩参数等集中在此 |
| `assets/js/account.js` | 新增脚本 | 账号模块：注册、登录、退出、导航栏账号信息、登录态缓存，导出 `window.GB_AUTH` |
| `assets/js/chat.js` | 新增脚本 | 聊天室逻辑：会话列表、一对一 / 群聊、实时消息、图片本地压缩与上传、已读、正在输入、群管理 |
| `assets/css/app.css` | 新增样式 | 登录 / 注册页 + 聊天室布局 + 弹窗 + 图片卡片 + 响应式（沿用现有深色电竞风 token） |
| `sql/supabase-schema.sql` | **重要** | 数据库一键初始化脚本：建表、索引、触发器、RLS 策略、会话汇总视图、业务 RPC、Storage 桶与策略、Realtime 发布 |
| `ACCOUNT-CHAT-GUIDE.md` | 文档 | 本文档 |
| 既有页面改动 | — | `index.html` / `services.html` / `contact.html` 导航新增「聊天室」入口；`assets/js/site-data.js` 页脚导航同步新增；`admin.html` 快捷入口新增「用户聊天室」；`README.md` 增补账号与聊天一节 |

> 数据隔离说明：原有站点内容 / 订单仍保存在浏览器 `localStorage`（`gb_site_v1` / `gb_orders`），**与 Supabase 数据互不影响**；本次新增功能不会读写、更不会破坏原有站点数据。

---

## 二、功能一览

### 1. 账号

- 邮箱 + 密码注册，注册时填写**昵称**（2–20 个字符，支持中文 / 字母 / 数字 / 下划线）。
- 昵称在数据库侧做**唯一性约束**（不区分大小写），重复会被拒绝。
- 登录支持「记住登录态」（刷新页面、关闭标签页后再打开仍是登录状态）；退出登录即时生效。
- 登录后导航栏显示「昵称 · 聊天室」快捷入口。

### 2. 聊天

| 能力 | 说明 |
| --- | --- |
| 会话列表 | 显示每个会话的头像、标题、最后一条消息、时间、**未读红点**，按最后消息时间倒序 |
| 一对一聊天 | 搜索用户 → 点击即创建（或复用）一对一会话，同一对用户不会重复建会话 |
| 群聊 | 输入群名称 + 勾选成员建群；群内可**拉人**、**改群名**、**退群**；群消息带发送者昵称 |
| 实时消息 | 基于 Supabase Realtime，消息 / 会话变更通过 WebSocket 推送，无需刷新页面 |
| 图片发送 | 选择图片 → **浏览器本地压缩**（不消耗服务器额度）→ 上传私有桶 → 消息中展示，点击可看原图 |
| 消息状态 | 对方正在输入提示、未读数、进入会话自动已读 |
| 资料编辑 | 可修改昵称（群里显示的就是这个昵称） |

### 3. 图片压缩与体积限制（发送前在浏览器本地完成）

| 参数 | 默认值 | 配置项（`supabase-config.js`） | 说明 |
| --- | --- | --- | --- |
| 原图上限 | 10 MB | `maxSourceBytes` | 超过直接拒绝，不进入压缩流程 |
| 压缩后最长边 | 1600 px | `compressMaxEdge` | 等比缩放，避免大图浪费流量与存储 |
| 初始 JPEG 质量 | 0.72 | `compressQuality` | 质量不足目标体积时自动逐级下调（最低 0.5） |
| 目标体积 | 500 KB | `compressTargetBytes` | 达到即停止压缩，通常一次压缩即可达标 |
| 上传硬上限 | 1 MB | `maxUploadBytes` | 压缩后仍超标则拒绝并提示 |
| 桶服务端上限 | 2 MB | SQL 脚本内 `file_size_limit` | 服务端兜底，防止绕过前端限制 |

支持 `image/jpeg`、`image/png`、`image/webp`；桶为**私有桶**，图片通过**临时签名链接**（默认 1 小时有效，配置项 `signUrlExpires`）展示，非会话成员无法读取。

---

## 三、Supabase 一次性配置（约 10 分钟）

### 步骤 1：注册并创建项目

1. 打开 <https://supabase.com> 注册（可用 GitHub 账号登录）。
2. 点 **New project**，填写：
   - **Name**：`gushou-esports`（随意）
   - **Database Password**：点 **Generate a password** 生成并**自行保存**（本前端方案用不到它，但重置需要）
   - **Region**：选离用户近的（如 Singapore / Tokyo）
   - **Pricing Plan**：**Free**
3. 点 **Create new project**，等待 1–2 分钟初始化完成。

### 步骤 2：执行数据库脚本（关键步骤）

1. 项目左侧栏 → **SQL Editor** → **New query**。
2. 打开本仓库的 `sql/supabase-schema.sql`，**全文复制**粘贴到编辑器。
3. 点 **Run**（或 `Ctrl + Enter`）。成功时底部显示 `Success. No rows returned`。
4. 脚本是**可重复执行**的（内部使用 `create table if not exists` / `drop policy if exists` 等写法），重复运行不会报错、不会清空数据。

脚本执行后会创建：

| 对象 | 说明 |
| --- | --- |
| `public.profiles` | 用户资料（昵称、头像地址），与 `auth.users` 一一对应；由注册触发器自动建行 |
| `public.conversations` | 会话（`type = direct / group`、群名称、最后消息时间） |
| `public.conversation_members` | 会话成员（含角色 owner / member、未读计数、最后已读位置） |
| `public.messages` | 消息（文字正文 / 图片路径 / 类型 / 时间） |
| `public.conversation_overview`（视图） | 会话列表汇总：标题、最后一条消息、未读数、成员等，前端会话列表直接读它 |
| RPC 函数 | `create_direct_conversation`（建 / 复用一对一）、`create_group_conversation`（建群）、`add_group_members`（拉人）、`leave_conversation`（退群） |
| 辅助函数 / 触发器 | `is_conversation_member`、`is_conversation_owner`（RLS 判定）、新用户自动建档、更新时间戳、新消息更新会话最后时间 |
| Storage 桶 `chat-images` | **私有**图片桶 + 上传 / 读取 / 删除三条策略 |
| Realtime | 把 `messages` / `conversations` / `conversation_members` 加入实时发布 |

### 步骤 3：获取项目地址与匿名 key

左侧栏 → **Project Settings** → **API**：

| 需要复制的内容 | 字段名 | 用途 |
| --- | --- | --- |
| Project URL | `Project URL` | 形如 `https://abcdefghijklmn.supabase.co` |
| 公开密钥 | `anon` `public`（`anon key`） | 前端公开密钥，可放在网页里 |

> ⚠️ **绝对不要复制 `service_role` key**（同页面上写着 `service_role` `secret` 的那一条）。它是全库管理员密钥，一旦写进前端文件等于把数据库开放给所有人。本方案前端只需要 anon key。

### 步骤 4（建议）：调整邮箱验证设置

Supabase 默认开启**邮箱验证**：注册后需到邮箱点击确认链接才能登录。

- **保持默认（推荐）**：更安全，但**每位用户注册后都要去邮箱点一次链接**。免费版自带邮件发送服务有额度限制（每小时几封），仅适合小规模测试。
- **关闭验证（便于快速体验/小范围内部使用）**：左侧栏 **Authentication → Sign In / Providers → Email**，把 **Confirm email** 关掉并保存。关闭后注册即可直接登录（注册页会相应提示）。
- **自定义发信服务**：如要对外开放注册，建议在 **Authentication → Emails → SMTP Settings** 配置自己的发信邮箱（如 QQ 邮箱 / 企业邮箱的 SMTP），避免免费额度耗尽导致注册邮件发不出去。

### 步骤 5（可选）：把线上站点加入允许列表

如果部署在 GitHub Pages，建议到 **Authentication → URL Configuration**：

- **Site URL**：`https://gu060125.github.io/gushou-esports/`
- **Redirect URLs**：加入 `https://gu060125.github.io/gushou-esports/**`

用于「邮箱验证链接跳回站点」等场景（不配置也能正常注册登录，只是验证链接会跳到默认页）。

---

## 四、填入配置（唯一需要改代码的地方）

打开 `assets/js/supabase-config.js`，把前两项换成步骤 3 复制的值：

```js
var CONFIG = {
  /* ---------- 必填：把这两行换成你自己的项目信息 ---------- */
  url: "https://abcdefghijklmn.supabase.co",   // ← 你的 Project URL
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....",  // ← 你的 anon public key

  /* ---------- 以下为可选调优项，一般无需改动 ---------- */
  bucket: "chat-images",
  sdk: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js",
  sdkFallback: "https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js",
  maxSourceBytes: 10 * 1024 * 1024,
  compressMaxEdge: 1600,
  compressQuality: 0.72,
  compressTargetBytes: 500 * 1024,
  maxUploadBytes: 1024 * 1024,
  messagePageSize: 200,
  signUrlExpires: 3600,
  typingTimeout: 3000
};
```

说明：

- 常量 `YOUR-PROJECT-REF` / `YOUR_SUPABASE_ANON_KEY` 是**占位符**，未替换时页面不会报错崩溃，而是弹出「尚未配置 Supabase」的提示条（点提示里的链接可跳回本文档）。
- `sdk` / `sdkFallback` 是 Supabase JS SDK 的两个 CDN 地址，国内网络访问第一个慢时自动切换第二个，一般不用改。
- 配置改完**必须**重新发布（见下一节）才能让线上访客生效。
- **anon key 放在前端是官方设计，本身不构成泄露**；数据安全由数据库 RLS 策略保证。但要记住：`service_role` key 永远不能出现在前端。

---

## 五、部署到线上（沿用现有 GitHub Pages）

### 方式一（推荐）：跟现有站点一起发布

新页面与已有页面同属一个仓库（`Gu060125/gushou-esports`），把以下文件提交到仓库即可，Pages 会自动重建：

```
login.html
register.html
chat.html
assets/css/app.css
assets/js/supabase-config.js
assets/js/account.js
assets/js/chat.js
sql/supabase-schema.sql
ACCOUNT-CHAT-GUIDE.md
（以及 index.html / services.html / contact.html / admin.html / assets/js/site-data.js / README.md 的改动）
```

- 可用现有的「**后台 → 🚀 发布到线上**」流程提交内容数据；**静态文件本身**需要通过 Git 推送（或 GitHub 网页端上传）到仓库，随后 Pages 自动重建，约 1 分钟后生效。
- 上线后地址：`https://gu060125.github.io/gushou-esports/login.html`、`.../register.html`、`.../chat.html`。

### 方式二：本机预览

- ⚠️ 直接用 `file://` 双击打开也能运行，但**部分浏览器会拦截跨域请求 / WebSocket**，导致注册或实时消息异常，**建议用本地 HTTP 服务预览**：

  ```powershell
  # 在站点目录（含 index.html 的目录）执行
  python -m http.server 8080
  # 然后浏览器访问 http://localhost:8080/login.html
  ```

- 若必须用 `file://` 打开，请用 Chrome / Edge，并确认能正常访问 Supabase（提示网络错误时优先改用 HTTP 方式）。

### 部署后的自检清单

1. 打开 `chat.html`，未登录时应被引导到登录页；
2. 注册一个账号（注意是否需要邮箱验证），登录成功；
3. 用第二个浏览器（或隐私窗口）注册另一个账号；
4. A 端「新建会话」搜索 B 的昵称 → 发一条文字，B 端**不刷新页面**应在 1 秒内收到；
5. A 端发一张 3–5 MB 的图，检查提示「已压缩至 XXX KB」并能正常显示、B 端可见；
6. A 端建一个群并拉 B 进群，群内互发消息正常；
7. 越权自检：用 C 账号（非会话成员）尝试访问，看不到 A/B 的会话与消息（数据接口返回空 / 被拒绝）。

---

## 六、日常使用说明

1. **注册**：打开 `register.html`，填昵称、邮箱、密码（至少 6 位）、勾选协议 → 提交。若开启了邮箱验证，去邮箱点确认链接后再登录。
2. **登录**：打开 `login.html`，填邮箱 + 密码 → 登录后自动跳转 `chat.html`；已登录用户打开登录页会看到「进入聊天室」按钮。
3. **发起一对一聊天**：聊天室左上角 **新建会话** → 输入昵称关键词搜索 → 点击用户即可建立会话（同一对用户复用同一会话）。
4. **建群**：**新建会话** 弹窗切到「建群」标签 → 填群名 + 勾选成员 → 创建。
5. **群管理**：进入群会话后，右上角可 **改群名 / 拉人 / 退群**。
6. **发图片**：点输入框旁的回形针按钮选图 → 自动压缩 → 点发送。
7. **改昵称**：左上角账号信息弹窗中修改昵称并保存（群聊中显示的昵称会随之更新）。
8. **退出登录**：账号信息弹窗或导航栏的「退出登录」。

---

## 七、数据表与权限（速查）

| 表 | 关键字段 | 谁能读 | 谁能写 |
| --- | --- | --- | --- |
| `profiles` | `id`(=auth.users.id)、`username`、`display_name`、`avatar_url` | 已登录用户 | 仅本人（注册时由触发器自动建档） |
| `conversations` | `id`、`type`(direct/group)、`title`、`last_message_at` | 仅会话成员 | 创建者（owner）可改 / 删 |
| `conversation_members` | `conversation_id`、`user_id`、`role`、`unread_count` | 仅会话成员 | 本人可退出；owner 可拉人 / 移除 |
| `messages` | `id`、`conversation_id`、`sender_id`、`body`、`image_path`、`created_at` | 仅会话成员 | 仅成员本人（且发送者必须是自己） |
| Storage `chat-images` | 路径 `{conversation_id}/{user_id}/{时间戳}-{随机}.jpg` | 仅该会话成员 | 仅该会话成员；删除仅限本人上传 |

RLS 状态：四张表 `.enable row level security` 均已开启（详见 `sql/supabase-schema.sql` 第 5 节），共 17 条策略；Storage 桶 3 条策略；所有策略仅对 `authenticated` 角色开放，**未登录用户拿不到任何聊天数据**。

---

## 八、常见问题排查

| 现象 | 原因与处理 |
| --- | --- |
| 页面提示「尚未配置 Supabase 项目地址与匿名 key」 | `assets/js/supabase-config.js` 里的 `url` / `anonKey` 还是占位符，按第四节替换后重新发布 |
| 提示「Supabase JS SDK 加载失败，请检查网络」 | 两个 CDN 都访问不通。检查网络 / 代理 / 广告拦截插件；也可把 SDK 文件下载到 `assets/js/` 后把 `sdk` 改成本地相对路径 |
| 注册成功但登录提示「邮箱尚未验证」 | Supabase 默认开启邮箱验证，去邮箱点确认链接；或按步骤 4 关闭 Confirm email（小范围内部使用） |
| 注册报「该邮箱已注册」 | 该邮箱已在 Auth 中存在（含未验证状态），直接登录或用其他邮箱 |
| 注册报「昵称已被占用」 | `profiles.username` 唯一约束生效，换一个昵称 |
| 登录报「邮箱或密码不正确」 | 大小写与前后空格；忘记密码可在 Supabase 后台 **Authentication → Users** 重置 |
| 消息能发但对方收不到实时推送 | ① SQL 脚本第 9 节的 Realtime 发布语句没执行成功，重跑脚本；② 页面被浏览器休眠；③ 网络不稳定，刷新页面即恢复（消息本身已入库） |
| 图片发不出去，提示体积超标 | 图片压缩后仍超过 1 MB（`maxUploadBytes`）：改用 JPG 或先裁剪；也可调大 `maxUploadBytes` 并同步调大 SQL 里的 `file_size_limit` |
| 图片显示为「加载失败 / 已过期」 | 签名链接默认 1 小时有效，刷新页面会重新生成；若长期失败，检查 Storage 桶是否被改动或策略是否被删 |
| 建群 / 拉人报错 | 优先确认 SQL 脚本中的 4 个 RPC 函数已创建（SQL Editor 里可执行 `select proname from pg_proc where proname like '%conversation%'` 核对） |
| 换设备后看不到历史消息 | 聊天数据存在 Supabase 云端，换设备只要登录同一账号即可看到；看不到通常是登录了不同账号 |
| 免费额度相关顾虑 | 免费版有数据库 500 MB、Storage 1 GB、月活用户数与带宽等限制。文字聊天占用极小；图片因已压缩到 500 KB 以内，正常小团队使用足够。可在 Supabase 后台 **Reports** 查看用量 |

---

## 九、安全注意事项

1. **前端只放 anon key**：`service_role` key 代表全库管理员权限，**严禁**写入任何前端文件或提交到仓库。
2. **不要关闭 RLS**：所有数据隔离依赖 RLS，关闭后任何拿到 anon key 的人都能读取全部聊天记录。
3. **上传图片会经过浏览器压缩**，但请提醒用户不要发送身份证、银行卡等敏感信息截图；聊天内容存在第三方（Supabase）云端。
4. **管理员不等于能看聊天**：Supabase 后台可查看数据库表，属于运营侧权限，请勿用于窥探用户私聊，并在站点声明中告知用户。
5. **未成年人保护与合规**：站点为游戏代练业务，需遵守当地法律法规与游戏平台用户协议，做好未成年人保护与理性消费引导（与现有 README 免责声明一致）。

---

## 十、参数调优速查

| 想达到的效果 | 改哪里 |
| --- | --- |
| 图片更清晰（体积更大） | `compressQuality` 提到 `0.8`、`compressTargetBytes` 提到 `1024 * 1024`，并同步调大 SQL 里的 `file_size_limit` |
| 更省流量 | `compressMaxEdge` 降到 `1280`、`compressTargetBytes` 降到 `300 * 1024` |
| 图片链接更久不过期 | `signUrlExpires` 调大（单位秒，如 `86400`） |
| 单次拉取更多历史消息 | `messagePageSize` 调大（如 `500`） |
| 换图片存储桶名 | 同时改 `bucket` 与 SQL 脚本第 8 节的桶名（保持一致） |

---

*（本文档为部署与使用说明，站点内容与价格均为示例数据；内容由 AI 生成，仅供参考。）*
