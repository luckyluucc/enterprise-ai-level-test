// Vercel Serverless Function: /api/diagnose
// Receives answers, computes Lv, calls DeepSeek, returns structured diagnosis.

const LEVEL_TABLE = [
  { lv: 0,  name: '沉默者',          tagline: '公司里"用 AI"这件事从未被讨论过' },
  { lv: 1,  name: '私下用',          tagline: '老板偷偷用，员工偷偷用，互不知道' },
  { lv: 2,  name: '喊口号',          tagline: '"我们要拥抱 AI" — 但没人知道怎么做' },
  { lv: 3,  name: '发了没人用',      tagline: '⚠️ 95% 企业卡在这 — 工具发了，业务说"跟我没关系"' },
  { lv: 4,  name: '局部跑通',        tagline: '某一个部门跑通了，节人 1-2 名' },
  { lv: 5,  name: '多场景嵌入',      tagline: '2-3 个核心流程嵌入了 AI，效率可量化' },
  { lv: 6,  name: '体系化复制',      tagline: '⭐ 关键分水岭 — 跨过这级就赢 90% 同行' },
  { lv: 7,  name: '岗位重构',        tagline: '开始招"AI Native 岗"，KPI 加入 AI 使用度' },
  { lv: 8,  name: '商业模式变',      tagline: 'AI 真的改变了产品 / 服务 / 收费方式' },
  { lv: 9,  name: '一人公司形态',    tagline: '组织压缩到 1-5 人，AI 顶 30-50 人工作量' },
  { lv: 10, name: 'AI 原生公司',     tagline: '从 0 设计就是 AI-native，没有"AI 化"这个动作' },
];

function determineLevel(answers) {
  // B1-B10 are progressive yes/no. First "否" = current level.
  // If B_k is the first "否", level = k - 1 (since B_k tests Lv.(k-1) → Lv.k crossing).
  // B1 → Lv.0→1, ..., B10 → Lv.9→10. All 是 → Lv.10.
  for (let k = 1; k <= 10; k++) {
    const ans = answers[`B${k}`];
    if (ans !== '是') return k - 1;
  }
  return 10;
}

