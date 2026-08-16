import { spawn } from 'child_process';
import { resolve } from 'path';
import fs from 'fs';

try {
  const envFile = fs.readFileSync('.env', 'utf8');
  const key = envFile.split('=')[1].trim();
  process.env.OPENAI_API_KEY = key;
} catch (e) {
  console.warn("Could not load .env file");
}

const tasks = ['stripe-webhooks'];
const groups = ['experimental-agentdocs'];
const seeds = [1, 2, 3];

async function runEval(task, group, seed) {
  console.log(`\n======================================================`);
  console.log(`Running: Task=${task}, Group=${group}, Seed=${seed}`);
  console.log(`======================================================\n`);

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      'node',
      ['scripts/eval-runner.mjs', '--task', task, '--group', group, '--seed', seed.toString()],
      { stdio: 'inherit', shell: true }
    );

    child.on('close', (code) => {
      if (code !== 0) {
        console.error(`Process exited with code ${code}`);
      }
      resolvePromise(code);
    });
  });
}

async function runAll() {
  for (const task of tasks) {
    for (const group of groups) {
      for (const seed of seeds) {
        await runEval(task, group, seed);
      }
    }
  }

  console.log('\nBenchmarking complete. Running aggregation...');
  const child = spawn('node', ['scripts/aggregate-metrics.mjs', ...tasks], { stdio: 'inherit', shell: true });
  child.on('close', () => console.log('Aggregation complete.'));
}

runAll().catch(console.error);
