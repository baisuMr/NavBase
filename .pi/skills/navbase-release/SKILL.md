---
name: navbase-release
description: Use when the user wants to 更新版本、升版、发版、打版本标签、更新 CHANGELOG、发布正式版、上线、release、publish、bump version、把版本合并到 main、紧急发布、紧急修复上线 in NavBase（含版本号建议、git tag 与发布上线全流程；提供「更新版本」「发布正式版」「紧急发布」三条命令）
---

# NavBase 版本发布

## 概述

三条命令：**更新版本**（dev 上升版本号 + CHANGELOG + 打 tag）、**发布正式版**（把带 tag 的版本合入 main，推送即部署生产）、**紧急发布**（紧急修复 bug 直推 main 上线，随后合回 dev）。

核心约束：tag 必须指向含版本号与 CHANGELOG 的提交；只合并 tag 指向的提交，绝不 `git merge dev` 上线；紧急发布是唯一直推 main 的例外通道（不升版本号、不打 tag）。

策略已定型，**不要重复询问**：任意 tag（含 beta）均可发上 main；只合并 tag 提交，dev 上 tag 之后的新提交留在 dev；版本号只写 `package.json`；紧急发布不升版本号、不打 tag，修复记入下次发版的 CHANGELOG。仅版本号选择、发布 tag 确认两处需要用户拍板。

## 版本号规则（SemVer + beta.N，仅推荐）

**以下均为推荐，最终版本号由用户拍板**（用户可指定自定义版本号）。给 2–3 个候选版本号（各附理由）**让用户选定后再动手**，不得自行决定。

| 变更内容（自上个 tag） | 推荐版本 | 示例 |
|---|---|---|
| 仅 fix/docs/chore | beta.N+1 | 1.0.0-beta.2 → 1.0.0-beta.3 |
| 含 feat | minor+1，beta 位重置 .1 | → 1.1.0-beta.1 |
| 含破坏性变更 | major+1，beta 位重置 .1 | → 2.0.0-beta.1 |
| 发正式版 | 去预发布后缀 | 1.0.0-beta.3 → 1.0.0 |
| 上个 tag 已是正式版，之后又有新变更 | 仅 fix/docs/chore 建议 patch+1 起 beta；含 feat 建议 minor+1 起 beta | 1.1.0 后仅 fix → 1.1.1-beta.1；含 feat → 1.2.0-beta.1 |

仓库还没有任何 tag 时（`git describe` 报错）视为首次发版：以 `0.0.0` 为基准给候选，具体由用户定。

## 数据库结构变更（schema / migrations）

结构变更 = `schema.sql` 的表/索引/列增删改，或 `migrations/` 新增脚本。检测：
- 更新版本：`git diff <上个tag>..HEAD --name-only -- schema.sql migrations/`
- 发布正式版：`git diff main..<tag> --name-only -- schema.sql migrations/`
- 紧急发布：`git diff main..HEAD --name-only -- schema.sql migrations/`（修复涉及结构变更时同样走门禁）

命中即做三件事（只给命令，绝不代执行、不操作 Cloudflare 控制台）：

1. **提示用户**：列出变更摘要（哪个表/索引/列）与迁移脚本名，提醒生产库与预览库各执行一次
2. **给 D1 控制台可执行的 SQL**：取 `migrations/` 脚本正文语句（去掉头部用法注释）合成一个代码块——用户直接粘贴到 Cloudflare 控制台 → D1 → 选库 → Console 执行；同时附脚本头部注释的 wrangler 命令（线上加 `--remote`）
3. **写入更新日志**：CHANGELOG 该版本条目内单列一条 `数据库：<变更>（需执行迁移 <脚本名>）`

`schema.sql` 有变更但缺 `migrations/` 脚本 → 提示用户先补一次性迁移脚本再发版。

**闭环**：用户回复确认已对生产/预览库执行迁移后，移除 CLAUDE.md / AGENTS.md 里的「当前待执行」标注。

## 命令一：更新版本

1. **前置检查（只读）**：`git branch --show-current` 必须是 `dev`——不在 dev 上先停下告知用户，切回 `dev` 后再继续；`git fetch origin`；`git status` 看工作区；当前版本 = `package.json` 的 `version`；上个 tag = `git describe --tags --abbrev=0`（无 tag 见「首次发版」）；变更 = `git log --oneline <上个tag>..HEAD`
2. **建议版本号**：按上表分类变更，给 2–3 个候选（各附理由），等用户选定；含数据库结构变更时一并提示（见「数据库结构变更」，给 D1 控制台 SQL）
3. **整理工作区**（若有未提交代码）：功能代码按提交规范分条提交（feat/fix 各自成条，`类型: 动词开头描述` 单行）；与发版无关的 WIP 不动。**禁 `git add -A`/`git add .`**，逐文件指定
4. **升版本**：改 `package.json` 的 `version`
5. **写 CHANGELOG.md**：顶部新增 `## v<版本> - YYYY-MM-DD` + 要点列表（从变更清单整理，沿用现有条目文风：写给用户看的效果，不用 `fix: xxx` 式 commit 短语）；含数据库结构变更时条目内单列 `数据库：<变更>（需执行迁移 <脚本名>）`；期间有紧急发布的修复（已在 dev 历史中）必须一并写入；**必须在打标签前完成**
6. **提交**：`git add package.json CHANGELOG.md` → `git commit -m "chore: 升版至 <版本> 并更新日志"`
7. **测试**：`pnpm test`，未全绿不得打标签（可修复后继续）
8. **推送**：`git push origin dev`
9. **打标签**：`git tag -a v<版本> -m "v<版本>"` → `git push origin v<版本>`
10. **汇报**：列出本次写入/修改的文件名

