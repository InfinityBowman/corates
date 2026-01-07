/**
 * SSRF (Server-Side Request Forgery) Protection
 *
 * Validates URLs to prevent requests to internal/private networks.
 * Used by the PDF proxy and any other endpoints that fetch external URLs.
 */

import { createDomainError, VALIDATION_ERRORS } from '@corates/shared';

// Private/internal IP ranges (RFC 1918, RFC 5735, RFC 6598)
const PRIVATE_IP_PATTERNS = [
  // IPv4 loopback
  /^127\./,
  // IPv4 private ranges
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  // IPv4 link-local
  /^169\.254\./,
  // IPv4 CGNAT (Carrier-grade NAT)
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./,
  // IPv4 documentation ranges
  /^192\.0\.2\./,
  /^198\.51\.100\./,
  /^203\.0\.113\./,
  // IPv4 broadcast
  /^255\.255\.255\.255$/,
  // IPv4 "this" network
  /^0\./,
];

// Blocked hostnames
const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  '*.localhost',
  '*.local',
  'metadata.google.internal', // GCP metadata
  '169.254.169.254', // Cloud metadata endpoint (AWS, GCP, Azure)
  'metadata.azure.com',
  'metadata.internal',
];

// Allowed domains for PDF fetching (allowlist approach for extra safety)
const ALLOWED_PDF_DOMAINS = [
  // Major publishers and repositories
  'arxiv.org',
  'www.arxiv.org',
  'export.arxiv.org',
  'ncbi.nlm.nih.gov',
  'www.ncbi.nlm.nih.gov',
  'pubmed.ncbi.nlm.nih.gov',
  'pmc.ncbi.nlm.nih.gov',
  'europepmc.org',
  'www.europepmc.org',
  'doi.org',
  'dx.doi.org',
  'biorxiv.org',
  'www.biorxiv.org',
  'medrxiv.org',
  'www.medrxiv.org',
  'researchgate.net',
  'www.researchgate.net',
  'academia.edu',
  'www.academia.edu',
  'semanticscholar.org',
  'www.semanticscholar.org',
  'pdfs.semanticscholar.org',
  // Major journal publishers
  'nature.com',
  'www.nature.com',
  'springer.com',
  'link.springer.com',
  'wiley.com',
  'onlinelibrary.wiley.com',
  'elsevier.com',
  'www.elsevier.com',
  'sciencedirect.com',
  'www.sciencedirect.com',
  'tandfonline.com',
  'www.tandfonline.com',
  'sagepub.com',
  'journals.sagepub.com',
  'bmj.com',
  'www.bmj.com',
  'thelancet.com',
  'www.thelancet.com',
  'jamanetwork.com',
  'nejm.org',
  'www.nejm.org',
  'oup.com',
  'academic.oup.com',
  'plos.org',
  'journals.plos.org',
  'frontiersin.org',
  'www.frontiersin.org',
  'mdpi.com',
  'www.mdpi.com',
  'hindawi.com',
  'www.hindawi.com',
  'cochranelibrary.com',
  'www.cochranelibrary.com',
  // Google Drive (for user-uploaded PDFs)
  'drive.google.com',
  'docs.google.com',
  'googleapis.com',
  'www.googleapis.com',
  'storage.googleapis.com',
  // Institutional repositories
  'osf.io',
  'zenodo.org',
  'figshare.com',
  // CDNs commonly used by publishers
  'cloudfront.net',
  's3.amazonaws.com',
];

/**
 * Check if a hostname matches a pattern (supports wildcards)
 */
function hostnameMatches(hostname, pattern) {
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1); // Remove the *
    return hostname.endsWith(suffix) || hostname === pattern.slice(2);
  }
  return hostname === pattern;
}

/**
 * Check if an IP address is private/internal
 */
function isPrivateIP(ip) {
  return PRIVATE_IP_PATTERNS.some(pattern => pattern.test(ip));
}

/**
 * Check if a hostname is blocked
 */
function isBlockedHostname(hostname) {
  const lower = hostname.toLowerCase();
  return BLOCKED_HOSTNAMES.some(blocked => hostnameMatches(lower, blocked));
}

/**
 * Check if a hostname is in the allowed list for PDF fetching
 */
function isAllowedPdfDomain(hostname) {
  const lower = hostname.toLowerCase();

  // Check exact matches
  if (ALLOWED_PDF_DOMAINS.includes(lower)) {
    return true;
  }

  // Check if it's a subdomain of an allowed domain
  for (const allowed of ALLOWED_PDF_DOMAINS) {
    if (lower.endsWith('.' + allowed)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate a URL for SSRF protection
 *
 * @param {string} url - The URL to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.requireAllowlist - If true, URL must be from allowed domains
 * @param {boolean} options.allowHttp - If true, allow http:// URLs (default: false, only https)
 * @returns {{ valid: boolean, error?: string, hostname?: string }}
 */
export function validateUrlForSSRF(url, options = {}) {
  const { requireAllowlist = false, allowHttp = false } = options;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Protocol check
  const allowedProtocols = allowHttp ? ['http:', 'https:'] : ['https:'];
  if (!allowedProtocols.includes(parsed.protocol)) {
    return {
      valid: false,
      error: allowHttp ? 'URL must use http or https protocol' : 'URL must use https protocol',
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block obviously internal hostnames
  if (isBlockedHostname(hostname)) {
    return { valid: false, error: 'URL points to internal/blocked hostname' };
  }

  // Check for IP addresses
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(hostname)) {
    if (isPrivateIP(hostname)) {
      return { valid: false, error: 'URL points to private/internal IP address' };
    }
    // Even if it's a public IP, block direct IP access for extra safety
    if (requireAllowlist) {
      return { valid: false, error: 'Direct IP addresses are not allowed' };
    }
  }

  // IPv6 check (bracketed in URLs)
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    // Block all IPv6 for simplicity (could be expanded to check for private ranges)
    return { valid: false, error: 'IPv6 addresses are not allowed' };
  }

  // Allowlist check for PDF domains
  if (requireAllowlist && !isAllowedPdfDomain(hostname)) {
    return {
      valid: false,
      error: `Domain '${hostname}' is not in the allowed list for PDF fetching`,
      hostname,
    };
  }

  return { valid: true, hostname };
}

/**
 * Validate a URL for PDF proxy requests
 * Uses strict validation with allowlist
 *
 * @param {string} url - The URL to validate
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePdfProxyUrl(url) {
  return validateUrlForSSRF(url, {
    requireAllowlist: true,
    allowHttp: false, // PDFs should always be fetched over HTTPS
  });
}

/**
 * Create a domain error for invalid URLs
 */
export function createSsrfError(message) {
  return createDomainError(VALIDATION_ERRORS.INVALID_INPUT, { reason: 'ssrf_protection' }, message);
}
