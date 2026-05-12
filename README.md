# 企业 AI 原生化诊断

11 级框架在线测评 · 卿小璐 / AI × 一人公司 出品。

测一下你公司在 AI 哪一级：60 秒做完 18 道题，DeepSeek 实时生成个性化诊断书。

## 框架来源

- 个体版骨架：卡兹克《我把所有人用 AI 的水平分成了 10 个等级》
- 企业版改编：卿小璐
- 数据校准：艾瑞咨询《2026 Q1 中国企业 AI 应用调研》

## 技术栈

- 前端：单文件 HTML（vanilla JS），Claude design system（warm parchment + terracotta）
- 后端：Vercel Serverless Function，DeepSeek `deepseek-chat`
- 部署：Vercel · 域名 `enterprise-ai-level-test.vercel.app`（默认）

## 本地开发

```bash
# 1. 装 Vercel CLI
npm i -g vercel

# 2. 设置 env
echo "DEEPSEEK_API_KEY=sk-..." > .env.local

# 3. 起本地服务
vercel dev
```

## 部署

```bash
vercel --prod
```

API key 通过 Vercel Dashboard → Settings → Environment Variables 设置，名为 `DEEPSEEK_API_KEY`。

## 目录结构

```
.
├── public/index.html       # 前端（含全部题目和样式）
├── api/diagnose.js         # 后端：判等级 + 调 DeepSeek + Markdown 转 HTML
├── vercel.json             # 部署配置
├── package.json
├── .gitignore
└── README.md
```
