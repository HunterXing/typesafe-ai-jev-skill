# typesafe-ai-jev-skill

**English** | [简体中文](README.zh-CN.md)

A portable Agent Skill for using TypeSafe System One / Jev through any compatible provider. It helps coding agents make typed, uncertainty-aware decisions with Choice, Score, and Noul questions instead of parsing generated prose.

## Install

Install the `typesafe-ai-jev-skill` Skill. If you work in a coding agent that supports Agent Skills, such as Claude Code or OpenCode, run:

```bash
npx skills add HunterXing/typesafe-ai-jev-skill --skill typesafe-ai-jev-skill
```

Select your coding agent during installation. The command installs the Skill to a location supported by the selected client. After installation, you can read the Skill instructions directly:

[Open the Skill instructions](https://github.com/HunterXing/typesafe-ai-jev-skill/blob/main/SKILL.md)

After that, use `typesafe-ai-jev-skill` for development tasks that involve Jev, System One, Choice, Score, Noul, or other structured decisions.

## What this Skill solves

Ordinary prompts often mix semantic understanding with JSON generation. The caller then has to handle model wording, format errors, and uncertain results. This Skill turns those judgments into stable typed questions:

- **Choice**: select one of the named options and return the complete probability distribution.
- **Noul**: estimate the probability that a statement or condition is true.
- **Score**: evaluate a state across ordered levels and return a weighted score, probabilities, and confidence.

It is useful for:

- ticket classification, routing, and escalation decisions;
- risk, urgency, and quality assessments;
- source selection, candidate matching, and structured extraction;
- business decisions that need confidence scores, probability distributions, or human-review thresholds.

This repository provides agent instructions, a configuration verifier, and an optional smoke test. It is not a Provider proxy and does not decide the final action for application code.

## Features

- **Provider-neutral**: no service is a default; the API root, model, endpoint, and authentication settings come from user configuration.
- **Portable across agents**: follows the Agent Skills `SKILL.md` structure and can be installed into a supported user-level Skill directory.
- **Typed outputs**: organizes questions and results around Choice, Score, and Noul instead of parsing generated prose.
- **Safe configuration**: the private config lives outside the repository; the verifier never prints the API key or raw Provider error bodies.
- **Verifiable**: includes offline configuration checks, an optional live smoke test, unit tests, and a cross-directory installation test.
- **No runtime dependencies**: the verifier uses the built-in `fetch` available in Node.js 18+.

## Requirements

1. Node.js 18 or newer:

   ```bash
   node --version
   ```

2. A coding agent that supports Agent Skills and can discover and load `SKILL.md` on demand.
3. A compatible Provider with:
   - an API root or full System One endpoint;
   - a model ID;
   - an authentication method and any required headers;
   - permission to make System One requests.

If only a chat-completions gateway is available, set `protocol` to `chat` to check authentication and route reachability. A chat check **does not prove Choice / Score / Noul System One compatibility**.

## Copy the prompt below and send it to Codex or another coding agent

Copy the following prompt and send it to Codex or another coding agent:

```text
Install the typesafe-ai-jev-skill Skill from https://github.com/HunterXing/typesafe-ai-jev-skill. Select the current coding agent during installation. Do not ask me to paste an API key into chat; keep the private configuration outside the repository.

After installation, create ~/.config/typesafe-ai-jev-skill.json from references/config.example.json, or use JEV_SKILL_CONFIG when a different path is required. Ask me to fill the provider base URL, model, endpoint, authentication mode, and key source in a local editor. Run only the offline configuration verifier first. Do not run a real API request or --smoke test unless I explicitly approve the possible charge.
```

## Manual installation

Choose a user-level Skill directory supported by the target agent. Common choices are:

| Target agent | Common user-level directory |
| --- | --- |
| Agent Skills interoperability convention | `~/.agents/skills/` |
| Claude Code | `~/.claude/skills/` |
| OpenCode | `~/.config/opencode/skills/` or `~/.agents/skills/` |
| Clients without user-level Skills | A project `.agents/skills/` or the client-specific directory |

Use the target client's current official documentation. Do not assume that one agent's directory is scanned by another agent.

### macOS / Linux / Git Bash

The following command uses the common `~/.agents/skills/` location. Replace `SKILL_DIR` when the target agent uses another directory:

```bash
SKILL_DIR="$HOME/.agents/skills/typesafe-ai-jev-skill"

git clone --depth 1 \
  https://github.com/HunterXing/typesafe-ai-jev-skill.git \
  "$SKILL_DIR"

test -f "$SKILL_DIR/SKILL.md"
test -f "$SKILL_DIR/scripts/verify-config.mjs"
```

If the directory already exists, update the copy:

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

For Claude Code, use `Join-Path $HOME ".claude/skills"` instead. For OpenCode, use `Join-Path $HOME ".config/opencode/skills"` or the interoperability directory. These are examples; follow the client's current documentation.

## Configure the private config

The default private config path is:

```text
~/.config/typesafe-ai-jev-skill.json
```

Configuration schema:

```json
{
  "providerName": "your-provider",
  "baseUrl": "https://api.your-provider.example",
  "model": "your-model-id",
  "apiKey": "your-key",
  "apiKeyEnv": "",
  "protocol": "systemone",
  "endpointPath": "v1/systemone",
  "authHeader": "Authorization",
  "authScheme": "Bearer",
  "extraHeaders": {},
  "timeoutSeconds": 30
}
```

| Field | Purpose |
| --- | --- |
| `providerName` | An identifier for the Provider; it does not change request behavior. |
| `baseUrl` | The Provider API root. It may also be a full System One endpoint; the verifier avoids duplicating the suffix. |
| `model` | The Provider model ID. |
| `apiKey` | A key stored in the local file; convenient for one-time manual testing. |
| `apiKeyEnv` | The name of an environment variable containing the key; use it instead of `apiKey` in production. |
| `protocol` | `systemone` for typed Jev, or `chat` for chat-route reachability only. |
| `endpointPath` | The System One or chat path relative to `baseUrl`. |
| `authHeader` | The authentication header, such as `Authorization` or `x-api-key`. |
| `authScheme` | The authentication prefix, such as `Bearer`; use an empty string for a raw key. |
| `extraHeaders` | Additional request headers; managed authentication headers cannot be overridden. |
| `timeoutSeconds` | The request timeout; it must be a positive number. |

### macOS / Linux setup

These commands do not guess a Provider and do not make a network request:

```bash
SKILL_ROOT="$HOME/.agents/skills/typesafe-ai-jev-skill"
CONFIG_DIR="$HOME/.config"
CONFIG_PATH="$CONFIG_DIR/typesafe-ai-jev-skill.json"

mkdir -p "$CONFIG_DIR"
cp "$SKILL_ROOT/references/config.example.json" "$CONFIG_PATH"
chmod 600 "$CONFIG_PATH"

"${EDITOR:-vi}" "$CONFIG_PATH"

node "$SKILL_ROOT/scripts/verify-config.mjs" --config "$CONFIG_PATH"
```

To use another config path:

```bash
export JEV_SKILL_CONFIG="$HOME/path/to/typesafe-ai-jev-skill.json"
node "$SKILL_ROOT/scripts/verify-config.mjs" \
  --config "$JEV_SKILL_CONFIG"
```

`JEV_SKILL_CONFIG` must point to a private config, not to the repository example.

### Windows PowerShell setup

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

On Windows, the verifier also checks the NTFS ACL. Restrict the file to the current user. To use a different path:

```powershell
$env:JEV_SKILL_CONFIG = $ConfigPath
node (Join-Path $SkillRoot "scripts/verify-config.mjs") `
  --config $env:JEV_SKILL_CONFIG
```

### Credential guidance

A local manual test may use `apiKey`, but the file must remain outside the repository and have restricted permissions:

```bash
chmod 600 "$HOME/.config/typesafe-ai-jev-skill.json"
```

Prefer `apiKeyEnv` in CI, containers, and shared environments:

```json
{
  "apiKey": "your-key",
  "apiKeyEnv": "JEV_API_KEY"
}
```

Inject that variable in the environment where the agent runs. Never put credentials in `README.md`, `README.zh-CN.md`, `SKILL.md`, test fixtures, Git commits, or shell history.

## Configuration discovery

After loading this Skill, the agent should resolve `SKILL_ROOT` from the directory containing the loaded `SKILL.md` and look for the private config in this order:

1. The `JEV_SKILL_CONFIG` environment variable.
2. `~/.config/typesafe-ai-jev-skill.json`.
3. If no config exists, report the exact setup action; do not scan unrelated secret directories.

`SKILL_ROOT` must come from the currently loaded Skill location. Do not assume the source repository still exists at a fixed local path.

## Offline configuration validation

Run the verifier without a network request first:

```bash
node "$SKILL_ROOT/scripts/verify-config.mjs" \
  --config "${JEV_SKILL_CONFIG:-$HOME/.config/typesafe-ai-jev-skill.json}"
```

The verifier reports the Provider, protocol, final endpoint, model, authentication mode, and whether a key is present, while hiding the key. It returns a nonzero exit code for:

- a missing or invalid JSON config;
- missing fields or placeholder values;
- a remote URL that does not use HTTPS;
- invalid endpoint, authentication-header, extra-header, or timeout settings;
- overly broad POSIX permissions or an invalid Windows ACL.

## Optional live smoke test

`--smoke` sends one minimal real request and may incur Provider charges. Run it only after explicit user approval:

```bash
node "$SKILL_ROOT/scripts/verify-config.mjs" \
  --config "${JEV_SKILL_CONFIG:-$HOME/.config/typesafe-ai-jev-skill.json}" \
  --smoke
```

Result meanings:

- `systemone`: checks the HTTP status, returned model, and one typed Noul answer;
- `chat`: checks authentication and chat-route reachability only;
- any non-2xx response, timeout, connection failure, or incompatible response: failure.

Do not add an unconditional real smoke test to automation or CI. It can be billable and requires explicit authorization.

## Use the Skill in an application

The Skill guides the agent's decision workflow. Applications should use the official TypeSafe JavaScript/Python SDK and pass Provider values explicitly from deployment configuration or a secret manager. Consume typed answers and probabilities directly; do not parse generated prose.

Recommended boundaries:

- code owns thresholds, permissions, retries, human review, and final actions;
- Jev owns semantic judgment, candidate selection, and probabilistic assessment;
- low-confidence or high-consequence cases use deterministic fallback, a reasoning model, or a person;
- Choice / Score confidence describes concentration in the probability distribution, not correctness or permission to act automatically.

More question design, SDK examples, and configuration variants:

- [`SKILL.md`](SKILL.md)
- [`references/provider-config.md`](references/provider-config.md)
- [`references/portable-install.md`](references/portable-install.md)
- [TypeSafe API reference](https://docs.typesafe.ai/api.md)
- [TypeSafe documentation index](https://docs.typesafe.ai/llms.txt)

## Compatibility references

Different agents and versions may search different Skill directories. Follow the target client's current official documentation. [`references/portable-install.md`](references/portable-install.md) retains additional compatibility paths for migration and troubleshooting; they are not default requirements and do not imply that every client scans the same directory.

## Development and validation

```bash
node --test tests/verify-config.test.mjs tests/portable-install.test.mjs
```

The tests use only fictional Providers and test keys. Before publishing, confirm that:

- both README files, the Skill, and reference docs contain no real keys or private user paths;
- the private config is not in `git ls-files`;
- `.env` files, logs, and temporary files are not version-controlled;
- internal `docs/superpowers/` material remains local and is not runtime Skill content.

## License and attribution

This project is licensed under the [MIT License](LICENSE). It adapts the TypeSafe Jev programming model and documentation; see [ATTRIBUTION.md](ATTRIBUTION.md) for source and modification details. TypeSafe, System One, and Jev names and branding belong to their respective rights holders.
