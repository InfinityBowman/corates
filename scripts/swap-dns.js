#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const hostsFile = '/etc/hosts';
const devEntry = '127.0.0.1   corates.org www.corates.org';
const prodEntry = '#127.0.0.1   corates.org www.corates.org'; // commented out for prod

const action = process.argv[2]; // 'dev' or 'prod'

if (!['dev', 'prod'].includes(action)) {
  console.error('Usage: node swap-dns.js <dev|prod>');
  process.exit(1);
}

let hosts = fs.readFileSync(hostsFile, 'utf-8').split('\n');

// Remove any existing dev entry
hosts = hosts.filter(line => !line.includes('corates.org'));

// Add new entry if dev
if (action === 'dev') {
  hosts.push(devEntry);
} else {
  hosts.push(prodEntry);
}

// Need sudo to write to /etc/hosts
try {
  fs.writeFileSync(hostsFile, hosts.join('\n'), { encoding: 'utf-8' });
  console.log(`Switched hosts to ${action}`);
} catch (err) {
  console.error('Failed to write to hosts file. Try running with sudo.');
  console.error(err);
}
