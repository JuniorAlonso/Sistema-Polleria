#!/usr/bin/env node
/**
 * Minimal REST Client (humao.rest-client) compatible runner.
 *
 * Executes .http files sequentially against the running backend and asserts the
 * expected status of every request. Supported syntax (REST Client subset):
 *   - `###` request separators, `# @name foo` named requests
 *   - file variables `@VAR = value` (resolved lazily, cached once per file)
 *   - `{{VAR}}`, `{{name.response.body.$.a.b[0]}}`, `{{name.response.headers.X}}`
 *   - `{{$guid}}`, `{{$timestamp}}`, `{{$randomInt a b}}`, `{{$dotenv NAME}}`,
 *     `{{$datetime iso8601}}`, `{{$localDatetime 'YYYY-MM-DD'}}`
 *   - body lines `< ./relative/file` (inlined as binary, useful for multipart)
 *
 * Runner-only directives (plain comments, ignored by REST Client):
 *   # Esperado: HTTP 200            expected status; alternatives with | or ,
 *   # @assert $.path == value       JSON assertion (==, !=, exists, notExists, >=, <=, contains)
 *   # @otp VAR user@email           loads the latest unused 2FA code into VAR
 *   # @sql VAR SELECT ...           loads the first column of the first row into VAR
 *   # @sleep 1500                   waits before sending the request
 *
 * Usage: node runner/run-http.mjs [--verbose] [--bail] [file.http ...]
 *        (no files = every *.http in rest-tests, sorted by name)
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const BAIL = args.includes('--bail');
const files = args.filter((a) => !a.startsWith('--'));
const PG_CONTAINER = process.env.PG_CONTAINER || 'polleria-postgres';
const PG_USER = process.env.PG_USER || 'postgres';
const PG_DB = process.env.PG_DB || 'polleria';

function loadDotenv() {
  const env = {};
  for (const p of [join(ROOT, '..', 'polleria', '.env'), join(ROOT, '.env')]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}
const DOTENV = loadDotenv();

function sql(query) {
  const out = execFileSync('docker', ['exec', PG_CONTAINER, 'psql', '-U', PG_USER, '-d', PG_DB, '-Atc', query], {
    encoding: 'utf8',
  });
  return out.split(/\r?\n/)[0].split('|')[0].trim();
}

function parseFile(text) {
  const lines = text.split(/\r?\n/);
  const fileVars = {};
  const blocks = [];
  let current = [];
  for (const line of lines) {
    if (/^###/.test(line)) {
      blocks.push(current);
      current = [line];
    } else current.push(line);
  }
  blocks.push(current);

  const requests = [];
  for (const block of blocks) {
    const title = (block[0] || '').replace(/^###\s*/, '').trim();
    const meta = { title, name: null, expect: null, asserts: [], otp: [], sql: [], sleep: 0 };
    let i = block[0]?.startsWith('###') ? 1 : 0;
    let requestLine = null;
    for (; i < block.length; i++) {
      const line = block[i];
      const v = line.match(/^@([A-Za-z_][\w-]*)\s*=\s*(.*)$/);
      if (v) { fileVars[v[1]] = v[2].trim(); continue; }
      if (/^\s*(#|\/\/)/.test(line) || line.trim() === '') {
        const c = line.replace(/^\s*(#|\/\/)\s?/, '');
        let m;
        if ((m = c.match(/^@name\s+(\S+)/))) meta.name = m[1];
        else if ((m = c.match(/^Esperado:\s*HTTP\s*([\d\s|,/o]+)/i))) meta.expect = m[1].split(/[|,/]|\bo\b/).map((s) => Number(s.trim())).filter(Boolean);
        else if ((m = c.match(/^@assert\s+(.+)$/))) meta.asserts.push(m[1].trim());
        else if ((m = c.match(/^@otp\s+(\S+)\s+(\S+)/))) meta.otp.push([m[1], m[2]]);
        else if ((m = c.match(/^@sql\s+(\S+)\s+(.+)$/))) meta.sql.push([m[1], m[2]]);
        else if ((m = c.match(/^@sleep\s+(\d+)/))) meta.sleep = Number(m[1]);
        continue;
      }
      if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+/.test(line)) { requestLine = line; i++; break; }
    }
    if (!requestLine) continue;
    const headers = [];
    for (; i < block.length && block[i].trim() !== ''; i++) {
      if (/^\s*(#|\/\/)/.test(block[i])) continue;
      headers.push(block[i]);
    }
    let body = block.slice(i + 1);
    while (body.length && (body.at(-1).trim() === '' || /^\s*#/.test(body.at(-1)) || /^@[\w-]+\s*=/.test(body.at(-1)))) {
      const last = body.pop();
      const v = last.match(/^@([A-Za-z_][\w-]*)\s*=\s*(.*)$/);
      if (v) fileVars[v[1]] = v[2].trim();
    }
    requests.push({ ...meta, requestLine, headers, body });
  }
  return { fileVars, requests };
}

function jsonPath(obj, path) {
  const p = path.replace(/^\$\.?/, '');
  if (!p) return obj;
  const parts = p.match(/[^.[\]]+|\[\d+\]/g) || [];
  let cur = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = part.startsWith('[') ? cur[Number(part.slice(1, -1))] : cur[part];
  }
  return cur;
}

function makeResolver(fileVars, named, runtimeVars) {
  const cache = {};
  const resolveStr = (str, depth = 0) => {
    if (depth > 20) throw new Error('Variable recursion too deep');
    return str.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr) => {
      const val = resolveExpr(expr.trim(), depth);
      return typeof val === 'object' ? JSON.stringify(val) : String(val);
    });
  };
  const resolveExpr = (expr, depth) => {
    if (expr in runtimeVars) return runtimeVars[expr];
    if (expr.startsWith('$')) {
      const [fn, ...rest] = expr.split(/\s+/);
      switch (fn) {
        case '$guid': return randomUUID();
        case '$timestamp': return Math.floor(Date.now() / 1000);
        case '$randomInt': { const [a, b] = rest.map(Number); return Math.floor(a + Math.random() * (b - a)); }
        case '$dotenv': {
          const k = rest[0];
          if (!(k in DOTENV) && !(k in process.env)) throw new Error(`$dotenv ${k} is not defined`);
          return DOTENV[k] ?? process.env[k];
        }
        case '$datetime': return new Date().toISOString();
        case '$localDatetime': {
          const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
          const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          return /HH/.test(rest.join(' ')) ? `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` : date;
        }
        default: throw new Error(`Unsupported system variable ${fn}`);
      }
    }
    const m = expr.match(/^([\w-]+)\.response\.(body|headers)(?:\.(.*))?$/);
    if (m) {
      const res = named[m[1]];
      if (!res) throw new Error(`Named request "${m[1]}" has not run yet`);
      if (m[2] === 'headers') return res.headers.get(m[3]) ?? '';
      const v = m[3] ? jsonPath(res.json, m[3]) : res.text;
      if (v === undefined) throw new Error(`${expr} is undefined in response of "${m[1]}"`);
      return v;
    }
    if (expr in fileVars) {
      if (!(expr in cache)) cache[expr] = resolveStr(fileVars[expr], depth + 1);
      return cache[expr];
    }
    throw new Error(`Unknown variable {{${expr}}}`);
  };
  return resolveStr;
}

