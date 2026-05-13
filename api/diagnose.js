// Vercel Serverless Function: /api/diagnose
// Receives answers, computes Lv, calls DeepSeek, returns structured diagnosis.

// 老板 AI 化 5 阶段（PDF《30 人以下企业 AI 转型实战指南》框架）
const LEVEL_TABLE = [
  null, // 占位，从 L1 开始
  { lv: 1, name: '围观期',     tagline: '知道 AI 很火，公司里没具体动作 · 信息过载、选模型焦虑' },
  { lv: 2, name: '个人尝鲜',   tagline: '⚠️ 60% 老板卡这 — 自己会用了，团队还在原地' },
  { lv: 3, name: '团队推行',   tagline: '⭐ 核心转化阶段 — 跨过这道坎赢 80% 同行' },
  { lv: 4, name: '组织重构',   tagline: '团队在用了，岗位/角色边界开始重组' },
  { lv: 5, name: '系统化运转', tagline: 'AI 大脑成型 — 知识自动外化、判断编码化' },
];

// ===== 单选题分数表（选项→0-5 分）=====
const SCORES = {
  B1: { '0 件，主要是看新闻、刷推文':0, '1-2 件，偶尔试一下':1, '3-5 件，几个稳定场景在用':2, '几乎每天，5 件以上':3, '我已经离不开 AI，主要工作流都嵌入了':4, '我自己用得很顺，重点是把这套传给团队':5 },
  B2: { '还没在团队推过':0, '推过，没人真正用起来':1, '1-2 个先锋在用（团队不到 30%）':2, '一半左右（30%-60%）在用':3, '大多数人（60%+）每天都在用':4, '全员每天离不开，已融入日常工作流':5 },
  B3: { '完全没动过':0, '想过，还没动手':1, '改了 1-2 条 JD（招聘标准变了）':2, '合并或减掉过某个岗位':3, '招了新的 AI Native 类岗位':4, '整个组织结构按 AI 重新设计过':5 },
  B4: { '没这概念':0, '我个人有一些提示词收藏':1, '团队有共享的 prompt 库（人工维护）':2, '有部门级知识库/案例库':3, '公司级 AI 大脑，全员可调用':4, 'AI 大脑由 AI 自动采集编译（不靠人录入）':5 },
  C2: { '还没真正在用':0, '偶尔用，不到 10 分钟/天':1, '10-30 分钟/天':2, '30 分钟-1 小时/天':3, '1-3 小时/天':4, '3+ 小时，AI 是我主要工作工具':5 },
  C4: { '都没技术背景，怕搞不来':0, '我懂一点，团队完全不懂':1, '我懂技术，团队不懂':2, '大家都不算技术，但学习能力还行':3, '团队里有几个挺会折腾 AI 的':4, '团队有 IT / 开发顶大头':5 },
  C5: { '我自己还没真正开始':0, '我自己在用，没推过团队':1, '推过，员工说"跟我没关系"，没下文了':2, '推过，员工试一下就放弃了':2, '少数几个人在用，多数人不用':3, '全员每天都在用':5 },
  C6: { '还没推':0, '我在群里口头说"大家都要用"':1, '搞过 1-2 次脱产培训':2, '写进了流程 / SOP 文档':3, '把 AI 嵌入了日常工作群（飞书机器人 / 一键按钮）':4, '加进了 KPI / 绩效考核':5 },
  C7: { '团队已经在用，没这问题':5, '没人正经推过，无所谓':1, '不会用，学习成本太高':2, '觉得 AI 不靠谱 / 没人情味':2, '觉得跟自己工作没关系':1, '怕 AI 把自己替代了':3 },
  C8: { '没对比过':0, '我自己心里有数，没正经做过对比':1, '小范围做过一次对比给团队看':2, '常态化对比（每周 / 每月）':3, 'AI 已经做主力，人审核':4, 'AI 全跑，没人对比这个事了':5 },
  C10: { '差不多':5, '我略高一些':4, '我明显高出一截':2, '天差地别（我单飞）':0, '我还不如某些员工':4, '不知道，没真做过对比':1 },
  C11: { '没考核':0, '嘴上提，没写进考核':1, '部分关键岗位（销售 / 内容）写进了 KPI':3, '全岗位 KPI 含 AI 使用度':4, '不达标会被淘汰':5, 'AI 产出本身就是 KPI（不分 AI 与非 AI）':5 },
  C12: { '完全没用上，跟大公司一样慢':0, '想动但卡在自己决策上':1, '想换工具/流程时能 1 天内全员切':3, '每周都在小步试错 / 切换':4, '已经把"小快灵"变成日常工作节奏':5, '我们就是按 AI 原生设计的，速度是核心优势':5 },
  C14: { '没 SOP':0, '写在 Word / 飞书文档里（人看的）':1, '部分写成了 prompt 模板':2, '写成了 Skill / Agent 配置（AI 执行）':4, 'AI 能根据反馈自动迭代 SOP':5, '关键工作流没人写 SOP——AI 直接跑':5 },
  C15: { '没沉淀':0, '靠个人收藏（提示词收藏夹之类）':1, '靠人手动整理（飞书文档 / Notion）':2, 'AI 半自动整理 + 人审':4, 'AI 全自动采集编译（聊天记录 / 文档自动入库）':5, '一人输入、全员受益的共享上下文':5 },
  C16: { '0 条':0, '1 条（内容生产 / 客服 / 销售 三选一）':1, '2-3 条核心流程':3, '4-6 条':4, '7+ 条，AI 已经是生产力主体':5, '产品 / 服务本身就是 AI 跑出来的，没"人版"对照':5 },
};

