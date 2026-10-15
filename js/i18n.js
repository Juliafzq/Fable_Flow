/**
 * UNTO / FLOW — Lightweight i18n (English / Simplified Chinese).
 *
 * Keys are the original English strings (or English templates with {params}),
 * so English is always the fallback. The app name (UNTO / FLOW), all dates, and
 * the monthly calendar intentionally stay in English and are NOT listed here.
 */

export const SUPPORTED_LANGUAGES = ['en', 'zh'];

const ZH = {
  // ---- Top bar & profile menu ----
  'Card': '卡片',
  'Timer': '番茄',
  'Account': '账号',
  'Sign In ↗': '登录 ↗',
  'Home': '首页',
  'About & Tour': '关于与教程',
  'Daily Reset': '每日换新',
  'Daily reset time: {time}': '每日换新时间：{time}',
  'Tomato Reset': '番茄每日重置',
  'Reset tomatoes daily with the card': '每天随卡片一起重置番茄',
  'Yes': '是',
  'No': '否',
  'Tomatoes reset daily with the card': '番茄将每天随卡片一起重置',
  'Tomatoes keep running across days': '番茄跨天保留，不会自动重置',
  'Sound': '声音',
  'On': '开',
  'Off': '关',
  'Sound: On': '声音：开',
  'Sound: Off': '声音：关',
  'Language': '语言',

  // ---- Today's card ----
  '+ Add item': '+ 添加待办',
  'Type item...': '今天要做什么？',
  'Example Task': '示例待办',
  'Write your evening reflection...': '今天过得怎么样？',
  '+ Attach Photo (up to 2)': '+ 添加照片（最多 2 张）',
  '+ 2nd Photo': '+ 再加一张',
  '+ Add 2nd Photo': '+ 再加一张',
  'Tap photo to view in detail': '点击照片查看大图',
  'Tap photo to view in detail, or tap × to remove': '点击照片查看大图，点 × 删除',
  'Click to attach a photo': '点击添加照片',
  'Click to attach a second photo': '点击再加一张照片',
  'Delete item': '删除待办',
  'Open this tomato timer': '打开这个番茄钟',
  'Click grey tomato to light up and open Timer page': '点击灰色番茄，开始计时',

  // ---- Timer ----
  'Tap to assign': '点击选择',
  'TAP TO ASSIGN': '点击选择待办',
  'EXAMPLE TASK': '示例待办',
  '+ Custom Title...': '+ 自定义名称…',
  '✎ Edit Title...': '✎ 修改名称…',
  '✕ Unassign Tomato': '✕ 清空这个番茄',
  '+ Card': '+ 卡片',
  'Type task title...': '输入专注名称…',
  'Type task title': '输入专注名称',
  'Type timer task title': '输入番茄专注名称',
  "Sync this task to Today's Card": '同步到今日卡片',
  "Sync this task to Today's Card list": '同步到今日卡片列表',
  'Synced to Today’s Card': '已同步到今日卡片',
  'Deep Work': '深度专注',
  'Focus Session': '专注时间',
  'Set': '确定',
  'MIN': '分钟',
  'HH:MM': '时:分',
  '0–180m': '0–180',
  'Type minutes (0–180) or HH:MM (e.g. 02:30) · Enter to set':
    '输入 0–180 分钟或 02:30，回车确认',
  'Minutes or HH:MM, up to 3 hours':
    '输入分钟数或 时:分，最长 3 小时',
  '15m': '15分',
  '25m': '25分',
  '45m': '45分',
  '60m': '60分',
  '90m': '90分',
  '120m': '120分',
  '150m': '150分',
  '180m': '180分',
  'Start Timer': '开始',
  'Pause Timer': '暂停',
  'End Timer (Turn Silver Metallic)': '结束计时',
  'Reset Timer to 00:00': '重置为 00:00',
  'Reset Tomato Timer to 00:00': '重置为 00:00',
  'End Timer (Turns tomato Silver Metallic without clearing)': '结束计时',
  'Tap tomato body to open Hero Timer; tap title text to edit/reassign':
    '点番茄看大图计时，点名称可修改',
  'Tap title to edit or reassign task': '点击修改名称或更换待办',
  'Tap to assign a task to this tomato': '点击为这个番茄选择待办',

  // ---- Card stack ----
  'Edit': '编辑',
  'Done': '完成',
  'Add tasks / reflections retrospectively': '补写待办 / 回顾',
  'Write or update your reflection for this day...': '那天过得怎么样？',
  'Permanently delete {date} card?': '删除 {date} 的卡片？',
  'This action cannot be undone. This archived card and its reflection will be permanently removed from your stack.':
    '删除后无法恢复，这张卡片和当天的回顾都会被移除。',
  'Tap to jump between months': '点击切换月份',
  'Previous archived card': '上一张卡片',
  'Next archived card': '下一张卡片',

  // ---- Dialogs ----
  'Add Task': '添加待办',
  'Edit Task {n}': '修改待办 {n}',
  'Add Task to {date}': '给 {date} 添加待办',
  'Edit {date} Task {n}': '修改 {date} 的待办 {n}',
  'Assign Custom Timer Title': '给番茄起个名字',
  'Edit Timer Title': '修改番茄名称',
  'Enter title...': '输入名称…',
  'Cancel': '取消',
  'Save': '保存',
  'Delete': '删除',
  'Permanently delete this item?': '删除这条待办？',
  'This action cannot be undone. The item will be permanently removed from Today’s Card.':
    '删除后无法恢复。',
  'Permanently Delete': '删除',
  'Permanently delete this task': '删除这条待办',
  'Delete task': '删除待办',

  // ---- Account & sign-in ----
  'Sign In': '登录',
  'Create Account': '注册',
  'or': '或',
  'Continue with Google': '通过 Google 登录',
  'Continue with Apple': '通过 Apple 登录',
  'Email address': '邮箱',
  'Password (6+ chars)': '密码（至少 6 位）',
  'Synced': '已同步',
  'This device only': '仅保存在本设备',
  'Up to date': '已是最新',
  'Just now': '刚刚',
  'Sync Now': '立即同步',
  'Sign Out': '退出登录',
  'Supabase Cloud': 'Supabase 云端',
  'Supabase Cloud Keys ▾': 'Supabase 云端设置 ▾',
  'Save Keys': '保存',
  'Enter a valid email address': '请输入正确的邮箱',
  'Enter your password': '请输入密码',
  'Password must be at least 6 characters': '密码至少需要 6 位',
  'Account already exists — switch to Sign In': '这个邮箱已注册，请直接登录',
  'Account not found — switch to Create Account': '这个邮箱还没注册，请先注册',
  "No account on this device. Accounts don't sync between devices yet.": '这台设备上没有这个账号。账号暂时还不能在设备之间同步。',
  'Incorrect password': '密码不对，请再试一次',
  'Wrong email or password': '邮箱或密码不对',
  'Check your email to confirm your account, then sign in': '请先到邮箱确认账号，然后再登录',
  "Google / Apple sign-in isn't set up yet. Use email and password.": 'Google / Apple 登录暂未开通，请用邮箱和密码',
  "Couldn't reach cloud sync. Changes are kept on this device.": '暂时连不上云端，改动已保存在本设备',
  'Authentication failed': '登录失败，请稍后再试',
  'Sign-in failed': '登录失败，请稍后再试',

  // ---- About card ----
  'A simple companion for a fulfilling life, built on three principles:':
    '一个陪你过好充实每一天的小工具，\n围绕三个理念：',
  'Purpose:': '心怀目标：',
  'Write down daily goals and cross them off.': '写下每天的目标，完成一项划掉一项。',
  'Presence:': '专心生活：',
  'Reflect on the day and revisit past memories.': '回顾当天，也重温过去的点滴。',
  'Flow:': '融入心流：',
  'Sink into deep focus using the pomodoros.': '用番茄钟，沉浸在专注里。',
  'Just a small tool that helps you focus on your real life, not this app.':
    '希望这个小工具，可以帮你专注于真实的生活，而不是这个 App。',
  'Enjoy.': '祝你用得开心。',
  'Start Tour →': '开始教程 →',

  // ---- Tutorial ----
  'Tap Card or Tomato': '点击卡片或番茄',
  'Open today’s card or focus timer': '打开今天的卡片或番茄钟',
  'Front Page · Daily To-Dos': '卡片正面 · 今日待办',
  'Add up to 8 tasks. Swipe to cross out, swipe again to undo':
    '最多 8 条。划一下完成，再划一下撤销',
  'Flip Page · Daily Reflection': '卡片背面 · 今日回顾',
  'Swipe card to write reflection & attach photos': '滑动卡片翻面，写写今天、放几张照片',
  'Flip with the flip button or by swiping empty card space (not on items) to write reflection & attach photos':
    '点翻面按钮，或在卡片空白处滑动（不要在待办上）翻面，写写今天、放几张照片',
  'Tap Mini Tomato': '点击小番茄',
  'Link a daily to-do item to a focus timer': '给这条待办开一个番茄钟',
  'Turn Tomato Dial': '转动番茄',
  'Swipe across the tomato to turn the dial': '左右拨动番茄，转动转盘',
  'Swipe to turn the dial. Turn on phone ringtone & app sound to hear the chime':
    '左右拨动番茄设定时间。请开启手机响铃与应用内声音以听取到点铃声',
  'Tap Digits to Type Time': '点数字输入时间',
  'Tap the numbers to type minutes, e.g. 45': '点击数字，直接输入分钟，如 45',
  'Tap to Assign & Sync to Card': '点击命名 · 同步到卡片',
  'Tap title to name your timer, then tap + Card to add it to today’s card':
    '点击标题输入专注名称，点右侧「+ 卡片」同步到今日卡片',
  'Tomato Grid · 6 Focus Timers': '番茄格 · 6 个番茄',
  'Tap tomato body for big timer, tap title to edit': '点番茄看大图计时，点名称可修改',
  'Scroll Stack · Past Cards': '卡片堆 · 往日卡片',
  'Swipe the date bar to browse past cards': '左右滑动日期栏，翻看以前的卡片',
  'Zoom Out · Monthly Calendar': '月历 · 整月一览',
  'Pinch two fingers to zoom out to monthly calendar': '双指捏合，查看整个月',
  'Profile & Settings': '个人与设置',
  'Sign in and change settings here': '在这里登录账号与更改设置',
  'Enter your Google email above first, or connect OAuth in Cloud Sync settings':
    '请先在上方输入 Google 邮箱，或在云同步设置中配置 OAuth',
  'Enter your Apple ID email above first, or connect OAuth in Cloud Sync settings':
    '请先在上方输入 Apple ID 邮箱，或在云同步设置中配置 OAuth',
  'Last': '上一步',
  'Next': '下一步',

  // ---- Toasts & notifications ----
  'Task length limit reached': '字数已达上限',
  'Reflection limit reached': '字数已达上限',
  'Maximum 8 tasks per card reached.': '每张卡片最多 8 条待办',
  'Maximum 6 active tomatoes reached.': '最多同时开启 6 个番茄钟',
  'Maximum 6 active tomatoes reached': '最多同时开启 6 个番茄钟',
  'Photo updated in Evening Journal': '照片已更新',
  'Photo updated on archived card': '照片已更新',
  'Could not process selected image file.': '这张图片无法读取，换一张试试',
  'Timer set to {n} min': '已设为 {n} 分钟',
  'Timer ended': '计时结束',
  'Timer completed: {title}': '时间到：{title}',
  'Tomato reset to 00:00': '番茄已归零',
  'Stopwatch mode': '已切换为正计时',
  'Countdown mode': '已切换为倒计时',
  'Switch to Countdown to set duration': '请先切换到倒计时，再设定时长',
  'Tomato unassigned': '已清空这个番茄',
  'Task deleted': '待办已删除',
  'Task removed from archived card': '待办已删除',
  'Card permanently deleted': '卡片已删除',
  'No archived card remaining to delete.': '没有可以删除的卡片',
  'Card added for {date}': '已添加 {date} 的卡片',
  'Future date': '这一天还没到哦',
  'Synced to account': '已同步',
  'Signed in as {email}': '已登录：{email}',
  'Account created: {email}': '注册成功：{email}',
  'Signed out': '已退出登录',
  'Supabase Cloud connected': '已连接云端',
  'Saved local vault mode': '已改为仅存本地',
  'New day: yesterday’s card moved to your stack': '新的一天开始了，昨天的卡片已放进卡片堆',
  'Restored clean default state with Example Task.': '已恢复默认状态',
  'Language: English': 'Language: English',
  'Language: 简体中文': '语言：简体中文',

  // ---- Accessibility labels & tooltips ----
  'Profile and Settings': '个人与设置',
  'Profile, Foley Audio & Workspace Navigation': '个人与设置',
  "Open Today's Index Card": '打开今日卡片',
  'Open Pomodoro Timer': '打开番茄钟',
  'Open Card Stack Archive': '打开卡片堆',
  'Open Chronological Card Stack Archive': '打开卡片堆',
  'Flip Card 180 Degrees': '翻转卡片',
  'Flip card': '翻面',
  'Flip Card 180° (White Front ↔ Matte Black Back)': '翻转卡片',
  'Timer readout. Tap to type duration in minutes or HH:MM': '剩余时间，点击输入时长',
  'Tap digits to type time (0–180 min or HH:MM)': '点击数字输入时长',
  'Type timer duration': '输入时长',
  'Type minutes (0 to 180) or HH:MM': '输入分钟数或 时:分',
  'Quick duration presets': '常用时长',
  'Tap to assign or change task right on this page': '点击选择或更换待办',
  'Interactive Heirloom Tomato Timer Dial': '番茄钟转盘',
  'Switch to 6-Tomato Grid View': '切换到番茄格',
  'Play or Pause Timer': '开始或暂停',
  'End and Reset Timer to 00:00': '结束并重置',
  'Toggle Stopwatch Count-Up Mode': '切换正计时',
  'Archived Card Dates': '往日卡片日期',
  'Edit past card': '编辑往日卡片',
  'Archived card evening reflection': '往日回顾',
  "Return to Today's Card": '返回今日卡片',
  'Zoom Out to Monthly Calendar View': '缩小到月历',
  'Flip Archived Card 180 Degrees': '翻转卡片',
  'Flip Archived Card 180° (Front ↔ Back)': '翻转卡片',
  'Permanently Delete Archived Card': '删除这张卡片',
  'Permanently Delete This Card': '删除这张卡片',
  'Zoom In to Selected Card in Stack': '放大查看这张卡片',
  'Profile Menu': '个人菜单',
  'Daily reset time': '每日换新时间',
  'Account and Cloud Sync': '账号与同步',
  'Close account modal': '关闭',
  'Close': '关闭',
  'About UNTO / FLOW': '关于 UNTO / FLOW',
  'Close about card': '关闭',
  'Guided Tutorial': '教程',
  'Close tutorial': '关闭教程',
  'Photo Detail View': '查看照片',
  'Close photo detail': '关闭',
  'Workspace Pillar': '切换卡片或番茄',
  'Type task directly on card': '在卡片上输入待办',
  'Edit task directly on card': '在卡片上修改待办',
  'Evening reflection journal (100% user-authored, dynamic font scaling)': '今日回顾',
  'Evening journal photo attachments': '回顾照片',
  'Assigned Tomato': '已关联的番茄',
  'Unassigned Grey Tomato': '未关联的番茄',
  'Unassigned Tomato Timer': '未关联的番茄',
};

