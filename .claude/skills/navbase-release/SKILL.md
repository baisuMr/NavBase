---
name: navbase-release
description: Use when the user wants to 更新版本、升版、发版、打版本标签、更新 CHANGELOG、发布正式版、上线、release、publish、bump version、把版本合并到 main in NavBase（含版本号建议、git tag 与发布上线全流程）
---

# NavBase 版本发布

## 概述

两条命令：**更新版本**（dev 上升版本号 + CHANGELOG + 打 tag）与**发布正式版**（把带 tag 的版本合入 main，推送即部署生产）。核心约束：tag 必须指向含版本号与 CHANGELOG 的提交；只合并 tag 指向的提交，绝不 `git merge dev` 上线。

策略已定型，**不要重复询问**：任意 tag（含 beta）均可发上 main；只合并 tag 提交，dev 上 tag 之后的新提交留在 dev；版本号只写 `package.json`。仅版本号选择、发布 tag 确认两处需要用户拍板。

## 版本号规则（SemVer + beta.N）

| 变更内容（自上个 tag） | 建议版本 | 示例 |
|---|---|---|
| 仅 fix/docs/chore | beta.N+1 | 1.0.0-beta.2 → 1.0.0-beta.3 |
| 含 feat | minor+1，beta 位重置 .1 | → 1.1.0-beta.1 |
| 含破坏性变更 | major+1，beta 位重置 .1 | → 2.0.0-beta.1 |
| 发正式版 | 去预发布后缀 | 1.0.0-beta.3 → 1.0.0 |

给 2–3 个候选版本号（各附理由）**让用户选定后再动手**，用户可指定自定义版本号。

## 数据库结构变更（schema / migrations）

结构变更 = `schema.sql` 的表/索引/列增删改，或 `migrations/` 新增脚本。检测：
- 更新版本：`git diff <上个tag>..HEAD --name-only -- schema.sql migrations/`
- 发布正式版：`git diff main..<tag> --name-only -- schema.sql migrations/`

命中即做三件事（只给命令，绝不代执行、不操作 Cloudflare 控制台）：

1. **提示用户**：列出变更摘要（哪个表/索引/列）与迁移脚本名，提醒生产库与预览库各执行一次
2. **给 D1 控制台可执行的 SQL**：取 `migrations/` 脚本正文语句（去掉头部用法注释）合成一个代码块——用户直接粘贴到 Cloudflare 控制台 → D1 → 选库 → Console 执行；同时附脚本头部注释的 wrangler 命令（线上加 `--remote`）
3. **写入更新日志**：CHANGELOG 该版本条目内单列一条 `数据库：<变更>（需执行迁移 <脚本名>）`

`schema.sql` 有变更但缺 `migrations/` 脚本 → 提示用户先补一次性迁移脚本再发版。

## 命令一：更新版本

1. **盘点（只读）**：`git fetch origin`；`git status` 看工作区；当前版本 = `package.json` 的 `version`；上个 tag = `git describe --tags --abbrev=0`；变更 = `git log --oneline <上个tag>..HEAD`
2. **建议版本号**：按上表分类变更，给候选，等用户确认；含数据库结构变更时一并提示（见「数据库结构变更」，给 D1 控制台 SQL）
3. **整理工作区**（若有未提交代码）：功能代码按提交规范分条提交（feat/fix 各自成条，`类型: 动词开头描述` 单行）；与发版无关的 WIP 不动。**禁 `git add -A`/`git add .`**，逐文件指定
4. **升版本**：改 `package.json` 的 `version`
5. **写 CHANGELOG.md**：顶部新增 `## v<版本> - YYYY-MM-DD` + 要点列表（从变更清单整理，沿用现有条目文风）；含数据库结构变更时条目内单列 `数据库：<变更>（需执行迁移 <脚本名>）`；**必须在打标签前完成**
6. **提交**：`git add package.json CHANGELOG.md` → `git commit -m "chore: 升版至 <版本> 并更新日志"`
7. **测试**：`pnpm test`，未全绿不得打标签（可修复后继续）
8. **推送**：`git push origin dev`
9. **打标签**：`git tag -a v<版本> -m "v<版本>"` → `git push origin v<版本>`
10. **汇报**：列出本次写入/修改的文件名

## 命令二：发布正式版

1. **前置**：`git fetch origin --tags`
2. **确定发布对象**：候选 = dev 历史上的 tag（`git tag --merged dev`），**合并前必须让用户确认 tag 名**；用户要发的内容没有 tag（如 dev 最新提交未升版）→ **停止**，提示先跑「更新版本」
3. **迁移门禁**：`git diff main..<tag> --name-only -- schema.sql migrations/` 有命中、或 CLAUDE.md 标注有待执行迁移 → **停止**，向用户给出结构变更提示 + D1 控制台可执行 SQL 与 wrangler 命令（见「数据库结构变更」）；**只给命令，绝不代执行**，用户确认已对生产/预览库执行后才继续
4. **合并（只合 tag 提交）**：`git switch main && git pull origin main` → `git merge --no-ff <tag> -m "merge: 发布 <tag>"`
   **禁止 `git merge dev`**——那会把未打 tag 的提交带上生产
5. **门禁测试**：`pnpm test`；失败 → `git merge --abort` 并报告，不推送
6. **上线**：推送前向用户复述「将推送 main，自动部署生产」并再次确认 → `git push origin main`
7. **汇报**：提醒用户人工验收生产

## 红线 — 出现即停

- 不得自行决定版本号，必须给选项让用户选
- 版本号 + CHANGELOG 的提交必须先于打标签（tag 要指向含它们的提交）
- 无 tag 的提交绝不合入 main；绝不 `git merge dev` 上线
- `pnpm test` 未全绿不推 main
- schema.sql 有变更、迁移未确认 → 不合并
- 结构变更必须提示用户、必须给 D1 控制台可执行 SQL、必须写入更新日志
- 不执行数据库迁移、不代操作 Cloudflare 控制台
- 推 main 即生产部署，推送前必须获用户明确确认

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