const singleScore = (val, qid) => SCORES[qid]?.[val] ?? 0;

// multi 题分档：去掉否定项，按比例分档
function multiScore(arr, maxOptions) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  const NEG = ['都没用过', '都没有', '都不懂'];
  const positive = arr.filter(x => !NEG.some(n => x.includes(n)));
  if (positive.length === 0) return 0;
  const ratio = positive.length / maxOptions;
  if (ratio >= 0.7) return 5;
  if (ratio >= 0.5) return 4;
  if (ratio >= 0.35) return 3;
  if (ratio >= 0.2) return 2;
  return 1;
}

// ===== 4 板块能力分（每板块满分 25，归一到 0-100）=====
function computeDomains(answers) {
  const personal = singleScore(answers.B1,'B1') + multiScore(answers.C1, 11) + singleScore(answers.C2,'C2') + multiScore(answers.C3, 7) + singleScore(answers.C4,'C4');
  const team     = singleScore(answers.B2,'B2') + singleScore(answers.C5,'C5') + singleScore(answers.C6,'C6') + singleScore(answers.C7,'C7') + singleScore(answers.C8,'C8');
  const org      = singleScore(answers.B3,'B3') + multiScore(answers.C9, 7) + singleScore(answers.C10,'C10') + singleScore(answers.C11,'C11') + singleScore(answers.C12,'C12');
  const system   = singleScore(answers.B4,'B4') + multiScore(answers.C13, 6) + singleScore(answers.C14,'C14') + singleScore(answers.C15,'C15') + singleScore(answers.C16,'C16');
  const pct = (s) => Math.round(s / 25 * 100);
  return { personal: pct(personal), team: pct(team), org: pct(org), system: pct(system) };
}

// ===== 等级判定：B 区累加分 + 反作弊降级 =====
function determineLevel(answers) {
  const bSum = singleScore(answers.B1,'B1') + singleScore(answers.B2,'B2') + singleScore(answers.B3,'B3') + singleScore(answers.B4,'B4');

  let lv;
  if (bSum <= 3) lv = 1;
  else if (bSum <= 8) lv = 2;
  else if (bSum <= 13) lv = 3;
  else if (bSum <= 17) lv = 4;
  else lv = 5;

  // 反作弊降级规则
  const reasons = [];
  if (answers.C2 === '还没真正在用') { lv = Math.min(lv, 1); reasons.push('C2 显示个人还没真正在用'); }
  if (answers.C2 === '偶尔用，不到 10 分钟/天') { lv = Math.min(lv, 2); reasons.push('C2 个人时长不足，最多 L2'); }
  if (answers.C5 === '我自己还没真正开始') { lv = Math.min(lv, 1); reasons.push('C5 团队卡点显示自己还没开始'); }
  if (answers.C5 === '我自己在用，没推过团队') { lv = Math.min(lv, 2); reasons.push('C5 显示自用未推团队，最多 L2'); }

  const c1 = Array.isArray(answers.C1) ? answers.C1 : [];
  const c3 = Array.isArray(answers.C3) ? answers.C3 : [];
  const hasAdvancedTool = c1.some(t => /Cursor|Coze|Dify|Claude Code|Codex|n8n/.test(t));
  if (bSum >= 14 && !hasAdvancedTool) { lv = Math.min(lv, 3); reasons.push('B 区高分但工具栈仅基础聊天工具，最多 L3'); }

  const onlyChat = c3.length === 1 && c3[0].includes('都不懂');
  if (bSum >= 14 && onlyChat) { lv = Math.min(lv, 2); reasons.push('B 区高分但 C3 显示"都不懂"，最多 L2'); }

  const e1 = answers.E1 || '';
  if (bSum >= 14 && e1.replace(/\s/g,'').length < 50) { lv = Math.min(lv, 3); reasons.push('B 区高分但 E1 工作流描述少于 50 字，最多 L3'); }

  return { lv, bSum, reasons };
}

