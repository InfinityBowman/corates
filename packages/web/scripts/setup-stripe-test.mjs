/**
 * Stripe Test Setup Script
 * Creates the Stripe products and prices from @corates/shared/plans, keyed by
 * lookup key so the app needs no price ids, then writes the key and webhook
 * secrets to .env
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... pnpm stripe:setup
 *   pnpm stripe:setup -- --key sk_test_...
 *   pnpm stripe:setup -- --dry-run
 *   pnpm stripe:setup -- --force
 */

import Stripe from 'stripe';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { spawn } from 'node:child_process';
import { getAllStripeProductConfigs } from '@corates/shared/plans';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workersDir = join(__dirname, '..');
const envPath = join(workersDir, '.env');

// Load environment variables from .env file
dotenv.config({ path: envPath });

// Product/Price definitions from shared plans package
const PRODUCTS = getAllStripeProductConfigs();

// The signing secret is per Stripe CLI session, not per target, so the one
// captured here also serves the e2e listener that dev:test runs against 3010.
const WEBHOOK_FORWARD_URL = 'https://corates.localhost/api/auth/stripe/webhook';

function parseArgs(argv) {
  const args = {
    key: null,
    dryRun: false,
    force: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token === '--') {
      continue;
    }

    if (token === '--key' || token === '-k') {
      args.key = argv[i + 1] || null;
      i++;
      continue;
    }

    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (token === '--force' || token === '-f') {
      args.force = true;
      continue;
    }

    if (token.startsWith('-')) {
      throw new Error(`Unknown flag: ${token}`);
    }
  }

  return args;
}

async function validateStripeKey(key) {
  if (!key) {
    throw new Error('Stripe secret key is required');
  }
  if (!key.startsWith('sk_test_') && !key.startsWith('sk_live_')) {
    throw new Error('Stripe secret key must start with sk_test_ or sk_live_');
  }
  if (key.startsWith('sk_live_')) {
    console.warn('⚠️  WARNING: Using LIVE key! This script is intended for test mode only.');
    const { default: readline } = await import('node:readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve, reject) => {
      rl.question('Continue anyway? (yes/no): ', answer => {
        rl.close();
        if (answer.toLowerCase() !== 'yes') {
          reject(new Error('Aborted: Live key usage cancelled'));
        } else {
          resolve();
        }
      });
    });
  }
}

function readEnvFile() {
  if (!existsSync(envPath)) {
    return {};
  }

  const content = readFileSync(envPath, 'utf-8');
  const env = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      env[key] = value;
    }
  }

  return env;
}

function writeEnvFile(env) {
  const stripeKeys = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET_AUTH'];

  // Track which Stripe keys we've updated
  const updatedKeys = new Set();

  // Read existing file line by line to preserve structure
  let fileLines = [];
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    fileLines = content.split('\n');
  }

  // Update existing STRIPE_ lines in place
  const newLines = fileLines.map(line => {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) {
      return line;
    }

    // Check if this line is a STRIPE_ variable
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      if (stripeKeys.includes(key) && env[key] !== undefined) {
        updatedKeys.add(key);
        // Preserve original line ending (trailing spaces, etc.)
        const originalIndent = line.match(/^\s*/)?.[0] || '';
        return `${originalIndent}${key}=${env[key]}`;
      }
    }

    return line;
  });

  // Add any Stripe keys that weren't in the file
  const missingKeys = stripeKeys.filter(key => !updatedKeys.has(key) && env[key] !== undefined);

  if (missingKeys.length > 0) {
    // Add a newline if file doesn't end with one
    if (newLines.length > 0 && newLines[newLines.length - 1] !== '') {
      newLines.push('');
    }

    // Add comment if there are multiple missing keys
    if (missingKeys.length > 1) {
      newLines.push('# Stripe Configuration');
    }

    // Add missing keys
    for (const key of missingKeys) {
      newLines.push(`${key}=${env[key]}`);
    }
  }

  // Write back to file, preserving line endings
  const content = newLines.join('\n');
  // Ensure file ends with newline
  const finalContent = content.endsWith('\n') ? content : content + '\n';
  writeFileSync(envPath, finalContent, 'utf-8');
}

/**
 * Get webhook secret from stripe listen command
 * Spawns the process, captures the secret from output, then kills it
 */
