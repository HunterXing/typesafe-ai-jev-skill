#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtemp, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  ConfigError,
  buildAuthorizationHeader,
  buildSmokePayload,
  loadConfigFile,
  main,
  normalizeBaseUrl,
  runSmoke,
  summarizeResponse,
  validateConfig,
} from "../scripts/verify-config.mjs";

const SECRET = "test-secret-must-never-appear";

function config(overrides = {}) {
  return {
    providerName: "Test Provider",
    baseUrl: "https://api.test-provider.example/gateway",
    model: "test/jev",
    apiKey: SECRET,
    apiKeyEnv: "",
    systemOnePath: "v1/systemone",
    authHeader: "Authorization",
    authScheme: "Bearer",
    timeoutSeconds: 30,
    ...overrides,
  };
}

async function writeConfigFile(source, mode = 0o600) {
  const dir = await mkdtemp(join(tmpdir(), "jev-skill-test-"));
  const path = join(dir, "config.json");
  await writeFile(path, `${JSON.stringify(source, null, 2)}\n`, "utf8");
  await chmod(path, mode);
  return path;
}

test("normalizes a custom provider root and endpoint", () => {
  const result = normalizeBaseUrl(
    "https://api.test-provider.example/gateway///",
    "custom/systemone",
  );
  assert.equal(result.baseUrl, "https://api.test-provider.example/gateway");
  assert.equal(
    result.endpoint,
    "https://api.test-provider.example/gateway/custom/systemone",
  );
});

test("accepts a full custom System One endpoint", () => {
  const result = normalizeBaseUrl(
    "https://api.test-provider.example/gateway/custom/systemone",
    "custom/systemone",
  );
  assert.equal(result.baseUrl, "https://api.test-provider.example/gateway");
  assert.equal(
    result.endpoint,
    "https://api.test-provider.example/gateway/custom/systemone",
  );
});

test("allows HTTP only for loopback", () => {
  assert.equal(
    normalizeBaseUrl("http://127.0.0.1:8787", "v1/systemone").endpoint,
    "http://127.0.0.1:8787/v1/systemone",
  );
  assert.throws(
    () => normalizeBaseUrl("http://api.test-provider.example", "v1/systemone"),
    /must use https/,
  );
});

test("rejects URL credentials, queries, and fragments", () => {
  assert.throws(
    () => normalizeBaseUrl("https://user:pass@api.example.com", "v1/systemone"),
    /cannot include credentials/,
  );
  assert.throws(
    () => normalizeBaseUrl("https://api.example.com?token=secret", "v1/systemone"),
    /query string or fragment/,
  );
});

test("validates arbitrary provider values without Command Code defaults", () => {
  const result = validateConfig(config());
  assert.equal(result.providerName, "Test Provider");
  assert.equal(result.baseUrl, "https://api.test-provider.example/gateway");
  assert.equal(result.endpoint, "https://api.test-provider.example/gateway/v1/systemone");
  assert.equal(result.model, "test/jev");
  assert.doesNotMatch(JSON.stringify(result), /commandcode/i);
});

test("supports environment-backed keys", () => {
  const result = validateConfig(
    config({ apiKey: "", apiKeyEnv: "CUSTOM_JEV_KEY" }),
    { CUSTOM_JEV_KEY: SECRET },
  );
  assert.equal(result.apiKey, SECRET);
  assert.equal(result.apiKeySource, "environment variable CUSTOM_JEV_KEY");
});

test("rejects missing and placeholder secrets", () => {
  assert.throws(() => validateConfig(config({ apiKey: "" })), /apiKey is missing/);
  assert.throws(
    () => validateConfig(config({ apiKey: "<your-key>" })),
    /placeholder/,
  );
  assert.throws(
    () => validateConfig(config({ apiKey: "", apiKeyEnv: "CUSTOM_JEV_KEY" }), {}),
    /CUSTOM_JEV_KEY is missing/,
  );
});

test("supports a custom auth header without a scheme", () => {
  const result = validateConfig(
    config({ authHeader: "x-api-key", authScheme: "" }),
  );
  assert.equal(buildAuthorizationHeader(result), SECRET);
  assert.throws(
    () => validateConfig(config({ authHeader: "bad header" })),
    /valid HTTP header/,
  );
});

test("builds the custom provider smoke payload", () => {
  const result = buildSmokePayload(validateConfig(config()));
  assert.deepEqual(result, {
    model: "test/jev",
    state: "Provider configuration smoke test.",
    questions: {
      is_configuration_valid: {
        type: "noul",
        instructions: "Is this a valid System One configuration test?",
      },
    },
  });
});

test("loads a private config file without exposing the key", async () => {
  const path = await writeConfigFile(config());
  const result = await loadConfigFile(path);
  assert.equal(result.apiKey, SECRET);
  assert.equal(result.providerName, "Test Provider");
});

test("rejects overly broad config permissions", async () => {
  const path = await writeConfigFile(config(), 0o644);
  await assert.rejects(() => loadConfigFile(path), /permissions are too broad/);
});

test("rejects incomplete config files", async () => {
  const path = await writeConfigFile({ providerName: "broken" });
  await assert.rejects(() => loadConfigFile(path), /model is required/);
});

test("provider errors are categorized without echoing the body", () => {
  const result = summarizeResponse(
    401,
    JSON.stringify({ error: SECRET, detail: SECRET }),
    validateConfig(config()),
  );
  assert.equal(result.ok, false);
  assert.match(result.message, /authentication failed/);
  assert.doesNotMatch(result.message, new RegExp(SECRET));
});

test("smoke uses the custom endpoint, auth header, and model", async () => {
  const custom = validateConfig(
    config({ authHeader: "x-api-key", authScheme: "" }),
  );
  let observed;
  const result = await runSmoke(custom, {
    fetchImpl: async (url, init) => {
      observed = { url, init };
      return new Response(
        JSON.stringify({
          model: "test/jev-2026",
          answers: {
            is_configuration_valid: { type: "noul", noul: 0.98 },
          },
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(result.ok, true);
  assert.equal(
    observed.url,
    "https://api.test-provider.example/gateway/v1/systemone",
  );
  assert.equal(observed.init.method, "POST");
  assert.equal(observed.init.headers["x-api-key"], SECRET);
  assert.equal(JSON.parse(observed.init.body).model, "test/jev");
  assert.match(result.message, /model=test\/jev-2026/);
});

test("non-2xx smoke response is a failure", async () => {
  const result = await runSmoke(validateConfig(config()), {
    fetchImpl: async () =>
      new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
  });
  assert.equal(result.ok, false);
});

test("CLI missing config returns nonzero", async () => {
  const path = join(tmpdir(), "missing-jev-config-that-does-not-exist.json");
  let output = "";
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (line) => {
    output += `${line}\n`;
  };
  console.error = (line) => {
    output += `${line}\n`;
  };
  try {
    const code = await main(["--config", path]);
    assert.equal(code, 1);
    assert.match(output, /config file not found/);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
});

test("CLI local success never prints the key", async () => {
  const path = await writeConfigFile(config());
  let output = "";
  const originalLog = console.log;
  console.log = (line) => {
    output += `${line}\n`;
  };
  try {
    const code = await main(["--config", path]);
    assert.equal(code, 0);
    assert.match(output, /Configuration valid/);
    assert.match(output, /value hidden/);
    assert.doesNotMatch(output, new RegExp(SECRET));
  } finally {
    console.log = originalLog;
  }
});
