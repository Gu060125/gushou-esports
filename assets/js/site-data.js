/* =========================================================
   顾手游电竞 · 站点数据层 + 前台渲染引擎
   -------------------------------------------------
   数据来源优先级：localStorage(gb_site_v1) > 内置默认数据(DEFAULTS)
   后台「内容管理」修改后写入 localStorage，前台刷新即生效。
   品牌名统一由 DEFAULTS.brand 提供，旧数据中的旧品牌会自动迁移。
   ========================================================= */
(function () {
  "use strict";

  var KEY = "gb_site_v1";

  /* ---------------- 品牌信息（全站唯一来源） ---------------- */
  var BRAND = {
    name: "顾手游电竞",
    short: "GU ESPORTS",
    /* 旧品牌名 → 新品牌名的迁移词典（用于修正已存在于本机的旧数据） */
    legacy: [
      [/GameBoost\s*极速代练/g, "顾手游电竞"],
      [/GameBoost_CS/g, "Gushou_CS"],
      [/service@gameboost\.demo/g, "service@gushou.demo"],
      [/WHY GAMEBOOST/g, "WHY GU ESPORTS"],
      /* 旧英文眉题/标语（旧数据里可能是全大写形式） */
      [/GAME\s+BOOSTING/g, "GU ESPORTS"],
      [/GAMEBOOST/g, "GU ESPORTS"],
      [/GameBoost/g, "顾手游电竞"],
      [/gameboost/g, "gushou"],
      /* 旧编号前缀 GB-（打手/工号）→ 新前缀 GS- */
      [/GB-(\d{3,4})/g, "GS-$1"]
    ],
    legacyShort: "极速代练"
  };

  /* ---------------- 默认站点数据 ---------------- */
  var DEFAULTS = {
    brand: {
      name: BRAND.name,
      short: BRAND.short,
      slogan: "实名打手 · 进度可视 · 封号包赔",
      footerDesc: "专业游戏段位代练与陪玩服务平台，实名打手、进度可视、封号包赔。"
    },

    hero: {
      eyebrow: "GU ESPORTS SERVICE PLATFORM",
      titleHtml: '让每一段<span class="grad-text">排位冲刺</span><br>都变成确定的结果',
      lead: "顾手游电竞专注于游戏段位代练与陪玩服务：实名认证打手、全程进度可视化、封号包赔、隐私加密。无论是赛季末的最后一颗星，还是新赛季的定级赛，我们都能给你一个明确的时间表。",
      primaryText: "查看服务与价目 →",
      secondaryText: "联系客服下单",
      boardTitle: "实时代练进度看板",
      boardLive: "进行中 12 单",
      stats: [
        { value: "86,400+", label: "累计完成订单" },
        { value: "4.9 / 5.0", label: "用户满意度" },
        { value: "98.6%", label: "准时交付率" },
        { value: "7×24h", label: "客服在线" }
      ],
      board: [
        { badge: "青铜→白银", title: "英雄联盟 · 单人代练", sub: "打手：GS-2071 · 已进行 3 小时", value: "75%" },
        { badge: "星耀→王者", title: "王者荣耀 · 排位上分", sub: "打手：GS-1188 · 已进行 5 小时", value: "52%" },
        { badge: "黄金→铂金", title: "无畏契约 · 定级赛", sub: "打手：GS-3345 · 已进行 1.5 小时", value: "90%" },
        { badge: "陪玩", title: "永劫无间 · 双排陪玩", sub: "陪玩师：GS-0092 · 已进行 2 小时", value: "进行中" }
      ]
    },

    industry: {
      eyebrow: "INDUSTRY OVERVIEW",
      titleHtml: '游戏代练产业：一个被低估的<span class="grad-text">服务型市场</span>',
      desc: "游戏代练并非简单的“帮人打游戏”，它本质上是竞技游戏生态中的时间置换服务——用专业玩家的时间与技能，替代普通玩家无法投入的练习时长，从而交付一个明确的段位结果。",
      cards: [
        { icon: "🎮", num: "01 / 需求端", title: "需求从哪来", text: "竞技类游戏普遍采用赛季制排位体系，段位直接绑定赛季奖励、限定皮肤、荣誉标识与社交身份。而上班族、学生群体的可用游戏时长被严重压缩，“有段位需求、无时间投入”形成了稳定且持续的需求缺口。" },
        { icon: "🧑‍💻", num: "02 / 供给端", title: "供给由谁提供", text: "供给侧由高段位职业选手、退役半职业玩家、高分路人王组成，他们具备稳定的胜率与英雄池深度。头部平台通过实名认证、押金机制、段位审核与违约金条款，把零散的个体技能组织成可交付的服务产能。" },
        { icon: "🔁", num: "03 / 商业模式", title: "平台如何运转", text: "主流模式为“C2B2C 撮合 + 平台担保”：用户下单付款进入平台托管，平台派单给认证打手，完成后按阶段验收结算，平台抽取一定比例服务佣金，并对纠纷提供仲裁与赔付。" },
        { icon: "📈", num: "04 / 产业链", title: "产业链上下游", text: "上游是账号资源、加速器与手柄外设等配套服务；中游是代练与陪玩服务本身；下游延伸出战绩分析、代肝活动、限定皮肤解锁、账号托管与游戏内容代运营等增值业务。" },
        { icon: "⚠️", num: "05 / 行业痛点", title: "长期以来存在的问题", text: "价格不透明、进度无反馈、中途加价、打手跑单、账号密码泄露，以及最关键的封号风险，是用户最集中的五类抱怨。这些痛点决定了这个行业的核心竞争力其实是“信任与流程”。" },
        { icon: "🛡️", num: "06 / 趋势与合规", title: "走向规范化", text: "行业正在从“贴吧散单”向“平台化、标准化、可视化”演进：实名打手、进度直播、分阶段付款、封号赔付条款、隐私加密传输，逐步成为服务标配。合规与风控能力，正在取代低价成为新的竞争壁垒。" }
      ]
    },

    metrics: [
      { value: "86,400+", label: "累计服务订单" },
      { value: "1,260", label: "实名认证打手" },
      { value: "32", label: "支持游戏 / 区服" },
      { value: "98.6%", label: "订单准时交付率" },
      { value: "4.9", label: "平均用户评分（5 分制）" },
      { value: "18 分钟", label: "平均派单响应时间" },
      { value: "< 2.1%", label: "售后纠纷率" },
      { value: "7×24h", label: "客服与风控值守" }
    ],

    advantages: {
      eyebrow: "WHY GU ESPORTS",
      titleHtml: '为什么选择我们的<span class="grad-text">四项保障</span>',
      desc: "我们用流程和可验证的机制，替代口头承诺。",
      items: [
        { icon: "🔐", title: "隐私与账号安全", text: "登录信息采用加密通道传输，任务完成后自动失效；打手端全程脱敏，客服仅在必要节点查看。" },
        { icon: "📺", title: "进度可视化", text: "每日战报推送、关键对局录屏、实时段位截图，进度可随时查询，不需要反复追问。" },
        { icon: "💰", title: "分阶段付款", text: "资金由平台托管，按阶段验收释放；未达成约定段位，按比例退款，拒绝中途坐地起价。" },
        { icon: "🛡️", title: "封号包赔条款", text: "签署明确的服务协议，因代练操作导致的账号处罚，按协议约定进行赔付与补偿。" }
      ]
    },

    steps: {
      eyebrow: "HOW IT WORKS",
      title: "四步完成一单",
      desc: "从咨询到交付，每一步都有明确的确认节点。",
      items: [
        { title: "需求沟通", text: "说明游戏、区服、当前段位与目标段位，客服给出定价与预计工时。" },
        { title: "确认下单", text: "确认报价与交付时间，签署电子服务协议，资金进入平台托管。" },
        { title: "派单执行", text: "系统匹配实名打手接单，每日推送战报与进度截图，全程可视。" },
        { title: "验收交付", text: "达到目标段位后验收，释放款项并生成订单凭证，支持售后服务。" }
      ]
    },

    cta: {
      home: {
        title: "赛季快结束了，还差几颗星？",
        desc: "说出你的段位目标，30 秒内给你明确报价与交付时间。",
        primaryText: "立即联系客服",
        secondaryText: "查看价目表"
      },
      services: {
        title: "不确定该选哪种服务？",
        desc: "把当前段位和目标发给客服，我们帮你算出最短路径与最省钱的组合方案。",
        primaryText: "联系客服获取方案",
        secondaryText: ""
      }
    },

    servicesPage: {
      eyebrow: "SERVICE CATALOG",
      title: "服务项目与价目表",
      desc: "覆盖主流竞技类游戏的六大服务类型。所有报价均为含平台担保的最终价，下单前确认，执行中不加价。"
    },

    servicesIntro: {
      eyebrow: "SERVICE TYPES",
      title: "六大核心服务",
      desc: "按需选择服务类型，客服会结合你的当前段位给出精确工时与价格。"
    },

    services: {
      items: [
        {
          online: true, tag: "最热销", icon: "🏆", name: "段位代练", price: "¥ 68", unit: "起 / 小段",
          desc: "由高段位实名打手接力完成段位提升，按小段计价，跨大段另有阶梯优惠。",
          features: ["单人代练，全程录像留档", "每日战报 + 段位截图推送", "支持指定英雄 / 指定位置", "未达标按比例退款"]
        },
        {
          online: true, tag: "赛季末热门", icon: "⚡", name: "排位上分", price: "¥ 12", unit: "起 / 星",
          desc: "按“星”计费的小颗粒度服务，适合只差几颗星上段的临门一脚需求。",
          features: ["按星计价，用多少买多少", "支持加急通道（+30% 服务费）", "可指定完成时间段", "连败保护：连败超 3 局暂停并复盘"]
        },
        {
          online: true, tag: "", icon: "🎯", name: "定级赛 / 定位赛", price: "¥ 158", unit: "起 / 十局",
          desc: "新赛季定级赛全权代办，目标是把隐藏分打到理想起点，为整个赛季打好基础。",
          features: ["十局打包价，胜率目标 70% 以上", "完成后附赛季上分建议", "支持跨区定级", "开局前可沟通英雄池偏好"]
        },
        {
          online: true, tag: "", icon: "🎧", name: "双排陪玩", price: "¥ 45", unit: "起 / 小时",
          desc: "账号仍由你自己操作，高段位陪玩师带你上分并同步讲解答疑，适合想提升自身水平的人。",
          features: ["语音沟通，实时战术讲解", "可选指定位置 / 指定英雄配合", "按小时计费，可续单", "账号全程由本人持有"]
        },
        {
          online: true, tag: "", icon: "🗂️", name: "账号托管", price: "¥ 30", unit: "起 / 天",
          desc: "短期托管代管账号，用于维护当前段位不掉分，或完成日常活跃任务保持状态。",
          features: ["保分托管，不掉段位", "每日活跃任务 / 通行证进度", "登录信息加密存储，到期失效", "可随时中止托管"]
        },
        {
          online: true, tag: "", icon: "🧩", name: "活动 / 通行证代肝", price: "¥ 25", unit: "起 / 阶段",
          desc: "赛季通行证、限时活动、材料刷取等重复性任务代为完成，把时间留给真正想玩的内容。",
          features: ["按阶段 / 按目标打包报价", "适用于限时活动与成长资源", "完成后交付进度截图", "支持多账号批量处理"]
        }
      ]
    },

    pricing: {
      eyebrow: "PRICE LIST",
      title: "分游戏价目表",
      desc: "下表为常用区间参考价，实际价格以客服根据当前段位、区服与完成时间给出的报价为准。",
      note: "* 以上为演示用示例价格，不代表真实市场报价。加急服务统一收取 30% 加急费；跨区服务可能产生额外区服费用。",
      rows: [
        { game: "英雄联盟", service: "排位上分", range: "青铜 → 白银", price: "¥ 68 / 小段", hours: "约 4 小时", status: "可接单", tone: "ok" },
        { game: "英雄联盟", service: "排位上分", range: "白银 → 黄金", price: "¥ 88 / 小段", hours: "约 5 小时", status: "可接单", tone: "ok" },
        { game: "英雄联盟", service: "排位上分", range: "黄金 → 铂金", price: "¥ 128 / 小段", hours: "约 8 小时", status: "可接单", tone: "ok" },
        { game: "英雄联盟", service: "排位上分", range: "铂金 → 钻石", price: "¥ 168 / 小段", hours: "约 10 小时", status: "需预约", tone: "hot" },
        { game: "英雄联盟", service: "排位上分", range: "钻石 → 大师", price: "¥ 320 / 小段", hours: "约 16 小时", status: "需预约", tone: "hot" },
        { game: "英雄联盟", service: "定级赛", range: "新赛季十局", price: "¥ 198 起", hours: "约 6 小时", status: "可接单", tone: "ok" },
        { game: "英雄联盟", service: "双排陪玩", range: "不限段位", price: "¥ 55 / 小时", hours: "预约制", status: "可接单", tone: "ok" },
        { game: "英雄联盟", service: "账号托管", range: "保分不掉段", price: "¥ 35 / 天", hours: "按天结算", status: "长期可谈", tone: "info" },

        { game: "王者荣耀", service: "排位上分", range: "青铜 → 黄金", price: "¥ 10 / 星", hours: "约 3 小时", status: "可接单", tone: "ok" },
        { game: "王者荣耀", service: "排位上分", range: "黄金 → 铂金", price: "¥ 12 / 星", hours: "约 4 小时", status: "可接单", tone: "ok" },
        { game: "王者荣耀", service: "排位上分", range: "铂金 → 钻石", price: "¥ 15 / 星", hours: "约 5 小时", status: "可接单", tone: "ok" },
        { game: "王者荣耀", service: "排位上分", range: "星耀 → 王者", price: "¥ 22 / 星", hours: "约 8 小时", status: "需预约", tone: "hot" },
        { game: "王者荣耀", service: "巅峰赛", range: "1200 → 1500 分", price: "¥ 3.5 / 分", hours: "约 12 小时", status: "需预约", tone: "hot" },
        { game: "王者荣耀", service: "定级赛", range: "新赛季十局", price: "¥ 158 起", hours: "约 6 小时", status: "可接单", tone: "ok" },
        { game: "王者荣耀", service: "双排陪玩", range: "不限段位", price: "¥ 45 / 小时", hours: "预约制", status: "可接单", tone: "ok" },
        { game: "王者荣耀", service: "战力代练", range: "单英雄战力提升", price: "¥ 1.2 / 战力点", hours: "按目标计算", status: "按需报价", tone: "info" },

        { game: "无畏契约", service: "定级赛", range: "五局定位", price: "¥ 128 起", hours: "约 4 小时", status: "可接单", tone: "ok" },
        { game: "无畏契约", service: "排位上分", range: "铁牌 → 铜牌", price: "¥ 60 / 段", hours: "约 4 小时", status: "可接单", tone: "ok" },
        { game: "无畏契约", service: "排位上分", range: "铜牌 → 银牌", price: "¥ 85 / 段", hours: "约 6 小时", status: "可接单", tone: "ok" },
        { game: "无畏契约", service: "排位上分", range: "银牌 → 金牌", price: "¥ 120 / 段", hours: "约 8 小时", status: "名额紧张", tone: "warn" },
        { game: "无畏契约", service: "排位上分", range: "金牌 → 铂金", price: "¥ 180 / 段", hours: "约 12 小时", status: "需预约", tone: "hot" },
        { game: "无畏契约", service: "双排陪玩", range: "不限段位", price: "¥ 68 / 小时", hours: "预约制", status: "可接单", tone: "ok" },
        { game: "无畏契约", service: "账号托管", range: "保分不掉段", price: "¥ 45 / 天", hours: "按天结算", status: "长期可谈", tone: "info" },

        { game: "永劫无间", service: "排位上分", range: "青铜 → 白银", price: "¥ 50 / 段", hours: "约 3 小时", status: "可接单", tone: "ok" },
        { game: "永劫无间", service: "排位上分", range: "白银 → 黄金", price: "¥ 75 / 段", hours: "约 5 小时", status: "可接单", tone: "ok" },
        { game: "永劫无间", service: "排位上分", range: "黄金 → 铂金", price: "¥ 110 / 段", hours: "约 7 小时", status: "可接单", tone: "ok" },
        { game: "永劫无间", service: "排位上分", range: "铂金 → 星耀", price: "¥ 160 / 段", hours: "约 10 小时", status: "名额紧张", tone: "warn" },
        { game: "永劫无间", service: "双排陪玩", range: "不限段位", price: "¥ 58 / 小时", hours: "预约制", status: "可接单", tone: "ok" },
        { game: "永劫无间", service: "活动代肝", range: "限时活动 / 通行证", price: "¥ 25 起 / 阶段", hours: "按目标计算", status: "可接单", tone: "ok" }
      ]
    },

    guarantee: {
      eyebrow: "SERVICE GUARANTEE",
      title: "服务保障条款",
      desc: "以下条款会在下单时以电子协议形式确认，双方各留一份凭证。",
      items: [
        { title: "下单须知", text: "1. 下单需提供游戏名称、区服、当前段位截图与目标段位；\n2. 请勿在代练期间自行登录账号，避免挤号导致进度中断；\n3. 代练期间账号内的点券、皮肤等资产由用户自行负责保管；\n4. 完成任务后的 3 天内若出现段位回退，可申请免费补打一次。" },
        { title: "退款与赔付", text: "1. 未开始执行的订单，支持全额退款；\n2. 已开始执行的订单，按已完成的阶段比例结算，剩余部分退回；\n3. 因代练操作导致的账号处罚，按服务协议约定条款进行赔付；\n4. 交付时间因平台原因延后超过 50%，可申请 20% 工时补偿。" }
      ]
    },

    faq: {
      services: [
        { q: "代练期间我的账号会有风险吗？", a: "平台要求打手使用独立设备与固定网络环境，并规避高风险的登录行为；同时登录凭证经加密通道传输，任务完成即失效。代练本身存在游戏官方规则层面的风险，我们通过签署服务协议与封号赔付条款来覆盖这部分不确定性，下单前客服会明确告知相关条款。" },
        { q: "价格是按什么标准计算的？", a: "主要参考四个因素：当前段位与目标段位的跨度、所在区服的竞争强度、是否需要指定英雄或位置、以及交付时间要求。段位跨度越大、区服越硬核、指定条件越多，单价越高。所有报价在下单前一次性确认，执行过程中不会加价。" },
        { q: "可以用其他方式付款吗？", a: "本站为静态演示站点，不提供真实支付能力。实际业务中，平台通常支持微信、支付宝与对公转账，资金由平台托管并按阶段释放。请勿向任何个人账户直接转账。" },
        { q: "多久能完成一单？", a: "普通排位代练通常 1 至 3 天完成，跨度较大的订单可能需要 3 至 7 天。加急订单可通过延长单日时长压缩交付周期，具体时间在下单时以客服给出的交付时间为准。" }
      ],
      contact: [
        { q: "提交需求后多久会收到报价？", a: "客服在岗时段通常 18 分钟内响应；深夜时段（00:00 - 09:00）可能延迟至次日早间。若长时间未收到回复，建议通过微信直接联系。" },
        { q: "需要提供账号密码吗？", a: "段位代练与托管类服务在执行阶段需要登录凭证；陪玩类服务全程由你本人操作，无需提供。所有凭证仅在任务期间有效，任务结束后请及时修改密码。" },
        { q: "本站的留言会被保存在哪里？", a: "本站为纯静态演示站点，表单数据仅保存在你本机浏览器的 localStorage 中，可通过“管理后台”页面的订单列表查看，不会上传到任何服务器。" }
      ]
    },

    contactPage: {
      eyebrow: "CONTACT US",
      title: "联系入口与在线下单",
      desc: "选择你最方便的渠道联系我们，或直接填写下方需求表单。客服平均 18 分钟内响应，7×24 小时在线。"
    },

    contact: {
      title: "联系方式",
      desc: "点右侧按钮可一键复制账号信息。",
      items: [
        { icon: "💬", label: "客服 QQ", value: "800-123-456", note: "适合发送段位截图，沟通报价细节", copy: true },
        { icon: "📱", label: "客服微信", value: "Gushou_CS", note: "添加时请备注“代练 + 游戏名”", copy: true },
        { icon: "✉️", label: "商务邮箱", value: "service@gushou.demo", note: "团队批量订单、渠道合作请走邮箱", copy: true },
        { icon: "☎️", label: "客服热线", value: "400-000-1234", note: "夜间时段请优先使用在线客服", copy: true },
        { icon: "🕐", label: "服务时间", value: "在线客服 7×24 小时值守", note: "派单与打手排期以客服确认为准", copy: false }
      ],
      qrTitle: "扫码添加专属客服",
      qrDesc: "添加后可获取实时报价与进度查询",
      qrNote: "客服微信二维码（演示占位，此处放置实际二维码图片）",
      formTitle: "在线提交需求",
      formDesc: "填写以下信息提交后，你的需求单会进入后台订单列表（本站为静态演示，数据保存在本机浏览器中）。",
      formNote: "提交即表示你已阅读并同意服务条款；未成年人请在监护人陪同下咨询。本站为演示站点，不会真实发送或上传任何数据。",
      channelsEyebrow: "OTHER CHANNELS",
      channelsTitle: "其他沟通渠道",
      channelsDesc: "根据不同需求场景，选择最合适的对接方式。",
      channels: [
        { icon: "🚀", title: "加急订单通道", text: "需要在 24 小时内完成的高优先级订单，请直接添加微信并注明“加急”。加急订单统一加收 30% 服务费，且受打手排期限制。" },
        { icon: "🏢", title: "战队 / 团队批量", text: "公会、战队、直播间的批量上分与托管需求，可联系商务邮箱，支持签订年度框架协议与专属打手团队配置。" },
        { icon: "🤝", title: "打手入驻合作", text: "如果你具备稳定的高段位实力，欢迎申请成为认证打手；需提交账号段位证明并通过实名与试单考核，享受阶梯分成。" }
      ],
      faqEyebrow: "BEFORE YOU ORDER",
      faqTitle: "下单前请确认"
    },

    footer: {
      nav: [
        { text: "首页", href: "index.html" },
        { text: "服务项目", href: "services.html" },
        { text: "联系下单", href: "contact.html" },
        { text: "管理后台", href: "admin.html" }
      ],
      services: ["段位代练", "排位上分", "定级赛 / 定位赛", "双排陪玩"],
      contactLines: ["客服QQ：800-123-456", "微信：Gushou_CS", "邮箱：service@gushou.demo", "服务时间：7×24 小时"],
      copyright: "© 2026 顾手游电竞 · 本站为静态演示站点，所有数据均为示例内容",
      tip: "理性游戏 · 适度消费 · 未成年人禁止下单"
    }
  };

  /* ---------------- 基础工具 ---------------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function nl2br(s) { return esc(s).replace(/\n/g, "<br>"); }

  function getPath(obj, path) {
    if (!obj || !path) return undefined;
    var parts = String(path).split(".");
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function setPath(obj, path, val) {
    var parts = String(path).split(".");
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var k = parts[i];
      if (cur[k] == null || typeof cur[k] !== "object") cur[k] = {};
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = val;
    return obj;
  }

  /* 深合并：以默认结构为骨架，用已保存数据覆盖 */
  function merge(base, over) {
    if (Array.isArray(base)) return Array.isArray(over) ? clone(over) : clone(base);
    if (base && typeof base === "object") {
      var out = {};
      for (var k in base) {
        if (!has(base, k)) continue;
        out[k] = (over && typeof over === "object" && has(over, k)) ? merge(base[k], over[k]) : clone(base[k]);
      }
      if (over && typeof over === "object" && !Array.isArray(over)) {
        for (var k2 in over) if (has(over, k2) && !has(base, k2)) out[k2] = clone(over[k2]);
      }
      return out;
    }
    return over === undefined ? base : over;
  }

  /* ---------------- 旧品牌迁移（只修正旧品牌字串，不改动用户自己写的其它文案） ---------------- */
  function fixText(v) {
    for (var i = 0; i < BRAND.legacy.length; i++) {
      v = v.replace(BRAND.legacy[i][0], BRAND.legacy[i][1]);
    }
    return v;
  }

  function walkBrand(node, flag) {
    if (typeof node === "string") {
      var out = fixText(node);
      if (out !== node) flag.changed = true;
      return out;
    }
    if (Array.isArray(node)) {
      return node.map(function (it) { return walkBrand(it, flag); });
    }
    if (node && typeof node === "object") {
      var o = {};
      for (var k in node) if (has(node, k)) o[k] = walkBrand(node[k], flag);
      return o;
    }
    return node;
  }

  function migrateBrand(data) {
    var flag = { changed: false };
    var out = walkBrand(data, flag);
    if (out && out.brand) {
      if (out.brand.short === BRAND.legacyShort) { out.brand.short = BRAND.short; flag.changed = true; }
      if (!out.brand.name) { out.brand.name = BRAND.name; flag.changed = true; }
    }
    return { data: out, changed: flag.changed };
  }

  /* ---------------- 读写 ---------------- */
  function readRaw() {
    try {
      var raw = localStorage.getItem(KEY);
      var v = raw ? JSON.parse(raw) : null;
      return (v && typeof v === "object") ? v : null;
    } catch (e) { return null; }
  }

  function get() {
    var stored = readRaw();
    if (!stored) return clone(DEFAULTS);
    var data = migrateBrand(merge(DEFAULTS, stored));
    /* 迁移结果立即落盘，保证前台、后台读到的都是新品牌名 */
    if (data.changed) save(data.data);
    return data.data;
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  }

  function reset() {
    try { localStorage.removeItem(KEY); return true; }
    catch (e) { return false; }
  }

  function isCustomized() { return readRaw() !== null; }

  /* ---------------- 渲染模板 ---------------- */
  function pill(text, tone) {
    var map = { ok: "pill-ok", hot: "pill-hot", warn: "pill-warn", info: "pill-info", mute: "pill-mute" };
    return '<span class="pill ' + (map[tone] || "pill-info") + '">' + esc(text) + "</span>";
  }

  var TPL = {
    stat: function (it) {
      return '<div class="stat"><b>' + esc(it.value) + '</b><span>' + esc(it.label) + "</span></div>";
    },

    progress: function (it) {
      return '<div class="rank-item"><span class="rank-badge">' + esc(it.badge) + "</span>" +
        '<div class="ri-body"><b>' + esc(it.title) + "</b><span>" + esc(it.sub) + "</span></div>" +
        '<span class="ri-val">' + esc(it.value) + "</span></div>";
    },

    industryCard: function (it) {
      return '<article class="card reveal"><div class="card-icon">' + esc(it.icon) + "</div>" +
        '<span class="card-num">' + esc(it.num) + "</span><h3>" + esc(it.title) + "</h3>" +
        "<p>" + esc(it.text) + "</p></article>";
    },

    metric: function (it) {
      return '<div class="card metric"><b>' + esc(it.value) + "</b><span>" + esc(it.label) + "</span></div>";
    },

    advantage: function (it) {
      return '<div class="card reveal"><div class="card-icon">' + esc(it.icon) + "</div><h3>" +
        esc(it.title) + "</h3><p>" + esc(it.text) + "</p></div>";
    },

    step: function (it) {
      return '<div class="step"><h4>' + esc(it.title) + "</h4><p>" + esc(it.text) + "</p></div>";
    },

    serviceCard: function (it) {
      if (it.online === false) return "";
      var tag = it.tag ? '<span class="tag">' + esc(it.tag) + "</span>" : "";
      var unit = it.unit ? " <small>" + esc(it.unit) + "</small>" : "";
      var feats = (it.features || []).map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("");
      return '<article class="card service-card reveal">' + tag +
        '<div class="card-icon">' + esc(it.icon) + "</div><h3>" + esc(it.name) + "</h3>" +
        '<div class="price">' + esc(it.price) + unit + "</div><p>" + esc(it.desc) + "</p>" +
        "<ul>" + feats + "</ul>" +
        '<a class="btn btn-ghost btn-sm" href="contact.html">咨询报价</a></article>';
    },

    guarantee: function (it) {
      return '<div class="card"><h3>' + esc(it.title) + "</h3><p>" + nl2br(it.text) + "</p></div>";
    },

    contactItem: function (it) {
      var btn = it.copy === false ? "" :
        '<button class="btn btn-ghost btn-sm copy-btn" type="button" data-copy="' + esc(it.value) + '">复制</button>';
      var note = it.note ? '<p style="font-size:12.4px">' + esc(it.note) + "</p>" : "";
      return '<div class="contact-item"><span class="ci-icon">' + esc(it.icon) + "</span>" +
        "<div><h4>" + esc(it.label) + "</h4><p>" + esc(it.value) + "</p>" + note + "</div>" + btn + "</div>";
    },

    channel: function (it) {
      return '<div class="card reveal"><div class="card-icon">' + esc(it.icon) + "</div><h3>" +
        esc(it.title) + "</h3><p>" + esc(it.text) + "</p></div>";
    },

    footerNav: function (it) {
      return '<a href="' + esc(it.href || "#") + '">' + esc(it.text) + "</a>";
    },

    footerPlain: function (it) { return "<p>" + esc(it) + "</p>"; }
  };

  /* ---------------- 渲染 ---------------- */
  function renderText(data) {
    document.querySelectorAll("[data-gb-text]").forEach(function (el) {
      var v = getPath(data, el.getAttribute("data-gb-text"));
      if (v !== undefined && v !== null && typeof v !== "object") el.textContent = v;
    });
  }

  function renderHtml(data) {
    document.querySelectorAll("[data-gb-html]").forEach(function (el) {
      var v = getPath(data, el.getAttribute("data-gb-html"));
      if (typeof v === "string" && v) el.innerHTML = v;
    });
  }

  function renderLists(data) {
    document.querySelectorAll("[data-gb-list]").forEach(function (box) {
      var items = getPath(data, box.getAttribute("data-gb-list"));
      var tpl = TPL[box.getAttribute("data-gb-tpl")];
      if (!tpl || !Array.isArray(items)) return;
      box.innerHTML = items.map(function (it) { return tpl(it); }).join("");
    });
  }

  function renderPricing(data) {
    document.querySelectorAll("[data-gb-pricing]").forEach(function (box) {
      var rows = getPath(data, "pricing.rows") || [];
      var games = [], map = {};
      rows.forEach(function (r) {
        if (games.indexOf(r.game) < 0) games.push(r.game);
        if (!map[r.game]) map[r.game] = [];
        map[r.game].push(r);
      });

      var tabs = games.map(function (g, i) {
        return '<button class="tab' + (i === 0 ? " active" : "") + '" type="button" data-tab="gb-tab-' + i + '">' + esc(g) + "</button>";
      }).join("");

      var panels = games.map(function (g, i) {
        var body = map[g].map(function (r) {
          return "<tr><td><b>" + esc(r.service) + "</b></td><td>" + esc(r.range) + "</td>" +
            '<td class="td-price">' + esc(r.price) + "</td><td>" + esc(r.hours) + "</td><td>" +
            pill(r.status, r.tone) + "</td></tr>";
        }).join("");
        return '<div class="tab-panel' + (i === 0 ? " active" : "") + '" data-panel="gb-tab-' + i + '">' +
          '<div class="table-wrap"><table><thead><tr><th>服务项目</th><th>段位区间</th>' +
          "<th>参考单价</th><th>预计工时</th><th>状态</th></tr></thead><tbody>" + body +
          "</tbody></table></div></div>";
      }).join("");

      box.innerHTML = '<div class="tabs">' + tabs + "</div>" + panels;
    });
  }

  function renderFaqs(data) {
    document.querySelectorAll("[data-gb-faq]").forEach(function (box) {
      var items = getPath(data, box.getAttribute("data-gb-faq")) || [];
      box.innerHTML = items.map(function (it, i) {
        return '<div class="faq-item' + (i === 0 ? " open" : "") + '">' +
          '<button class="faq-q" type="button">' + esc(it.q) + "<i>+</i></button>" +
          '<div class="faq-a"><p>' + esc(it.a) + "</p></div></div>";
      }).join("");
    });
  }

  /* 属性渲染：data-gb-href / data-gb-src / data-gb-copy */
  function renderAttrs(data) {
    document.querySelectorAll("[data-gb-href]").forEach(function (el) {
      var v = getPath(data, el.getAttribute("data-gb-href"));
      if (typeof v === "string" && v) el.setAttribute("href", v);
    });
    document.querySelectorAll("[data-gb-src]").forEach(function (el) {
      var v = getPath(data, el.getAttribute("data-gb-src"));
      if (typeof v === "string" && v) el.setAttribute("src", v);
    });
    document.querySelectorAll("[data-gb-copy]").forEach(function (el) {
      var v = getPath(data, el.getAttribute("data-gb-copy"));
      if (typeof v === "string" && v) {
        el.setAttribute("data-copy", v);
        el.setAttribute("data-gb-copy", v);
      }
    });
  }

  /* 下拉选项渲染：data-gb-options="games" | "services" */
  function renderOptions(data) {
    document.querySelectorAll("[data-gb-options]").forEach(function (sel) {
      var kind = sel.getAttribute("data-gb-options");
      var holder = sel.getAttribute("data-gb-placeholder") || "请选择";
      var arr = [];

      if (kind === "games") {
        (getPath(data, "pricing.rows") || []).forEach(function (r) {
          if (r && r.game && arr.indexOf(r.game) < 0) arr.push(r.game);
        });
        if (arr.indexOf("其他游戏") < 0) arr.push("其他游戏");
      } else if (kind === "services") {
        (getPath(data, "services.items") || []).forEach(function (s) {
          if (s && s.name && s.online !== false && arr.indexOf(s.name) < 0) arr.push(s.name);
        });
      }

      if (!arr.length) return;
      var cur = sel.value;
      sel.innerHTML = '<option value="">' + esc(holder) + "</option>" +
        arr.map(function (v) {
          return '<option value="' + esc(v) + '">' + esc(v) + "</option>";
        }).join("");
      if (cur) sel.value = cur;
    });
  }

  function render() {
    var data = get();
    renderText(data);
    renderHtml(data);
    renderLists(data);
    renderPricing(data);
    renderFaqs(data);
    renderOptions(data);
    renderAttrs(data);
    return data;
  }

  /* ---------------- 对外接口 ---------------- */
  window.GBSite = {
    KEY: KEY,
    DEFAULTS: DEFAULTS,
    get: get,
    save: save,
    reset: reset,
    merge: merge,
    clone: clone,
    getPath: getPath,
    setPath: setPath,
    esc: esc,
    nl2br: nl2br,
    isCustomized: isCustomized,
    brandText: fixText,
    render: render
  };

  document.addEventListener("DOMContentLoaded", function () { render(); });
})();
