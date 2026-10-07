import { DatastoreCliError, type CliEnvironment, type CliOptions, type CliProvider } from './types';

const PROVIDERS: readonly CliProvider[] = ['mysql', 'postgres', 'sqlite', 'redis', 'mongodb'];
const FLAGS = new Set(['connection', 'session', 'provider', 'schema', 'table', 'database', 'collection', 'query', 'file', 'out', 'timeout', 'limit', 'offset', 'format', 'url']);
const SWITCHES = new Set(['help', 'json', 'csv', 'overwrite']);

function fail(message: string): never {
  throw new DatastoreCliError(message, 2, 'invalid_arguments');
}

function integer(value: string | undefined, fallback: number, minimum: number, maximum: number, flag: string): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) fail(`--${flag} requires an integer`);
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) fail(`--${flag} must be between ${minimum} and ${maximum}`);
  return result;
}

function timeout(value: string | undefined): number {
  if (value === undefined) return 30_000;
  const match = /^(\d+)(ms|s|m)?$/.exec(value);
  if (!match) fail('--timeout requires milliseconds or an integer with ms/s/m suffix');
  const result = Number(match[1]) * (match[2] === 'm' ? 60_000 : match[2] === 's' ? 1000 : 1);
  if (!Number.isSafeInteger(result) || result < 1000 || result > 600_000) fail('--timeout must be between 1000ms and 10m');
  return result;
}

function named(value: string | undefined, flag: string, maximum = 1024): string | null {
  if (value === undefined) return null;
  if (!value.trim() || value.length > maximum || /[\0\r\n]/.test(value)) fail(`--${flag} is empty or invalid`);
  return value;
}

export function parseDatastoreCliArgs(args: readonly string[], environment: CliEnvironment = {}): CliOptions {
  const values = new Map<string, string>();
  const switches = new Set<string>();
  const command: string[] = [];
  let positional = false;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--' && !positional) {
      positional = true;
      continue;
    }
    if (argument === '-h' && !positional) {
      switches.add('help');
      continue;
    }
    if (!argument.startsWith('--') || positional) {
      command.push(argument);
      continue;
    }
    const equal = argument.indexOf('=');
    const flag = argument.slice(2, equal < 0 ? undefined : equal);
    if (SWITCHES.has(flag)) {
      if (equal >= 0) fail(`--${flag} takes no value`);
      if (switches.has(flag)) fail(`--${flag} specified twice`);
      switches.add(flag);
      continue;
    }
    if (!FLAGS.has(flag)) fail(`Unknown option --${flag}`);
    if (values.has(flag)) fail(`--${flag} specified twice`);
    const value = equal >= 0 ? argument.slice(equal + 1) : args[++index];
    if (value === undefined || (!value && flag !== 'query') || (equal < 0 && value.startsWith('--'))) fail(`--${flag} requires a value`);
    values.set(flag, value);
  }
  if (switches.has('json') && switches.has('csv')) fail('Select one output format');
  if (values.has('format') && (switches.has('json') || switches.has('csv'))) fail('--format cannot be combined with --json/--csv');
  const format = switches.has('json') ? 'json' : switches.has('csv') ? 'csv' : values.get('format') ?? 'table';
  if (!['table', 'json', 'csv'].includes(format)) fail('--format must be table, json or csv');
  const provider = values.get('provider');
  if (provider !== undefined && !PROVIDERS.includes(provider as CliProvider)) fail('--provider must be mysql, postgres, sqlite, redis or mongodb');
  const url = values.get('url') ?? environment.FOUC_DEVICE_URL ?? 'http://127.0.0.1:8710';
  let endpoint: URL;
  try { endpoint = new URL(url); } catch { fail('--url requires an absolute HTTP(S) device endpoint'); }
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) fail('--url must be HTTP(S) without credentials, query or fragment');
  if (endpoint.pathname !== '/' && endpoint.pathname !== '') fail('--url must be the device origin; API subpaths are resolved by this CLI');
  const query = values.get('query') ?? null;
  if (query !== null && Buffer.byteLength(query, 'utf8') > 1_000_000) fail('--query exceeds 1 MB');
  if (query !== null && values.has('file')) fail('Select --query or --file');
  const connection = named(values.get('connection') ?? environment.FOUC_CONNECTION_ID, 'connection', 120);
  const session = named(values.get('session'), 'session', 128);
  if (connection && session) fail('Select --connection or --session');
  return {
    command,
    connection,
    session,
    provider: provider as CliProvider | undefined ?? null,
    schema: named(values.get('schema'), 'schema'),
    table: named(values.get('table'), 'table'),
    database: named(values.get('database'), 'database'),
    collection: named(values.get('collection'), 'collection'),
    query,
    file: named(values.get('file'), 'file', 4096),
    output: named(values.get('out'), 'out', 4096),
    overwrite: switches.has('overwrite'),
    timeout: timeout(values.get('timeout')),
    limit: integer(values.get('limit'), 100, 1, 5000, 'limit'),
    offset: integer(values.get('offset'), 0, 0, 10_000_000, 'offset'),
    format: format as CliOptions['format'],
    url: endpoint.origin,
    help: switches.has('help') || command.length === 0,
  };
}

export const DATASTORE_CLI_HELP = `Fouc datastore CLI — native device HTTP bridge, readonly operations

Usage: pnpm datastore:cli <command> [options]

  doctor                         Device health and reachable runtime
  capabilities                   Supported native command families and readonly policy
  connections list               Device public connection directory
  connect                        Open an explicit readonly session (caller owns closing it)
  disconnect                     Close the explicitly selected --session
  schemas list                   Relational schemas / Mongo databases
  tables list                    Relational tables / Mongo collections
  describe                       Native relational table structure
  rows                           One bounded page of relational rows
  query                          Registered, cancellable relational SQL execution
  context                        Native database documentation snapshot
  dbml                           Native DBML snapshot export
  docs                           Native Markdown snapshot export
  redis scan                     One native SCAN page; cursor is never expanded to writes
  redis value                    One native value page (--query is canonical Base64 key)
  mongo documents                Native filtered document page (--query is canonical EJSON)

Session scope: --session <id> --provider <type>, or --connection <id|unique name>
Targets: --schema <name> --table <name>, or --database <name> --collection <name>
SQL: --query <sql> or --file <utf8.sql>; --limit 1..5000 --timeout 1000ms..10m
Output: --format table|json|csv / --json / --csv; --out <path> [--overwrite]
Endpoint: --url <origin> (default http://127.0.0.1:8710)

Environment secrets: FOUC_DEVICE_TOKEN, FOUC_CONNECTION_PASSWORD,
FOUC_CONNECTION_OPTIONS_JSON (temporary TLS certificate inputs).
Secrets are never accepted as CLI flags or written to the connection directory.
Implicit sessions created for a single command close on completion/error/cancel.
Native server readonly gates remain authoritative; write flags are unsupported.
Exit codes: 0 success, 1 operation failure, 2 arguments, 3 authentication, 4 timeout, 130 interrupt.
`;
