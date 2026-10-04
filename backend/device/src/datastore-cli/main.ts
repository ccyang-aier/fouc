import { DATASTORE_CLI_HELP, parseDatastoreCliArgs } from './args';
import { executeDatastoreCli } from './commands';
import { formatCliResult } from './format';
import { DatastoreHttpClient } from './http';
import { writeCliOutput } from './output';
import { DatastoreCliError, type CliEnvironment, type CliIo, type CliOptions } from './types';

function safeMessage(message: string, environment: CliEnvironment): string {
  let text = message;
  for (const name of ['FOUC_DEVICE_TOKEN', 'FOUC_CONNECTION_PASSWORD', 'FOUC_CONNECTION_OPTIONS_JSON']) {
    const value = environment[name];
    if (value) text = text.replaceAll(value, '[redacted]');
  }
  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
}

export async function runDatastoreCli(args: readonly string[], environment: CliEnvironment, io: CliIo, signal?: AbortSignal): Promise<number> {
  let options: CliOptions | null = null;
  try {
    options = parseDatastoreCliArgs(args, environment);
    if (options.help) {
      io.stdout(DATASTORE_CLI_HELP);
      return 0;
    }
    const client = new DatastoreHttpClient(options.url, environment, options.timeout, signal);
    const result = await executeDatastoreCli(client, options, environment, signal);
    const text = formatCliResult(result, options.format);
    if (options.output) {
      await writeCliOutput(options.output, text, options.overwrite);
      io.stderr(`Saved ${Buffer.byteLength(text, 'utf8')} bytes to ${options.output}\n`);
    } else io.stdout(text);
    if (options.format !== 'json') for (const warning of result.warnings ?? []) io.stderr('Warning: ' + safeMessage(warning, environment) + '\n');
    return 0;
  } catch (reason) {
    const error = reason instanceof DatastoreCliError ? reason : new DatastoreCliError(reason instanceof Error ? reason.message : String(reason));
    const message = safeMessage(error.message, environment);
    const json = options?.format === 'json' || args.includes('--json') || args.includes('--format=json');
    if (json) io.stderr(JSON.stringify({ ok: false, error: { code: error.code, message, exitCode: error.exitCode } }) + '\n');
    else io.stderr('Error: ' + message + '\n');
    return error.exitCode;
  }
}
