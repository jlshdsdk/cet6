# CET-6 真题自学网站 · 施工总纲（PROMPT）

> 本文档由两轮 grilling 确认的需求生成，是唯一权威规格。制作过程中出现的新问题一律由主代理自决最优解，不再询问用户。

## 一、目标

把 `D:\Users\王奕博\Desktop\六级真题` 下全部资料做成一个**零卡顿的静态 MPA 自学网站**，部署到 GitHub Pages，
最终地址 `https://jlshdsdk.github.io/cet6/`，可在任意设备访问。

## 二、已确认的需求决策（用户拍板）

| 决策点 | 结论 |
|---|---|
| 收录范围 | 全部 19 批次（2019.06~2026.06）约 50 套，一套不落；扫描卷用视觉转写补齐 |
| 内容深度 | 全量：题目 + 听力原文 + 阅读逐段译文 + 答案速查 + 每题解析 + 写作范文/翻译参考译文 |
| 阅读译文 | 仔细阅读 + 选词填空 + 匹配题全覆盖，逐段配译 |
| 听力译文 | 每段听力原文配中文译文，默认折叠（<details>），做题不受干扰 |
| 音频 | 全部压缩为 48kbps 单声道 MP3，托管在站内 |
| 生词查询 | 内置离线词典（ECDICT 精简版，按首字母分片懒加载），点击单词秒出释义，无需联网 |
| 生词收藏 | localStorage 存储 + 一键导出/导入 JSON（换设备迁移） |
| 做题进度 | localStorage 记录每套"未开始/做题中/已核对"，首页进度总览（已刷 X/50） |
| 仓库 | github.com/jlshdsdk/cet6，Pages 主分支根目录 |
| 本机存储 | 一切本地产物（工作区、构建中间物、git 仓库）放 `D:\cet6\`；浏览器 localStorage 无法指定盘符，用 JSON 导出弥补 |

## 三、信息源与提取策略（已探明事实）

1. 真题 Word 版（2019.06~2024.06 大多有）：**无听力原文、无答案**，纯题目，文本提取质量最高 → 作为题目正文首选源。
2. 真题 PDF：部分为文本版可提取；**2024.12 三套为扫描图**且无 Word → 视觉转写整卷。
3. 答案解析 PDF：小体积（<1.5MB）多为文本版（含听力原文/答案/详解/范文/参考译文，2019.12 已验证）；
   大体积（>10MB）多为扫描版 → 渲染 PNG 后 Flash 视觉转写"听力原文 + 答案速查 + 详解"部分。
4. 2025.12 文件夹名 "CTE6" 是笔误，按 CET6 处理。
5. 听力音频：约 32 个 MP3 共 690MB → ffmpeg 压缩 48kbps 单声道。
6. 05/06 资料夹（作文句型/翻译热词/预测）：docx 直接提取，扫描 PDF 视觉转写，做成"作文与翻译"栏目，排在真题目录之后。

## 四、网站架构

```
D:\cet6\                          ← git 仓库根 = 站点根
├── index.html                    首页：年份导航 + 进度总览 + 生词本入口
├── assets/site.css               全站唯一样式（系统字体栈，无外部字体）
├── assets/site.js                全站唯一脚本：点词查词弹窗/收藏/进度/播放器
├── dict/{a..z}.json              ECDICT 精简词典，按首字母分片，点词时懒加载
├── audio/{yyyymm}/{n}.mp3        压缩后的听力音频
├── exam/{yyyymm}/set{n}.html     每套一个自包含 MPA 页面（内容直接内嵌，零请求）
├── writing/                      作文句型、翻译热词、预测（多篇 article 页）
├── vocab.html                    生词本：收藏列表 + 导入导出 JSON + 复习
├── _build/                       [.gitignore] 提取中间物、脚本、PLAN/PROGRESS
├── .gitignore / README.md
```

### 性能红线（"零卡顿"的落实）
- 纯静态 HTML，无框架、无构建时依赖、无外部 CDN、无网络字体。
- 页面内容直接内嵌 HTML（打开即渲染，无 fetch 等待）；CSS/JS 各一个文件，浏览器缓存。
- 词典按首字母分片懒加载（每片 ≤1.5MB），首次点词加载一片后内存缓存。
- 音频 `preload="none"`；倍速用原生 `playbackRate`（0.75/1.0/1.25/1.5/2.0）。
- 折叠用原生 `<details>`；点词用事件委托 + Range 定位（不给每个单词包 span，不膨胀 HTML）。
- 单页 HTML 控制在 ~500KB 内。

### 套卷页面结构（每套）
1. 顶部：返回首页 / 年份批次导航 / 该套进度标记按钮（未开始→做题中→已核对）
2. Part I 写作：题目 + 范文（折叠）+ 范文要点
3. Part II 听力：内嵌音频播放器（吸底、倍速）→ 25 题题目选项 → 听力原文（每段折叠，英文 + 中文译文再折叠）
4. Part III 阅读：
   - 选词填空：原文逐段、每段下方灰色小字译文；15 选 15 词汇表；10 题
   - 匹配题：原文段落（每段配折叠译文）；10 题陈述句
   - 仔细阅读 ×2：逐段配译文（直接可见）；各 5 题
5. Part IV 翻译：中文原文 + 参考译文（折叠）
6. 答案速查表（折叠）+ 每题解析（折叠，按题号）
7. 全部英文正文区域支持点词查询 → 弹窗：音标、释义、加入生词本按钮

## 五、数据流水线

```
Phase A 提取（纯脚本，零 LLM）
  manifest.py   → 扫描源目录生成 manifest.json（批次/套/文件/可用性）
  extract.py    → docx/文本PDF 全部提为 _build/raw/{yyyymm}_set{n}_{kind}.txt
  classify.py   → 逐 PDF 抽样提取文本，标记 text|image，生成渲染任务清单
