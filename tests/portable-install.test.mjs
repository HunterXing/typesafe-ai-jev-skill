#!/usr/bin/env node

import assert from "node:assert/strict";
import { chmod, cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const TEST_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)));
const SKILL_ROOT = resolve(TEST_DIR, "..");

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

async function copySkillForIsolation() {
  const parent = await mkdtemp(join(tmpdir(), "jev-skill-install-"));
  const destination = join(parent, "typesafe-ai-jev-skill");
  await cp(SKILL_ROOT, destination, {
    recursive: true,
    filter: (source) =>
      !source.includes(`${join(SKILL_ROOT, ".git")}`) &&
      !source.includes(`${join(SKILL_ROOT, "node_modules")}`) &&
      !source.includes(`${join(SKILL_ROOT, "__pycache__")}`),
  });
  return destination;
}

test("portable install bundle contains all cross-agent resources", async () => {
  const installed = await copySkillForIsolation();
  try {
    for (const relative of [
      "SKILL.md",
      "scripts/verify-config.mjs",
      "references/provider-config.md",
      "references/portable-install.md",
      "references/config.example.json",
    ]) {
      await readFile(join(installed, relative), "utf8");
    }
    const skill = await readFile(join(installed, "SKILL.md"), "utf8");
    assert.match(skill, /JEV_SKILL_CONFIG/);
    assert.match(skill, /\.config\/typesafe-ai-jev-skill\.json/);
    assert.doesNotMatch(skill, /commandcode\.ai|typesafe-ai-commandcode/);
    const bundle = await readFile(
      join(installed, "scripts/verify-config.mjs"),
      "utf8",
    );
    assert.match(bundle, /JEV_SKILL_CONFIG|\.config/);
    assert.equal(
      await readFile(join(installed, ".git"), "utf8").catch(() => null),
      null,
    );
  } finally {
    await rm(installed, { recursive: true, force: true });
  }
});

test("portable install reference names supported agent locations", async () => {
  const text = await readFile(
    join(SKILL_ROOT, "references/portable-install.md"),
    "utf8",
  );
  assert.match(text, /~\/\.agents\/skills\//);
  assert.match(text, /~\/\.minimax\/skills\//);
  assert.match(text, /~\/\.claude\/skills\//);
  assert.match(text, /JEV_SKILL_CONFIG/);
  assert.match(text, /PowerShell/);
});

test("default config path is portable and not Mavis-specific", async () => {
  const { DEFAULT_CONFIG_PATH } = await import("../scripts/verify-config.mjs");
  assert.equal(
    DEFAULT_CONFIG_PATH,
    join(homedir(), ".config", "typesafe-ai-jev-skill.json"),
  );
  assert.doesNotMatch(DEFAULT_CONFIG_PATH, /\.minimax/);
});
