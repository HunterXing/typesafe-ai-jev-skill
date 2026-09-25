# 来源与许可

## TypeSafe 基础内容

- 上游仓库：[typesafe-ai/skills](https://github.com/typesafe-ai/skills)。
- 参考版本：commit `65a39f393687675ce170e6094757de20370365b9`，对应插件版本
  `0.5.7`。
- `SKILL.md` 在上游 Skill 的 TypeSafe/Jev 编程模型、Choice、Score、Noul、state、
  confidence、组合与验证指导基础上改写。
- 上游 Skill 的 MIT 许可证与版权声明保留在仓库根目录 `LICENSE`。
- TypeSafe、System One 与 Jev 的名称和品牌权利归各自权利人所有。

## 本地修改

- Skill 改为 Provider 中立，不内置 Command Code、TypeSafe 或其他服务默认值。
- 支持用户自定义 base URL、完整 System One 端点、模型 ID、认证头、认证前缀、
  端点路径、key 来源和超时。
- 私密配置位于 Skill 仓库之外，不会被 Git 跟踪。
- 提供不打印 key、不回显 Provider 错误体的 Node.js 配置验证与可选 smoke 工具。
- 提供本地单元测试，覆盖配置解析、URL 归一化、认证头、请求构造与退出码。
