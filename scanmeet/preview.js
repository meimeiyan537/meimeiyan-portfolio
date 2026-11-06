/* 静态预览交互：语言 / 主题 / 标签页切换 + 离线链接接管 */
(function () {
  "use strict";

  var LANGS = { zh: "中文", en: "English", es: "Español" };
  var PAGE_LABELS = {
    overview: { zh: "数据总览", en: "Overview", es: "Resumen" },
    visitors: { zh: "访客追踪", en: "Visitor tracking", es: "Visitantes" },
    leads: { zh: "客户留资", en: "Leads", es: "Contactos" },
    products: { zh: "产品资料", en: "Products", es: "Productos" },
    editor: { zh: "展示页编辑", en: "Page editor", es: "Editor de página" },
    organization: { zh: "组织工作台", en: "Organization", es: "Organización" },
    profile: { zh: "个人资料", en: "Profile", es: "Perfil" }
  };
  var THEMES = [
    { id: "industrial", label: { zh: "工业制造", en: "Industrial", es: "Industrial" } },
    { id: "medical", label: { zh: "医疗器械", en: "Medical", es: "Médico" } },
    { id: "tech", label: { zh: "科技互联网", en: "Tech", es: "Tecnología" } }
  ];

  var state = { lang: "zh", page: null, theme: "industrial" };
  var root = document.documentElement;

  function pageRoot() {
    return document.querySelector(".pv-page");
  }

  function visibleVariants() {
    var pr = pageRoot();
    if (!pr) return [];
    return Array.prototype.slice.call(pr.querySelectorAll(".pv-variant"));
  }

  function toast(message) {
    var el = document.getElementById("pv-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "pv-toast";
      el.className = "pv-toast";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.setAttribute("data-show", "true");
    clearTimeout(el._timer);
    el._timer = setTimeout(function () {
      el.setAttribute("data-show", "false");
    }, 2200);
  }

  /**
   * 按 id 找元素，但优先在「当前可见的语言变体」里找。
   * 多语言快照里 id 会重复（dedupeIds 会改成 id--v1），直接用 getElementById
   * 会命中隐藏的那一份，滚动就会滚到看不见的地方。
   */
  function visibleById(baseId) {
    if (!baseId) return null;
    var variants = visibleVariants();
    for (var i = 0; i < variants.length; i++) {
      var v = variants[i];
      if (v.hidden) continue;
      var list = v.querySelectorAll("[id]");
      for (var j = 0; j < list.length; j++) {
        var id = list[j].getAttribute("id") || "";
        if (id === baseId || id.indexOf(baseId + "--v") === 0) return list[j];
      }
    }
    return document.getElementById(baseId);
  }

  function render() {
    visibleVariants().forEach(function (v) {
      var variantPage = v.getAttribute("data-pv-page");
      var matchPage = !variantPage || !state.page || variantPage === state.page;
      var matchLang = v.getAttribute("data-pv-lang") === state.lang;
      v.hidden = !(matchPage && matchLang);
    });
  }

  function applyLang(lang) {
    if (!LANGS[lang]) return;
    state.lang = lang;
    root.lang = lang === "zh" ? "zh-CN" : lang;
    render();
    document.querySelectorAll("[data-pv-lang-btn]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-pv-lang-btn") === lang ? "true" : "false");
    });
    document.querySelectorAll("[data-pv-label]").forEach(function (el) {
      var key = el.getAttribute("data-pv-label");
      var table = key === "page" ? PAGE_LABELS : THEMES.reduce(function (acc, t) {
        acc[t.id] = t.label;
        return acc;
      }, {});
      var item = table[el.getAttribute("data-pv-item")];
      if (item) el.textContent = item[lang] || item.zh;
    });
    // 切换语言时，标题与分享卡片文案也跟着换
    refreshMeta();
  }

  function applyPage(pageId) {
    // 快照里没有这一页就别切过去，否则用户点了会「完全没反应」
    var known = visibleVariants().some(function (v) {
      var vp = v.getAttribute("data-pv-page");
      return !vp || vp === pageId;
    });
    if (!known) {
      toast((OFFLINE_MSG.missingPage[state.lang] || OFFLINE_MSG.missingPage.zh) + pageId);
      return;
    }
    state.page = pageId;
    render();
    document.querySelectorAll("[data-pv-page-btn]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-pv-page-btn") === pageId ? "true" : "false");
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function applyTheme(themeId) {
    state.theme = themeId;
    document.querySelectorAll("[data-theme]").forEach(function (el) {
      el.setAttribute("data-theme", themeId);
    });
    document.querySelectorAll("[data-pv-theme-btn]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-pv-theme-btn") === themeId ? "true" : "false");
    });
  }

  /* --- 构建工具条 --- */
  function buildToolbar() {
    var pr = pageRoot();
    if (!pr) return;
    var kind = pr.getAttribute("data-pv-page");
    var fab = document.createElement("button");
    fab.className = "pv-fab";
    fab.type = "button";
    fab.innerHTML = '<span class="pv-fab-dot"></span><span>静态预览</span>';
    var panel = document.createElement("div");
    panel.className = "pv-panel";
    panel.hidden = true;

    var html = '<div class="pv-panel-title"><span class="pv-fab-dot"></span>码上见 ScanMeet · 静态预览</div>';
    html += '<div class="pv-label">界面语言</div><div class="pv-group" data-pv-lang-group>';
    Object.keys(LANGS).forEach(function (code) {
      html +=
        '<button type="button" class="pv-pill" data-pv-lang-btn="' +
        code +
        '" aria-pressed="' +
        (code === state.lang ? "true" : "false") +
        '">' +
        LANGS[code] +
        "</button>";
    });
    html += "</div>";

    if (kind === "workbench") {
      html += '<div class="pv-label">页面</div><div class="pv-group" data-pv-page-group>';
      Object.keys(PAGE_LABELS).forEach(function (id) {
        html +=
          '<button type="button" class="pv-pill" data-pv-page-btn="' +
          id +
          '" aria-pressed="' +
          (id === "overview" ? "true" : "false") +
          '"><span data-pv-label="page" data-pv-item="' +
          id +
          '">' +
          PAGE_LABELS[id].zh +
          "</span></button>";
      });
      html += "</div>";
    }

    if (kind === "card") {
      html += '<div class="pv-label">名片主题</div><div class="pv-group" data-pv-theme-group>';
      THEMES.forEach(function (t) {
        html +=
          '<button type="button" class="pv-pill" data-pv-theme-btn="' +
          t.id +
          '" aria-pressed="' +
          (t.id === state.theme ? "true" : "false") +
          '"><span data-pv-label="theme" data-pv-item="' +
          t.id +
          '">' +
          t.label.zh +
          "</span></button>";
      });
      html += "</div>";
    }

    html += '<div class="pv-label">当前显示身份</div>';
    html += '<div class="pv-identity" data-pv-identity></div>';
    html +=
      '<div class="pv-group">' +
      '<button type="button" class="pv-pill" data-pv-identity-copy>复制身份链接</button>' +
      '<button type="button" class="pv-pill" data-pv-identity-clear>恢复示例人物</button>' +
      "</div>";

    html += '<div class="pv-links">';
    if (kind !== "card") {
      html += '<a class="pv-link" href="card.html">访客名片页预览 <span>→</span></a>';
    }
    if (kind !== "workbench") {
      html += '<a class="pv-link" href="workbench.html">销售工作台预览 <span>→</span></a>';
    }
    if (kind !== "landing") {
      html += '<a class="pv-link" href="index.html">产品介绍页 <span>→</span></a>';
    }
    html += "</div>";

    html +=
      '<p class="pv-hint">本页面为离线静态快照：数据为演示样例，登录、留资提交与真实埋点需要连接后端服务。直接把文件发给同事，双击任意 .html 即可打开。</p>';

    panel.innerHTML = html;
    document.body.appendChild(fab);
    document.body.appendChild(panel);
    refreshIdentityPanel();

    fab.addEventListener("click", function () {
      panel.hidden = !panel.hidden;
    });

    panel.addEventListener("click", function (e) {
      var langBtn = e.target.closest("[data-pv-lang-btn]");
      if (langBtn) {
        applyLang(langBtn.getAttribute("data-pv-lang-btn"));
        return;
      }
      var pageBtn = e.target.closest("[data-pv-page-btn]");
      if (pageBtn) {
        applyPage(pageBtn.getAttribute("data-pv-page-btn"));
        return;
      }
      var themeBtn = e.target.closest("[data-pv-theme-btn]");
      if (themeBtn) {
        applyTheme(themeBtn.getAttribute("data-pv-theme-btn"));
        return;
      }
      var copyIdentityBtn = e.target.closest("[data-pv-identity-copy]");
      if (copyIdentityBtn) {
        copyIdentityLink();
        return;
      }
      var clearIdentityBtn = e.target.closest("[data-pv-identity-clear]");
      if (clearIdentityBtn) {
        clearLocalUser();
        window.location.reload();
      }
    });
  }

  /* --- 接管应用自带的语言切换按钮（离线时改为切换预览语种） --- */
  function langCodeFromLabel(text) {
    var keys = Object.keys(LANGS);
    for (var i = 0; i < keys.length; i++) {
      if (LANGS[keys[i]] === text) return keys[i];
    }
    return null;
  }

  function interceptAppLocaleButtons() {
    document.addEventListener(
      "click",
      function (e) {
        var target = e.target;
        if (!target || !target.closest) return;

        // 工具条自己的语言胶囊走面板内部逻辑，这里放行
        if (target.closest("[data-pv-lang-btn]")) return;

        // 优先使用构建期注入的 data-pv-app-lang（LocaleSwitcher，可靠且不误伤其它按钮）
        var marked = target.closest("[data-pv-app-lang]");
        if (marked) {
          e.preventDefault();
          e.stopPropagation();
          applyLang(marked.getAttribute("data-pv-app-lang"));
          return;
        }

        // 兜底：档案页「语言偏好」选择器（data-locale-option）等按文案识别
        var btn = target.closest("button");
        if (!btn) return;
        var code = langCodeFromLabel((btn.textContent || "").trim());
        if (!code) return;
        e.preventDefault();
        e.stopPropagation();
        applyLang(code);
      },
      true
    );
  }

  /* --- 接管站内链接，避免 file:// 下跳到不存在的路径 --- */
  function interceptLinks() {
    document.addEventListener(
      "click",
      function (e) {
        var a = e.target.closest && e.target.closest("a[href]");
        if (!a) return;
        var href = a.getAttribute("href") || "";
        if (!href || href.charAt(0) === "#") return;
        if (href.indexOf("mailto:") === 0 || href.indexOf("tel:") === 0) return;
        // 外链照常打开
        if (/^https?:\/\//i.test(href)) return;
        // 已经被离线模块接管的链接（复制/下载二维码等）不再拦截
        if (e.target && e.target.closest && e.target.closest("[data-pv-handled]")) return;
        // 预览三个页面之间的相对链接（card.html / workbench.html / index.html）照常跳转
        // 注意要连 # 片段一起去掉再判断，否则 card.html#id=xxx 会被误判成应用路由
        if (/\.html($|\?|#)/i.test(href.split("#")[0])) return;

        e.preventDefault();
        if (href.indexOf("/dashboard") === 0) {
          // 应用路由 → 静态包里的视图 id
          // 注意 /dashboard/page-editor 的视图 id 是 editor，不是 page-editor
          var DASHBOARD_ROUTES = {
            "/dashboard": "overview",
            "/dashboard/visitors": "visitors",
            "/dashboard/leads": "leads",
            "/dashboard/products": "products",
            "/dashboard/page-editor": "editor",
            "/dashboard/organization": "organization",
            "/dashboard/profile": "profile",
          };
          var dashRoute = href.split("?")[0].split("#")[0];
          var id =
            DASHBOARD_ROUTES[dashRoute] || dashRoute.replace(/^\/dashboard\/?/, "") || "overview";
          applyPage(id);
          return;
        }
        if (href.indexOf("/p/") === 0) {
          window.location.href = "card.html";
          return;
        }
        // 应用路由 → 静态包里的对应页面（注册/登录要真的能打开）
        var route = href.split("?")[0].split("#")[0];
        var STATIC_ROUTES = {
          "/": "index.html",
          "/login": "login.html",
          "/register": "register.html",
        };
        if (Object.prototype.hasOwnProperty.call(STATIC_ROUTES, route)) {
          window.location.href = STATIC_ROUTES[route];
          return;
        }
        openOfflineModal(friendlyReason(href));
      },
      true
    );
  }

  /** 把站内路径翻译成人话，别在弹窗里甩一条 /login 给访客 */
  var REASON_LABELS = {
    "/login": { zh: "登录", en: "Sign in", es: "Iniciar sesión" },
    "/register": { zh: "免费注册", en: "Sign up", es: "Registrarse" },
    "/signup": { zh: "免费注册", en: "Sign up", es: "Registrarse" },
    "/onboarding": { zh: "创建我的名片", en: "Create my card", es: "Crear mi tarjeta" },
    "/settings": { zh: "账号设置", en: "Account settings", es: "Ajustes de la cuenta" },
  };

  function friendlyReason(href) {
    var clean = String(href).split("?")[0].split("#")[0];
    var hit = REASON_LABELS[clean];
    if (hit) return hit[state.lang] || hit.zh;
    return href;
  }

  /* --- 原生接管：产品横滑箭头 / 产品详情弹窗 / 表单离线提示 / 锚点跳转 --- */
  var PREV_LABELS = ["上一张", "Previous", "Anterior"];
  var NEXT_LABELS = ["下一张", "Next", "Siguiente"];
  var SHARE_LABELS = ["分享", "Share", "Compartir"];
  var OFFLINE_MSG = {
    lead: {
      zh: "离线静态预览：留资提交与真实埋点需要连接后端服务，此处不会真的发送。",
      en: "Offline static preview: submitting a contact form and real tracking need a backend service; nothing is sent here.",
      es: "Vista previa estática sin conexión: enviar un contacto y el seguimiento real necesitan un servidor; aquí no se envía nada.",
    },
    save: {
      zh: "离线静态预览：保存与提交需要连接后端服务，此处不会真的写入数据。",
      en: "Offline static preview: saving and submitting need a backend service; nothing is written here.",
      es: "Vista previa estática sin conexión: guardar y enviar necesitan un servidor; aquí no se escribe nada.",
    },
    assignHint: {
      zh: "离线快照没有后端，改派线索需要部署完整应用",
      en: "The offline snapshot has no backend — assigning leads needs the full app",
      es: "La copia sin conexión no tiene servidor: asignar contactos requiere la app completa",
    },
    select: {
      zh: "离线静态预览：下拉选项由后端提供，这里打不开。",
      en: "Offline static preview: dropdown options come from the backend, so they cannot open here.",
      es: "Vista previa estática sin conexión: las opciones del desplegable vienen del servidor, no se puede abrir aquí.",
    },
    copy: {
      zh: "链接已复制到剪贴板",
      en: "Link copied to clipboard",
      es: "Enlace copiado al portapapeles",
    },
    identitySaved: {
      zh: "已把页面上的示例人物换成你填的名字（保存在这台设备的浏览器里）",
      en: "The sample person on this page is now the name you entered (saved in this browser)",
      es: "La persona de ejemplo ahora es el nombre que escribiste (guardado en este navegador)",
    },
    identityCopied: {
      zh: "身份链接已复制：在另一台设备（手机/电脑）打开它，就会显示你的名字",
      en: "Identity link copied: open it on another device (phone or PC) and it shows your name",
      es: "Enlace de identidad copiado: ábrelo en otro dispositivo (móvil o PC) y muestra tu nombre",
    },
    identityCleared: {
      zh: "已恢复为示例人物",
      en: "Reset to the sample person",
      es: "Restaurado a la persona de ejemplo",
    },
    noIdentity: {
      zh: "还没有设置身份：先在注册页填姓名，或在工作台保存个人资料",
      en: "No identity set yet: fill in your name on the sign-up page, or save your profile in the workbench",
      es: "Aún no hay identidad: escribe tu nombre en el registro o guarda tu perfil en el panel",
    },
    missingPage: {
      zh: "静态快照里没有这一页：",
      en: "This page is not included in the static snapshot: ",
      es: "Esta página no está incluida en la instantánea estática: ",
    },
    localUpdate: {
      zh: "已在本机更新（静态演示，不会写回服务器）",
      en: "Updated on this device only (static demo, nothing is written back)",
      es: "Actualizado solo en este dispositivo (demo estática, no se guarda en el servidor)",
    },
    csvExported: {
      zh: "已导出 CSV，共 ",
      en: "CSV exported, ",
      es: "CSV exportado, ",
    },
    leadRecorded: {
      zh: "留资已记到本机：工作台「客户留资」里能看到这条记录",
      en: "Saved on this device: the lead now shows up under Leads in the workbench",
      es: "Guardado en este dispositivo: el contacto ya aparece en Contactos del panel",
    },
    leadRequired: {
      zh: "请填写称呼和手机号",
      en: "Please fill in your name and phone number",
      es: "Escribe tu nombre y tu teléfono",
    },
    leadSource: {
      zh: "展示页留资",
      en: "Card page",
      es: "Página de tarjeta",
    },
    pageSaved: {
      zh: "已保存到本机（刷新后仍然生效）",
      en: "Saved on this device (it stays after a refresh)",
      es: "Guardado en este dispositivo (se mantiene tras recargar)",
    },
    qrDownloaded: {
      zh: "二维码已下载（内容是当前站点的名片页地址）",
      en: "QR code downloaded (it points to this site's card page)",
      es: "Código QR descargado (apunta a la tarjeta de este sitio)",
    },
    qrUnavailable: {
      zh: "二维码内核没加载成功，暂时无法生成",
      en: "The QR engine did not load, so it cannot be generated right now",
      es: "El motor QR no cargó, no se puede generar ahora",
    },
  };

  /* --- 离线快照里「没有后端」的入口统一给说法 --- */
  var OFFLINE_MODAL_TEXT = {
    zh: {
      title: "静态演示模式",
      desc: "这是离线静态快照，没有服务器。已经能真用的：名片页留资会记到本机并在工作台「客户留资」里出现、线索状态与已读会存住、能导出 CSV、展示页设置能保存、二维码能下载。不能真用的：注册账号、真实埋点、附件下载、多人协作——这些要连后端。",
      tip: "想用完整可用的版本（能注册、能收线索、团队协作）：按发布包里的 guides/2-full-app-vercel-supabase.md 部署到 Vercel + Supabase。",
      card: "打开访客名片页",
      workbench: "打开销售工作台",
    },
    en: {
      title: "Static demo mode",
      desc: "This is an offline static snapshot with no server. Already working for real: contact form entries are stored on this device and show up under Leads, lead status and read state are kept, CSV export works, page settings save, and the QR code downloads. Not working: real accounts, real tracking, attachment downloads and team collaboration — those need a backend.",
      tip: "For the fully working version (sign-up, lead capture, team collaboration): deploy to Vercel + Supabase following guides/2-full-app-vercel-supabase.md in the package.",
      card: "Open visitor card page",
      workbench: "Open sales workbench",
    },
    es: {
      title: "Modo demo estático",
      desc: "Esta es una instantánea estática sin servidor. Ya funciona de verdad: los contactos se guardan en este dispositivo y aparecen en Contactos, el estado y la lectura se conservan, la exportación CSV funciona, los ajustes de la página se guardan y el QR se descarga. No funciona: cuentas reales, seguimiento real, descarga de adjuntos y colaboración de equipo; eso necesita servidor.",
      tip: "Para la versión completa (registro, captura de contactos, colaboración): despliega en Vercel + Supabase según guides/2-full-app-vercel-supabase.md.",
      card: "Abrir tarjeta de visitante",
      workbench: "Abrir panel de ventas",
    },
  };

  /** 注册 / 登录页提交后的演示结果 */
  var AUTH_DONE_TEXT = {
    register: {
      zh: {
        title: "注册完成",
        desc: "这是离线静态演示包，信息不会上传到任何服务器；但你填的姓名、公司和职位已经保存在这台设备的浏览器里，下面的页面都会显示你的名字。换设备时点「复制身份链接」，把链接发到手机打开，手机上也会显示你的名字。",
        card: "查看访客名片页",
        workbench: "进入销售工作台",
        home: "回到产品介绍页",
        link: "复制身份链接（手机 / 电脑通用）",
      },
      en: {
        title: "Signed up",
        desc: "This is an offline static demo, so nothing is uploaded to any server. But the name, company and title you entered are saved in this browser, and every page below shows your name. To switch devices, copy the identity link and open it on your phone - it shows your name there too.",
        card: "View visitor card page",
        workbench: "Enter the sales workbench",
        home: "Back to product page",
        link: "Copy identity link (phone & PC)",
      },
      es: {
        title: "Registro completado",
        desc: "Esta es una demo estática sin servidor, así que no se sube nada. Pero el nombre, la empresa y el puesto que escribiste quedan guardados en este navegador, y todas las páginas de abajo muestran tu nombre. Para cambiar de dispositivo, copia el enlace de identidad y ábrelo en el móvil: también mostrará tu nombre.",
        card: "Ver tarjeta de visitante",
        workbench: "Entrar al panel de ventas",
        home: "Volver a la página de producto",
        link: "Copiar enlace de identidad (móvil y PC)",
      },
    },
    login: {
      zh: {
        title: "登录完成",
        desc: "这是离线静态演示包，不会真的校验账号密码；但你的身份会保存在这台设备的浏览器里，下面的页面都会显示你的名字。换设备时点「复制身份链接」，把链接发到手机打开，手机上也会显示你的名字。",
        card: "查看访客名片页",
        workbench: "进入销售工作台",
        home: "回到产品介绍页",
        link: "复制身份链接（手机 / 电脑通用）",
      },
      en: {
        title: "Signed in",
        desc: "This is an offline static demo, so credentials are not really checked. Your identity is still saved in this browser, and every page below shows your name. To switch devices, copy the identity link and open it on your phone - it shows your name there too.",
        card: "View visitor card page",
        workbench: "Enter the sales workbench",
        home: "Back to product page",
        link: "Copy identity link (phone & PC)",
      },
      es: {
        title: "Sesión iniciada",
        desc: "Esta es una demo estática sin servidor, así que no se comprueban las credenciales. Tu identidad queda guardada en este navegador, y todas las páginas de abajo muestran tu nombre. Para cambiar de dispositivo, copia el enlace de identidad y ábrelo en el móvil: también mostrará tu nombre.",
        card: "Ver tarjeta de visitante",
        workbench: "Entrar al panel de ventas",
        home: "Volver a la página de producto",
        link: "Copiar enlace de identidad (móvil y PC)",
      },
    },
  };

  /* =====================================================================
   * 本地身份
   * 静态包没有后端，但「谁填的名字，网页就显示谁」必须成立：
   * 注册 / 登录填的信息存进 localStorage，页面渲染时把示例人物换成 TA。
   * 每个浏览器各存各的（手机和电脑互不相通），这是静态站的固有限制。
   * ===================================================================== */
  var LS_USER = "scanmeet_local_user";

  var DEMO_PERSONA = {
    name: ["李明", "Lee Ming", "Li Ming"],
    company: [
      "苏州精工智能装备有限公司",
      "Suzhou Precision Intelligent Equipment Co., Ltd.",
      "Suzhou Precision Intelligent Equipment, S.L.",
    ],
    title: ["华东区销售总监", "Sales Director, East China"],
    email: ["sales@demo.com"],
  };

  function readLocalUser() {
    try {
      var raw = window.localStorage.getItem(LS_USER);
      if (!raw) return null;
      var u = JSON.parse(raw);
      return u && (u.fullName || u.email) ? u : null;
    } catch (e) {
      return null;
    }
  }

  function saveLocalUser(user) {
    try {
      window.localStorage.setItem(LS_USER, JSON.stringify(user));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearLocalUser() {
    try {
      window.localStorage.removeItem(LS_USER);
    } catch (e) {
      /* 忽略：隐私模式 / file:// 下可能不可写 */
    }
  }

  /** 当前用户对应的「示例 → 真实」替换对 */
  function identityPairs(user, previous) {
    var pairs = [];
    function push(demo, mine) {
      if (!mine) return;
      demo.forEach(function (d) {
        if (!d || d === mine) return;
        pairs.push([d, mine]);
      });
    }
    push(DEMO_PERSONA.name, user.fullName);
    push(DEMO_PERSONA.company, user.companyName);
    push(DEMO_PERSONA.title, user.jobTitle);
    // 注册 / 登录页的「演示账号」提示里也有这个邮箱，那里别替换，
    // 否则会变成「演示账号：你自己的邮箱」这种误导。
    if (currentKind() !== "auth") push(DEMO_PERSONA.email, user.email);
    // 上一次的身份也要一起换掉：
    // 同一页里先注册张三、再在留资表单写李四，页面必须立刻变成李四。
    if (previous) {
      push([previous.fullName], user.fullName);
      push([previous.companyName], user.companyName);
      push([previous.jobTitle], user.jobTitle);
      push([previous.email], user.email);
    }
    return pairs;
  }

  /** 把页面上所有示例人物换成当前用户 */
  function applyIdentity(previous) {
    var user = readLocalUser();
    if (!user) return false;
    var pairs = identityPairs(user, previous);
    if (!pairs.length) return false;

    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue) continue;
      var v = node.nodeValue;
      for (var i = 0; i < pairs.length; i++) {
        if (v.indexOf(pairs[i][0]) !== -1) v = v.split(pairs[i][0]).join(pairs[i][1]);
      }
      if (v !== node.nodeValue) node.nodeValue = v;
    }

    // 个人资料编辑页的输入框
    document.querySelectorAll("input, textarea").forEach(function (el) {
      if (el.type === "password") return;
      var v = el.value || "";
      var nv = v;
      for (var i = 0; i < pairs.length; i++) {
        if (nv.indexOf(pairs[i][0]) !== -1) nv = nv.split(pairs[i][0]).join(pairs[i][1]);
      }
      if (nv !== v) el.value = nv;
      var ph = el.getAttribute("placeholder");
      if (ph) {
        var nph = ph;
        for (var j = 0; j < pairs.length; j++) {
          if (nph.indexOf(pairs[j][0]) !== -1) nph = nph.split(pairs[j][0]).join(pairs[j][1]);
        }
        if (nph !== ph) el.setAttribute("placeholder", nph);
      }
    });

    // 图片说明、无障碍标签里也可能有示例人物
    document.querySelectorAll("[title], [alt], [aria-label]").forEach(function (el) {
      ["title", "alt", "aria-label"].forEach(function (attr) {
        var av = el.getAttribute(attr);
        if (!av) return;
        var anv = av;
        for (var k = 0; k < pairs.length; k++) {
          if (anv.indexOf(pairs[k][0]) !== -1) anv = anv.split(pairs[k][0]).join(pairs[k][1]);
        }
        if (anv !== av) el.setAttribute(attr, anv);
      });
    });

    // 头像里的姓名首字（头像只放一个字，替换整名时它会漏掉）
    if (user.fullName) {
      var initials = DEMO_PERSONA.name.map(function (n) {
        return n.slice(0, 1);
      });
      var mineInitial = user.fullName.slice(0, 1);
      document.querySelectorAll("span, div, p, td, strong").forEach(function (el) {
        if (el.children.length) return;
        var t = (el.textContent || "").trim();
        if (!t || t.length > 2) return;
        if (initials.indexOf(t) === -1) return;
        el.textContent = mineInitial;
      });
    }

    if (user.fullName) {
      DEMO_PERSONA.name.forEach(function (demo) {
        if (document.title.indexOf(demo) !== -1) {
          document.title = document.title.split(demo).join(user.fullName);
        }
      });
      if (previous && previous.fullName && previous.fullName !== user.fullName) {
        document.title = document.title.split(previous.fullName).join(user.fullName);
      }
    }
    refreshMeta();
    return true;
  }

  /* =====================================================================
   * 分享卡片（标题 / 描述 / og / twitter / canonical）
   * 链接发到微信、企微、飞书时，对方看到的是标题、描述和缩略图。
   * 这里让它们跟着「当前页面 + 当前语言 + 本机身份」一起变，
   * 而不是构建时写死的「李明 …（静态预览）」。
   * ===================================================================== */

  var META_DESC = {
    landing: {
      zh: "面向 B2B 展会的销售数字名片：上传公司与产品资料包，自动生成专属展示页、短链接与二维码；访客行为全程追踪，留资实时通知到销售。",
      en: "Digital business card for B2B trade shows: upload your company and product assets, get a dedicated page, short link and QR code, with visitor tracking and instant lead alerts.",
      es: "Tarjeta digital para ferias B2B: sube tu empresa y tus productos, obtén página, enlace corto y QR con seguimiento de visitas y avisos de contactos.",
    },
    internal: {
      zh: "码上见 ScanMeet 销售工作台：访客行为时间线、数据看板与留资管理。",
      en: "ScanMeet sales workspace: visitor timeline, dashboards and lead management.",
      es: "Espacio de trabajo ScanMeet: línea de tiempo de visitas, paneles y gestión de contactos.",
    },
  };

  var OG_LOCALE = { zh: "zh_CN", en: "en_US", es: "es_ES" };

  /** 「姓名 · 职位 · 公司」——分享卡片里介绍自己 */
  function identityLine() {
    var user = readLocalUser();
    if (!user) return "";
    var parts = [];
    if (user.fullName) parts.push(user.fullName);
    if (user.jobTitle) parts.push(user.jobTitle);
    if (user.companyName) parts.push(user.companyName);
    return parts.join(" · ");
  }

  function setMetaContent(selector, value) {
    var el = document.querySelector(selector);
    if (el) el.setAttribute("content", value);
  }

  function setLinkHref(rel, href) {
    var el = document.querySelector('link[rel="' + rel + '"]');
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", rel);
      document.head.appendChild(el);
    }
    el.setAttribute("href", href);
  }

  /** 当前页面在站点里的文件名（card.html / index.html …） */
  function currentFileName() {
    var file = (window.location.pathname || "").split("/").pop() || "index.html";
    return file.indexOf(".") === -1 ? "index.html" : file;
  }

  /** 把标题里的示例人物换成当前用户 */
  function replaceDemoName(text) {
    var user = readLocalUser();
    if (!user || !user.fullName) return text;
    var out = text;
    DEMO_PERSONA.name.forEach(function (demo) {
      if (out.indexOf(demo) !== -1) out = out.split(demo).join(user.fullName);
    });
    return out;
  }

  /**
   * 刷新标题 / 描述 / 分享卡片标签。
   * og:url 刻意不带 #id=… 身份片段：分享链接不该把姓名公司明文挂在上面。
   */
  function refreshMeta() {
    var pr = pageRoot();
    var kind = pr ? pr.getAttribute("data-pv-page") : null;
    var base = siteBase();
    var file = currentFileName();
    var local = base.indexOf("file:") === 0;
    var pageUrl = base ? base + file : window.location.origin + "/" + file;
    var imageUrl = local ? "og-image.png" : (base || window.location.origin + "/") + "og-image.png";

    // 当前可见的语言变体（名片页的标题/描述按语种带在 data 属性里）
    var visible = null;
    var variants = visibleVariants();
    for (var i = 0; i < variants.length; i++) {
      if (!variants[i].hidden) { visible = variants[i]; break; }
    }

    var title = document.title;
    var desc = "";
    if (kind === "card" && visible) {
      var vt = visible.getAttribute("data-pv-title");
      var vd = visible.getAttribute("data-pv-desc");
      if (vt) title = replaceDemoName(vt);
      var line = identityLine();
      desc = (line ? line + " —— " : "") + (vd || "");
    } else if (kind === "landing") {
      desc = META_DESC.landing[state.lang] || META_DESC.landing.zh;
    } else {
      desc = META_DESC.internal[state.lang] || META_DESC.internal.zh;
    }

    document.title = title;
    setMetaContent('meta[name="description"]', desc);
    setMetaContent('meta[property="og:title"]', title);
    setMetaContent('meta[property="og:description"]', desc);
    setMetaContent('meta[property="og:url"]', pageUrl);
    setMetaContent('meta[property="og:image"]', imageUrl);
    setMetaContent('meta[property="og:locale"]', OG_LOCALE[state.lang] || "zh_CN");
    setMetaContent('meta[name="twitter:title"]', title);
    setMetaContent('meta[name="twitter:description"]', desc);
    setMetaContent('meta[name="twitter:image"]', imageUrl);
    setLinkHref("canonical", pageUrl);
  }

  /** 从注册 / 登录 / 留资表单里读出用户填的信息 */
  function readFormUser(form) {
    function val(id) {
      var el = form.querySelector("#" + id);
      return el && el.value ? el.value.trim() : "";
    }
    var user = {
      fullName: val("fullName") || val("lead-name"),
      companyName: val("companyName") || val("lead-company"),
      jobTitle: val("jobTitle"),
      email: val("email"),
    };
    if (!user.fullName && !user.email) return null;
    return user;
  }

  /**
   * 读取「个人资料」页的输入框。
   * 那块 UI 不是 <form>，而且多语言快照里同 id 有三份，
   * 所以按当前可见的变体取，避免读到隐藏那份。
   */
  function readProfileUser() {
    function val(id) {
      var el = visibleById(id);
      return el && el.value ? el.value.trim() : "";
    }
    var user = {
      fullName: val("fullName"),
      companyName: val("companyName"),
      jobTitle: val("jobTitle"),
      email: val("email"),
    };
    if (!user.fullName && !user.email) return null;
    return user;
  }

  /** 保存身份并立刻刷新页面上的显示 */
  function setIdentity(user) {
    if (!user) return false;
    var previous = readLocalUser() || {};
    var merged = {
      fullName: user.fullName || previous.fullName || "",
      companyName: user.companyName || previous.companyName || "",
      jobTitle: user.jobTitle || previous.jobTitle || "",
      email: user.email || previous.email || "",
    };
    if (!merged.fullName && !merged.email) return false;
    if (!saveLocalUser(merged)) return false;
    applyIdentity(previous);
    refreshIdentityPanel();
    return true;
  }

  /* --- 身份链接：把身份编码进 URL，手机和电脑之间靠链接传递 --- */

  function b64Encode(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function b64Decode(str) {
    var bin = atob(str);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function encodeIdentity(user) {
    if (!user) return "";
    try {
      var json = JSON.stringify({
        n: user.fullName || "",
        c: user.companyName || "",
        t: user.jobTitle || "",
        e: user.email || "",
      });
      return b64Encode(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    } catch (e) {
      return "";
    }
  }

  function decodeIdentity(raw) {
    try {
      var b64 = String(raw).replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      var o = JSON.parse(b64Decode(b64));
      var user = {
        fullName: o.n || "",
        companyName: o.c || "",
        jobTitle: o.t || "",
        email: o.e || "",
      };
      return user.fullName || user.email ? user : null;
    } catch (e) {
      return null;
    }
  }

  /** 当前页面的可分享地址（file:// 双击打开时也成立） */
  function currentPageUrl() {
    var base = siteBase();
    var file = (window.location.pathname || "").split("/").pop() || "index.html";
    if (base) return base + file;
    var origin = window.location.origin;
    if (origin && origin !== "null") return origin + (window.location.pathname || "/" + file);
    return window.location.href.split("#")[0];
  }

  function identityShareUrl() {
    var enc = encodeIdentity(readLocalUser());
    if (!enc) return "";
    return currentPageUrl() + "#id=" + enc;
  }

  /** 打开带 #id= 的链接时，把身份存下来并刷新显示 */
  function applyIdentityFromHash() {
    var m = /^#id=([A-Za-z0-9\-_]+)$/.exec(window.location.hash || "");
    if (!m) return null;
    var user = decodeIdentity(m[1]);
    if (!user) return null;
    var previous = readLocalUser() || null;
    saveLocalUser(user);
    try {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch (e) {
      /* file:// 下 replaceState 可能不可用，忽略即可 */
    }
    return previous;
  }

  /** 复制身份链接：手机 / 电脑之间靠它同步 */
  function copyIdentityLink() {
    var url = identityShareUrl();
    if (!url) {
      toast(OFFLINE_MSG.noIdentity[state.lang] || OFFLINE_MSG.noIdentity.zh);
      return;
    }
    var say = function () {
      toast((OFFLINE_MSG.identityCopied[state.lang] || OFFLINE_MSG.identityCopied.zh) + "：" + url);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(say, function () {
        legacyCopy(url, say);
      });
    } else {
      legacyCopy(url, say);
    }
  }

  /** 刷新预览面板里的「当前身份」显示 */
  function refreshIdentityPanel() {
    var el = document.querySelector("[data-pv-identity]");
    if (!el) return;
    var user = readLocalUser();
    if (!user) {
      el.textContent = OFFLINE_MSG.noIdentity[state.lang] || OFFLINE_MSG.noIdentity.zh;
      el.setAttribute("data-state", "empty");
      return;
    }
    var parts = [];
    if (user.fullName) parts.push(user.fullName);
    if (user.jobTitle) parts.push(user.jobTitle);
    if (user.companyName) parts.push(user.companyName);
    el.textContent = parts.join(" · ");
    el.setAttribute("data-state", "on");
  }

  // 按钮文字 → 离线行为
  var DEAD_BTN_RULES = [
    { re: /看看示例名片|see a sample card|ver una tarjeta/i, action: "card" },
    { re: /获取完整资料包|get the full asset pack|descargar pack completo/i, action: "lead" },
    { re: /复制链接|copy link|copiar enlace/i, action: "copy" },
    // 「保存个人资料」不是普通死按钮：它要真的把名字写进本机身份
    { re: /保存个人资料|save profile|guardar perfil/i, action: "profile" },
    // 线索页：导出 CSV 与标记已读在离线快照里也能真做
    { re: /导出 CSV|export csv|exportar csv/i, action: "csv" },
    { re: /标记已读|mark as read|marcar leído/i, action: "markRead" },
    {
      re: /注册|免费创建|免费|sign up|get started|create my card|empezar|registrar|crear mi tarjeta/i,
      action: "register",
    },
    { re: /登录|sign in|iniciar sesión/i, action: "login" },
    { re: /退出|sign out|cerrar sesión/i, action: "signout" },
    {
      re: /发送邀请|使用此资料|取消共享|标记已读|生成示例数据|生成示例线索|退出|保存|导出 CSV|export csv|exportar csv|send invite|use this asset|unshare|mark as read|generate sample|exit|save|enviar invitación|usar este recurso|dejar de compartir|marcar leído|salir/i,
      action: "write",
    },
  ];

  function currentKind() {
    var pr = pageRoot();
    return pr ? pr.getAttribute("data-pv-page") : null;
  }

  function scrollCarousel(btn, dir) {
    var wrap = btn.closest(".relative");
    if (!wrap) return;
    var container = wrap.querySelector(".no-scrollbar");
    if (!container) return;
    var card = container.querySelector("[data-product-card]");
    var step = card ? card.offsetWidth + 16 : 260;
    container.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  function closeModal() {
    var overlay = document.getElementById("pv-modal");
    if (overlay) overlay.remove();
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function openProductModal(card) {
    closeModal();
    var img = card.querySelector("img");
    var titleEl = card.querySelector("h3");
    var ps = card.querySelectorAll("p");
    var subtitle = ps.length ? (ps[0].textContent || "").trim() : "";
    var desc = ps.length > 1 ? (ps[1].textContent || "").trim() : "";
    var tags = [];
    card.querySelectorAll('[class*="bg-slate-100"]').forEach(function (el) {
      var t = (el.textContent || "").trim();
      if (t && tags.indexOf(t) === -1) tags.push(t);
    });

    var overlay = document.createElement("div");
    overlay.id = "pv-modal";
    overlay.className = "pv-modal-overlay";
    var html = '<div class="pv-modal" role="dialog" aria-modal="true">';
    if (img && img.getAttribute("src")) {
      html += '<img class="pv-modal-img" src="' + escapeHtml(img.getAttribute("src")) + '" alt="" />';
    }
    html += '<button type="button" class="pv-modal-close" aria-label="close">×</button>';
    html += '<h3 class="pv-modal-title">' + escapeHtml(titleEl ? titleEl.textContent : "") + "</h3>";
    if (subtitle) html += '<p class="pv-modal-sub">' + escapeHtml(subtitle) + "</p>";
    if (desc) html += '<p class="pv-modal-desc">' + escapeHtml(desc) + "</p>";
    if (tags.length) {
      html += '<div class="pv-modal-tags">';
      tags.forEach(function (t) {
        html += "<span>" + escapeHtml(t) + "</span>";
      });
      html += "</div>";
    }
    html += '<button type="button" class="pv-modal-action">×</button>';
    html += "</div>";
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay || e.target.closest(".pv-modal-close, .pv-modal-action")) closeModal();
    });
    document.addEventListener("keydown", function onEsc(e) {
      if (e.key === "Escape") {
        closeModal();
        document.removeEventListener("keydown", onEsc);
      }
    });
  }

  /** 离线快照的"无后端"说明弹窗 */
  function openOfflineModal(reason) {
    closeModal();
    var t = OFFLINE_MODAL_TEXT[state.lang] || OFFLINE_MODAL_TEXT.zh;
    var overlay = document.createElement("div");
    overlay.id = "pv-modal";
    overlay.className = "pv-modal-overlay";
    var html = '<div class="pv-modal" role="dialog" aria-modal="true">';
    html += '<button type="button" class="pv-modal-close" aria-label="close">×</button>';
    html += '<h3 class="pv-modal-title">' + escapeHtml(t.title) + "</h3>";
    html += '<p class="pv-modal-sub">' + escapeHtml(t.desc) + "</p>";
    if (reason) html += '<p class="pv-modal-desc">「' + escapeHtml(reason) + "」</p>";
    html += '<div class="pv-modal-actions">';
    html += '<a class="pv-modal-btn" href="card.html">' + escapeHtml(t.card) + "</a>";
    html += '<a class="pv-modal-btn pv-modal-btn-ghost" href="workbench.html">' + escapeHtml(t.workbench) + "</a>";
    html += "</div>";
    html += '<p class="pv-modal-tip">' + escapeHtml(t.tip) + "</p>";
    html += "</div>";
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay || e.target.closest(".pv-modal-close")) closeModal();
    });
    document.addEventListener("keydown", function onEsc(e) {
      if (e.key === "Escape") {
        closeModal();
        document.removeEventListener("keydown", onEsc);
      }
    });
  }

  /** 复制当前页面链接：离线也能真做，就不弹「不可用」 */
  function copyCurrentUrl() {
    var url = window.location.href;
    var say = function () {
      toast((OFFLINE_MSG.copy[state.lang] || OFFLINE_MSG.copy.zh) + "：" + url);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(say, function () {
        legacyCopy(url, say);
      });
    } else {
      legacyCopy(url, say);
    }
  }

  function legacyCopy(text, cb) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e) {
      /* 忽略：剪贴板不可用时仍然给出提示 */
    }
    document.body.removeChild(ta);
    cb();
  }

  /** 必填字段没填时，给「请填写 XX」的人话提示，而不是浏览器默认英文气泡 */
  var AUTH_FIELD_PROMPT = {
    fullName: {
      zh: "请填写姓名",
      en: "Please enter your full name",
      es: "Introduce tu nombre completo",
    },
    companyName: {
      zh: "请填写公司名称",
      en: "Please enter your company name",
      es: "Introduce el nombre de tu empresa",
    },
    jobTitle: {
      zh: "请填写职位",
      en: "Please enter your job title",
      es: "Introduce tu puesto",
    },
    email: {
      zh: "请填写邮箱",
      en: "Please enter your email",
      es: "Introduce tu correo electrónico",
    },
    password: {
      zh: "请填写密码",
      en: "Please enter your password",
      es: "Introduce tu contraseña",
    },
  };

  /** 按按钮文案判断它在离线快照里该做什么 */
  function actionForButton(text) {
    for (var i = 0; i < DEAD_BTN_RULES.length; i++) {
      if (DEAD_BTN_RULES[i].re.test(text)) return DEAD_BTN_RULES[i].action;
    }
    return "default";
  }

  /* =====================================================================
   * 客户留资页：离线也能筛选、改状态、标记已读、导出 CSV
   * 快照里的 Radix 下拉是空的（选项由 React 运行时渲染，离线取不到），
   * 这里换成原生 <select>，数据直接从快照 DOM 里读，点了就生效。
   * ===================================================================== */
  var LEAD_STATUS_TEXT = {
    zh: {
      all: "全部状态",
      new: "待跟进",
      contacted: "已联系",
      closed: "已关闭",
      unread: "未读",
      read: "已读",
    },
    en: {
      all: "All statuses",
      new: "To follow up",
      contacted: "Contacted",
      closed: "Closed",
      unread: "Unread",
      read: "Read",
    },
    es: {
      all: "Todos los estados",
      new: "Pendiente",
      contacted: "Contactado",
      closed: "Cerrado",
      unread: "No leído",
      read: "Leído",
    },
  };
  var LEAD_STATUS_KEYS = ["new", "contacted", "closed"];
  var LEAD_INTENT_TEXT = {
    zh: { all: "全部意向", high: "高意向", medium: "中意向", low: "低意向" },
    en: { all: "All intents", high: "High intent", medium: "Medium intent", low: "Low intent" },
    es: { all: "Toda intención", high: "Alta intención", medium: "Intención media", low: "Intención baja" },
  };
  var LEAD_CSV_HEADER = {
    zh: ["时间", "姓名", "电话", "公司", "需求描述", "来源", "状态", "意向评分", "归属"],
    en: ["Time", "Name", "Phone", "Company", "Request", "Source", "Status", "Intent score", "Owner"],
    es: ["Fecha", "Nombre", "Teléfono", "Empresa", "Solicitud", "Origen", "Estado", "Puntuación", "Responsable"],
  };
  var LEAD_STATUS_VARIANT = {
    new: "border-transparent bg-amber-100 text-amber-700",
    contacted: "border-transparent bg-primary/10 text-primary",
    closed: "border-transparent bg-emerald-100 text-emerald-700",
  };

  function leadLang(scope) {
    var v = scope && scope.closest ? scope.closest(".pv-variant") : null;
    return (v && v.getAttribute("data-pv-lang")) || state.lang || "zh";
  }

  /** 当前可见的「客户留资」语言变体 */
  function leadsVariant() {
    var variants = visibleVariants();
    for (var i = 0; i < variants.length; i++) {
      var v = variants[i];
      if (v.getAttribute("data-pv-page") === "leads" && !v.hidden) return v;
    }
    return null;
  }

  /** 线索表格行（新版工作台是表格，不是卡片） */
  function leadRows(scope) {
    var v = scope || leadsVariant();
    if (!v) return [];
    return Array.prototype.slice.call(v.querySelectorAll("tr[data-pv-lead-row]"));
  }

  /** 从表格行的 data 属性里读出线索信息 */
  function readLead(row, lang) {
    var t = LEAD_STATUS_TEXT[lang] || LEAD_STATUS_TEXT.zh;
    var statusKey = row.getAttribute("data-pv-lead-status") || "new";
    var name = row.getAttribute("data-pv-lead-name") || "";
    var phone = row.getAttribute("data-pv-lead-phone") || "";
    var ownerCell = row.querySelector("[data-pv-lead-owner]");
    return {
      name: name,
      company: row.getAttribute("data-pv-lead-company") || "",
      phone: phone,
      message: row.getAttribute("data-pv-lead-message") || "",
      source: row.getAttribute("data-pv-lead-source") || "",
      time: row.getAttribute("data-pv-lead-time") || "",
      statusKey: statusKey,
      statusLabel: t[statusKey] || t.new,
      unread: row.getAttribute("data-pv-lead-unread") === "1",
      intent: row.getAttribute("data-pv-lead-intent") || "low",
      score: row.getAttribute("data-pv-lead-score") || "",
      owner: ownerCell ? ownerCell.textContent.trim() : "",
      key: leadKeyOf(name, phone),
    };
  }

  /** 生成一个原生 select */
  function nativeSelect(className, options, current) {
    var sel = document.createElement("select");
    sel.className = className;
    options.forEach(function (o) {
      var op = document.createElement("option");
      op.value = o[0];
      op.textContent = o[1];
      if (o[0] === current) op.selected = true;
      sel.appendChild(op);
    });
    return sel;
  }

  /** 把快照里的 Radix 下拉换成原生 select，并接上筛选 / 搜索 / 已读 */
  function upgradeLeadSelects() {
    var variants = document.querySelectorAll('.pv-variant[data-pv-page="leads"]');
    Array.prototype.slice.call(variants).forEach(function (v) {
      if (v.getAttribute("data-pv-leads-ready") === "1") return;
      v.setAttribute("data-pv-leads-ready", "1");
      var lang = v.getAttribute("data-pv-lang") || "zh";
      var t = LEAD_STATUS_TEXT[lang] || LEAD_STATUS_TEXT.zh;
      var ti = LEAD_INTENT_TEXT[lang] || LEAD_INTENT_TEXT.zh;

      // 行内「状态」下拉 → 原生 select
      Array.prototype.slice.call(v.querySelectorAll('[data-pv-select="status"]')).forEach(function (btn) {
        var row = btn.closest("tr[data-pv-lead-row]");
        if (!row) return;
        var sel = nativeSelect(
          "pv-select pv-select-status",
          LEAD_STATUS_KEYS.map(function (k) {
            return [k, t[k]];
          }),
          readLead(row, lang).statusKey,
        );
        if (btn.parentNode) btn.parentNode.replaceChild(sel, btn);
        sel.addEventListener("change", function () {
          setLeadStatus(row, sel.value, lang);
        });
      });

      // 行内「归属」下拉：离线快照没有后端，改派做不了，换成纯文字说明
      Array.prototype.slice.call(v.querySelectorAll('[data-pv-select="owner"]')).forEach(function (btn) {
        var row = btn.closest("tr[data-pv-lead-row]");
        var span = document.createElement("span");
        span.className = "pv-owner";
        span.setAttribute("title", OFFLINE_MSG.assignHint[lang] || OFFLINE_MSG.assignHint.zh);
        // Radix 的 SelectValue 在 SSR 里解析不到选项文本，名字从行上的 data 属性取
        span.textContent = (row && row.getAttribute("data-pv-lead-owner-name")) || btn.textContent.trim();
        if (btn.parentNode) btn.parentNode.replaceChild(span, btn);
      });

      // 顶部筛选：状态
      var filterBtn = v.querySelector('[data-pv-select="filter-status"]');
      if (filterBtn) {
        var fsel = nativeSelect(
          "pv-select pv-select-filter",
          [["all", t.all]].concat(
            LEAD_STATUS_KEYS.map(function (k) {
              return [k, t[k]];
            }),
          ),
          "all",
        );
        if (filterBtn.parentNode) filterBtn.parentNode.replaceChild(fsel, filterBtn);
        fsel.addEventListener("change", applyLeadFilter);
      }

      // 顶部筛选：意向
      var intentBtn = v.querySelector('[data-pv-select="filter-intent"]');
      if (intentBtn) {
        var isel = nativeSelect(
          "pv-select pv-select-filter-intent",
          [
            ["all", ti.all],
            ["high", ti.high],
            ["medium", ti.medium],
            ["low", ti.low],
          ],
          "all",
        );
        if (intentBtn.parentNode) intentBtn.parentNode.replaceChild(isel, intentBtn);
        isel.addEventListener("change", applyLeadFilter);
      }

      // 搜索
      var search = v.querySelector("[data-pv-lead-search]");
      if (search) search.addEventListener("input", applyLeadFilter);

      // 行内「标记已读」
      leadRows(v).forEach(function (row) {
        var btn = row.querySelector("[data-pv-lead-read]");
        if (!btn || btn.getAttribute("data-pv-bound") === "1") return;
        btn.setAttribute("data-pv-bound", "1");
        btn.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          markLeadRead(row, lang);
        });
      });
    });
  }

  /** 改状态（写进本机存储，刷新后还在） */
  function setLeadStatus(row, value, lang) {
    applyStatusToRow(row, value, lang);
    var info = readLead(row, lang);
    persistLeadState(info, { status: value });
    toast(OFFLINE_MSG.localUpdate[state.lang] || OFFLINE_MSG.localUpdate.zh);
    applyLeadFilter();
  }

  /** 标记已读（写进本机存储，刷新后还在） */
  function markLeadRead(row, lang) {
    applyReadToRow(row, lang);
    var info = readLead(row, lang);
    persistLeadState(info, { unread: false });
    toast(OFFLINE_MSG.localUpdate[state.lang] || OFFLINE_MSG.localUpdate.zh);
    updateUnreadStat();
  }

  /* =========================================================
   * 离线工作台：把数据真的记下来
   * 静态包没有服务器，但同源各页共享 localStorage，
   * 所以「名片页留资 → 工作台客户留资」这条链路是真能跑通的。
   * ========================================================= */
  var LS_LEADS = "scanmeet_local_leads";
  var LS_PAGE = "scanmeet_local_page";

  function readJson(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function leadStore() {
    var v = readJson(LS_LEADS, []);
    return Array.isArray(v) ? v : [];
  }

  function leadKeyOf(name, phone) {
    return String(name || "").trim() + "|" + String(phone || "").trim();
  }

  /** 写入/更新一条线索记录 */
  function upsertLeadRecord(rec) {
    var list = leadStore();
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].key === rec.key) {
        list[i] = Object.assign({}, list[i], rec);
        writeJson(LS_LEADS, list);
        return list[i];
      }
    }
    list.unshift(rec);
    writeJson(LS_LEADS, list);
    return rec;
  }

  /** 把状态/已读落到本机 */
  function persistLeadState(info, patch) {
    var key = leadKeyOf(info.name, info.phone);
    var list = leadStore();
    var found = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].key === key) {
        found = list[i];
        break;
      }
    }
    if (!found) {
      found = {
        key: key,
        name: info.name,
        phone: info.phone,
        company: info.company,
        status: info.statusKey,
        unread: info.unread,
        recorded: false,
      };
      list.unshift(found);
    }
    Object.assign(found, patch);
    writeJson(LS_LEADS, list);
    return found;
  }

  /** 静默套用状态（不弹提示） */
  function applyStatusToRow(row, value, lang) {
    row.setAttribute("data-pv-lead-status", value);
    var sel = row.querySelector("select.pv-select-status");
    if (sel) sel.value = value;
    var cell = row.querySelector("[data-pv-lead-status-text]");
    if (cell) {
      var t = LEAD_STATUS_TEXT[lang] || LEAD_STATUS_TEXT.zh;
      cell.textContent = t[value] || t.new;
    }
  }

  /** 静默标记已读 */
  function applyReadToRow(row) {
    row.setAttribute("data-pv-lead-unread", "0");
    var dot = row.querySelector("[data-pv-lead-unread-dot]");
    if (dot && dot.parentNode) dot.parentNode.removeChild(dot);
    row.className = row.className.replace(/\s*bg-amber-50\/40/g, "");
    var btn = row.querySelector("[data-pv-lead-read]");
    if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
  }

  /** 顶部「未读」计数跟着变 */
  function updateUnreadStat() {
    var v = leadsVariant();
    if (!v) return;
    var n = 0;
    leadRows(v).forEach(function (row) {
      if (row.getAttribute("data-pv-lead-unread") === "1") n += 1;
    });
    var el = v.querySelector('[data-pv-stat="unread"]');
    if (el) el.textContent = String(n);
  }

  /** 载入时把本机记录套回线索行 */
  function restoreLeadState(v) {
    var list = leadStore();
    if (!list.length) return;
    var map = {};
    list.forEach(function (r) {
      if (r && r.key) map[r.key] = r;
    });
    leadRows(v).forEach(function (row) {
      var lang = leadLang(row);
      var info = readLead(row, lang);
      var rec = map[leadKeyOf(info.name, info.phone)];
      if (!rec) return;
      if (rec.status && rec.status !== info.statusKey) applyStatusToRow(row, rec.status, lang);
      if (rec.unread === false) applyReadToRow(row);
    });
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatNow() {
    var d = new Date();
    function p(n) {
      return (n < 10 ? "0" : "") + n;
    }
    return (
      d.getFullYear() + "/" + p(d.getMonth() + 1) + "/" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes())
    );
  }

  /** 与应用里 toLocaleString 一致的带秒格式 */
  function formatNowFull() {
    var d = new Date();
    function p(n) {
      return (n < 10 ? "0" : "") + n;
    }
    return (
      d.getFullYear() +
      "/" +
      p(d.getMonth() + 1) +
      "/" +
      p(d.getDate()) +
      " " +
      p(d.getHours()) +
      ":" +
      p(d.getMinutes()) +
      ":" +
      p(d.getSeconds())
    );
  }

  /** 生成一条「真记录」的线索行 */
  function buildLeadRowHtml(rec, lang) {
    var t = LEAD_STATUS_TEXT[lang] || LEAD_STATUS_TEXT.zh;
    var unread = rec.unread !== false;
    var options = LEAD_STATUS_KEYS.map(function (k) {
      return (
        '<option value="' + k + '"' + (k === rec.status ? " selected" : "") + ">" + escapeHtml(t[k]) + "</option>"
      );
    }).join("");
    var markText = { zh: "标记已读", en: "Mark as read", es: "Marcar leído" };
    var phoneIcon =
      '<svg class="lucide lucide-phone h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 0 2.81.7A2 2 0 0 0 22 16.92z"></path></svg>';
    var mailIcon =
      '<svg class="lucide lucide-mail h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path></svg>';
    return (
      '<tr data-pv-lead-row="1"' +
      ' data-pv-lead-name="' + escapeHtml(rec.name) + '"' +
      ' data-pv-lead-phone="' + escapeHtml(rec.phone) + '"' +
      ' data-pv-lead-company="' + escapeHtml(rec.company || "") + '"' +
      ' data-pv-lead-message="' + escapeHtml(rec.message || "") + '"' +
      ' data-pv-lead-source="' + escapeHtml(rec.source || "") + '"' +
      ' data-pv-lead-status="' + escapeHtml(rec.status || "new") + '"' +
      ' data-pv-lead-unread="' + (unread ? "1" : "0") + '"' +
      ' data-pv-lead-time="' + escapeHtml(rec.time || "") + '"' +
      ' data-pv-lead-intent="low" data-pv-lead-score=""' +
      ' class="border-b border-black/[0.04] align-top transition-colors hover:bg-black/[0.015]' +
      (unread ? " bg-amber-50/40" : "") +
      '">' +
      '<td class="px-4 py-3"><span class="text-xs text-muted-foreground">—</span></td>' +
      '<td class="px-4 py-3">' +
      '<p class="flex items-center gap-1.5 text-[13px] font-medium text-slate-800">' +
      (unread ? '<span data-pv-lead-unread-dot="1" class="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"></span>' : "") +
      escapeHtml(rec.name) +
      "</p>" +
      '<p class="mt-1 text-[11px] text-muted-foreground">' +
      (rec.company ? escapeHtml(rec.company) + " · " : "") +
      '<a href="tel:' + escapeHtml(rec.phone) + '" class="hover:text-foreground">' + escapeHtml(rec.phone) + "</a>" +
      "</p></td>" +
      '<td class="max-w-[260px] px-4 py-3"><p class="text-[12px] leading-relaxed text-slate-700">' +
      escapeHtml(rec.message || "") +
      "</p></td>" +
      '<td class="px-4 py-3"><span class="chip whitespace-nowrap">' + escapeHtml(rec.source || "") + "</span></td>" +
      '<td class="px-4 py-3" data-pv-lead-owner="1"><span class="text-[11px] text-muted-foreground">—</span></td>' +
      '<td class="px-4 py-3"><select class="pv-select pv-select-status">' + options + "</select></td>" +
      '<td class="whitespace-nowrap px-4 py-3 text-[11px] text-muted-foreground">' + escapeHtml(rec.time || "") + "</td>" +
      '<td class="px-4 py-3"><div class="flex items-center justify-end gap-1.5">' +
      '<a href="tel:' + escapeHtml(rec.phone) + '" title="' + escapeHtml(markText[lang] || markText.zh) + '" class="grid h-7 w-7 place-items-center rounded-full border border-black/[0.07] bg-white text-muted-foreground transition-colors hover:text-[var(--ink)]">' +
      phoneIcon +
      "</a>" +
      (unread
        ? '<button type="button" data-pv-lead-read="1" title="' + escapeHtml(markText[lang] || markText.zh) + '" class="grid h-7 w-7 place-items-center rounded-full border border-black/[0.07] bg-white text-muted-foreground transition-colors hover:text-[var(--ink)]">' +
          mailIcon +
          "</button>"
        : "") +
      "</div></td></tr>"
    );
  }

  /** 把本机记录的留资渲染进「客户留资」表格 */
  function renderRecordedLeads(v) {
    if (!v) return;
    var recs = leadStore().filter(function (r) {
      return r && r.recorded;
    });
    if (!recs.length) return;
    var body = v.querySelector("tbody");
    if (!body) return;
    var lang = v.getAttribute("data-pv-lang") || "zh";
    recs.slice().reverse().forEach(function (rec) {
      var exists = Array.prototype.slice.call(body.querySelectorAll("tr[data-pv-lead-row]")).some(function (r) {
        return r.getAttribute("data-pv-lead-phone") === rec.phone;
      });
      if (exists) return;
      body.insertAdjacentHTML("afterbegin", buildLeadRowHtml(rec, lang));
    });
    // 新行也要有下拉与「标记已读」的离线交互
    leadRows(v).forEach(function (row) {
      var sel = row.querySelector("select.pv-select-status");
      if (sel && sel.getAttribute("data-pv-bound") !== "1") {
        sel.setAttribute("data-pv-bound", "1");
        sel.addEventListener("change", function () {
          setLeadStatus(row, sel.value, leadLang(row));
        });
      }
      var btn = row.querySelector("[data-pv-lead-read]");
      if (btn && btn.getAttribute("data-pv-bound") !== "1") {
        btn.setAttribute("data-pv-bound", "1");
        btn.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          markLeadRead(row, leadLang(row));
        });
      }
    });
    applyLeadFilter();
  }

  /** 按状态 + 意向 + 关键词筛选 */
  function applyLeadFilter() {
    var v = leadsVariant();
    if (!v) return;
    var lang = v.getAttribute("data-pv-lang") || "zh";
    var filterSel = v.querySelector("select.pv-select-filter");
    var intentSel = v.querySelector("select.pv-select-filter-intent");
    var status = filterSel ? filterSel.value : "all";
    var intent = intentSel ? intentSel.value : "all";
    var search = v.querySelector("[data-pv-lead-search]");
    var keyword = search ? search.value.trim().toLowerCase() : "";
    leadRows(v).forEach(function (row) {
      var info = readLead(row, lang);
      var okStatus = status === "all" || info.statusKey === status;
      var okIntent = intent === "all" || info.intent === intent;
      var text = (info.name + info.phone + info.company + info.message).toLowerCase();
      var okKeyword = !keyword || text.indexOf(keyword) !== -1;
      row.style.display = okStatus && okIntent && okKeyword ? "" : "none";
    });
  }

  /** 导出 CSV：真的下载一个文件 */
  function exportLeadsCsv() {
    var v = leadsVariant();
    if (!v) return;
    var lang = v.getAttribute("data-pv-lang") || "zh";
    var header = LEAD_CSV_HEADER[lang] || LEAD_CSV_HEADER.zh;
    var rows = leadRows(v)
      .filter(function (c) {
        return c.style.display !== "none";
      })
      .map(function (c) {
        var i = readLead(c, lang);
        return [
          i.time,
          i.name,
          i.phone,
          i.company,
          i.message.replace(/\r?\n/g, " "),
          i.source,
          i.statusLabel,
          i.score,
          i.owner,
        ];
      });
    var csv = [header]
      .concat(rows)
      .map(function (row) {
        return row
          .map(function (cell) {
            return '"' + String(cell == null ? "" : cell).replace(/"/g, '""') + '"';
          })
          .join(",");
      })
      .join("\r\n");
    try {
      var blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "leads-" + new Date().toISOString().slice(0, 10) + ".csv";
      document.body.appendChild(a);
      a.click();
      // 立刻移除锚点会让个别浏览器取消这次下载，延后一拍再清理
      setTimeout(function () {
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 0);
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 2000);
      toast((OFFLINE_MSG.csvExported[state.lang] || OFFLINE_MSG.csvExported.zh) + rows.length + " 条");
    } catch (e) {
      toast(OFFLINE_MSG.save[state.lang] || OFFLINE_MSG.save.zh);
    }
  }

  /**
   * 快照里的按钮常常是 disabled（因为没有 React 状态在跑）。
   * 离线模式下把这些「需要后端」的按钮放开：点了就能给出解释，
   * 而不是摆一个永远按不动的灰色按钮。
   */
  function reviveButton(btn) {
    if (!btn.hasAttribute("disabled")) return;
    btn.removeAttribute("disabled");
    btn.removeAttribute("aria-disabled");
    btn.removeAttribute("data-disabled");
  }

  /* =========================================================
   * 展示页编辑：离线也能真的保存，实时预览跟着变
   * ========================================================= */
  var PAGE_DEFAULT = {
    theme: "industrial",
    headline: "",
    welcomeTitle: "",
    welcomeMessage: "",
    showProducts: true,
    showCompany: true,
    showWechat: true,
    isPublished: true,
    updatedAt: "",
  };
  var SWITCH_KEYS = ["showProducts", "showCompany", "showWechat", "isPublished"];

  function editorVariant() {
    var variants = visibleVariants();
    for (var i = 0; i < variants.length; i++) {
      var v = variants[i];
      if (v.getAttribute("data-pv-page") === "editor" && !v.hidden) return v;
    }
    return null;
  }

  function pageStore() {
    var v = readJson(LS_PAGE, {});
    return v && typeof v === "object" ? v : {};
  }

  /** 同页多语言变体里 id 会变成 xxx--v1，这里按基础 id 找 */
  function inVariant(v, baseId) {
    if (!v || !baseId) return null;
    var list = v.querySelectorAll("[id]");
    for (var i = 0; i < list.length; i++) {
      var id = list[i].getAttribute("id") || "";
      if (id === baseId || id.indexOf(baseId + "--v") === 0) return list[i];
    }
    return null;
  }

  function themeButtons(v) {
    return Array.prototype.slice.call(v.querySelectorAll("[data-theme-option]"));
  }

  function currentTheme(v) {
    var btns = themeButtons(v);
    var i;
    var mark;
    // 1) 快照/离线里被打上勾的
    for (i = 0; i < btns.length; i++) {
      mark = btns[i].querySelector('[class*="right-2 top-2"]');
      if (mark && mark.textContent.trim() === "✓") return btns[i].getAttribute("data-theme-option");
    }
    // 2) 离线模块自己标记的
    for (i = 0; i < btns.length; i++) {
      if (btns[i].classList.contains("pv-theme-active")) return btns[i].getAttribute("data-theme-option");
    }
    // 3) 快照原始的选中态
    for (i = 0; i < btns.length; i++) {
      if ((btns[i].getAttribute("class") || "").indexOf("border-[var(--ink)]") !== -1)
        return btns[i].getAttribute("data-theme-option");
    }
    var s = pageStore();
    return s.theme || PAGE_DEFAULT.theme;
  }

  function setThemeButtons(v, theme) {
    themeButtons(v).forEach(function (b) {
      var on = b.getAttribute("data-theme-option") === theme;
      var mark = b.querySelector('[class*="right-2 top-2"]');
      if (mark) mark.textContent = on ? "✓" : "";
      b.classList.toggle("pv-theme-active", on);
      var cls = b.getAttribute("class") || "";
      if (on) {
        if (cls.indexOf("border-[var(--ink)]") === -1) {
          cls = cls.replace("border-black/[0.07]", "border-[var(--ink)]");
        }
      } else if (cls.indexOf("border-[var(--ink)]") !== -1) {
        cls = cls.replace("border-[var(--ink)]", "border-black/[0.07]");
      }
      b.setAttribute("class", cls);
    });
  }

  function switchesOf(v) {
    return Array.prototype.slice.call(v.querySelectorAll('button[role="switch"]'));
  }

  function setSwitch(el, on) {
    el.setAttribute("aria-checked", on ? "true" : "false");
    el.setAttribute("data-state", on ? "checked" : "unchecked");
    var thumb = el.querySelector("[data-state]");
    if (thumb) thumb.setAttribute("data-state", on ? "checked" : "unchecked");
    var box = el.querySelector('input[type="checkbox"]');
    if (box) {
      box.checked = !!on;
      if (on) box.setAttribute("checked", "checked");
      else box.removeAttribute("checked");
    }
  }

  function readEditorForm(v) {
    var s = Object.assign({}, PAGE_DEFAULT, pageStore());
    s.theme = currentTheme(v);
    var hl = inVariant(v, "headline");
    if (hl) s.headline = hl.value;
    var wt = inVariant(v, "welcome-title");
    if (wt) s.welcomeTitle = wt.value;
    var wm = inVariant(v, "welcome-message");
    if (wm) s.welcomeMessage = wm.value;
    var sw = switchesOf(v);
    SWITCH_KEYS.forEach(function (k, i) {
      if (sw[i]) s[k] = sw[i].getAttribute("aria-checked") === "true";
    });
    var slug = inVariant(v, "slug");
    if (slug) s.slug = slug.value;
    return s;
  }

  function fillEditorForm(v, s) {
    var hl = inVariant(v, "headline");
    if (hl && document.activeElement !== hl) hl.value = s.headline || "";
    var wt = inVariant(v, "welcome-title");
    if (wt && document.activeElement !== wt) wt.value = s.welcomeTitle || "";
    var wm = inVariant(v, "welcome-message");
    if (wm && document.activeElement !== wm) wm.value = s.welcomeMessage || "";
    var slug = inVariant(v, "slug");
    if (slug && document.activeElement !== slug) slug.value = s.slug || slug.value;
    setThemeButtons(v, s.theme);
    var sw = switchesOf(v);
    SWITCH_KEYS.forEach(function (k, i) {
      if (sw[i]) setSwitch(sw[i], !!s[k]);
    });
  }

  /** 实时预览：主题 / 标语 / 欢迎语 / 四个开关立刻反映到手机框里 */
  function applyEditorPreview(v, s) {
    var root = v.querySelector('[class*="max-w-[300px]"]');
    if (!root) return;
    var shell = root.querySelector("[data-theme]");
    if (shell) shell.setAttribute("data-theme", s.theme);
    var headlineEl = root.querySelector('[class*="text-white/85"]');
    if (headlineEl) {
      headlineEl.textContent = s.headline || "";
      headlineEl.style.display = s.headline ? "" : "none";
    }
    var cards = root.querySelectorAll('[class*="rounded-xl p-3"]');
    if (cards[0]) {
      var titleEl = cards[0].querySelector('[class*="font-semibold text-slate-900"]');
      var bodyEl = cards[0].querySelector('[class*="line-clamp-3"]');
      if (titleEl) titleEl.textContent = s.welcomeTitle || "—";
      if (bodyEl) bodyEl.textContent = s.welcomeMessage || "—";
      cards[0].style.display = s.welcomeTitle || s.welcomeMessage ? "" : "none";
    }
    if (cards[1]) cards[1].style.display = s.showCompany ? "" : "none";
    if (cards[2]) cards[2].style.display = s.showProducts ? "" : "none";
    if (cards[3]) {
      var wechat = cards[3].querySelector('[class*="bg-slate-50"]');
      if (wechat) wechat.style.display = s.showWechat ? "" : "none";
    }
    var hero = root.querySelector('[class*="exhibit-hero"]');
    if (hero) {
      var pills = hero.querySelectorAll("span.rounded-lg");
      if (pills[1]) pills[1].style.display = s.showWechat ? "" : "none";
    }
  }

  /** 数据概览：最后更新时间 / 发布状态跟着保存走 */
  function updateEditorMeta(v, s) {
    var lang = v.getAttribute("data-pv-lang") || "zh";
    var pubText = { zh: "已发布", en: "Published", es: "Publicado" };
    var draftText = { zh: "未发布", en: "Draft", es: "Borrador" };
    var nodes = v.querySelectorAll("span, div, p");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.children.length) continue;
      var txt = (el.textContent || "").trim();
      if (!txt) continue;
      if (/^\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}(:\d{2})?$/.test(txt)) {
        el.textContent = s.updatedAt;
        continue;
      }
      if (/^\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2}(:\d{2})?$/.test(txt)) {
        el.textContent = s.updatedAt;
        continue;
      }
      if (
        txt === pubText[lang] ||
        txt === draftText[lang] ||
        txt === pubText.zh ||
        txt === draftText.zh
      ) {
        el.textContent = s.isPublished ? pubText[lang] || pubText.zh : draftText[lang] || draftText.zh;
      }
    }
  }

  /** 展示页在当前站点上的地址 */
  function cardPageUrl() {
    var base = siteBase();
    if (base) return base + "card.html";
    var origin = window.location.origin;
    if (origin && origin !== "null") return origin + "/card.html";
    return "card.html";
  }

  /** 保存展示页设置到本机 */
  function savePageSettings(v) {
    var s = readEditorForm(v);
    s.updatedAt = formatNowFull();
    writeJson(LS_PAGE, s);
    applyEditorPreview(v, s);
    updateEditorMeta(v, s);
    toast(OFFLINE_MSG.pageSaved[state.lang] || OFFLINE_MSG.pageSaved.zh);
    return s;
  }

  /** 展示页编辑页：把表单、实时预览、保存按钮都接管过来 */
  function bindEditorPage() {
    var variants = document.querySelectorAll('.pv-variant[data-pv-page="editor"]');
    Array.prototype.slice.call(variants).forEach(function (v) {
      if (v.getAttribute("data-pv-editor-ready") === "1") return;
      v.setAttribute("data-pv-editor-ready", "1");
      var lang = v.getAttribute("data-pv-lang") || "zh";

      // 回填本机已保存的设置
      var saved = Object.assign({}, PAGE_DEFAULT, pageStore());
      if (saved.headline || saved.welcomeTitle || saved.welcomeMessage || saved.updatedAt) {
        fillEditorForm(v, saved);
        applyEditorPreview(v, saved);
        updateEditorMeta(v, saved);
      }

      // 文本输入 → 实时预览
      ["headline", "welcome-title", "welcome-message"].forEach(function (id) {
        var el = inVariant(v, id);
        if (!el) return;
        el.addEventListener("input", function () {
          var s = readEditorForm(v);
          applyEditorPreview(v, s);
        });
      });

      // 主题切换
      themeButtons(v).forEach(function (b) {
        b.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopImmediatePropagation();
          var theme = b.getAttribute("data-theme-option");
          var s = readEditorForm(v);
          s.theme = theme;
          setThemeButtons(v, theme);
          applyEditorPreview(v, s);
          s.updatedAt = formatNowFull();
          writeJson(LS_PAGE, s);
          updateEditorMeta(v, s);
          toast(OFFLINE_MSG.pageSaved[state.lang] || OFFLINE_MSG.pageSaved.zh);
        });
      });

      // 四个开关
      var sw = switchesOf(v);
      SWITCH_KEYS.forEach(function (k, i) {
        if (!sw[i]) return;
        sw[i].addEventListener("click", function (e) {
          e.preventDefault();
          e.stopImmediatePropagation();
          var on = sw[i].getAttribute("aria-checked") !== "true";
          setSwitch(sw[i], on);
          var s = readEditorForm(v);
          applyEditorPreview(v, s);
        });
      });

      // 保存修改
      Array.prototype.slice.call(v.querySelectorAll("button")).forEach(function (b) {
        var text = (b.textContent || "").trim();
        if (/保存修改|save changes|guardar cambios/i.test(text)) {
          b.setAttribute("data-pv-handled", "1");
          b.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            savePageSettings(v);
          });
        }
      });

      // 复制链接 / 下载二维码 / 预览：都真做，不再弹「打不开」
      Array.prototype.slice.call(v.querySelectorAll("button, a")).forEach(function (b) {
        var text = (b.textContent || "").trim();
        if (/复制链接|copy link|copiar enlace/i.test(text)) {
          b.setAttribute("data-pv-handled", "1");
          b.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            copyText(cardPageUrl());
          });
          return;
        }
        if (/下载二维码|download qr|descargar qr/i.test(text)) {
          b.setAttribute("data-pv-handled", "1");
          b.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            downloadQrImage(v);
          });
        }
      });

      // 二维码图片与链接文本换成当前站点地址
      refreshEditorLink(v, lang);
    });
  }

  /** 面板里的二维码 / 链接文本 / 预览按钮 → 当前站点真实地址 */
  function refreshEditorLink(v, lang) {
    var url = cardPageUrl();
    var enc = encodeIdentity(readLocalUser());
    var full = enc ? url + "#id=" + enc : url;
    var dataUrl = window.QRCodeCore ? renderQrDataUrl(full) : "";
    var img = v.querySelector('img[alt="QR"]');
    if (img && dataUrl) img.setAttribute("src", dataUrl);
    var linkText = v.querySelector('[class*="break-all"]');
    if (linkText) linkText.textContent = full;
    Array.prototype.slice.call(v.querySelectorAll("a")).forEach(function (a) {
      var text = (a.textContent || "").trim();
      if (/下载二维码|download qr|descargar qr/i.test(text)) {
        if (dataUrl) a.setAttribute("href", dataUrl);
        return;
      }
      if (/^预览$|^preview$|^vista previa$/i.test(text)) {
        a.setAttribute("href", full);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener");
      }
    });
  }

  /** 复制文本（离线也能真做） */
  function copyText(text) {
    var say = function () {
      toast((OFFLINE_MSG.copy[state.lang] || OFFLINE_MSG.copy.zh) + "：" + text);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(say, function () {
        legacyCopy(text, say);
      });
    } else {
      legacyCopy(text, say);
    }
  }

  /** 用内置二维码内核生成 PNG 并下载 */
  function downloadQrImage(v) {
    var url = cardPageUrl();
    var slug = (inVariant(v, "slug") || {}).value || "card";
    if (!window.QRCodeCore) {
      toast(OFFLINE_MSG.qrUnavailable[state.lang] || OFFLINE_MSG.qrUnavailable.zh);
      return;
    }
    var dataUrl = renderQrDataUrl(url);
    if (!dataUrl) {
      toast(OFFLINE_MSG.qrUnavailable[state.lang] || OFFLINE_MSG.qrUnavailable.zh);
      return;
    }
    var a = document.createElement("a");
    a.href = dataUrl;
    a.download = "scanmeet-" + String(slug).replace(/[^a-z0-9-]/gi, "") + ".png";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 0);
    toast(OFFLINE_MSG.qrDownloaded[state.lang] || OFFLINE_MSG.qrDownloaded.zh);
  }

  /** 把文字渲染成二维码 PNG 的 data URL */
  function renderQrDataUrl(text) {
    if (!window.QRCodeCore || !document.createElement("canvas")) return "";
    try {
      var qr = window.QRCodeCore.create(text, { errorCorrectionLevel: "M" });
      var size = qr.modules.size;
      var scale = 6;
      var quiet = 4;
      var canvas = document.createElement("canvas");
      canvas.width = (size + quiet * 2) * scale;
      canvas.height = (size + quiet * 2) * scale;
      var ctx = canvas.getContext("2d");
      if (!ctx) return "";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0f172a";
      for (var row = 0; row < size; row++) {
        for (var col = 0; col < size; col++) {
          if (qr.modules.get(row, col)) {
            ctx.fillRect((col + quiet) * scale, (row + quiet) * scale, scale, scale);
          }
        }
      }
      return canvas.toDataURL("image/png");
    } catch (e) {
      return "";
    }
  }

  /**
   * 离线快照里所有需要后端的按钮都要有回应，
   * 否则访客点「登录 / 免费注册」会毫无反应，像是坏掉了。
   */
  function bindDeadButtons() {
    document.querySelectorAll("button").forEach(function (btn) {
      // 已经有离线接管的控件，交给各自的逻辑
      if (btn.closest("[data-product-card]")) return;
      if (btn.getAttribute("role") === "tab") return;
      // 已被离线模块自己接管的按钮（展示页编辑的保存/复制/下载/预览等）
      if (btn.getAttribute("data-pv-handled") === "1") return;
      // 预览工具条自身（浮动按钮 / 面板内胶囊 / 弹窗按钮）
      if (btn.closest(".pv-fab") || btn.closest(".pv-panel") || btn.closest(".pv-modal")) return;
      // 已有锚点跳转逻辑的 CTA（留资 / 微信区块）
      if (btn.hasAttribute("data-cta")) return;
      if (
        btn.hasAttribute("data-pv-app-lang") ||
        btn.hasAttribute("data-pv-lang-btn") ||
        btn.hasAttribute("data-pv-theme-btn") ||
        btn.hasAttribute("data-pv-page-btn")
      ) {
        return;
      }
      var label = (btn.getAttribute("aria-label") || "").trim();
      if (
        PREV_LABELS.indexOf(label) !== -1 ||
        NEXT_LABELS.indexOf(label) !== -1 ||
        SHARE_LABELS.indexOf(label) !== -1
      ) {
        return;
      }
      // 表单提交由表单自身的离线提示处理
      if (btn.closest("form")) return;

      var text = (btn.textContent || "").replace(/\s+/g, " ").trim();

      // 表格里的「标记已读」是图标按钮，没有文字，按 data 属性认
      if (btn.hasAttribute("data-pv-lead-read")) {
        var pvRow = btn.closest("tr[data-pv-lead-row]");
        if (pvRow) {
          reviveButton(btn);
          btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            markLeadRead(pvRow, leadLang(pvRow));
          });
          return;
        }
      }

      // Radix 下拉 / 菜单：选项来自后端，轻提示即可
      if (btn.getAttribute("role") === "combobox" || btn.hasAttribute("aria-haspopup")) {
        // 快照里的下拉通常是 disabled（没有 React 状态），放开它才能给出说明
        reviveButton(btn);
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          toast(OFFLINE_MSG.select[state.lang] || OFFLINE_MSG.select.zh);
        });
        return;
      }

      var action = actionForButton(text);
      // 需要后端的按钮在快照里常是 disabled；放开它，点击时才能解释原因
      if (action !== "default") reviveButton(btn);

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        if (action === "card") {
          window.location.href = "card.html";
          return;
        }
        if (action === "lead") {
          var anchor = visibleById("lead-form");
          if (anchor) anchor.scrollIntoView({ behavior: "smooth", block: "center" });
          toast(OFFLINE_MSG.lead[state.lang] || OFFLINE_MSG.lead.zh);
          return;
        }
        if (action === "copy") {
          copyCurrentUrl();
          return;
        }
        if (action === "register") {
          window.location.href = "register.html";
          return;
        }
        if (action === "login") {
          window.location.href = "login.html";
          return;
        }
        if (action === "signout") {
          clearLocalUser();
          window.location.href = "index.html";
          return;
        }
        if (action === "profile") {
          // 「保存个人资料」= 把自己写成本机身份（职位必填）
          var pu = readProfileUser();
          if (pu && !pu.jobTitle) {
            toast(AUTH_FIELD_PROMPT.jobTitle[state.lang] || AUTH_FIELD_PROMPT.jobTitle.zh);
            var jobBox = visibleById("jobTitle");
            if (jobBox && jobBox.focus) jobBox.focus();
            return;
          }
          if (pu && setIdentity(pu)) {
            toast(OFFLINE_MSG.identitySaved[state.lang] || OFFLINE_MSG.identitySaved.zh);
          } else {
            toast(OFFLINE_MSG.save[state.lang] || OFFLINE_MSG.save.zh);
          }
          return;
        }
        if (action === "csv") {
          exportLeadsCsv();
          return;
        }
        if (action === "markRead") {
          var leadRow = btn.closest("tr[data-pv-lead-row]");
          if (leadRow) {
            markLeadRead(leadRow, leadLang(leadRow));
            if (btn.parentNode) btn.parentNode.removeChild(btn);
          }
          return;
        }
        if (action === "write") {
          openOfflineModal(text);
          return;
        }
        toast(OFFLINE_MSG.save[state.lang] || OFFLINE_MSG.save.zh);
      });
    });
  }

  function bindNativeInteractions() {
    // 产品卡片 → 详情弹窗（直接绑定，避免委托在嵌套结构上漏判）
    document.querySelectorAll("[data-product-card]").forEach(function (card) {
      var btn = card.querySelector("button");
      if (!btn) return;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        openProductModal(card);
      });
    });

    // 产品横滑箭头
    document.querySelectorAll("button[aria-label]").forEach(function (btn) {
      var label = (btn.getAttribute("aria-label") || "").trim();
      if (PREV_LABELS.indexOf(label) !== -1) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          scrollCarousel(btn, -1);
        });
      }
      if (NEXT_LABELS.indexOf(label) !== -1) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          scrollCarousel(btn, 1);
        });
      }
      // 分享按钮（离线环境无法调用系统分享）
      if (SHARE_LABELS.indexOf(label) !== -1) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          toast(OFFLINE_MSG.lead[state.lang] || OFFLINE_MSG.lead.zh);
        });
      }
    });

    // CTA 锚点跳转
    document.querySelectorAll("[data-cta]").forEach(function (cta) {
      var kind = cta.getAttribute("data-cta");
      var targetId = kind === "lead" ? "lead-form" : kind === "wechat" ? "wechat-block" : null;
      if (!targetId) return;
      cta.addEventListener("click", function (e) {
        e.preventDefault();
        var anchor = visibleById(targetId);
        if (anchor) anchor.scrollIntoView({ behavior: "smooth", block: "center" });
        if (kind === "lead") {
          toast(OFFLINE_MSG.lead[state.lang] || OFFLINE_MSG.lead.zh);
        }
      });
    });

    // 表单：离线环境给出提示，不真的提交
    document.querySelectorAll("form").forEach(function (form) {
      var auth = isAuthForm(form);
      var lead = !!form.querySelector("#lead-name");
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (auth) {
          // 注册 / 登录：填的姓名写进本机身份，全站立刻换成这个人
          var u = readFormUser(form);
          var isRegisterForm = !!form.querySelector("#fullName");
          // 职位必填：没填就当场拦下来并提示
          if (isRegisterForm && u && !u.jobTitle) {
            toast(AUTH_FIELD_PROMPT.jobTitle[state.lang] || AUTH_FIELD_PROMPT.jobTitle.zh);
            var jobInput = form.querySelector("#jobTitle");
            if (jobInput && jobInput.focus) jobInput.focus();
            return;
          }
          if (u) setIdentity(u);
          showAuthSuccess(form, u);
          applyIdentity();
          return;
        }
        if (lead) {
          // 名片页留资：真的记到本机（工作台「客户留资」里能看到这条），
          // 同时把页面上的人换成填的人
          var lu = readFormUser(form);
          if (lu) setIdentity(lu);
          var nameEl = form.querySelector("#lead-name");
          var phoneEl = form.querySelector("#lead-phone");
          var companyEl = form.querySelector("#lead-company");
          var msgEl = form.querySelector("#lead-message");
          var leadName = nameEl ? nameEl.value.trim() : "";
          var leadPhone = phoneEl ? phoneEl.value.trim() : "";
          if (!leadName || !leadPhone) {
            toast(OFFLINE_MSG.leadRequired[state.lang] || OFFLINE_MSG.leadRequired.zh);
            return;
          }
          upsertLeadRecord({
            key: leadKeyOf(leadName, leadPhone),
            name: leadName,
            phone: leadPhone,
            company: companyEl ? companyEl.value.trim() : "",
            message: msgEl ? msgEl.value.trim() : "",
            time: formatNow(),
            source: OFFLINE_MSG.leadSource[state.lang] || OFFLINE_MSG.leadSource.zh,
            status: "new",
            unread: true,
            recorded: true,
          });
          showLeadSuccess(form);
          applyIdentity();
          toast(OFFLINE_MSG.leadRecorded[state.lang] || OFFLINE_MSG.leadRecorded.zh);
          return;
        }
        var kind = currentKind() === "card" ? "lead" : "save";
        toast(OFFLINE_MSG[kind][state.lang] || OFFLINE_MSG[kind].zh);
      });
      // 必填校验没通过时 submit 不会触发，这里用捕获把离线提示补上
      form.addEventListener(
        "invalid",
        function (e) {
          var field = e.target && e.target.id ? AUTH_FIELD_PROMPT[e.target.id] : null;
          if (field) {
            toast(field[state.lang] || field.zh);
            return;
          }
          if (auth) return;
          var kind = currentKind() === "card" ? "lead" : "save";
          toast(OFFLINE_MSG[kind][state.lang] || OFFLINE_MSG[kind].zh);
        },
        true
      );
    });
  }

  /** 注册/登录表单：有邮箱 + 密码输入框 */
  function isAuthForm(form) {
    return !!form.querySelector('input[type="email"]') && !!form.querySelector('input[type="password"]');
  }

  /** 留资成功态：把表单换成确认卡片 */
  function showLeadSuccess(form) {
    if (!form || form.getAttribute("data-pv-lead-done") === "1") return;
    form.setAttribute("data-pv-lead-done", "1");
    var text = {
      zh: "已收到你的联系方式，稍后会与你联系。",
      en: "Thanks! We have your contact details and will get back to you soon.",
      es: "¡Gracias! Hemos recibido tus datos y te contactaremos pronto.",
    };
    var box = document.createElement("div");
    box.className =
      "flex flex-col items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-8 text-center";
    box.innerHTML =
      '<p class="text-sm font-medium text-emerald-800">' +
      escapeHtml(text[state.lang] || text.zh) +
      "</p>" +
      '<p class="text-[11px] text-emerald-700/80">' +
      escapeHtml(
        (OFFLINE_MSG.leadRecorded[state.lang] || OFFLINE_MSG.leadRecorded.zh)
      ) +
      "</p>";
    if (form.parentNode) form.parentNode.replaceChild(box, form);
  }

  /** 注册/登录提交后：把表单换成一张「演示完成」的结果卡 */
  function showAuthSuccess(form, user) {
    var isRegister = !!form.querySelector("#fullName");
    var set = AUTH_DONE_TEXT[isRegister ? "register" : "login"];
    var t = set[state.lang] || set.zh;
    var who = user && user.fullName ? user.fullName : "";
    if (!who) {
      var cur = readLocalUser();
      who = cur && cur.fullName ? cur.fullName : user && user.email ? user.email : "";
    }

    var panel = document.createElement("div");
    panel.className = "pv-auth-done";
    panel.innerHTML =
      '<div class="pv-auth-done-icon">✓</div>' +
      '<h2 class="pv-auth-done-title">' + escapeHtml(t.title) + "</h2>" +
      (who ? '<p class="pv-auth-done-who">' + escapeHtml(who) + "</p>" : "") +
      '<p class="pv-auth-done-desc">' + escapeHtml(t.desc) + "</p>" +
      '<div class="pv-modal-actions">' +
      '<a class="pv-modal-btn" href="workbench.html">' + escapeHtml(t.workbench) + "</a>" +
      '<a class="pv-modal-btn pv-modal-btn-ghost" href="card.html">' + escapeHtml(t.card) + "</a>" +
      '<a class="pv-modal-btn pv-modal-btn-ghost" href="index.html">' + escapeHtml(t.home) + "</a>" +
      '<button type="button" class="pv-modal-btn pv-modal-btn-ghost" data-pv-copy-identity>' +
      escapeHtml(t.link) +
      "</button>" +
      "</div>";

    var card = form.parentElement || form;
    card.insertBefore(panel, form);
    form.remove();
    var note = card.querySelector("p.mt-5");
    if (note) note.remove();

    var linkBtn = panel.querySelector("[data-pv-copy-identity]");
    if (linkBtn) linkBtn.addEventListener("click", copyIdentityLink);
  }

  /* --- 站点根目录：取 preview.js 自身所在目录，兼容子路径部署（如 GitHub Pages）与 file:// 双击打开 --- */
  function siteBase() {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || "";
      if (src.indexOf("preview.js") !== -1) return src.replace(/preview\.js.*$/, "");
    }
    return "";
  }

  /* --- 把演示数据里的 localhost 链接换成当前站点地址 --- */
  function fixLocalUrls() {
    var base = siteBase();
    if (!base) {
      var origin = window.location.origin;
      // file:// 打开时 origin 是字符串 "null"，无法拼出可用地址，直接跳过
      if (!origin || origin === "null") return;
      if (origin.indexOf("localhost") !== -1 || origin.indexOf("127.0.0.1") !== -1) return;
      base = origin + "/";
    }

    // 链接：演示环境的 /p/xxx 指向访客名片页预览
    document.querySelectorAll("a[href]").forEach(function (a) {
      var href = a.getAttribute("href") || "";
      if (href.indexOf("http://localhost:3000/p/") === 0) {
        a.setAttribute("href", base + "card.html");
        a.removeAttribute("target");
      }
    });

    // 文本：把演示链接换成当前站点地址
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || node.nodeValue.indexOf("http://localhost:3000") === -1) continue;
      node.nodeValue = node.nodeValue
        .replace(/http:\/\/localhost:3000\/p\/[^\s"'<>]+/g, base + "card.html")
        .replace(/http:\/\/localhost:3000/g, base);
    }
  }

  /* --- 修复多语言变体之间的重复 id --- */
  function dedupeIds() {
    var seen = {};
    visibleVariants().forEach(function (variant, index) {
      var renames = {};
      variant.querySelectorAll("[id]").forEach(function (el) {
        var id = el.getAttribute("id");
        if (!id) return;
        if (seen[id]) {
          var next = id + "--v" + index;
          renames[id] = next;
          el.setAttribute("id", next);
        } else {
          seen[id] = true;
        }
      });
      // 同步 aria-controls / aria-labelledby，保证 Tab 与面板仍然对应
      Object.keys(renames).forEach(function (oldId) {
        variant.querySelectorAll('[aria-controls="' + oldId + '"]').forEach(function (el) {
          el.setAttribute("aria-controls", renames[oldId]);
        });
        variant.querySelectorAll('[aria-labelledby="' + oldId + '"]').forEach(function (el) {
          el.setAttribute("aria-labelledby", renames[oldId]);
        });
      });
    });
  }

  /**
   * 接管 Radix Tabs：离线快照里各 Tab 面板都已渲染（未选中的带 hidden），
   * 这里用原生事件切换显示，React 运行时不在场也能点。
   */
  function bindTabs() {
    var tabs = document.querySelectorAll('[role="tab"]');
    if (!tabs.length) return;
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var controls = tab.getAttribute("aria-controls");
        document.querySelectorAll('[role="tab"]').forEach(function (other) {
          var active = other === tab;
          other.setAttribute("aria-selected", active ? "true" : "false");
          other.setAttribute("data-state", active ? "active" : "inactive");
        });
        document.querySelectorAll('[role="tabpanel"]').forEach(function (panel) {
          var active = panel.id === controls;
          panel.hidden = !!controls && !active;
          panel.setAttribute("data-state", active ? "active" : "inactive");
        });
      });
    });
  }

  function init() {
    dedupeIds();
    fixLocalUrls();
    // 身份链接（#id=…）优先：这样手机打开电脑发来的链接就直接显示那个名字
    var prevIdentity = applyIdentityFromHash();
    applyIdentity(prevIdentity);
    buildToolbar();

    var pr = pageRoot();
    var kind = pr ? pr.getAttribute("data-pv-page") : null;
    if (kind === "workbench") applyPage("overview");
    if (kind === "card") applyTheme("industrial");
    applyLang("zh");
    interceptAppLocaleButtons();
    interceptLinks();
    bindNativeInteractions();
    upgradeLeadSelects();
    // 线索页：把本机记录恢复回来，并把真实留资渲染进去
    Array.prototype.slice
      .call(document.querySelectorAll('.pv-variant[data-pv-page="leads"]'))
      .forEach(function (v) {
        restoreLeadState(v);
        renderRecordedLeads(v);
      });
    // 展示页编辑：先接管自己的按钮，通用规则会跳过它们
    bindEditorPage();
    bindDeadButtons();
    bindTabs();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