const DICTS = { zh: ZH };

let currentLang = 'en';

export function setLanguage(lang) {
  currentLang = SUPPORTED_LANGUAGES.includes(lang) ? lang : 'en';
  if (typeof document !== 'undefined') {
    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.classList.toggle('lang-zh', currentLang === 'zh');
  }
}

export function getLanguage() {
  return currentLang;
}

/** Translate an English key (with optional {param} substitutions). */
export function t(key, params = null) {
  const dict = DICTS[currentLang];
  let out = dict && Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
  if (params) {
    out = out.replace(/\{(\w+)\}/g, (m, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : m
    );
  }
  return out;
}

// ---- Static HTML translation (text nodes + placeholder / aria-label / title) ----
const TRANSLATABLE_ATTRS = ['placeholder', 'aria-label', 'title'];
let staticRegistry = null;

/**
 * Records the original English of every static text node / attribute in `root`.
 * Must run once BEFORE the app renders user content, so user-typed text is never captured.
 */
export function registerStaticI18n(root) {
  if (staticRegistry || !root) return;
  staticRegistry = { texts: [], attrs: [] };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent || parent.closest('script, style, svg, textarea')) {
        return NodeFilter.FILTER_REJECT;
      }
      const key = node.nodeValue.trim();
      return key && Object.prototype.hasOwnProperty.call(ZH, key)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  let n;
  while ((n = walker.nextNode())) {
    staticRegistry.texts.push({ node: n, original: n.nodeValue, key: n.nodeValue.trim() });
  }
  root.querySelectorAll('*').forEach((el) => {
    TRANSLATABLE_ATTRS.forEach((attr) => {
      const val = el.getAttribute(attr);
      if (val && Object.prototype.hasOwnProperty.call(ZH, val.trim())) {
        staticRegistry.attrs.push({ el, attr, key: val.trim(), original: val });
      }
    });
  });
}

/** Re-applies static translations for the current language. */
export function applyStaticI18n() {
  if (!staticRegistry) return;
  staticRegistry.texts.forEach(({ node, original, key }) => {
    node.nodeValue = currentLang === 'en' ? original : t(key);
  });
  staticRegistry.attrs.forEach(({ el, attr, key, original }) => {
    el.setAttribute(attr, currentLang === 'en' ? original : t(key));
  });
}
