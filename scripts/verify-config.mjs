#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { homedir, userInfo } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import process from "node:process";

const execFileAsync = promisify(execFile);

export const DEFAULT_CONFIG_PATH = join(
  homedir(),
  ".config",
  "typesafe-ai-jev-skill.json",
);
export const SYSTEM_ONE_PATH = "v1/systemone";
export const SMOKE_QUESTION_ID = "is_configuration_valid";

export class ConfigError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "ConfigError";
  }
}

function isLoopback(hostname) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  );
}

function isPlaceholderSecret(value) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized.includes("<") ||
    normalized.includes(">") ||
    normalized.includes("your-") ||
    normalized.includes("changeme") ||
    normalized.includes("replace") ||
    normalized.includes("todo") ||
    normalized === "sk-xxx" ||
    normalized === "xxx"
  );
}

function normalizeEndpointPath(raw) {
  if (raw === undefined || raw === null || raw === "") return SYSTEM_ONE_PATH;
  const value = String(raw).trim();
  if (value.includes("://") || value.includes("?") || value.includes("#")) {
    throw new ConfigError("endpointPath must be a URL path without query or fragment");
  }
  return value.replace(/^\/+|\/+$/g, "");
}

function normalizeAuthHeader(raw) {
  const value = String(raw ?? "Authorization").trim();
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(value)) {
    throw new ConfigError("authHeader is not a valid HTTP header name");
  }
  return value;
}

function normalizeAuthScheme(raw) {
  const value = String(raw ?? "Bearer").trim();
  if (/[\r\n]/.test(value)) {
    throw new ConfigError("authScheme cannot contain line breaks");
  }
  return value;
}

export function normalizeBaseUrl(raw, systemOnePath = SYSTEM_ONE_PATH) {
  const value = String(raw ?? "").trim();
  if (!value) throw new ConfigError("baseUrl is required in the config file");

  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new ConfigError("baseUrl must be a valid absolute URL", { cause: error });
  }

  if (parsed.protocol !== "https:" && !isLoopback(parsed.hostname)) {
    throw new ConfigError("remote baseUrl must use https; loopback HTTP is allowed");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ConfigError("baseUrl must use http or https");
  }
  if (!parsed.hostname) throw new ConfigError("baseUrl must include a hostname");
  if (parsed.username || parsed.password) {
    throw new ConfigError("baseUrl cannot include credentials");
  }
  if (parsed.search || parsed.hash) {
    throw new ConfigError("baseUrl cannot include a query string or fragment");
  }

  let path = parsed.pathname.replace(/\/+$/, "");
  const normalizedPath = normalizeEndpointPath(systemOnePath);
  if (
    normalizedPath &&
    path.toLowerCase().endsWith(`/${normalizedPath.toLowerCase()}`)
  ) {
    path = path.slice(0, -`/${normalizedPath}`.length);
  }

  const baseUrl = path && path !== "/" ? `${parsed.origin}${path}` : parsed.origin;
  const endpoint =
    normalizedPath && systemOnePath !== ""
      ? `${baseUrl}/${normalizedPath}`
      : baseUrl;
  return { baseUrl, endpoint };
}

async function hasWindowsUserAcl(configPath) {
  try {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$path = $args[0]; (Get-Acl -LiteralPath $path).Access | ForEach-Object { \"$($_.IdentityReference)|$($_.FileSystemRights)|$($_.AccessControlType)|$($_.IsInherited)\" }",
      configPath,
    ], { windowsHide: true });
    const currentUser = userInfo().username.toLowerCase();
    const entries = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [identity, rights, type, inherited] = line.split("|");
        return {
          identity: identity.toLowerCase(),
          rights: Number(rights),
          type,
          inherited: inherited.toLowerCase() === "true",
        };
      });
    const allowEntries = entries.filter(
      (entry) => entry.type === "allow" && !entry.inherited,
    );
    const hasCurrentUser = allowEntries.some((entry) => {
      const name = entry.identity.split("\\").at(-1);
      return name === currentUser || name === "system" || name === "administrators";
    });
    const broadAllow = allowEntries.some((entry) => {
      const name = entry.identity.split("\\").at(-1);
      return ["everyone", "users", "authenticated users", "guests"].includes(name);
    });
    return hasCurrentUser && !broadAllow;
  } catch {
    return false;
  }
}

