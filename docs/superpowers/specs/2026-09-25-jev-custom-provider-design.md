# 设计

## 目标

创建 Provider 中立的 Agent Skills-compatible Skill `typesafe-ai-jev-skill`，用于通过任意兼容
TypeSafe System One 契约的自定义 Provider 调用 Jev。

## 全局位置

- 本机 Mavis：`/Users/xingheng/.minimax/skills/typesafe-ai-jev-skill/`
- 可移植安装：复制到目标 Agent 官方支持的用户级 Skill 目录，或在支持时使用
  `~/.agents/skills/typesafe-ai-jev-skill/`
- 私密配置：`~/.config/typesafe-ai-jev-skill.json`（可用 `JEV_SKILL_CONFIG` 覆盖）
- 官方市场插件 `typesafe:typesafe-ai` 保持不变。

## 可移植性

- Skill 遵循 Agent Skills 的 `SKILL.md` 结构，不依赖 Mavis 专有 API。
- 各 Agent 安装到自己的用户级 Skill 目录，共享 `~/.config/typesafe-ai-jev-skill.json`。
- `JEV_SKILL_CONFIG` 可覆盖配置路径，适合异构 home、容器和 secret 挂载。
- 跨电脑分别安装 Skill 和配置；密钥不进入 Git。

## 配置模型

Skill 不提供 Provider 默认值。配置由用户填写：

- `providerName`
- `baseUrl`
- `model`
- `apiKey` 或 `apiKeyEnv`
- `protocol`（`systemone` 或兼容网关的 `chat` 探测）
- `endpointPath`
- `authHeader`
- `authScheme`
- `extraHeaders`
- `timeoutSeconds`

私密文件不进入 Git，文件权限限制为当前用户。验证器只输出安全元数据，不输出 key
或 Provider 原始错误体。

## 数据流

1. 用户在 Zed 中填写私密 JSON。
2. 验证器读取配置并执行无网络校验。
3. 用户明确要求后，验证器按 `protocol` 发送最小请求：System One 检查 Noul，chat
   只验证认证与可达性。
4. 验证器报告 HTTP 状态、模型和最小结构结果；任何非 2xx / 不兼容响应都失败。
5. 目标应用从自身 secret store / deployment config 读取等价值并显式传给官方 SDK。

## 约束

- 不内置 Command Code 或其他 Provider 默认值。
- 远程地址要求 HTTPS；仅 localhost / loopback 允许 HTTP。
- 不把文档页、模型页或带 query 的网页 URL 静默当作 API 根地址。
- 不在 Git 仓库中保存真实 key。
