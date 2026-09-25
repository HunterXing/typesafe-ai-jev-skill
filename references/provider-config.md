# 自定义 Provider 配置参考

本 Skill 不绑定任何默认 Provider。实际值来自用户级私密配置文件：

```text
~/.minimax/secrets/typesafe-ai-jev-skill.json
```

该路径相对于每个 Agent 所属 OS 用户的 `$HOME`。同一用户下的所有 Mavis Agent
共享此文件；也可以用 `JEV_SKILL_CONFIG` 指向其他私密配置路径。

## 配置结构

```json
{
  "providerName": "your-provider",
  "baseUrl": "https://api.your-provider.example",
  "model": "your-model-id",
  "apiKey": "your-key",
  "apiKeyEnv": "",
  "systemOnePath": "v1/systemone",
  "authHeader": "Authorization",
  "authScheme": "Bearer",
  "timeoutSeconds": 30
}
```

- `apiKey` 与 `apiKeyEnv` 二选一。推荐生产环境使用 secret manager，并在
  `apiKeyEnv` 中填写环境变量名；本地人工测试可以填写 `apiKey`。
- `systemOnePath` 允许自定义 Provider 使用不同路径。`baseUrl` 也可以填写完整
  System One 端点，验证器会去掉重复后缀。
- 常见认证：
  - `Authorization` + `Bearer` + key。
  - `x-api-key` + 空 `authScheme` + key。
- 远程 Provider 默认要求 HTTPS；仅允许 `localhost` / loopback 使用 HTTP。

不要把私密配置文件提交到 Git，不要在聊天、源码、测试 fixture 或日志中复制 key。

## JavaScript / TypeScript

从目标应用的私密配置层读取值后，显式传给官方 SDK：

```ts
import { noul, TypeSafeClient } from "@typesafe-ai/sdk";

const client = new TypeSafeClient({
  apiKey: config.apiKey,
  baseURL: config.baseUrl,
  defaultModel: config.model,
});

const result = await client.systemOne({
  state: "My payments have failed for three days and I am losing sales.",
  questions: {
    is_urgent: noul("Does this request need urgent attention?"),
  },
});
```

如果 Provider 认证不是 `Authorization: Bearer`，但官方 SDK 仍兼容该端点，可使用
`defaultHeaders` 覆盖认证头；不要在日志中输出请求头。

## Python

```python
from typesafe_sdk import Noul, TypeSafeClient

with TypeSafeClient(
    api_key=config.api_key,
    base_url=config.base_url,
    model=config.model,
) as client:
    result = client.system_one(
        state="My payments have failed for three days and I am losing sales.",
        questions={
            "is_urgent": Noul(
                instructions="Does this request need urgent attention?"
            ),
        },
    )
```

自定义认证头可通过 SDK 的 `default_headers` / `headers` 配置；具体参数以已安装
SDK 文档为准。

## TypeSafe 官方服务

TypeSafe 官方服务只是一个可选配置，不是本 Skill 默认值：

```json
{
  "providerName": "TypeSafe",
  "baseUrl": "https://api.typesafe.ai",
  "model": "jev-latest",
  "apiKeyEnv": "TYPESAFE_API_KEY",
  "systemOnePath": "v1/systemone",
  "authHeader": "Authorization",
  "authScheme": "Bearer"
}
```

## 验证

```bash
node scripts/verify-config.mjs
node scripts/verify-config.mjs --config /path/to/another-config.json
node --test tests/verify-config.test.mjs
```

默认不联网。只有用户明确要求真实调用时运行：

```bash
node scripts/verify-config.mjs --smoke
```

Smoke 会发送一个极小的 Noul 请求，可能产生费用。非 2xx、超时、连接失败或响应
不兼容都会返回非零退出码。