## 命令二：发布正式版

1. **前置**：`git fetch origin --tags`；`git status` 确认工作区干净（有未提交改动先停下处理，绝不带着 WIP 切分支）；`git branch --show-current` 应为 `dev`
2. **同步检查**：`git log dev..main` 有提交（main 领先 dev，通常是紧急修复直推 main）→ 提醒用户先把 main 合回 dev 并推送，同步完成后再继续发版
3. **确定发布对象**：候选 = dev 历史上的 tag（`git tag --merged dev`），**合并前必须让用户确认 tag 名**；用户要发的内容没有 tag（如 dev 最新提交未升版）→ **停止**，提示先跑「更新版本」
4. **迁移门禁**：`git diff main..<tag> --name-only -- schema.sql migrations/` 有命中、或 CLAUDE.md / AGENTS.md 标注有待执行迁移 → **停止**，向用户给出结构变更提示 + D1 控制台可执行 SQL 与 wrangler 命令（见「数据库结构变更」）；**只给命令，绝不代执行**，用户确认已对生产/预览库执行后才继续
5. **合并（只合 tag 提交）**：`git switch main && git pull origin main` → `git merge --no-ff <tag> -m "merge: 发布 <tag>"`
   **禁止 `git merge dev`**——那会把未打 tag 的提交带上生产
6. **门禁测试**：`pnpm test`；失败 → `git merge --abort` 并报告，不推送
7. **上线**：推送前向用户复述「将推送 main，自动部署生产」并再次确认 → `git push origin main`
8. **切回 dev**：`git switch dev`（发布完不留在 main，避免后续改动误上生产）
9. **汇报**：提醒用户人工验收生产

## 命令三：紧急发布

用途：生产有紧急 bug，跳过 dev/beta 流程直接修复上线。**仅当用户明确要求紧急发布/直推 main 时使用**；普通 bug 修复照常走 dev 流程。不升版本号、不打 tag；修复随后合回 dev，由下次「更新版本」写入 CHANGELOG。

1. **确认场景**：用户明确表示这是紧急发布；涉及数据库结构变更 → 同样走迁移门禁（见「数据库结构变更」），**只给命令、用户确认已执行才推 main**
2. **前置**：`git fetch origin`；`git status` 工作区必须干净——dev 上有未完成改动 → **停下问用户**（先提交或 stash），绝不把 WIP 带上 main
3. **切到 main**：`git switch main && git pull origin main`
4. **修复**：只改与该 bug 相关的最小代码，**禁顺手重构、禁改无关文件**；禁 `git add -A`/`git add .`，逐文件指定
5. **测试**：`pnpm test` 全绿才继续（与正常发版同一条红线），失败修复后重跑
6. **提交**：`git commit -m "fix: 修复xxx"`（不改 `package.json`、不写 CHANGELOG）
7. **上线确认**：推送前向用户复述「将推送 main，自动部署生产」并再次确认 → `git push origin main`
8. **合回 dev**：`git switch dev && git merge main -m "merge: 合回紧急修复"` → `pnpm test` → `git push origin dev`；合并冲突或 dev 测试失败 → **停下报告**，不推送
9. **汇报**：提醒用户人工验收生产；提醒下次「更新版本」时 CHANGELOG 须包含本次紧急修复

## 红线 — 出现即停

- 不得自行决定版本号，必须给候选让用户选；版本号规则仅是推荐
- 版本号 + CHANGELOG 的提交必须先于打标签（tag 要指向含它们的提交）
- 无 tag 的提交绝不合入 main；绝不 `git merge dev` 上线
- 紧急发布仅限用户明确发起；除紧急发布外不直推 main
- `pnpm test` 未全绿不推 main（含紧急发布）
- schema.sql 有变更、迁移未确认 → 不合并、不推 main
- 结构变更必须提示用户、必须给 D1 控制台可执行 SQL、必须写入更新日志
- 不执行数据库迁移、不代操作 Cloudflare 控制台
- 推 main 即生产部署，推送前必须获用户明确确认
- 发布/发版流程结束后停在 dev，不停留在 main

## tag 打错的补救

- 本地 tag 未推送：`git tag -d v<版本>` 删掉重打（先确保版本号与 CHANGELOG 的提交已就位）
- 已推送的 tag：**不强改、不强删**，问题留给下一个版本修复（升 beta.N+1 或按推荐规则升号）

## 常见错误

| 错误 | 后果 |
|---|---|
| 先打标签后写 CHANGELOG | tag 指向旧提交，发布内容与日志不符 |
| `git add -A` 提交 | 半成品 WIP 混进发版提交 |
| `git merge dev` 上线 | 未打 tag 的提交被带上生产 |
| 发版时顺手把 beta 号改成正式号 | 版本号与 tag 不一致 |
| 自行拍板版本号 | 违背「让用户选择确认」的约定 |
| 结构变更只丢一句「去执行迁移」不给控制台 SQL | 用户不知在哪执行，来回追问 |
| 发版日志漏记数据库变更 | 升级方漏跑迁移，线上报错 |
| 发完版停在 main 分支继续改代码 | 后续改动被误推上生产 |
| 紧急修复顺手带无关改动 | 半成品被推上生产 |
| 紧急修复漏合回 dev | dev 缺该修复，下次发版丢失 |
| 紧急修复漏记 CHANGELOG | 升级方不知道该版本含哪些修复 |
