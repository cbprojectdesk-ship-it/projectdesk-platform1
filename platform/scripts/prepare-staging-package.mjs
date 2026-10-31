// Prepare a local package only. Authentication and deployment gates remain separate.
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

export function stagingPackage(compiled, staging) {
  const db = staging.d1_databases;
  if (staging.name !== 'quenvira-staging' || staging.workers_dev !== false ||
      db?.length !== 1 || db[0].binding !== 'DB' ||
      db[0].database_name !== 'quenvira-staging' ||
      db[0].database_id !== 'a91be5bb-6565-473e-98c2-40e83bc0e2d5') {
    throw new Error('Staging identity or database differs from the reviewed configuration.');
  }
  if (staging.vars?.QUENVIRA_HOSTING_MODE !== 'standalone' ||
      staging.vars?.QUENVIRA_BILLING_MODE !== 'test' ||
      staging.vars?.QUENVIRA_PAID_LAUNCH_APPROVED !== 'false') {
    throw new Error('Staging safety settings changed; review before packaging.');
  }
  if (compiled.main !== 'index.js' || compiled.no_bundle !== true ||
      compiled.assets?.directory !== '../client') {
    throw new Error('Expected the generated Vinext dist/server package. Run pnpm build first.');
  }
  // This staging setup currently supports DB only. Never silently drop or reuse
  // another environment's service/storage bindings when the application changes.
  for (const key of ['r2_buckets','services','kv_namespaces','workflows','dispatch_namespaces',
    'hyperdrive','vectorize','send_email','secrets_store_secrets']) {
    if (compiled[key]?.length) throw new Error('Unreviewed generated binding: ' + key);
  }
  if (compiled.durable_objects?.bindings?.length || compiled.queues?.producers?.length ||
      compiled.queues?.consumers?.length) throw new Error('Unreviewed generated background binding.');
  // Deliberately allowlist generated fields: never inherit vars, routes, account
  // selection or scheduled triggers from a development/managed configuration.
  return {
    name: staging.name,
    main: compiled.main,
    no_bundle: true,
    compatibility_date: staging.compatibility_date,
    compatibility_flags: staging.compatibility_flags,
    rules: compiled.rules,
    assets: {...compiled.assets, run_worker_first: true},
    workers_dev: false,
    preview_urls: false,
    routes: [],
    vars: {
      QUENVIRA_HOSTING_MODE: 'standalone',
      QUENVIRA_BILLING_MODE: 'test',
      QUENVIRA_PAID_LAUNCH_APPROVED: 'false',
      QUENVIRA_SELF_SERVE: 'no',
      QUENVIRA_EMAIL_MODE: 'test',
    },
    d1_databases: db,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const compiledPath = resolve(root, 'dist/server/wrangler.json');
    const output = resolve(root, 'dist/server/wrangler.staging.json');
    const compiled = JSON.parse(readFileSync(compiledPath, 'utf8'));
    const staging = JSON.parse(readFileSync(resolve(root, 'wrangler.staging.jsonc'), 'utf8'));
    const config = stagingPackage(compiled, staging);
    if (!existsSync(resolve(dirname(compiledPath), config.main)) ||
        !existsSync(resolve(dirname(compiledPath), config.assets.directory))) {
      throw new Error('Compiled Worker or client assets missing; run pnpm build first.');
    }
    writeFileSync(output, JSON.stringify(config, null, 2) + '\n', {mode: 0o600});
    console.log('Prepared dist/server/wrangler.staging.json using the reviewed staging DB.');
    console.log('Local package only. No deploy, migration, email or billing action performed.');
    console.log('Deployment BLOCKED pending verified Cloudflare Access configuration and release evidence.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
