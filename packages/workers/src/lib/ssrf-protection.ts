import { createDomainError, VALIDATION_ERRORS } from '@corates/shared';

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./,
  /^192\.0\.2\./,
  /^198\.51\.100\./,
  /^203\.0\.113\./,
  /^255\.255\.255\.255$/,
  /^0\./,
];

const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  '*.localhost',
  '*.local',
  'metadata.google.internal',
  '169.254.169.254',
  'metadata.azure.com',
  'metadata.internal',
];

const ALLOWED_PDF_DOMAINS = [
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
  'drive.google.com',
  'docs.google.com',
  'googleapis.com',
  'www.googleapis.com',
  'storage.googleapis.com',
  'osf.io',
  'zenodo.org',
  'figshare.com',
  'cloudfront.net',
  's3.amazonaws.com',
];

function hostnameMatches(hostname: string, pattern: string): boolean {
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1);
    return hostname.endsWith(suffix) || hostname === pattern.slice(2);
  }
  return hostname === pattern;
}

function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some(pattern => pattern.test(ip));
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return BLOCKED_HOSTNAMES.some(blocked => hostnameMatches(lower, blocked));
}

function isAllowedPdfDomain(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  if (ALLOWED_PDF_DOMAINS.includes(lower)) {
    return true;
  }

  for (const allowed of ALLOWED_PDF_DOMAINS) {
    if (lower.endsWith('.' + allowed)) {
      return true;
    }
  }

  return false;
}

export interface SSRFValidationOptions {
  requireAllowlist?: boolean;
  allowHttp?: boolean;
}

export interface SSRFValidationResult {
  valid: boolean;
  error?: string;
  hostname?: string;
}

export function validateUrlForSSRF(
  url: string,
  options: SSRFValidationOptions = {},
): SSRFValidationResult {
  const { requireAllowlist = false, allowHttp = false } = options;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  const allowedProtocols = allowHttp ? ['http:', 'https:'] : ['https:'];
  if (!allowedProtocols.includes(parsed.protocol)) {
    return {
      valid: false,
      error: allowHttp ? 'URL must use http or https protocol' : 'URL must use https protocol',
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (isBlockedHostname(hostname)) {
    return { valid: false, error: 'URL points to internal/blocked hostname' };
  }

  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(hostname)) {
    if (isPrivateIP(hostname)) {
      return { valid: false, error: 'URL points to private/internal IP address' };
    }
    if (requireAllowlist) {
      return { valid: false, error: 'Direct IP addresses are not allowed' };
    }
  }

  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return { valid: false, error: 'IPv6 addresses are not allowed' };
  }

  if (requireAllowlist && !isAllowedPdfDomain(hostname)) {
    return {
      valid: false,
      error: `Domain '${hostname}' is not in the allowed list for PDF fetching`,
      hostname,
    };
  }

  return { valid: true, hostname };
}

export function validatePdfProxyUrl(url: string): SSRFValidationResult {
  return validateUrlForSSRF(url, {
    requireAllowlist: true,
    allowHttp: false,
  });
}

export function createSsrfError(message: string) {
  return createDomainError(VALIDATION_ERRORS.INVALID_INPUT, { reason: 'ssrf_protection' }, message);
}
