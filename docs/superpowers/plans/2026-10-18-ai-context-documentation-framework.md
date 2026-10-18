# AI 项目上下文与文档框架实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立按需读取、单一事实来源、可可靠接续工作的项目文档入口与专题框架。

**Architecture:** 沿用根目录 README 和 `docs/architecture.md`、`docs/testing.md`、`docs/AI-CONTEXT.md` 的现有职责，新增根级规则与任务索引。在 `docs/context/` 放当前状态、目录映射、操作路由、决策、风险和历史索引；摘要链接到权威资料，未知事实明确标注。

**Tech Stack:** Markdown；现有 `package.json`、`vite.config.ts` 和项目文档作为事实来源；不增加依赖或修改应用代码。

**Spec:** [AI 项目上下文与文档框架设计](../specs/2026-10-18-ai-context-documentation-framework-design.md)

## Global Constraints

- 先确认项目根目录、适用规则和已有文档；等价文件或章节优先沿用，不重复建档或强制改名。
- 读取资料按当前问题选择；不因文件存在、被索引链接或可能有用而默认读取。不得默认读取所有项目文件或整份选中文件。
- 查找顺序为索引或限定范围搜索 → 标题、符号或关键词 → 命中片段及必要上下文；仅在证据不足、冲突或需要核对依赖时扩大范围，信息足够即停止。不得连续分段变相遍历全文。
- 全文读取只用于短小且全部相关的文件、完整理解适用规则，或明确要求整份审查的任务；不能因此扩展到全目录或全项目。索引是条件路由，不是必读清单。
- 历史、日志、依赖、产物和数据目录不默认读取；不读取密钥及无关私人数据。已加载且仍有效的内容不重复读取；不因片段过窄而断章取义，也不为节省上下文跳过适用规则。
- 仅在任务允许且信息有实质变化时更新记录；只读任务不改记录。每类事实只设一个权威来源，其他位置只写简短摘要和链接。
- 修改前读取目标部分及必要上下文；局部修改使用定点编辑，不根据局部阅读覆盖整份文件。当前状态直接修订；有价值的旧过程才归档，不追加矛盾快照，不保存完整聊天或操作流水账。
- 区分事实、计划、建议、已确认决定和待核实事项；分别记录代码完成、测试通过、安装验证、用户验收和发布授权。命令已配置不等于执行成功，历史结果不等于当前证据，文档步骤不构成执行授权。
- 使用清晰标题和项目内相对链接。核验日期注明对象与范围；不得写入秘密或个人设备私有路径。
- 不修改源码、依赖、构建配置或测试。只检查本计划涉及的文档及其直接关联链接；不运行全项目审计或项目测试。
- 保留本任务开始前的所有工作区改动。`docs/AI-CONTEXT.md` 仅定点修改开头，不改写已有正文。

## Review Focus

- 任务路由是否让后续 AI 只读对应资料，避免把索引或长参考变成全读清单。**检查：**抽查 `PROJECT_INDEX.md` 与 `docs/AI-CONTEXT.md` 开头的读取说明，确认它们要求按需定位章节。
- 是否出现重复权威来源或复制专题正文。**检查：**对照 README、架构、测试与 context 文件，确认新增内容只提供摘要和权威链接。
- 无证据的部署位置、历史决策、风险和当前进展是否被误写成事实。**检查：**查阅 `MAP.md`、`DECISIONS.md`、`RISKS.md`、`NOW.md`，确认未知项明确标为“待核实”或“暂无可确认记录”。
- 命令列表是否被误报为执行验证。**检查：**查阅 `RUNBOOK.md`，确认测试步骤指向 `docs/testing.md`，且没有声称本次运行成功。
- AI 长参考中的现有用户改动是否被覆盖。**检查：**审阅 `docs/AI-CONTEXT.md` 的定点差异，确认仅入口说明变化，原有其他差异保留。

---

### Task 1: 建立项目规则、任务索引与 README 文档入口

**Files:**
- Create: `AGENTS.md`
- Create: `PROJECT_INDEX.md`
- Modify: `README.md`（仅“文档”章节）

**Interfaces:**
- Consumes: 用户确认的设计文档与本计划的 Global Constraints。
- Produces: 后续任务的规则来源、条件路由和面向使用者的文档入口。

- [x] **Step 1: 编写 `AGENTS.md`**，纳入全部读取、写入规则，并补充接手时确认适用规则、按任务做适当验证及如实报告验证证据的要求。
- [x] **Step 2: 编写 `PROJECT_INDEX.md`**，提供简短项目定位和“任务 → 文件或章节”路由；显式说明索引按需使用、长参考按标题检索。
- [x] **Step 3: 定点更新 `README.md` 的文档章节**，链接规则、索引、现有架构/测试/AI 参考和新增 context 专题；保留用途、功能和使用说明。
- [x] **Step 4: 核对已存在资料的路由**，确认目标文件与章节存在且索引不复制专题内容；新建专题文件的完整链接核验留到 Task 5。