async function getWebhookSecret(forwardTo, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const args = ['listen', '--forward-to', forwardTo];
    // portless serves the dev app over a locally issued certificate
    if (forwardTo.startsWith('https://')) args.push('--skip-verify');
    const stripeProcess = spawn('stripe', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let secret = null;
    let timeoutId = null;

    function checkForSecret(text) {
      // Look for webhook secret in output
      // Stripe CLI outputs: "> Ready! ... Your webhook signing secret is whsec_... (^C to quit)"
      // Pattern: whsec_ followed by alphanumeric characters
      const match = text.match(/whsec_[a-zA-Z0-9]+/);
      if (match && match[0]) {
        secret = match[0];
        if (timeoutId) {
          globalThis.clearTimeout(timeoutId);
        }
        stripeProcess.kill('SIGINT');
        resolve(secret);
        return true;
      }
      return false;
    }

    stripeProcess.stdout.on('data', data => {
      const text = data.toString();
      stdout += text;
      checkForSecret(text);
    });

    stripeProcess.stderr.on('data', data => {
      const text = data.toString();
      stderr += text;
      // Stripe CLI might output to stderr
      checkForSecret(text);
    });

    stripeProcess.on('close', code => {
      if (secret) {
        // Already resolved
        return;
      }
      if (code === null || code === 0 || code === 130 || code === 2) {
        // Process was killed (SIGINT = 130, or exited normally)
        // Check combined output one more time
        const combined = stdout + stderr;
        const match = combined.match(/whsec_[a-zA-Z0-9]+/);
        if (match && match[0]) {
          resolve(match[0]);
        } else {
          reject(new Error('Webhook secret not found in output'));
        }
      } else {
        reject(new Error(`stripe listen exited with code ${code}: ${stderr || stdout}`));
      }
    });

    stripeProcess.on('error', err => {
      if (timeoutId) {
        globalThis.clearTimeout(timeoutId);
      }
      reject(new Error(`Failed to start stripe listen: ${err.message}`));
    });

    // Timeout fallback
    timeoutId = globalThis.setTimeout(() => {
      if (!secret) {
        stripeProcess.kill('SIGINT');
        reject(new Error('Timeout waiting for webhook secret'));
      }
    }, timeout);
  });
}

async function findExistingProduct(stripe, productName) {
  // Archived products keep their names, so only look at live ones.
  const products = await stripe.products.list({ active: true, limit: 100 });
  return products.data.find(p => p.name === productName);
}

async function findPriceByLookupKey(stripe, lookupKey) {
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  return prices.data[0] ?? null;
}

async function createProductAndPrices(stripe, productDef, dryRun, force) {
  const results = {};

  // Find or create product. A dry run without a key has no client to look with.
  let product = stripe ? await findExistingProduct(stripe, productDef.name) : null;

  if (product && force) {
    console.log(`🗑️  Deleting existing product: ${productDef.name} (${product.id})`);
    if (!dryRun) {
      await stripe.products.del(product.id);
      product = null;
    }
  }

  if (!product) {
    console.log(`📦 Creating product: ${productDef.name}`);
    if (!dryRun) {
      product = await stripe.products.create({
        name: productDef.name,
        description: productDef.description,
        metadata: {
          created_by: 'corates-setup-script',
        },
      });
      console.log(`   ✓ Created: ${product.id}`);
    } else {
      console.log(`   [DRY RUN] Would create product`);
      product = { id: 'prod_dryrun' };
    }
  } else {
    console.log(`✓ Product exists: ${productDef.name} (${product.id})`);
  }

  // Create prices. A price whose lookup key already points at the right amount
  // is reused; any other amount gets a new price and the key moves to it, so
  // existing subscriptions keep their old price object untouched.
  for (const priceDef of productDef.prices) {
    let price = null;
    if (product.id !== 'prod_dryrun') {
      price = await findPriceByLookupKey(stripe, priceDef.lookupKey);
    }

    if (price && (force || price.unit_amount !== priceDef.amount || price.product !== product.id)) {
      console.log(
        `↪️  ${priceDef.lookupKey} points at ${price.id} ($${(price.unit_amount / 100).toFixed(2)}); moving the key to a new price`,
      );
      price = null;
    }

    if (!price) {
      const amountDisplay = (priceDef.amount / 100).toFixed(2);
      console.log(
        `💰 Creating ${priceDef.lookupKey}: $${amountDisplay} ${priceDef.currency.toUpperCase()}`,
      );
      if (!dryRun) {
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: priceDef.amount,
          currency: priceDef.currency,
          recurring: { interval: priceDef.type === 'monthly' ? 'month' : 'year' },
          lookup_key: priceDef.lookupKey,
          transfer_lookup_key: true,
          metadata: { created_by: 'corates-setup-script' },
        });
        console.log(`   ✓ Created: ${price.id}`);
      } else {
        console.log(`   [DRY RUN] Would create price`);
        price = { id: 'price_dryrun' };
      }
    } else {
      console.log(`✓ ${priceDef.lookupKey} -> ${price.id}`);
    }

    results[priceDef.lookupKey] = price.id;
  }

  return results;
}

