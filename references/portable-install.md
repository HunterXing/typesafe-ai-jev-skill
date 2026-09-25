# Portable configuration and installation contract

## Goal

This repository is an Agent Skills-compatible Skill. Install it into the user
skill directory of the target coding agent, then create one private JSON config
for that agent installation. Coding agents that support Agent Skills can share
the same Skill files and configuration schema.

The Skill does not depend on a particular agent API, runtime path, or provider.

## Discover the agent's user skill directory

Use the target agent's documented user-level Skill location. For maximum
cross-client interoperability, use the Agent Skills interoperability directory
when the client scans it.

### Recommended paths

| Agent or standard | User skill directory |
| --- | --- |
| Agent Skills interoperability convention | `~/.agents/skills/` |
| OpenCode | `~/.config/opencode/skills/` or `~/.agents/skills/` |
| Claude Code | `~/.claude/skills/` |

For a client that does not scan the interoperability directory, use that
client's documented user-level directory. If a client does not support user-level
Skills, install the repository into a project `.agents/skills/` or equivalent
supported project directory instead. Do not assume one agent's path is visible
to another.

### Compatibility references

Some clients and older versions use additional locations. These are retained
as migration references, not as the default installation requirement:

| Compatibility reference | User skill directory |
| --- | --- |
| Native Mavis directory | `~/.minimax/skills/` |
| Codex interoperability path | `$HOME/.agents/skills/` |
| Older Codex examples | `~/.codex/skills/` |

Prefer the target client's current official documentation over a legacy path.
If multiple clients scan `~/.agents/skills/`, one installation there may be
shared by those clients. A client with its own native directory still requires
an installation there.

## Install

### CLI-assisted install

For agents supported by the `skills` CLI, install this single-skill repository with:

```bash
npx skills add HunterXing/typesafe-ai-jev-skill --skill typesafe-ai-jev-skill
```

Select the target agent in the CLI prompt. Use the client-specific path below only when the CLI is unavailable or when a manual installation is required.

### Manual install

Copy the Skill content into the chosen agent skill directory as:

```text
<agent-user-skill-dir>/typesafe-ai-jev-skill/
```

The required files are:

```text
SKILL.md
scripts/verify-config.mjs
references/provider-config.md
references/portable-install.md
references/config.example.json
```

Tests and license/attribution files may travel with the repository. Keep the
private config outside the Skill directory.

## Create the private config

Recommended location:

```text
<agent-home>/.config/typesafe-ai-jev-skill.json
```

Examples:

- macOS/Linux: `~/.config/typesafe-ai-jev-skill.json`
- Windows PowerShell: `$HOME\\.config\\typesafe-ai-jev-skill.json`

The JSON schema is the same for every agent:

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

`protocol: "systemone"` preserves the typed Jev contract. Some compatible
providers expose a chat-completions route instead; set `protocol: "chat"` and
`endpointPath: "v1/chat/completions"` for those gateways. A chat smoke test can
validate authentication and reachability but cannot prove System One
compatibility.

Prefer `apiKeyEnv` in CI or shared environments. For a local key file, set
POSIX mode to `600` before storing the real key. Windows should restrict the
file to the current user through NTFS ACLs.

## Point the agent to the config

The portable discovery order is:

1. `JEV_SKILL_CONFIG` environment variable.
2. `$HOME/.config/typesafe-ai-jev-skill.json`.
3. No config: report the exact setup action; do not scan unrelated secret
   directories.

Set `JEV_SKILL_CONFIG` when the target home directory or config location differs:

```bash
export JEV_SKILL_CONFIG="$HOME/.config/typesafe-ai-jev-skill.json"
```

PowerShell:

```powershell
$env:JEV_SKILL_CONFIG = Join-Path $HOME ".config/typesafe-ai-jev-skill.json"
```

After the agent loads this Skill, `SKILL_ROOT` is the directory containing the
loaded `SKILL.md`; resolve it from the agent's Skill path. Do not assume this
source checkout exists on the target computer. Run the bundled verifier by
absolute path:

```bash
node "$SKILL_ROOT/scripts/verify-config.mjs" \
  --config "${JEV_SKILL_CONFIG:-$HOME/.config/typesafe-ai-jev-skill.json}"
```

Optional live smoke after the user explicitly approves the possible charge:

```bash
node "$SKILL_ROOT/scripts/verify-config.mjs" \
  --config "${JEV_SKILL_CONFIG:-$HOME/.config/typesafe-ai-jev-skill.json}" \
  --smoke
```

The verifier requires Node.js 18+ for global `fetch` and uses no third-party
package. It prints no key and does not echo provider response bodies.

## Multi-agent and multi-computer behavior

On one computer, install one copy per client and let all copies read the same
portable config. On another computer, install the Skill and create the private
config there. Remote/container clients need the Skill provisioned into their
runtime plus a mounted config, injected `JEV_SKILL_CONFIG`, or secret manager;
the local machine's `$HOME` is not automatically shared. Never commit the key to
Git. On Windows, use PowerShell paths and NTFS ACLs; the Node verifier itself
is cross-platform.

## Acceptance check on each target machine

1. The target agent can load `typesafe-ai-jev-skill` and returns the installed
   `SKILL.md` path.
2. `node --version` is 18 or newer.
3. The local verifier reports the intended provider, endpoint, model, and auth
   mode while hiding the key.
4. A user-approved minimal smoke call returns one valid typed Noul answer in
   `systemone` mode. In `chat` mode, it proves only authentication and chat-route
   reachability, not TypeSafe decision-model compatibility.