function fmt(v) {
  if (Array.isArray(v)) return v.join('、') || '（未选）';
  return v || '（未填写）';
}

function buildPrompt(answers, lvInfo, domains) {
  const lv = lvInfo.lv;
  const levelInfo = LEVEL_TABLE[lv];
  const A1 = answers.A1 || '朋友';
  const A2 = answers.A2 || '未填';
  const A3 = answers.A3 || '未填';

  const nextLv = lv === 5 ? 5 : lv + 1;
  const nextStageHint = lv === 1 ? '先自己跑通一件具体业务交付，别再刷新闻、别再选工具'
                      : lv === 2 ? '别急着推全员；先把你自己跑通那件事写成 SOP；选 1 个最重复、一个人能验证的点切入'
                      : lv === 3 ? '把 AI 嵌入团队已有工作流（飞书群机器人/一键按钮/语音），不搞脱产培训'
                      : lv === 4 ? '搭"AI 大脑"——共享判断库/案例库/话术库，按业务目的组织，AI 自动采集编译'
                      : '保持已有的运转，避免人工录入回潮';

  // 找出最弱板块（给"该补哪里"的建议）
  const domainNames = { personal:'个人能力', team:'团队渗透', org:'组织重构', system:'系统沉淀' };
  const weakest = Object.entries(domains).sort((a,b) => a[1] - b[1])[0];
  const weakestLabel = `${domainNames[weakest[0]]}（${weakest[1]} 分）`;

  return `你是【卿小璐】，做了 7 年私域、操盘 30+ 项目累计业绩 8000 万+，现在搭一家「AI × 一人公司」。今天你给一位 30 人以下企业的老板做"老板 AI 化"诊断。

你已经判定他/她的当前阶段是【L${lv} · ${levelInfo.name}】。

## 框架（必须严格按这个判定逻辑）

老板 AI 化 5 阶段（来自《30 人以下企业 AI 转型实战指南》）：

- L1 围观期：知道 AI 很火，公司里没具体动作。痛点：信息过载、选模型焦虑。典型原话："天天看 AI 新闻，不知道从哪开始。"
- L2 个人尝鲜 ⚠️：自己用过工具觉得"还行"，团队没跟上。痛点：会用工具 ≠ 会用 AI 做业务。典型原话："我自己都会用豆包，不知道学了有什么用。"——【60% 老板卡在 L1-L2】
- L3 团队推行 ⭐：想让团队用起来，推不动。痛点：员工抵触、不知从哪个岗位切。典型原话："我累死了，团队又学不会。"——【核心转化阶段】
- L4 组织重构：团队在用了，组织结构得跟着变。痛点：中层被挤压、角色边界模糊。典型原话："以前的私域负责人岗位不存在了。"
- L5 系统化运转：建可持续的 AI 操作系统。痛点：知识外化、判断编码化、闭环验证。典型原话："有数据 ≠ 有资产，有智能体 ≠ 能自动化。"

【3 条铁律 - 必须在诊断中体现至少一条】
1. 90% 的老板高估了自己的阶段——你以为自己在 L3，其实还在 L2。判断标准：团队在日常工作中每天都在用 AI 吗？不是 → 还在 L2。
2. 推动团队 AI 化不是培训问题，是管理问题。买了最好的工具，他们不用 = 零。
3. AI 会放大优势，也会放大混乱——业务流程本身混乱，AI 只会让它更混乱。

【30 人以下团队的特殊优势】决策链短 + 试错成本低 + 一个通知就能全员切换。资源不是钱，是速度。

## 这位老板的答题数据

【基础】
- 称呼：${A1} · 行业：${A2} · 公司规模：${A3}

【4 板块能力分（满分 100）】
- 个人能力：${domains.personal}（你自己用 AI 的深度）
- 团队渗透：${domains.team}（团队真用起来的程度）
- 组织重构：${domains.org}（岗位/JD/KPI 因 AI 变了多少）
- 系统沉淀：${domains.system}（AI 大脑搭得怎样）
- 最弱板块：${weakestLabel}

【阶段定位 - B 区】
- B1 上周自己 AI 交付量：${fmt(answers.B1)}
- B2 团队 AI 渗透率：${fmt(answers.B2)}
- B3 组织/岗位调整：${fmt(answers.B3)}
- B4 AI 大脑现状：${fmt(answers.B4)}
- B 区累加分：${lvInfo.bSum}/20${lvInfo.reasons.length ? ' · 触发降级：' + lvInfo.reasons.join('；') : ''}

【个人能力 - C1-C4】
- C1 用过的 AI 工具：${fmt(answers.C1)}
- C2 自己每天用 AI 时长：${fmt(answers.C2)}
- C3 用 AI 主要做什么：${fmt(answers.C3)}
- C4 你和团队技术底子：${fmt(answers.C4)}

【团队渗透 - C5-C8】
- C5 团队推行卡在哪：${fmt(answers.C5)}
- C6 推 AI 主要靠什么方式：${fmt(answers.C6)}
- C7 团队拒绝最常见原因：${fmt(answers.C7)}
- C8 是否对比过 AI vs 人工：${fmt(answers.C8)}

【组织重构 - C9-C12】
- C9 过去 6 个月做的组织动作：${fmt(answers.C9)}
- C10 老板 vs 员工 AI 差距：${fmt(answers.C10)}
- C11 AI 是否写进 KPI：${fmt(answers.C11)}
- C12 小快灵优势利用：${fmt(answers.C12)}

【系统沉淀 - C13-C16】
- C13 接触过的 AI 概念：${fmt(answers.C13)}
- C14 SOP 形态：${fmt(answers.C14)}
- C15 知识沉淀方式：${fmt(answers.C15)}
- C16 AI 跑通的业务流程数量：${fmt(answers.C16)}

【开放题 - E 区】
- E1 工作流拆解：${fmt(answers.E1)}
- E2 团队没推动的具体场景：${fmt(answers.E2)}
- E3 真实焦虑/疑问：${fmt(answers.E3)}
- E4 想要的具体建议：${fmt(answers.E4)}

## 你的输出（严格按格式）

直接以"# 你的真实位置"开头。不要寒暄、不要自我介绍、不要问候。整篇诊断书严格按下面 6 段输出，每段都要有实质内容：

# 你的真实位置
（一段话，100-180 字。基于【行业 + 规模 + B 区 + 4 板块分布】，归纳"你比典型 L${lv} 多了什么 / 少了什么"。${lvInfo.reasons.length ? '⚠️ 重要：他的 B 区分数被降级了——具体原因：' + lvInfo.reasons.join('；') + '。这一段必须点破矛盾——告诉他"你在 B 区选了高档，但 C 区显示 XX——所以实际还在 L' + lv + '"。' : ''}${lv === 2 ? '如果 C5 显示"我自己在用，没推过团队"或类似——直接点破 PDF 那句"90% 老板高估自己阶段"。' : lv === 3 ? '如果 C7 显示团队抵触原因——点破"团队推行不是培训问题，是管理问题"。' : ''}要让他感觉"她真的看到了我的具体情况"，不要复述他的答案，做判断和归纳。）

# 4 板块拆解
（这一段按 4 板块各 1 句话点评，30-50 字/板块。先写最弱的板块（${weakestLabel}），用毒辣口吻说"为什么这块拖后腿"。每条用 markdown \`- **板块名（分数）**：点评\` 列表。不要客气，要点穿。）

# 你的最大卡点
（一段话，120-200 字。基于 E2 用户讲的具体场景做诊断式回应。**不要复读他的话**——要点出他没看到的深层卡点。要尖锐、直接，不说"很常见""完全理解"这类安慰话。这一段必须明确用到 3 条铁律里至少 1 条原话，并落到他的具体场景上。）

# 跨到 L${nextLv} 的 3 个具体动作
${lv === 5 ? '（你已经在 L5。给 3 个"保持不倒退"的具体动作，重点防"人工录入回潮"和"知识库荒废"。每个动作 1-2 句，用 markdown \`1. **动作名**：说明\` 列表。）' : `（3 个动作。每个动作必须满足：① 一周内能开始 ② 不需要再招人 ③ 匹配他的技术底子（C4）④ 紧扣 E1 他拆的那条工作流的数字目标。L${lv} 阶段的核心策略：${nextStageHint}。第 1 个动作必须针对最弱板块「${weakestLabel}」。每个动作 1-2 句话。用 \`1. **动作名**：说明\` 的 markdown 列表。）`}

