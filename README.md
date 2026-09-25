# typesafe-ai-jev-skill

一个可移植的 **Agent Skill**，帮助智能体通过兼容 Provider 使用 TypeSafe System One / Jev，完成可解释、可控的结构化决策。

> **English summary:** A provider-neutral, Agent Skills-compatible Skill for TypeSafe System One / Jev. It supports configurable API roots, models, authentication, typed Choice / Score / Noul questions, safe configuration validation, and optional live smoke tests without exposing credentials.

## 这个 Skill 解决什么问题

普通提示词经常把“理解语义”和“输出 JSON”混在一起，调用方还要自己处理模型措辞、格式错误和不确定结果。本 Skill 将这类判断拆成稳定的类型化问题：

- **Choice**：从明确候选中选择一个，并返回完整概率分布；
- **Noul**：判断一个陈述或条件为真的概率；
- **Score**：在有序等级上评估状态，并返回加权分数、概率和置信度。

它适合以下场景：

- 工单分类、路由和升级判断；
- 风险、紧急程度和质量等级评估；
- 来源选择、候选匹配和结构化抽取；
- 需要 confidence、概率分布或人工复核阈值的业务决策。

本仓库只提供智能体指导、配置校验器和可选 smoke test，不充当 Provider 代理，也不替应用代码决定最终动作。

## 特点

- **Provider 中立**：不绑定任何默认服务；Base URL、模型、端点和认证方式全部来自用户配置。
- **跨智能体使用**：遵循 Agent Skills 的 `SKILL.md` 结构，安装到目标智能体支持的用户级 Skill 目录即可。
- **类型化输出**：围绕 Choice、Score、Noul 组织问题和结果，不解析模型生成的自由文本。
- **安全配置**：私密配置位于仓库外；校验器不打印 API Key，也不回显 Provider 原始错误体。
- **可验证**：无网络配置检查、可选真实 smoke test、单元测试和跨目录安装检查。
- **无第三方运行时依赖**：校验器使用 Node.js 18+ 内置 `fetch`。

## 环境要求

1. Node.js 18 或更高版本：

   ```bash
   node --version
   ```

2. 一个支持 Agent Skills 的智能体，能够发现并按需加载 `SKILL.md`。
3. 一个兼容的 Provider，并能提供：
   - API 根地址或完整 System One 端点；
   - 模型 ID；
   - 认证方式和必要的请求头；
   - System One 请求权限。

如果你只有 chat-completions 网关，也可以把 `protocol` 设置为 `chat` 做认证和路由可达性检查；但这种检查**不能证明 Choice / Score / Noul 的 System One 兼容性**。

## 安装到智能体

先选择目标智能体支持的用户级 Skill 目录。常见选择如下：

| 目标智能体 | 推荐用户级目录 |
| --- | --- |
| 支持 Agent Skills 互操作约定的客户端 | `~/.agents/skills/` |
| Claude Code | `~/.claude/skills/` |
| OpenCode | `~/.config/opencode/skills/` 或 `~/.agents/skills/` |
| 不支持用户级 Skill 的客户端 | 项目 `.agents/skills/` 或该客户端文档指定的位置 |

目录以目标客户端当前官方文档为准；不要假设一个智能体的目录会被另一个智能体自动扫描。

### macOS / Linux / Git Bash

下面的命令使用通用的 `~/.agents/skills/`。如果目标智能体使用其他目录，只需替换 `SKILL_DIR`：

```bash
SKILL_DIR="$HOME/.agents/skills/typesafe-ai-jev-skill"

git clone --depth 1 \
  https://github.com/HunterXing/typesafe-ai-jev-skill.git \
  "$SKILL_DIR"

test -f "$SKILL_DIR/SKILL.md"
test -f "$SKILL_DIR/scripts/verify-config.mjs"
```

如果目标目录已经存在，可更新已有副本：

```bash
git -C "$HOME/.agents/skills/typesafe-ai-jev-skill" pull --ff-only
```

### Windows PowerShell

```powershell
$SkillDir = Join-Path $HOME ".agents/skills/typesafe-ai-jev-skill"

New-Item -ItemType Directory -Force (Split-Path $SkillDir) | Out-Null
git clone --depth 1 `
  https://github.com/HunterXing/typesafe-ai-jev-skill.git `
  $SkillDir

Test-Path (Join-Path $SkillDir "SKILL.md")
Test-Path (Join-Path $SkillDir "scripts/verify-config.mjs")
```

Claude Code 可将目标目录改为 `Join-Path $HOME ".claude/skills"`；OpenCode 可使用 `Join-Path $HOME ".config/opencode/skills"`。这些是示例路径，实际以客户端文档为准。

## 给智能体的一键配置引导

安装完成后，可以把下面这段提示词直接交给智能体。它要求智能体完成安装检查、创建私密配置、设置权限并执行**无网络校验**，但不会要求智能体在聊天中索取或打印密钥。

```text
请加载 typesafe-ai-jev-skill，并帮我完成本地配置：