export async function loadConfigFile(
  configPath = DEFAULT_CONFIG_PATH,
  env = process.env,
) {
  let file;
  try {
    file = await stat(configPath);
  } catch (error) {
    throw new ConfigError(`config file not found: ${configPath}`, { cause: error });
  }

  if (!file.isFile()) {
    throw new ConfigError(`config path is not a file: ${configPath}`);
  }
  if (process.platform !== "win32" && (file.mode & 0o077) !== 0) {
    throw new ConfigError(
      "config file permissions are too broad; run: chmod 600 <config-path>",
    );
  }

  if (process.platform === "win32" && !(await hasWindowsUserAcl(configPath))) {
    throw new ConfigError(
      "config file must be readable only by the current Windows user; restrict its NTFS ACL",
    );
  }

  let raw;
  try {
    raw = await readFile(configPath, "utf8");
  } catch (error) {
    throw new ConfigError(`cannot read config file: ${configPath}`, { cause: error });
  }

  let source;
  try {
    source = JSON.parse(raw);
  } catch (error) {
    throw new ConfigError("config file must contain valid JSON", { cause: error });
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new ConfigError("config file root must be a JSON object");
  }
  return validateConfig(source, env);
}

export function validateConfig(source, env = process.env) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new ConfigError("config must be a JSON object");
  }

  const providerName = String(source.providerName ?? "custom-provider").trim();
  if (!providerName) throw new ConfigError("providerName cannot be empty");

  const model = String(source.model ?? "").trim();
  if (!model) throw new ConfigError("model is required in the config file");
  if (model.includes("://") || /\s/.test(model)) {
    throw new ConfigError("model must be a provider model identifier");
  }

  const protocol = String(source.protocol ?? "systemone").trim().toLowerCase();
  if (protocol !== "systemone" && protocol !== "chat") {
    throw new ConfigError('protocol must be "systemone" or "chat"');
  }

  const endpointPath = normalizeEndpointPath(
    source.endpointPath ?? source.systemOnePath,
  );
  const { baseUrl, endpoint } = normalizeBaseUrl(source.baseUrl, endpointPath);

  const apiKeyEnv = String(source.apiKeyEnv ?? "").trim();
  const inlineApiKey = String(source.apiKey ?? "").trim();
  let apiKey;
  let apiKeySource;
  if (apiKeyEnv) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(apiKeyEnv)) {
      throw new ConfigError("apiKeyEnv must be a valid environment-variable name");
    }
    apiKey = String(env[apiKeyEnv] ?? "").trim();
    apiKeySource = `environment variable ${apiKeyEnv}`;
  } else {
    apiKey = inlineApiKey;
    apiKeySource = "config file apiKey";
  }
  if (!apiKey || isPlaceholderSecret(apiKey)) {
    throw new ConfigError(
      apiKeyEnv
        ? `apiKeyEnv ${apiKeyEnv} is missing or still contains a placeholder`
        : "apiKey is missing or still contains a placeholder",
    );
  }
  if (/\s/.test(apiKey)) {
    throw new ConfigError("API key cannot contain whitespace");
  }

  const authHeader = normalizeAuthHeader(source.authHeader);
  const authScheme = normalizeAuthScheme(source.authScheme);
  const extraHeaders = source.extraHeaders ?? {};
  if (!extraHeaders || typeof extraHeaders !== "object" || Array.isArray(extraHeaders)) {
    throw new ConfigError("extraHeaders must be a JSON object");
  }
  const safeExtraHeaders = {};
  for (const [name, value] of Object.entries(extraHeaders)) {
    normalizeAuthHeader(name);
    if (typeof value !== "string" || /[\r\n]/.test(value)) {
      throw new ConfigError(`extraHeaders.${name} must be a single-line string`);
    }
    const lowerName = name.toLowerCase();
    if (["authorization", "content-length", "host"].includes(lowerName)) {
      throw new ConfigError(
        `extraHeaders.${name} is managed by the verifier and cannot be overridden`,
      );
    }
    safeExtraHeaders[name] = value;
  }
  const timeoutSeconds = Number(source.timeoutSeconds ?? 30);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new ConfigError("timeoutSeconds must be a positive number");
  }

  return {
    providerName,
    baseUrl,
    endpoint,
    model,
    apiKey,
    apiKeySource,
    authHeader,
    authScheme,
    extraHeaders: safeExtraHeaders,
    protocol,
    endpointPath,
    timeoutSeconds,
  };
}

export function buildAuthorizationHeader(config) {
  return config.authScheme
    ? `${config.authScheme} ${config.apiKey}`
    : config.apiKey;
}

export function buildSmokePayload(config) {
  if (config.protocol === "chat") {
    return {
      model: config.model,
      messages: [
        {
          role: "user",
          content: "Reply with the single word OK.",
        },
      ],
      max_tokens: 8,
      stream: false,
    };
  }
  return {
    model: config.model,
    state: "Provider configuration smoke test.",
    questions: {
      [SMOKE_QUESTION_ID]: {
        type: "noul",
        instructions: "Is this a valid System One configuration test?",
      },
    },
  };
}