function printUsage() {
  console.log(`Usage:
  pnpm stripe:setup [options]

Options:
  --key, -k <key>        Stripe secret key (or set STRIPE_SECRET_KEY env var)
  --dry-run              Preview what would be created without making changes
  --force, -f            Delete and recreate existing products/prices

Examples:
  STRIPE_SECRET_KEY=sk_test_... pnpm stripe:setup
  pnpm stripe:setup -- --key sk_test_...
  pnpm stripe:setup -- --dry-run
  pnpm stripe:setup -- --force`);
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(String(err?.message || err));
    printUsage();
    process.exit(2);
  }

  // Try to get key from: CLI arg > env var > .env file
  const envFile = readEnvFile();
  const stripeKey = args.key || process.env.STRIPE_SECRET_KEY || envFile.STRIPE_SECRET_KEY;

  if (!stripeKey && !args.dryRun) {
    console.error(
      'Stripe secret key is required (use --key, STRIPE_SECRET_KEY env var, or add to .env file)',
    );
    printUsage();
    process.exit(2);
  }

  if (stripeKey) {
    try {
      await validateStripeKey(stripeKey);
    } catch (err) {
      console.error(String(err?.message || err));
      process.exit(1);
    }
  }

  if (args.dryRun && !stripeKey) {
    console.log('⚠️  DRY RUN MODE: Using placeholder key for preview');
  }

  // Keep in sync with STRIPE_API_VERSION in src/lib/stripe.ts
  const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2026-02-25.clover' }) : null;

  console.log('🚀 Setting up Stripe test products and prices...\n');

  if (args.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  const env = readEnvFile();

  // Create products and prices
  for (const productDef of PRODUCTS) {
    try {
      await createProductAndPrices(stripe, productDef, args.dryRun, args.force);
    } catch (error) {
      console.error(`❌ Error creating ${productDef.name}:`, error.message);
      if (!args.dryRun) {
        process.exit(1);
      }
    }
  }

  // Update .env file
  if (!args.dryRun) {
    const updatedEnv = { ...env };
    if (stripeKey) {
      updatedEnv.STRIPE_SECRET_KEY = stripeKey;
    }
    writeEnvFile(updatedEnv);
    console.log(`\n✅ Updated ${envPath} with Stripe configuration`);
  }

  // Try to get webhook secrets automatically
  const currentEnv = readEnvFile();
  const needsAuthSecret =
    !currentEnv.STRIPE_WEBHOOK_SECRET_AUTH || currentEnv.STRIPE_WEBHOOK_SECRET_AUTH.startsWith('#');

  if (needsAuthSecret && !args.dryRun) {
    console.log('\n🔐 Attempting to get webhook secrets from Stripe CLI...');
    console.log('   (Make sure Stripe CLI is installed and authenticated: stripe login)');

    const webhookSecrets = {};

    try {
      console.log('   Getting webhook secret for auth endpoint...');
      const secret = await getWebhookSecret(WEBHOOK_FORWARD_URL);
      webhookSecrets.STRIPE_WEBHOOK_SECRET_AUTH = secret;
      console.log(`   ✓ Got auth webhook secret: ${secret.substring(0, 20)}...`);
    } catch (error) {
      console.warn(`   ⚠️  Could not get auth webhook secret: ${error.message}`);
      console.warn('   You can get it manually by running:');
      console.warn(`   stripe listen --forward-to ${WEBHOOK_FORWARD_URL} --skip-verify`);
    }

    // Update .env with webhook secrets if we got them
    if (Object.keys(webhookSecrets).length > 0) {
      const updatedEnv = {
        ...env,
        ...webhookSecrets,
      };
      if (stripeKey) {
        updatedEnv.STRIPE_SECRET_KEY = stripeKey;
      }
      writeEnvFile(updatedEnv);
      console.log('   ✓ Updated .env with webhook secrets');
    }
  }

  if (needsAuthSecret) {
    console.log('\n📝 Next steps:');
    console.log('1. Get auth webhook secret:');
    console.log(`   stripe listen --forward-to ${WEBHOOK_FORWARD_URL} --skip-verify`);
    console.log('2. Copy the whsec_... value and add it to your .env file');
    console.log('3. Restart your dev server');
  } else {
    console.log('\n✅ Setup complete! All Stripe configuration is in place.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err?.message || err);
  process.exit(1);
});
