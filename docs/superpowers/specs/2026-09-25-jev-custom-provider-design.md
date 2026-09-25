# 设计

## 目标

创建 Provider 中立的 Mavis 全局 Skill `typesafe-ai-jev-skill`，用于通过任意兼容
TypeSafe System One 契约的自定义 Provider 调用 Jev。

## 全局位置

- Skill：`/Users/xingheng/.minimax/skills/typesafe-ai-jev-skill/`
- 私密配置：`~/.minimax/secrets/typesafe-ai-jev-skill.json`（可用
  `JEV_SKILL_CONFIG` 覆盖）
- 官方市场插件 `typesafe:typesafe-ai` 保持不变。

## 配置模型

Skill 不提供 Provider 默认值。配置由用户填写：

- `providerName`
- `baseUrl`
- `model`
- `apiKey` 或 `apiKeyEnv`
- `systemOnePath`
- `authHeader`
- `authScheme`
- `timeoutSeconds`

私密文件不进入 Git，文件权限限制为当前用户。验证器只输出安全元数据，不输出 key
或 Provider 原始错误体。

## 数据流

1. 用户在 Zed 中填写私密 JSON。
2. 验证器读取配置并执行无网络校验。
3. 用户明确要求后，验证器以最小 Noul 请求执行真实 smoke。
4. 验证器报告 HTTP 状态、模型与 Noul 概率；任何非 2xx / 不兼容响应都失败。
5. 目标应用从自身 secret store / deployment config 读取等价值并显式传给官方 SDK。

## 约束

- 不内置 Command Code 或其他 Provider 默认值。
- 远程地址要求 HTTPS；仅 localhost / loopback 允许 HTTP。
- 不把文档页、模型页或带 query 的网页 URL 静默当作 API 根地址。
- 不在 Git 仓库中保存真实 key。
