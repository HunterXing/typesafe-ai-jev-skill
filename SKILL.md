---
name: typesafe-ai-jev-skill
description: |
  Use this skill when the user wants to build, modify, configure, or verify a TypeSafe System One / Jev integration through any custom compatible provider. Trigger on requests mentioning Jev, System One, Choice, Score, Noul, probabilistic routing, calibrated decisions, or replacing prompt-plus-JSON parsing. Load it when base URL, model ID, authentication, endpoint path, or provider may differ from TypeSafe's official service. Do not use it for ordinary chat-model text generation or generic LLM tasks without a typed-decision requirement.
---

# TypeSafe Jev Custom Provider Integration

## Inputs to collect

- Target language and existing SDK/package setup.
- Where the provider key is stored. Keep it in the private config file or a deployment secret store; do not request it in chat or print it.
- The decision's failure consequence, because this determines whether low confidence goes to deterministic fallback, review, or blocking.

If the user only wants conceptual TypeSafe design and no live API call, read the live TypeSafe docs without reading the private config file or installing an SDK.

## Provider configuration

This Skill is Agent Skills-compatible and is not bound to a particular agent or
provider. On a new computer, install the Skill content into the target agent's documented
user-level skill directory, then create the private JSON config described in
`references/portable-install.md`. The repository is source code; copy the Skill
content rather than relying on its original checkout path.

The default portable config location is:

```text
<agent-home>/.config/typesafe-ai-jev-skill.json
```

Use the same configuration schema in every supported agent and operating system. `providerName`, `baseUrl`, `model`, `apiKey`/`apiKeyEnv`, `protocol`, `endpointPath`, `authHeader`, `authScheme`, `extraHeaders`, and `timeoutSeconds` are the portable fields.

The runtime does not inject configuration automatically. Every agent must load
this Skill, resolve `SKILL_ROOT` from the `Location:` path returned by its
client, and use this discovery order:

1. `JEV_SKILL_CONFIG` environment variable.
2. `<agent-home>/.config/typesafe-ai-jev-skill.json` (`$HOME/.config/...` on macOS/Linux; `$HOME\\.config\\...` on Windows).
3. No config: report setup instructions; do not scan unrelated secret
   directories.

On the same computer, different agents can share the same config file after each
installs the Skill in its own client directory. On another computer, copy the
Skill and create a separate private config; never commit or sync the key with
Git. Read `references/portable-install.md` for current agent paths, compatibility
references, Windows PowerShell notes, and acceptance checks.

The config template is `references/config.example.json`. Copy it to the resolved
private config path, fill it outside Git, and let the verifier validate the
result. Do not read or print the private config after credentials are filled.

For generated applications, load equivalent values from the project's deployment configuration or secret manager and pass them explicitly to the official TypeSafe SDK. Explicit SDK options take priority over environment variables.

## Procedure

1. Validate the custom configuration without network access:

   ```bash
   node "$SKILL_ROOT/scripts/verify-config.mjs" \
     --config "${JEV_SKILL_CONFIG:-$HOME/.config/typesafe-ai-jev-skill.json}"
   ```

   Use `--config <path>` to test another config file. The command reports provider name, base URL, protocol, endpoint, model, authentication header/scheme, and key presence, but never the key. A missing, placeholder, malformed, or incomplete value returns nonzero.

2. Confirm the provider contract before generating code.

   - Read relevant TypeSafe docs from `https://docs.typesafe.ai/llms.txt`.
   - Verify that the configured provider implements the TypeSafe System One request and response contract.
   - Confirm the exact base root, endpoint suffix, model ID, auth header, plan entitlement, and whether the endpoint streams. Jev/System One integrations are non-streaming decision calls, not chat completions.
   - Do not infer that a product page URL is an API root. A smoke test will establish endpoint reachability, but it cannot prove billing or data-retention terms.

3. Keep deterministic behavior in application code. Use the model only for semantic judgment.

   - Choice: one named option plus probabilities and confidence.
   - Noul: probability of yes. Use separate Nouls for independently applicable labels.
   - Score: probability-weighted position across ordered, self-contained levels.
   - For source selection, include every candidate the model may choose. Add a no-match option when nothing may fit.

4. Build one narrow, coherent question per judgment. Put the decision in `instructions`; define answers in `criteria`. Use structured objects or arrays when definitions, contrasts, exclusions, or examples reduce ambiguity. Reference nested state with backticked paths such as `` `ticket.messages[0].text` ``.

