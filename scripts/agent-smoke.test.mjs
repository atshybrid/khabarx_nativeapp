#!/usr/bin/env node
// Lightweight smoke test to validate prompts/registry.yaml integrity and basic templates.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const registryPath = path.join(root, 'prompts', 'registry.yaml');

function fail(msg) {
  console.error(`SMOKE: FAIL - ${msg}`);
  process.exit(1);
}
function ok(msg) {
  console.log(`SMOKE: OK - ${msg}`);
}

if (!fs.existsSync(registryPath)) fail('prompts/registry.yaml not found');
const text = fs.readFileSync(registryPath, 'utf8');

// Minimal YAML checks (avoid extra deps):
if (!/version:\s*\d+/.test(text)) fail('missing version');
if (!/prompts:\r?\n/.test(text)) fail('missing prompts list');
if (!/id:\s*"?newsbuddy_base_system"?/.test(text)) fail('missing base system id');

// Check at least three tasks
const ids = [...text.matchAll(/\n\s*-\s+id:\s*"?([a-zA-Z0-9_\-]+)"?/g)].map(m => m[1]);
if (ids.length < 3) fail('expected >= 3 prompt entries');
ok(`found ${ids.length} prompt entries`);

// Check templates include placeholders and do not have obvious syntax errors
if (!/template:\s*\|[\s\S]*{{/.test(text)) fail('no handlebars-style placeholders found in templates');
ok('templates include placeholders');

// Quick render sanity: ensure base system reference token appears
if (!/System:\s*{{newsbuddy_base_system}}/.test(text)) fail('tasks do not reference base system');
ok('tasks reference base system');

console.log('SMOKE: PASS');