function checkAssert(expr, json) {
  const m = expr.match(/^(\$\S*)\s+(==|!=|>=|<=|contains|exists|notExists)\s*(.*)$/);
  if (!m) return `invalid assert "${expr}"`;
  const actual = jsonPath(json, m[1]);
  let expected = m[3].trim();
  try { expected = expected === '' ? undefined : JSON.parse(expected); } catch { /* raw string */ }
  const ok = {
    '==': () => JSON.stringify(actual) === JSON.stringify(expected) || String(actual) === String(expected),
    '!=': () => String(actual) !== String(expected),
    '>=': () => Number(actual) >= Number(expected),
    '<=': () => Number(actual) <= Number(expected),
    contains: () => JSON.stringify(actual ?? '').includes(String(expected)),
    exists: () => actual !== undefined && actual !== null,
    notExists: () => actual === undefined || actual === null,
  }[m[2]]();
  return ok ? null : `assert ${expr} failed (actual: ${JSON.stringify(actual)?.slice(0, 200)})`;
}

async function runFile(file) {
  const dir = dirname(file);
  const { fileVars, requests } = parseFile(readFileSync(file, 'utf8'));
  const named = {};
  const runtimeVars = {};
  const resolveStr = makeResolver(fileVars, named, runtimeVars);
  let pass = 0, fail = 0;
  console.log(`\n=== ${basename(file)} (${requests.length} requests)`);
  for (const r of requests) {
    let label = r.title || r.requestLine;
    try {
      if (r.sleep) await new Promise((ok) => setTimeout(ok, r.sleep));
      for (const [k, email] of r.otp) {
        const code = sql(`SELECT t.code FROM two_factor_tokens t JOIN users u ON u.id = t.user_id WHERE u.email = '${resolveStr(email).replace(/'/g, "''")}' AND t.used = false ORDER BY t.created_at DESC, t.id DESC LIMIT 1`);
        if (!code) throw new Error(`No pending 2FA code for ${email}`);
        runtimeVars[k] = code;
      }
      for (const [k, q] of r.sql) runtimeVars[k] = sql(resolveStr(q));
      const [, method, rawUrl] = r.requestLine.match(/^(\w+)\s+(\S+)/);
      const url = resolveStr(rawUrl);
      label = `${r.title || ''} [${method} ${url.replace(/^https?:\/\/[^/]+/, '')}]`;
      const headers = {};
      for (const h of r.headers) {
        const idx = h.indexOf(':');
        headers[h.slice(0, idx).trim()] = resolveStr(h.slice(idx + 1).trim());
      }
      let body;
      if (r.body.length) {
        const chunks = [];
        r.body.forEach((line, n) => {
          const inc = line.match(/^<\s+(.+)$/);
          if (inc) chunks.push(readFileSync(resolve(dir, resolveStr(inc[1].trim()))));
          else chunks.push(Buffer.from(resolveStr(line), 'utf8'));
          if (n < r.body.length - 1) chunks.push(Buffer.from('\r\n'));
        });
        body = Buffer.concat(chunks);
      }
      const res = await fetch(url, { method, headers, body, redirect: 'manual' });
      const text = await res.text();
      let json; try { json = JSON.parse(text); } catch { json = undefined; }
      if (r.name) named[r.name] = { status: res.status, headers: res.headers, text, json };
      const problems = [];
      if (r.expect && !r.expect.includes(res.status)) problems.push(`expected ${r.expect.join('|')} got ${res.status}`);
      if (!r.expect) problems.push(`missing "# Esperado: HTTP ..." (got ${res.status})`);
      for (const a of r.asserts) { const p = checkAssert(resolveStr(a), json); if (p) problems.push(p); }
      if (problems.length) {
        fail++;
        console.log(`  FAIL ${label}\n       ${problems.join('\n       ')}\n       body: ${text.slice(0, 400)}`);
        if (BAIL) break;
      } else {
        pass++;
        console.log(`  ok   ${res.status} ${label}${VERBOSE ? `\n       ${text.slice(0, 300)}` : ''}`);
      }
    } catch (e) {
      fail++;
      console.log(`  FAIL ${label}\n       ${e.message}`);
      if (BAIL) break;
    }
  }
  console.log(`--- ${basename(file)}: ${pass} ok, ${fail} failed`);
  return { pass, fail };
}

const targets = files.length
  ? files.map((f) => resolve(process.cwd(), f))
  : readdirSync(ROOT).filter((f) => f.endsWith('.http')).sort().map((f) => join(ROOT, f));
let total = { pass: 0, fail: 0 };
for (const f of targets) {
  const r = await runFile(f);
  total.pass += r.pass; total.fail += r.fail;
}
console.log(`\nTOTAL: ${total.pass} ok, ${total.fail} failed`);
process.exit(total.fail ? 1 : 0);