5. Batch independent questions over the same state. They run in parallel and cannot see each other's answers. State speculative premises explicitly. Use a second request only when an earlier answer is needed to fetch evidence, build state, or determine later options; extra questions cost tokens and latency.

6. Consume uncertainty in code. Choice/Score confidence summarizes distribution concentration, not correctness or permission to act. A Noul near `0.5` is ambiguity, not a medium score. Evaluate thresholds on representative data and route uncertain or consequential cases to deterministic fallback, a reasoning model, or a person as appropriate.

7. Implement with the official SDK when the provider is compatible. Do not add a local proxy merely because the provider differs.

   JavaScript/TypeScript:

   ```ts
   import { choice, noul, TypeSafeClient } from "@typesafe-ai/sdk";

   const client = new TypeSafeClient({
     apiKey: provider.apiKey,
     baseURL: provider.baseUrl,
     defaultModel: provider.model,
   });

   const result = await client.systemOne({
     state: { document: "I was charged twice. Please fix this ASAP." },
     questions: {
       is_urgent: noul("Does this request need urgent attention?"),
       department: choice("Which team should handle this?", {
         billing: "charges, invoices, refunds",
         technical: "bugs, outages, integrations",
         other: "anything else",
       }),
     },
   });
   ```

   Python:

   ```python
   from typesafe_sdk import Choice, Noul, TypeSafeClient

   with TypeSafeClient(
       api_key=provider.api_key,
       base_url=provider.base_url,
       model=provider.model,
   ) as client:
       result = client.system_one(
           state={"document": "I was charged twice. Please fix this ASAP."},
           questions={
               "is_urgent": Noul(
                   instructions="Does this request need urgent attention?"
               ),
               "department": Choice(
                   instructions="Which team should handle this?",
                   criteria={
                       "billing": "charges, invoices, refunds",
                       "technical": "bugs, outages, integrations",
                       "other": "anything else",
                   },
               ),
           },
       )
   ```

   JavaScript uses `baseURL` / `defaultModel`; Python uses `base_url` / `model`. Confirm installed SDK signatures before shipping. More integration variants are in `references/provider-config.md`.

8. Run a live smoke test only when the user explicitly requests it, the private
config is complete, and the endpoint is reachable from the agent's runtime:

   ```bash
   node "$SKILL_ROOT/scripts/verify-config.mjs" \
     --config "${JEV_SKILL_CONFIG:-$HOME/.config/typesafe-ai-jev-skill.json}" \
     --smoke
   ```

   This sends one minimal request, which may incur provider charges. In
   `systemone` mode it checks a typed Noul answer. In `chat` mode it proves only
   authentication and chat-route reachability, not System One compatibility.
   Treat non-2xx, malformed responses, connection failures, and timeouts as
   failures. The verifier intentionally does not echo provider error bodies
   because a gateway may reflect credentials or user content.

9. Test representative cases and application behavior. Inspect exact state, question wording, candidates, answers, thresholds, and provider response. Separate missing evidence, model errors, code errors, authentication/plan errors, and service failures. Measure actual request count, latency, and cost.

## Output contract

For implementation work, deliver:

- Provider values in deployment configuration, with placeholders only for secrets.
- Typed code that consumes answers and probabilities without parsing generated prose.
- A tested uncertainty policy and fallback path.
- Verification evidence from local config validation, unit tests, and any explicitly requested live smoke test.

## Failure handling

- Missing config/key: report the missing field or environment-variable name, then open the resolved portable config path in the user's configured editor if they need to fill it.
- Product/docs URL as API root: explain the configured endpoint and correct it only after verifying the provider's documentation.
- Authentication or plan error: report HTTP status and a safe error category; do not print the provider response body.
- 429/529/5xx: back off and retry within budget; surface persistent failure rather than choosing a label silently.
- Missing state evidence or omitted candidate: fix the input and rerun; the model cannot select absent options.
- Low confidence: follow the tested fallback or review policy; a typed answer is not proof.

## Windows (win32) platform notes

On Windows PowerShell, use the same Node verifier with this path pattern:

```powershell
node (Join-Path $SKILL_ROOT "scripts/verify-config.mjs") `
  --config $(if ($env:JEV_SKILL_CONFIG) { $env:JEV_SKILL_CONFIG } else { Join-Path $HOME ".config/typesafe-ai-jev-skill.json" })
```

Resolve `$SKILL_ROOT` from the loaded Skill's installation directory. Keep the
private JSON outside the repository and restrict it to the current OS user. Do
not place credentials in repository files.
