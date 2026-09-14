/**
 * Start a persistent local Postgres for Agent 58 (no Docker / no Neon).
 * Uses the x64 embedded-postgres binaries (works on Windows ARM via emulation).
 * Keep this process running while the API is in use.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { Client } = require('pg');

const PORT = Number(process.env.LOCAL_PG_PORT || 5432);
const USER = 'agent58';
const PASSWORD = 'agent58_local_dev';
const DATABASE = 'agent58';
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, '.local-pg');
const LOG_FILE = path.join(DATA_DIR, 'postgres.log');
const BIN_PKG = path.join(ROOT, 'node_modules', '@embedded-postgres', 'windows-x64');
const TARBALL = path.join(ROOT, 'embedded-postgres-windows-x64-18.4.0-beta.17.tgz');

function binEnv() {
  const native = path.join(BIN_PKG, 'native');
  const binDir = path.join(native, 'bin');
  const libDir = path.join(native, 'lib');
  return {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${libDir}${path.delimiter}${process.env.PATH || ''}`,
    PGDATA: DATA_DIR,
  };
}

function exe(name) {
  return path.join(BIN_PKG, 'native', 'bin', `${name}.exe`);
}

async function canConnect(database = DATABASE) {
  const client = new Client({
    host: '127.0.0.1',
    port: PORT,
    user: USER,
    password: PASSWORD,
    database,
    connectionTimeoutMillis: 2500,
  });
  try {
    await client.connect();
    await client.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

function ensureBinaries() {
  if (fs.existsSync(exe('postgres')) && fs.existsSync(exe('initdb')) && fs.existsSync(exe('pg_ctl'))) {
    return;
  }
  if (!fs.existsSync(TARBALL)) {
    throw new Error(
      'Postgres binaries missing. From backend/ run: npm pack @embedded-postgres/windows-x64@18.4.0-beta.17',
    );
  }
  fs.mkdirSync(BIN_PKG, { recursive: true });
  const unpacked = spawnSync('tar', ['-xzf', TARBALL, '-C', BIN_PKG], { stdio: 'inherit' });
  if (unpacked.status !== 0) {
    throw new Error('Failed to extract Postgres binaries tarball');
  }
  const nested = path.join(BIN_PKG, 'package');
  if (fs.existsSync(nested)) {
    for (const entry of fs.readdirSync(nested)) {
      fs.cpSync(path.join(nested, entry), path.join(BIN_PKG, entry), { recursive: true, force: true });
    }
    fs.rmSync(nested, { recursive: true, force: true });
  }
  if (!fs.existsSync(exe('postgres'))) {
    throw new Error('Postgres binaries still missing after extract');
  }
}

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    env: binEnv(),
    encoding: 'utf8',
    windowsHide: true,
    ...opts,
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').toString().trim();
    throw new Error(`${path.basename(command)} failed: ${err || `exit ${result.status}`}`);
  }
  return result;
}

function initialiseCluster() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))) return;

  const pwFile = path.join(os.tmpdir(), `agent58-pg-password-${process.pid}.txt`);
  fs.writeFileSync(pwFile, `${PASSWORD}\n`);
  try {
    console.log('Initializing local Postgres cluster…');
    run(exe('initdb'), [
      `--pgdata=${DATA_DIR}`,
      '--auth=password',
      `--username=${USER}`,
      `--pwfile=${pwFile}`,
      '--lc-messages=C',
      '--encoding=UTF8',
      '--locale=C',
    ]);
  } finally {
    try {
      fs.unlinkSync(pwFile);
    } catch {
      /* ignore */
    }
  }

  const confPath = path.join(DATA_DIR, 'postgresql.conf');
  let conf = fs.readFileSync(confPath, 'utf8');
  if (!/listen_addresses\s*=/.test(conf) || /#listen_addresses/.test(conf)) {
    conf += `\nlisten_addresses = '127.0.0.1'\nport = ${PORT}\n`;
    fs.writeFileSync(confPath, conf);
  }
}

function startCluster() {
  console.log(`Starting local Postgres on 127.0.0.1:${PORT}…`);
  // Do not use pg_ctl -w: it can hang under Windows ARM x64 emulation
  // even after the server is accepting connections.
  run(exe('pg_ctl'), ['-D', DATA_DIR, '-l', LOG_FILE, '-o', `-p ${PORT}`, 'start']);
}

async function waitUntilReady(tries = 30) {
  for (let i = 1; i <= tries; i++) {
    if (await canConnect('postgres') || await canConnect(DATABASE)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  let log = '';
  try {
    log = fs.readFileSync(LOG_FILE, 'utf8').slice(-2000);
  } catch {
    /* ignore */
  }
  throw new Error(`Postgres did not become ready.\n${log}`);
}

async function ensureDatabase() {
  if (await canConnect(DATABASE)) return;
  const admin = new Client({
    host: '127.0.0.1',
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: 'postgres',
    connectionTimeoutMillis: 5000,
  });
  await admin.connect();
  try {
    const found = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [DATABASE]);
    if (!found.rowCount) {
      await admin.query(`CREATE DATABASE "${DATABASE}" OWNER "${USER}"`);
    }
  } finally {
    await admin.end();
  }
}

async function main() {
  if (await canConnect(DATABASE)) {
    console.log(`LOCAL_PG_READY postgresql://${USER}@127.0.0.1:${PORT}/${DATABASE}`);
    await new Promise(() => {});
    return;
  }

  ensureBinaries();
  initialiseCluster();
  startCluster();
  await waitUntilReady();
  await ensureDatabase();

  if (!(await canConnect(DATABASE))) {
    throw new Error('Local Postgres started but Agent 58 could not connect');
  }

  console.log(`LOCAL_PG_READY postgresql://${USER}@127.0.0.1:${PORT}/${DATABASE}`);
  await new Promise(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