Phase B 渲染（纯脚本）
  render.py     → 扫描版解析 PDF 的听力原文/答案页渲染为 PNG（pymupdf）
Phase C 结构化+翻译（Flash 子代理，每套一任务）
  输入: _build/raw/*.txt（或 PNG 清单）
  输出: _build/json/{yyyymm}_set{n}.json（严格 schema + 真实性约束：题目原文逐字保留）
  同任务内完成：段落切分、逐段翻译、听力原文→译文映射
Phase D 资料库（Flash 子代理）
  05/06 文件夹 → writing/*.html 数据 JSON
Phase E 生成（纯脚本）
  gen.py        → manifest + JSON → 全部 HTML；词典分片；校验器 validate.py
Phase F 审查
  censor 对抗审查生成页面（数据完整性/断链/卡顿点/排版）
  browser 实测点词/播放/收藏/进度
Phase G 部署
  gh repo create jlshdsdk/cet6 --public --source . --push
  开启 Pages(main/root) → 轮询验证 https://jlshdsdk.github.io/cet6/
```

### JSON schema（每套卷，Phase C 输出）
```jsonc
{
  "id": "2023.06-1", "session": "2023年06月", "setNo": 1,
  "writing": { "task": "...原文逐字...", "sample": "范文", "sampleNotes": "要点" },
  "listening": {
    "audio": "audio/202306/1.mp3",
    "sections": [ // 每段对话/讲座
      { "title": "Conversation One", "questions": [ {"no":1,"stem":"...","options":{"A":"..","B":"..","C":"..","D":".."}} ],
        "transcript": "W: ...\nM: ...", "transcriptZh": "..." }
    ]
  },
  "reading": {
    "cloze":    { "passage": ["para1","para2"], "passageZh": ["译1","译2"], "options": ["A word",...15], "questions": [10] },
    "matching": { "passage": [...], "passageZh": [...], "statements": [10] },
    "careful":  [ { "passage": [...], "passageZh": [...], "questions": [5] }, {...} ]
  },
  "translation": { "taskZh": "中文段落", "reference": "参考译文" },
  "answers": { "listening": ["A",...25], "reading": [...30], "clozeWords": {...} },
  "explanations": [ {"no":1,"answer":"A","expl":"简要解析"} ...55 ]
}
```
校验器硬指标：25 听力题 + 45 阅读写译题位、听力段落数（2长对话+3篇章+3讲座）、答案数组长度、每 passage 原文/译文段数一致、译文非空、英文段落无中文字符、中文译文无成段英文。

## 六、质量与红线纪律

- **忠实性**：题目/原文/选项一律逐字保留，禁止 LLM 复述式改写；解析可摘要。
- 翻译为学习辅助译文，准确优先，不追求文学性。
- 视觉转写件抽查：主代理抽 2 页 PNG 对照 JSON 核验。
- 每 Phase 完成→更新 `_build/PROGRESS.md`（断点续作友好）。
- 失败任务重派 ≤2 次，仍失败则该套标记降级（无译文/无解析上线），不留死链。
- 构建可重复：全部生成走脚本，删掉 html 可一键重建。

## 七、主代理自决清单（已拍板不再问）

- UI：米白底 + 深灰字 + 单强调色（藏青），衬线中文正文，移动端优先自适应。
- 播放器：吸底条 + 倍速 + 记住上次进度（localStorage）。
- 匹配题译文折叠；仔细阅读译文直接可见（可一键隐藏全部译文）。
- 生词本支持按套卷来源标注、删除、导出/导入。
- 2024.12 扫描卷：整卷视觉转写，抽查两页核对。
- 解析过长的取要点摘要（每题 ≤120 字）。
- 词典取 ECDICT（star 词典，GPL/兼容数据）按词频前 ~4 万 + 全部 CET4/6 标签词。
