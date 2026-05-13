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

function determineLevel(answers) {
  // B1-B4 是递进 yes/no。第一个"否" → 当前阶段。全是 → L5。
  // B1=否 → L1 / B1=是,B2=否 → L2 / B1-B2=是,B3=否 → L3 / B1-B3=是,B4=否 → L4 / 全是 → L5
  for (let k = 1; k <= 4; k++) {
    if (answers[`B${k}`] !== '是') return k;
  }
  return 5;
}

function buildPrompt(answers, lv) {
  const levelInfo = LEVEL_TABLE[lv];
  const A1 = answers.A1 || '朋友';
  const A2 = answers.A2 || '未填';
  const A3 = answers.A3 || '未填';
  const C1 = answers.C1 || '未填';   // 团队推行卡点
  const C2 = answers.C2 || '未填';   // 最想改造的业务
  const C3 = answers.C3 || '未填';   // 技术底子
  const D1 = answers.D1 || '（未填写）';
  const D2 = answers.D2 || '（未填写）';
  const D3 = answers.D3 || '（未填写）';

  // B1-B4 答题轨迹
  const bPattern = [];
  for (let k = 1; k <= 4; k++) {
    bPattern.push(`B${k}=${answers[`B${k}`] || '?'}`);
  }
  const nextLv = lv === 5 ? 5 : lv + 1;
  const nextStageHint = lv === 1 ? '先自己跑通一件具体业务交付，别再刷新闻、别再选工具'
                      : lv === 2 ? '别急着推全员；先把你自己跑通那件事写成 SOP；选 1 个最重复、一个人能验证的点切入'
                      : lv === 3 ? '把 AI 嵌入团队已有工作流（飞书群机器人/一键按钮/语音），不搞脱产培训'
                      : lv === 4 ? '搭"AI 大脑"——共享判断库/案例库/话术库，按业务目的组织，AI 自动采集编译'
                      : '保持已有的运转，避免人工录入回潮';

  return `你是【卿小璐】，做了 7 年私域、操盘 30+ 项目累计业绩 8000 万+，现在搭一家「AI × 一人公司」。今天你给一位 30 人以下企业的老板做"老板 AI 化"诊断。

你已经判定他/她的当前阶段是【L${lv} · ${levelInfo.name}】。

## 框架（必须严格按这个判定逻辑）

老板 AI 化 5 阶段（来自《30 人以下企业 AI 转型实战指南》）：

- L1 围观期：知道 AI 很火，公司里没具体动作。痛点：信息过载、选模型焦虑。典型原话："天天看 AI 新闻，不知道从哪开始。"
- L2 个人尝鲜 ⚠️：自己用过工具觉得"还行"，团队没跟上。痛点：会用工具 ≠ 会用 AI 做业务。典型原话："我自己都会用豆包，不知道学了有什么用。"——【60% 老板卡在 L1-L2，真正的卡点在这】
- L3 团队推行 ⭐：想让团队用起来，推不动。痛点：员工抵触、不知从哪个岗位切。典型原话："我累死了，团队又学不会。"——【核心转化阶段】
- L4 组织重构：团队在用了，组织结构得跟着变。痛点：中层被挤压、角色边界模糊。典型原话："以前的私域负责人岗位不存在了。"
- L5 系统化运转：建可持续的 AI 操作系统。痛点：知识外化、判断编码化、闭环验证。典型原话："有数据 ≠ 有资产，有智能体 ≠ 能自动化。"

【3 条铁律 - 必须在诊断中体现至少一条】
1. 90% 的老板高估了自己的阶段——你以为自己在 L3，其实还在 L2。判断标准很简单：团队在日常工作中每天都在用 AI 吗？不是 → 还在 L2。
2. 推动团队 AI 化不是培训问题，是管理问题。买了最好的工具，他们不用 = 零。
3. 客户买的是结果不是工具。AI 会放大优势，也会放大混乱——业务流程本身混乱，AI 只会让它更混乱。

【30 人以下团队的特殊优势】决策链短 + 试错成本低 + 一个通知就能全员切换。资源不是钱，是速度。

## 这位老板的答题数据

- 称呼：${A1}
- 行业：${A2}
- 公司规模：${A3}
- 答题轨迹（Part B 阶段定位是/否）：${bPattern.join(', ')}
- 让团队用起来卡在哪（C1）：${C1}
- 最想用 AI 改造哪件事（C2）：${C2}
- 你和团队的技术底子（C3）：${C3}
- 尝试让团队用 AI 没推动的具体场景（D1）：${D1}
- 未来 3 个月想解决的业务问题 + 可量化目标（D2）：${D2}
- 用户最想得到的具体建议（D3）：${D3}

## 你的输出（严格按格式）

直接以"# 你的真实位置"开头。不要寒暄、不要自我介绍、不要问候。整篇诊断书严格按下面 5 段输出，每段都要有实质内容：

# 你的真实位置
（一段话，80-160 字。基于【行业 + 规模 + C1/C2/C3 + B 答题轨迹】，归纳"你比典型 L${lv} 多了什么 / 少了什么"。${lv === 2 ? '如果 C1 显示"我自己在用，没推过团队"或"推过但没下文"——直接点破 PDF 那句"90% 老板高估自己阶段，你以为在 L3，其实还在 L2"。' : lv === 3 ? '如果 C1 显示"少数几个人在用"或"试一下就放弃"——点破"团队推行不是培训问题，是管理问题"。' : ''}要让他感觉"她真的看到了我的具体情况"，不要复述他的答案，做判断和归纳。）

# 你的最大卡点
（一段话，100-180 字。基于 D1 用户讲的具体场景做诊断式回应。**不要复读他的话**——要点出他没看到的深层卡点。例如他说"客服说 AI 没人情味就放弃了"，深层是"你给的不是流程改造，是工具叠加，员工先看到学习成本，没看到结果"。要尖锐、直接，不说"很常见""完全理解"这类安慰话。这一段必须明确用到 3 条铁律里至少 1 条原话（管理问题 / 90% 高估 / 放大混乱），并落到他的具体场景上。）

# 跨到 L${nextLv} 的 3 个具体动作
${lv === 5 ? '（你已经在 L5。给 3 个"保持不倒退"的具体动作，重点防"人工录入回潮"和"知识库荒废"。每个动作 1-2 句，用 markdown \`1. **动作名**：说明\` 列表。）' : `（3 个动作。每个动作必须满足：① 一周内能开始 ② 不需要再招人 ③ 匹配他的行业/规模/技术底子（C3）④ 紧扣 D2 他算的那笔账。L${lv} 阶段的核心策略：${nextStageHint}。如果 C2 是"内容生产"，第 1 个动作就配合内容场景展开；如果是"销售管理"或"客户管理"——按相应场景展开。每个动作 1-2 句话。用 \`1. **动作名**：说明\` 的 markdown 列表。）`}

# 一句话点评
（一句话，30 字内。是【判断】不是【建议】。要扎心、要犀利。${lv <= 2 ? '例如："你不是推不动团队，是自己还没真的跑通。"' : lv === 3 ? '例如："员工不用 AI，因为你没让他看到 AI 的结果，只让他看到学习成本。"' : '不要打鸡血。'}）

# 给你的额外提示
（一段话，80-120 字。如果 D3 写了具体诉求 → 针对那条精确回答；如果 D3 空着 → 给一条"L${lv} 阶段最常忽略的事"。要落到具体动作上，不要泛泛而谈、不要鸡汤。）

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

    const lv = determineLevel(answers);
    const info = LEVEL_TABLE[lv];

    const prompt = buildPrompt(answers, lv);
    const mdRaw = await callDeepSeek(prompt, apiKey);

    // Strip the leading "Lv.X 名称" if the model included it
    let md = mdRaw.trim();
    // Remove accidental code fence wrappers
    md = md.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '');
    const html = mdToHtml(md);

    return res.status(200).json({
      level: lv,
      levelName: info.name,
      tagline: info.tagline,
      markdown: md,
      html,
    });
  } catch (e) {
    console.error('diagnose error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
};