1. 找到当前智能体支持的 typesafe-ai-jev-skill 安装目录；如果没有，请告诉我应该复制到哪个用户级 Skill 目录。
2. 从 references/config.example.json 创建 ~/.config/typesafe-ai-jev-skill.json；不要把 API Key 写入仓库、聊天、日志或命令历史。
3. 让我在本地编辑器中填写 Provider 的 base URL、model、endpointPath、认证头和密钥来源。apiKey 与 apiKeyEnv 二选一，优先使用环境变量或 secret manager。
4. 在 macOS/Linux 上将私密配置权限设为 600；在 Windows 上限制为当前用户可读。
5. 运行 node <SKILL_ROOT>/scripts/verify-config.mjs --config <CONFIG_PATH>，只报告脱敏后的校验结果。
6. 不要执行真实 API 请求。只有在我明确确认可能产生费用后，才运行 --smoke。
```

### macOS / Linux 的复制、编辑、权限和校验

这是一组可以复制执行的配置命令。它不会自动猜测 Provider，也不会联网：

```bash
SKILL_ROOT="$HOME/.agents/skills/typesafe-ai-jev-skill"
CONFIG_DIR="$HOME/.config"
CONFIG_PATH="$CONFIG_DIR/typesafe-ai-jev-skill.json"

mkdir -p "$CONFIG_DIR"
cp "$SKILL_ROOT/references/config.example.json" "$CONFIG_PATH"
chmod 600 "$CONFIG_PATH"

"${EDITOR:-vi}" "$CONFIG_PATH"

# 默认配置路径就是 ~/.config/typesafe-ai-jev-skill.json；
# 如果使用了其他路径，再显式导出 JEV_SKILL_CONFIG。
node "$SKILL_ROOT/scripts/verify-config.mjs" --config "$CONFIG_PATH"
```

如果配置放在其他位置：

```bash
export JEV_SKILL_CONFIG="$HOME/path/to/typesafe-ai-jev-skill.json"
node "$SKILL_ROOT/scripts/verify-config.mjs" \
  --config "$JEV_SKILL_CONFIG"
```

`JEV_SKILL_CONFIG` 只应指向私密配置文件，不要把路径指向仓库内的示例文件。

### Windows PowerShell 的复制、编辑和校验

```powershell
$SkillRoot = Join-Path $HOME ".agents/skills/typesafe-ai-jev-skill"
$ConfigDir = Join-Path $HOME ".config"
$ConfigPath = Join-Path $ConfigDir "typesafe-ai-jev-skill.json"

New-Item -ItemType Directory -Force $ConfigDir | Out-Null
Copy-Item `
  (Join-Path $SkillRoot "references/config.example.json") `
  $ConfigPath `
  -Force

notepad $ConfigPath
node (Join-Path $SkillRoot "scripts/verify-config.mjs") --config $ConfigPath
```

在 Windows 上，校验器还会检查 NTFS ACL；如果文件对其他用户可读，校验会失败。请按照当前 Windows 版本的权限管理方式，将文件限制为当前用户可读。PowerShell 中如需使用非默认配置路径：

```powershell
$env:JEV_SKILL_CONFIG = $ConfigPath
node (Join-Path $SkillRoot "scripts/verify-config.mjs") `
  --config $env:JEV_SKILL_CONFIG
