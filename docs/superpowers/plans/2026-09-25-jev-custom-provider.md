# 实施计划

1. 将全局 Skill 重命名为 `typesafe-ai-jev-skill`。
2. 移除所有 Command Code 默认值与特定 Provider 假设。
3. 建立仓库外私密 JSON 配置，并限制文件权限。
4. 更新验证器：读取自定义 base URL、模型、端点路径、认证头与 key 来源。
5. 更新测试：覆盖非默认 Provider、自定义认证、路径归一化与密钥保护。
6. 运行 Mavis Skill lint、Node.js 单元测试、敏感信息扫描和 Git 完整性检查。
7. 用 Zed 打开私密配置，等待用户填写并保存。
8. 用户确认保存后，先做无网络验证，再按用户要求执行真实 API smoke。
