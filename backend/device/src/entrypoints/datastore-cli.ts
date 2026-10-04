import { runDatastoreCli } from '../datastore-cli/main';

const controller = new AbortController();
const interrupt = () => controller.abort(new Error('Interrupted'));
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);
try {
  process.exitCode = await runDatastoreCli(process.argv.slice(2), process.env, {
    stdout: text => process.stdout.write(text),
    stderr: text => process.stderr.write(text),
  }, controller.signal);
} finally {
  process.removeListener('SIGINT', interrupt);
  process.removeListener('SIGTERM', interrupt);
}