```

## 配置格式

默认私密配置位置：

```text
~/.config/typesafe-ai-jev-skill.json
```

配置结构：

```json
{
  "providerName": "your-provider",
  "baseUrl": "https://api.your-provider.example",
  "model": "your-model-id",
  "apiKey": "",
  "apiKeyEnv": "",
  "protocol": "systemone",
  "endpointPath": "v1/systemone",
  "authHeader": "Authorization",
  "authScheme": "Bearer",
  "extraHeaders": {},
  "timeoutSeconds": 30
}
```

| 字段 | 作用 |
| --- | --- |
| `providerName` | 仅用于标识 Provider 的名称，不会改变请求行为。 |
| `baseUrl` | Provider API 根地址；也可以填写完整 System One 端点，校验器会避免重复拼接路径。 |
| `model` | Provider 提供的模型 ID。 |
| `apiKey` | 本地文件中的密钥；适合一次性人工测试。 |
| `apiKeyEnv` | 保存密钥的环境变量名；与 `apiKey` 二选一，生产环境优先使用。 |
| `protocol` | `systemone` 用于类型化 Jev；`chat` 只做 chat 路由可达性检查。 |
| `endpointPath` | System One 或 chat 端点相对于 `baseUrl` 的路径。 |
| `authHeader` | 认证请求头，例如 `Authorization` 或 `x-api-key`。 |
| `authScheme` | 认证前缀，例如 `Bearer`；原始密钥认证时设为空字符串。 |
| `extraHeaders` | 额外请求头；不能覆盖验证器管理的认证头。 |
| `timeoutSeconds` | 请求超时时间，必须为正数。 |

### 密钥配置建议

本地人工测试可以使用 `apiKey`，但文件必须位于仓库外并限制权限：

```bash
chmod 600 "$HOME/.config/typesafe-ai-jev-skill.json"
```

CI、容器和共享环境优先使用 `apiKeyEnv`：

```json
{
  "apiKey": "",
  "apiKeyEnv": "JEV_API_KEY"
}
```

然后在运行智能体的环境中注入该变量。不要把密钥写入 `README.md`、`SKILL.md`、测试 fixture、Git 提交或命令历史。

## 配置发现顺序

智能体加载本 Skill 后，应从 Skill 的 `SKILL.md` 所在目录解析 `SKILL_ROOT`，再按以下顺序寻找私密配置：

1. `JEV_SKILL_CONFIG` 环境变量；
2. `~/.config/typesafe-ai-jev-skill.json`；
3. 如果没有配置，报告明确的设置步骤，不扫描其他秘密目录。

`SKILL_ROOT` 必须来自当前智能体实际加载的 Skill 目录，不应假定源代码仓库仍然存在于某个固定本机路径。

## 验证配置（无网络）

配置完成后先运行无网络校验：

```bash
node "$SKILL_ROOT/scripts/verify-config.mjs" \
  --config "${JEV_SKILL_CONFIG:-$HOME/.config/typesafe-ai-jev-skill.json}"
```

校验器会报告 Provider、协议、最终端点、模型、认证模式和密钥是否存在，但会隐藏密钥值。以下情况会返回非零退出码：

- 配置文件不存在或 JSON 无效；
- 必填字段为空或仍是占位符；
- 远程地址不是 HTTPS；
- 端点、认证头、额外请求头或超时配置无效；
- macOS/Linux 文件权限过宽，或 Windows ACL 不符合要求。

## 可选真实 smoke test

`--smoke` 会发送一个最小真实请求，可能产生 Provider 费用。只有在用户明确确认后才执行：

```bash
node "$SKILL_ROOT/scripts/verify-config.mjs" \
  --config "${JEV_SKILL_CONFIG:-$HOME/.config/typesafe-ai-jev-skill.json}" \
  --smoke
```

结果含义：

- `systemone`：检查 HTTP 状态、返回模型以及一个类型化 Noul 答案；
- `chat`：只检查认证和 chat 路由可达性，不代表 Jev 类型化兼容；
- 非 2xx、超时、连接失败或响应结构不兼容：视为失败。

不要在自动化脚本或 CI 中无条件加入真实 smoke test；它可能计费，并且需要明确的用户授权。

## 在应用中实现决策

Skill 负责让智能体遵守正确的决策工作流；实际应用应使用官方 TypeSafe JavaScript/Python SDK，把 Provider 配置从部署配置或 secret manager 显式传入客户端。应用代码应直接消费类型化答案和概率，不应解析模型生成的散文。

建议的边界：

- 代码负责阈值、权限、重试、人工复核和最终动作；
- Jev 负责语义判断、候选选择和概率化评估；
- 低置信度或高后果场景走确定性 fallback、专门推理模型或人工；
- Choice / Score 的 confidence 描述概率分布的集中程度，不等于正确率或自动执行许可。

更多问题设计、SDK 示例和配置变体见：

- [`SKILL.md`](SKILL.md)
- [`references/provider-config.md`](references/provider-config.md)
- [`references/portable-install.md`](references/portable-install.md)
- [TypeSafe API reference](https://docs.typesafe.ai/api.md)
- [TypeSafe documentation index](https://docs.typesafe.ai/llms.txt)

## 兼容路径参考

不同智能体和版本的 Skill 搜索目录可能不同。主流程请以目标客户端当前官方文档为准；本仓库的 [`references/portable-install.md`](references/portable-install.md) 保留了额外的兼容路径，供迁移和排查旧环境时参考。它们不是默认安装要求，也不代表所有客户端都会扫描同一目录。

## 开发与验证

```bash
node --test tests/verify-config.test.mjs tests/portable-install.test.mjs
```

仓库中的测试只使用虚构 Provider 和测试密钥，不读取真实私密配置。发布前还应确认：

- `README.md`、Skill 和参考文档没有真实密钥或用户私密路径；
- 私密配置不在 `git ls-files` 中；
- `.env`、日志和临时文件未被加入版本控制；
- 内部 `docs/superpowers/` 仅作为本地实施资料，不属于 Skill 运行时内容。

## 许可证与来源

本项目使用 [MIT License](LICENSE)。基于 TypeSafe 官方 Jev 编程模型和文档进行改写，来源与修改说明见 [ATTRIBUTION.md](ATTRIBUTION.md)。TypeSafe、System One 和 Jev 的名称与品牌权利归各自权利人所有。