function safeHttpCategory(status) {
  if (status === 401) return "authentication failed; verify the provider key";
  if (status === 403) return "permission denied; verify plan or model entitlement";
  if (status === 404) return "endpoint or model not found for this provider";
  if (status === 422) return "request validation failed at the provider";
  if (status === 429) return "provider rate limit reached";
  if (status === 529) return "provider temporarily overloaded";
  if (status >= 500) return "provider service error";
  return "provider rejected the request";
}

export function summarizeResponse(status, body, config) {
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return {
      ok: false,
      status,
      message:
        status >= 200 && status < 300
          ? "provider returned a non-JSON response"
          : safeHttpCategory(status),
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      status,
      message:
        status >= 200 && status < 300
          ? "provider returned an unexpected JSON shape"
          : safeHttpCategory(status),
    };
  }
  if (status < 200 || status >= 300) {
    return { ok: false, status, message: safeHttpCategory(status) };
  }

  if (config.protocol === "chat") {
    const choice = Array.isArray(parsed.choices) ? parsed.choices[0] : undefined;
    const content = choice?.message?.content;
    if (typeof content !== "string") {
      return {
        ok: false,
        status,
        message: "chat provider response did not contain message content",
      };
    }
    const model = typeof parsed.model === "string" ? parsed.model : config.model;
    return {
      ok: true,
      status,
      message: `chat reachability verified, model=${model}, content length=${content.length}`,
    };
  }

  const answer =
    parsed.answers && typeof parsed.answers === "object"
      ? parsed.answers[SMOKE_QUESTION_ID]
      : undefined;
  if (!answer || typeof answer !== "object" || answer.type !== "noul") {
    return {
      ok: false,
      status,
      message: "provider response did not contain the expected Noul answer",
    };
  }
  if (typeof answer.noul !== "number" || !Number.isFinite(answer.noul)) {
    return {
      ok: false,
      status,
      message: "provider Noul answer did not contain a numeric probability",
    };
  }

  const model =
    typeof parsed.model === "string" && parsed.model ? parsed.model : config.model;
  return {
    ok: true,
    status,
    message: `model=${model}, ${SMOKE_QUESTION_ID}=${answer.noul.toFixed(4)}`,
  };
}

export async function runSmoke(config, { fetchImpl = fetch } = {}) {
  if (typeof fetchImpl !== "function") {
    throw new ConfigError("this Node.js runtime does not provide global fetch");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutSeconds * 1000);
  try {
    const response = await fetchImpl(config.endpoint, {
      method: "POST",
      headers: {
        ...config.extraHeaders,
        [config.authHeader]: buildAuthorizationHeader(config),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(buildSmokePayload(config)),
      signal: controller.signal,
    });
    const body = await response.text();
    return summarizeResponse(response.status, body, config);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new ConfigError(
        `request timed out after ${config.timeoutSeconds}s`,
        { cause: error },
      );
    }
    throw new ConfigError("provider connection failed", { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

function parseArgs(argv) {
  const args = {
    configPath: DEFAULT_CONFIG_PATH,
    smoke: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--smoke") {
      args.smoke = true;
      continue;
    }
    if (arg === "--config") {
      const value = argv[index + 1];
      if (!value) throw new ConfigError("--config requires a path");
      args.configPath = value;
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    throw new ConfigError(`unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Validate a custom TypeSafe System One / Jev provider config.

Usage:
  node scripts/verify-config.mjs [options]

Options:
  --config <path>  Config JSON (default: ${DEFAULT_CONFIG_PATH})
  --smoke          Send one minimal billable request using the configured protocol
  -h, --help       Show this help

Without --smoke, this command does not make a network request. It never prints
the API key or the provider's raw error body.`);
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(`error: ${error.message}`);
    return 2;
  }
  if (args.help) {
    printHelp();
    return 0;
  }

  let config;
  try {
    config = await loadConfigFile(args.configPath, env);
  } catch (error) {
    console.error(`error: ${error.message}`);
    return 1;
  }

  console.log("Configuration valid.");
  console.log(`Config:     ${args.configPath}`);
  console.log(`Provider:   ${config.providerName}`);
  console.log(`Base URL:   ${config.baseUrl}`);
  console.log(`Model:      ${config.model}`);
  console.log(`Protocol:   ${config.protocol}`);
  console.log(`Endpoint:   ${config.endpoint}`);
  console.log(`Auth:       ${config.authHeader} (${config.authScheme || "raw key"})`);
  console.log(`Key source: ${config.apiKeySource}; value hidden`);

  if (!args.smoke) return 0;

  try {
    const result = await runSmoke(config);
    console.log(`Smoke test: HTTP ${result.status}: ${result.message}`);
    return result.ok ? 0 : 1;
  } catch (error) {
    console.error(`error: ${error.message}`);
    return 1;
  }
}

const isMain =
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMain) {
  process.exitCode = await main();
}
