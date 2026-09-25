---
name: typesafe-ai-jev-skill
description: |
  Use this skill when the user wants to build, modify, configure, or verify a TypeSafe System One / Jev integration through any custom compatible provider. Trigger on requests mentioning Jev, System One, Choice, Score, Noul, probabilistic routing, calibrated decisions, or replacing prompt-plus-JSON parsing. Load it when base URL, model ID, authentication, endpoint path, or provider may differ from TypeSafe's official service. Do not use it for ordinary chat-model text generation or generic LLM tasks without a typed-decision requirement.
---

# TypeSafe Jev Custom Provider Integration

## Inputs to collect

- Target language and existing SDK/package setup.
- The custom provider's API root, model ID, System One endpoint path, and authentication convention.
- Where the provider key is stored. Keep it in the private config file or a deployment secret store; do not request it in chat or print it.
- The decision's failure consequence, because this determines whether low confidence goes to deterministic fallback, review, or blocking.

If the user only wants conceptual TypeSafe design and no live API call, read the live TypeSafe docs without reading the private config file or installing an SDK.

## Provider configuration

The global skill uses this private, Git-untracked file by default:

```text
~/.minimax/secrets/typesafe-ai-jev-skill.json
```

`~/.minimax` is the active Mavis data directory for the current OS user. The
configuration is shared by agents running as that user, but the runtime does
not inject it automatically. Every agent must load this Skill and follow the
discovery sequence below.

### Agent discovery sequence

1. Load this Skill and use the `Location:` directory returned by the `skill`
   tool as `SKILL_ROOT`; do not assume the agent's current working directory.
2. Use `JEV_SKILL_CONFIG` when the deployment provides an override; otherwise
   use `$HOME/.minimax/secrets/typesafe-ai-jev-skill.json`.
3. Run the verifier with that path. It reads the config without printing the
   secret:

   ```bash
   node "$SKILL_ROOT/scripts/verify-config.mjs" \
     --config "${JEV_SKILL_CONFIG:-$HOME/.minimax/secrets/typesafe-ai-jev-skill.json}"
   ```

4. If the file is missing or incomplete, report the missing field and open that
   same path in Zed. Do not scan unrelated secret directories and do not copy
   the key into the conversation.

The file is provider-neutral. Its fields are:

- `providerName`: display name only.
- `baseUrl`: provider API root; it may also be a full System One endpoint, which the verifier normalizes.
- `model`: provider-specific model identifier.
- `apiKey`: secret value, or leave it blank and set `apiKeyEnv` to an environment-variable name.
- `systemOnePath`: endpoint suffix, normally `v1/systemone` but configurable.
- `authHeader`: header name, normally `Authorization`.
- `authScheme`: header prefix, normally `Bearer`; use an empty string for a raw key such as `x-api-key`.
- `timeoutSeconds`: request timeout.

Do not read or print the private config file after credentials are filled. Use the verifier, which reports safe configuration metadata and hides the key.

For generated applications, load equivalent values from the project's deployment configuration or secret manager and pass them explicitly to the official TypeSafe SDK. Explicit SDK options take priority over environment variables.

## Procedure

1. Validate the custom configuration without network access:

   ```bash
   node "$SKILL_ROOT/scripts/verify-config.mjs" \
     --config "${JEV_SKILL_CONFIG:-$HOME/.minimax/secrets/typesafe-ai-jev-skill.json}"
   ```

   Use `--config <path>` to test another config file. The command reports provider name, base URL, endpoint, model, authentication header/scheme, and key presence, but never the key. A missing, placeholder, malformed, or incomplete value returns nonzero.

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

8. Run a live smoke test only when the user explicitly requests it and the private config is complete:

   ```bash
   node "$SKILL_ROOT/scripts/verify-config.mjs" \
     --config "${JEV_SKILL_CONFIG:-$HOME/.minimax/secrets/typesafe-ai-jev-skill.json}" \
     --smoke
   ```

   This sends one minimal Noul request, which may incur provider charges. Treat non-2xx, malformed responses, connection failures, and timeouts as failures. The verifier intentionally does not echo provider error bodies because a gateway may reflect credentials or user content.

9. Test representative cases and application behavior. Inspect exact state, question wording, candidates, answers, thresholds, and provider response. Separate missing evidence, model errors, code errors, authentication/plan errors, and service failures. Measure actual request count, latency, and cost.

## Output contract

For implementation work, deliver:

- Provider values in deployment configuration, with placeholders only for secrets.
- Typed code that consumes answers and probabilities without parsing generated prose.
- A tested uncertainty policy and fallback path.
- Verification evidence from local config validation, unit tests, and any explicitly requested live smoke test.

## Failure handling

- Missing config/key: report the missing field or environment-variable name, then open the private config file in Zed if the user needs to fill it.
- Product/docs URL as API root: explain the configured endpoint and correct it only after verifying the provider's documentation.
- Authentication or plan error: report HTTP status and a safe error category; do not print the provider response body.
- 429/529/5xx: back off and retry within budget; surface persistent failure rather than choosing a label silently.
- Missing state evidence or omitted candidate: fix the input and rerun; the model cannot select absent options.
- Low confidence: follow the tested fallback or review policy; a typed answer is not proof.

## Windows (win32) platform notes

Run the same Node.js checker with `node "$SKILL_ROOT/scripts/verify-config.mjs"`. Resolve `$HOME` from the current user and keep the private JSON file outside the Skill repository. Restrict it to that user and do not place credentials in repository files.