function buildPrompt(answers, lv) {
  const levelInfo = LEVEL_TABLE[lv];
  const A1 = answers.A1 || '朋友';
  const A2 = answers.A2 || '未填';
  const A3 = answers.A3 || '未填';
  const C1 = Array.isArray(answers.C1) ? answers.C1.join('、') : (answers.C1 || '未填');
  const C2 = Array.isArray(answers.C2) ? answers.C2.join('、') : (answers.C2 || '未填');
  const C3 = answers.C3 || '未填';
  const D1 = answers.D1 || '（未填写）';
  const D2 = answers.D2 || '（未填写）';
  const D3 = answers.D3 || '（未填写）';
  const D4 = answers.D4 || '（未填写）';
  const D5 = answers.D5 || '（未填写）';

  // Show B answers as a compact pattern: 是是否... so AI sees the trajectory
  const bPattern = [];
  for (let k = 1; k <= 10; k++) {
    bPattern.push(`B${k}=${answers[`B${k}`] || '?'}`);
  }

  return `你是【卿小璐】，7 年私域千万操盘老兵，现在搭一家「AI × 一人公司」。今天你给一位企业从业者做 AI 原生化诊断。

你已经判定他/她的等级是【Lv.${lv} · ${levelInfo.name}】。

## 框架（你必须严格按这个判定逻辑）

11 级框架：
- Lv.0 沉默者：公司里"用 AI"从未被讨论。
- Lv.1 私下用：老板/员工各自偷偷用，公司层面零讨论。
- Lv.2 喊口号：领导表态拥抱 AI，但没人知道怎么落地。
- Lv.3 发了没人用 ⚠️：工具部署了，账号闲置，业务说"跟我没关系"——【95% 企业卡在这里】。
- Lv.4 局部跑通：某 1 个部门跑通了一个 AI 工作流，节人 1-2 名。
- Lv.5 多场景嵌入：2-3 个核心流程嵌入 AI，效率提升可量化。
- Lv.6 体系化复制 ⭐：知识库 / Skill 库 / 专职基础设施岗——【关键分水岭，跨过赢 90%】。
- Lv.7 岗位重构：招 AI Native 岗，KPI 加 AI 使用度，改 JD。
- Lv.8 商业模式变：AI 改变产品 / 服务 / 收费方式。
- Lv.9 一人公司形态：组织 ≤ 5 人，承担 30+ 人业务量。
- Lv.10 AI 原生公司：从 0 设计就是 AI-native。

3 个关键分水岭：Lv.3→Lv.4（从工具到流程，95% 死这）/ Lv.5→Lv.6（从效率到体系）/ Lv.7→Lv.8（从降本到改命）。

## 这位用户的答题数据

- 称呼：${A1}
- 行业：${A2}
- 公司规模：${A3}
- 用过的 AI 工具：${C1}
- AI 已嵌入的业务环节：${C2}
- 老板个人 vs 公司整体的 AI 水平：${C3}
- 答题轨迹（Part B 是/否序列）：${bPattern.join(', ')}
- 用户描述的最大卡点（D1）：${D1}
- 用户未来 3-6 个月最想用 AI 解决的具体问题（D2）：${D2}
- 用户在 AI 落地中踩过的坑（D3）：${D3}
- 用户认为最适合先开始用 AI 的人/部门（D4）：${D4}
- 用户最想得到的具体建议（D5）：${D5}

## 你的输出（严格按格式）

直接以"# 你的真实位置"开头，不要任何寒暄、自我介绍、问候。整篇诊断书严格按下面 4 段输出，每段都要有内容：

# 你的真实位置
（一段话，60-150 字。基于他的【行业 + 规模 + 工具栈 + 嵌入场景】给出"你比典型 Lv.${lv} 多了什么 / 少了什么"。要让他感觉"她真的看到了我的具体情况"。不要复述他的答案，要做归纳和判断。如果 C3 显示"老板单飞"或"老板明显高"，要特别点出"内外差"问题。）

# 你的最大卡点
（一段话，80-180 字。呼应 D1 用户原话 + 结合 D3 踩过的坑，用诊断口吻回应。**不要复读用户的话**——要点出他没看到的深层卡点，比如"你说员工不肯用，本质是 KPI 没绑定"。要尖锐、要直接，不要"很常见""完全理解"这种安慰话。如果 D3 写了踩坑经历，要明确指出他这次该避免什么。）

# 跨到 Lv.${lv === 10 ? 10 : (lv + 1)} 的 3 个具体动作
${lv === 10 ? '（这一段写：你已经在 Lv.10。给 3 个"保持不倒退"的具体动作。）' : `（3 个动作，每个动作必须满足：① 一周内能开始 ② 不需要再招人 ③ 跟他的行业/规模匹配 ④ 紧扣 D2 他最想解决的具体业务问题。如果 D4 提到了"先开始的人/部门"，要把第 1 个动作配合 D4 的人选展开。每个动作 1-2 句话。用 \`1. **动作名**：说明\` 的 markdown 列表格式。）`}

# 一句话点评
（一句话，30 字内。可以毒辣，可以扎心，但必须是【判断】不是【建议】。例如："你不是没工具，是没人逼着用。"）

# 给你的额外提示
${lv === 10 ? '（一段话 60-100 字，针对他的 D5 期望建议，给出"如何保持原生态"的具体提醒。）' : '（一段话，60-100 字。回应 D5 他想要的具体建议——如果 D5 写了，针对它精确回答；如果 D5 空着，就给一条"你这个等级最常忽略的事"。不要泛泛而谈。）'}

## 语气要求（卿小璐风格）

- 直接、实在、不夸张
- 短句为主，可以有一些长句子承担推导
- 观点可以毒辣犀利、可以有情绪
- 分析必须理性有逻辑
- 不打鸡血、不卖焦虑、不喊口号
- 不要用"最/第一/牛逼/绝绝子/yyds/家人们"
- 不要写"亲爱的 ${A1}"、"很高兴为你诊断"、"祝你 AI 之路顺利"
- 不要在文中说"我是卿小璐"
- 不要使用 emoji（除非框架里已有的 ⚠️ ⭐）
- 不要在结尾加广告或卖课，那部分由前端处理
- 称呼用户时用"你"，不要用"贵公司"
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
