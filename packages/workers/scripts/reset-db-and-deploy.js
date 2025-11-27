const { execSync } = require('child_process');

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

try {
  // Drop tables
  run(
    'pnpx wrangler d1 execute corates-db-prod --remote --command "DROP TABLE IF EXISTS session;"',
  );
  run('pnpx wrangler d1 execute corates-db-prod --remote --command "DROP TABLE IF EXISTS user;"');
  run(
    'pnpx wrangler d1 execute corates-db-prod --remote --command "DROP TABLE IF EXISTS account;"',
  );
  run(
    'pnpx wrangler d1 execute corates-db-prod --remote --command "DROP TABLE IF EXISTS verification;"',
  );

  // Re-run migration
  run('pnpx wrangler d1 execute corates-db-prod --remote --file=migrations/0001_init.sql');

  // Redeploy workers
  run('pnpx wrangler deploy --env production');

  console.log('\n✅ Database reset and workers redeployed!');
} catch (err) {
  console.error('\n❌ Error during reset/redeploy:', err);
  process.exit(1);
}