# 一句话点评
（一句话，30 字内。是【判断】不是【建议】。要扎心、要犀利。${lv <= 2 ? '例如："你不是推不动团队，是自己还没真的跑通。"' : lv === 3 ? '例如："员工不用 AI，因为你没让他看到结果，只让他看到学习成本。"' : '不打鸡血。'}）

# 给你的额外提示
（一段话，80-120 字。如果 E4 写了具体诉求 → 针对那条精确回答；如果 E4 空着 → 给一条"L${lv} 阶段最常忽略的事"。如果 E3 写了真实焦虑 → 也要一句话回应他的焦虑。要落到具体动作上，不要泛泛而谈、不要鸡汤。）

## 语气要求（卿小璐风格）

- 直接、实在、不夸张
- 短句为主，可以有少量长句承担推导
- 观点可以毒辣犀利、可以有情绪
- 分析必须理性有逻辑
- 不打鸡血、不卖焦虑、不喊口号
- 不要用"最/第一/牛逼/绝绝子/yyds/家人们/无敌/究极"
- 不要写"亲爱的 ${A1}"、"很高兴为你诊断"、"祝你 AI 之路顺利"
- 不要在文中说"我是卿小璐"
- 不使用 emoji（除非框架里已有的 ⚠️ ⭐）
- 不要在结尾加广告/卖课/卖陪跑，前端会处理
- 称呼用户用"你"，不要用"贵公司"
- 直接进入诊断，不要任何开场白`;
}

// Lightweight markdown → HTML (sufficient for the diagnostic format)
function mdToHtml(md) {
  if (!md) return '';
  // Normalize line endings
  let s = md.replace(/\r\n/g, '\n').trim();

  // Escape HTML
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const lines = s.split('\n');
  const out = [];
  let inOl = false, inUl = false;

  const flushList = () => {
    if (inOl) { out.push('</ol>'); inOl = false; }
    if (inUl) { out.push('</ul>'); inUl = false; }
  };

  for (let raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushList(); continue; }

    // Headings
    if (/^# /.test(line)) { flushList(); out.push(`<h1>${inline(line.slice(2))}</h1>`); continue; }
    if (/^## /.test(line)) { flushList(); out.push(`<h2>${inline(line.slice(3))}</h2>`); continue; }

    // Ordered list
    const olm = line.match(/^(\d+)\.\s+(.*)$/);
    if (olm) {
      if (!inOl) { flushList(); out.push('<ol>'); inOl = true; }
      out.push(`<li>${inline(olm[2])}</li>`);
      continue;
    }

    // Unordered list
    const ulm = line.match(/^[-*]\s+(.*)$/);
    if (ulm) {
      if (!inUl) { flushList(); out.push('<ul>'); inUl = true; }
      out.push(`<li>${inline(ulm[1])}</li>`);
      continue;
    }

    // Paragraph
    flushList();
    out.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  return out.join('\n');
}

function inline(s) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

async function callDeepSeek(prompt, apiKey) {
  const resp = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2200,
      stream: false,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`DeepSeek API ${resp.status}: ${text.slice(0, 200)}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

module.exports = async (req, res) => {
  // CORS (allow same-origin and local dev)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const answers = body?.answers || {};

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'Missing answers' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured on server' });
    }

    const lvInfo = determineLevel(answers);
    const info = LEVEL_TABLE[lvInfo.lv];
    const domains = computeDomains(answers);

    const prompt = buildPrompt(answers, lvInfo, domains);
    const mdRaw = await callDeepSeek(prompt, apiKey);

    let md = mdRaw.trim();
    md = md.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '');
    const html = mdToHtml(md);

    return res.status(200).json({
      level: lvInfo.lv,
      levelName: info.name,
      tagline: info.tagline,
      domains,
      bSum: lvInfo.bSum,
      downgradeReasons: lvInfo.reasons,
      markdown: md,
      html,
    });
  } catch (e) {
    console.error('diagnose error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
};