### Task 2: 建立当前状态、映射和操作入口

**Files:**
- Create: `docs/context/NOW.md`
- Create: `docs/context/MAP.md`
- Create: `docs/context/RUNBOOK.md`

**Interfaces:**
- Consumes: Task 1 的路由规则；`README.md`、`docs/architecture.md`、`docs/testing.md`、`package.json` 和 `vite.config.ts` 的相关内容。
- Produces: 可从索引到达的现状、目录/配置/产物映射及有依据的操作入口。

- [x] **Step 1: 编写 `NOW.md`**，先记录本次文档目标进行中的进展、阻塞、下一步及证据入口；Task 5 完成时在原条目内更新为已完成、无已确认阻塞，后续按下一条用户任务接续。注明工作区原有未提交变更在本任务前已存在，需按实时 Git 状态确认，不归因于文档工作。
- [x] **Step 2: 编写 `MAP.md`**，只记录已确认的目录职责、包版本、关键配置、构建产物命名和 Tampermonkey 运行目标；部署/公开发布位置若无证据则写“待核实”。
- [x] **Step 3: 编写 `RUNBOOK.md`**，说明相关操作的前置条件并链接 README 和 `docs/testing.md` 的权威步骤；不复制一套命令，也不把未执行命令描述为已验证。
- [x] **Step 4: 核对状态与映射来源**，确保每个具体事实能追溯到上述项目文件，状态项标明日期及范围。

### Task 3: 建立决策、风险和历史记录入口

**Files:**
- Create: `docs/context/DECISIONS.md`
- Create: `docs/context/RISKS.md`
- Create: `docs/context/history/README.md`

**Interfaces:**
- Consumes: Task 1 的路由规则；现有架构和测试文档中可直接定位的决定、风险或限制。
- Produces: 唯一决策记录点、基于证据的风险入口和历史归档检索说明。

- [x] **Step 1: 编写 `DECISIONS.md`**，说明新增记录必须包含决定、理由、范围、来源和状态；本任务已定位的项目资料没有可追溯来源与理由的历史决策，初始状态写“暂无可确认记录”。
- [x] **Step 2: 编写 `RISKS.md`**，仅记录现有测试说明明确支持的验证缺口及保护方式，并链接权威章节；没有依据的风险标“待核实”。
- [x] **Step 3: 编写 `history/README.md`**，说明追溯前先搜索、只归档有长期价值的过程结论；索引现有极简播放器设计说明与实施计划，不总结未经查阅的正文。
- [x] **Step 4: 核对三份入口**，确认事实有来源、没有把建议写成决定，且没有新建无依据的历史内容。

### Task 4: 调整 AI 长参考的阅读入口

**Files:**
- Modify: `docs/AI-CONTEXT.md`（仅开头说明）

**Interfaces:**
- Consumes: Task 1 的 `AGENTS.md` 和 `PROJECT_INDEX.md`。
- Produces: 与按需读取规则一致的长参考入口；文档正文和原有改动保持原样。

- [x] **Step 1: 读取开头及必要链接上下文**，定位当前建议新代理通读全篇的句子。
- [x] **Step 2: 定点替换开头阅读指引**，将本文描述为按需检索的长参考；指向根级项目索引，并提示时效性事实需按任务与当前证据核对。
- [x] **Step 3: 检查差异**，确认没有改动长文正文或覆盖此前已有的其他工作区差异。

### Task 5: 限定范围的文档与链接核验

**Files:**
- Check: 本计划列出的新增和修改文档及其直接关联链接。

**Interfaces:**
- Consumes: Tasks 1–4 的文档。
- Produces: 可交付的改动清单、链接核验结果和明确的待核实项。

- [x] **Step 1: 核对变更清单**，确认只包含规则/索引、README 入口、context 专题和 AI 长参考开头的目标修改。
- [x] **Step 2: 核对本次新增或修改文档的相对链接**，确认目标文件和指定标题均存在；不遍历无关文档或目录。54 个本地 Markdown 链接目标均存在。
- [x] **Step 3: 对照 Global Constraints 和 Review Focus**，确认无重复权威来源、未覆盖既有成果、未把命令或历史结果误称为验证；独立限域复核提出的两处根文档入口链接问题已修正。
- [x] **Step 4: 汇报新建、修改、沿用文件，核验范围、结果及仍标“待核实”的事实；结束本任务，不扩展为全项目审计。**
