#!/usr/bin/env node
/**
 * OpenAPI Spec Generator for Corates Workers API
 *
 * Parses route files to extract endpoints and merges with
 * descriptions from api-docs.yaml to generate openapi.json
 *
 * Usage: node scripts/generate-openapi.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// OpenAPI base document
const baseSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Corates API',
    version: '1.0.0',
    description: 'API for Corates - Collaborative Research Appraisal Tool for Evidence Synthesis',
    contact: {
      email: 'support@corates.org',
    },
  },
  servers: [
    {
      url: 'http://localhost:8787',
      description: 'Local development',
    },
    {
      url: 'https://api.corates.org',
      description: 'Production',
    },
  ],
  paths: {},
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'better-auth.session_token',
        description: 'Session cookie set by Better Auth',
      },
    },
    schemas: {},
  },
  tags: [],
};

/**
 * Parse a route file and extract endpoint definitions
 */
function parseRouteFile(filePath, basePath = '') {
  const content = fs.readFileSync(filePath, 'utf-8');
  const endpoints = [];

  // Match patterns like: routeName.get('/path', ...) or routeName.post('/', ...)
  // Also match JSDoc comments above routes
  const routeRegex =
    /(?:\/\*\*[\s\S]*?\*\/\s*)?\w+\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi;

  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    const method = match[1].toLowerCase();
    let routePath = match[2];

    // Convert Hono :param to OpenAPI {param}
    routePath = routePath.replace(/:(\w+)/g, '{$1}');

    // Build full path
    const fullPath = basePath + (routePath === '/' ? '' : routePath);

    // Extract JSDoc comment if present (look backwards from match)
    const beforeMatch = content.substring(0, match.index);
    const jsdocMatch = beforeMatch.match(/\/\*\*[\s\S]*?\*\/\s*$/);
    let summary = '';
    let description = '';

    if (jsdocMatch) {
      const jsdoc = jsdocMatch[0];
      // Extract first line as summary
      const summaryMatch = jsdoc.match(/\*\s*([A-Z][^@\n*]+)/);
      if (summaryMatch) {
        summary = summaryMatch[1].trim();
      }
      // Extract path comment like "GET /api/projects/:id"
      const pathMatch = jsdoc.match(/\*\s*(GET|POST|PUT|PATCH|DELETE)\s+([^\n*]+)/i);
      if (pathMatch) {
        description = `${pathMatch[1]} ${pathMatch[2]}`.trim();
      }
    }

    endpoints.push({
      method,
      path: fullPath || '/',
      summary,
      description,
      file: path.relative(ROOT, filePath),
    });
  }

  return endpoints;
}

/**
 * Extract path parameters from a path string
 */
function extractPathParams(pathStr) {
  const params = [];
  const paramRegex = /\{(\w+)\}/g;
  let match;
  while ((match = paramRegex.exec(pathStr)) !== null) {
    params.push({
      name: match[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
    });
  }
  return params;
}

/**
 * Load and parse the api-docs.yaml file
 */
function loadApiDocs() {
  const docsPath = path.join(ROOT, 'api-docs.yaml');
  if (!fs.existsSync(docsPath)) {
    // eslint-disable-next-line
    console.log('No api-docs.yaml found, using defaults');
    return { paths: {}, tags: [], schemas: {} };
  }
  const content = fs.readFileSync(docsPath, 'utf-8');
  return parseYaml(content) || { paths: {}, tags: [], schemas: {} };
}

/**
 * Merge extracted endpoints with api-docs.yaml overrides
 */
function mergeWithDocs(endpoints, apiDocs) {
  const paths = {};

  for (const endpoint of endpoints) {
    const { method, path: endpointPath, summary, description } = endpoint;

    if (!paths[endpointPath]) {
      paths[endpointPath] = {};
    }

    // Get overrides from api-docs.yaml
    const docOverride = apiDocs.paths?.[endpointPath]?.[method] || {};

    // Build operation object
    const operation = {
      summary: docOverride.summary || summary || `${method.toUpperCase()} ${endpointPath}`,
      description: docOverride.description || description || '',
      operationId: docOverride.operationId || generateOperationId(method, endpointPath),
      tags: docOverride.tags || inferTags(endpointPath),
      parameters: [...extractPathParams(endpointPath), ...(docOverride.parameters || [])],
      responses: docOverride.responses || {
        200: {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: { type: 'object' },
            },
          },
        },
        400: { description: 'Bad request' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' },
        404: { description: 'Not found' },
        500: { description: 'Internal server error' },
      },
    };

    // Add security if not a public endpoint
    const publicPaths = [
      '/health',
      '/healthz',
      '/',
      '/api/billing/plans',
      '/api/billing/webhook',
      '/api/contact',
    ];
    const isPublic = publicPaths.includes(endpointPath) || docOverride.public === true;
    if (!isPublic) {
      operation.security = [{ cookieAuth: [] }];
    }

    // Add request body for POST/PUT/PATCH
    if (['post', 'put', 'patch'].includes(method)) {
      operation.requestBody = docOverride.requestBody || {
        content: {
          'application/json': {
            schema: { type: 'object' },
          },
        },
      };
    }

    paths[endpointPath][method] = operation;
  }

  return paths;
}

/**
 * Generate an operationId from method and path
 */
function generateOperationId(method, path) {
  // /api/projects/{id} -> getProjectsById
  const parts = path
    .replace(/^\/api\//, '')
    .replace(/\{(\w+)\}/g, 'By$1')
    .split('/')
    .filter(Boolean);

  const name = parts.map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join('');

  return method + name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Infer tags from path
 */
function inferTags(path) {
  const segments = path.replace(/^\/api\//, '').split('/');
  const firstSegment = segments[0]?.replace(/\{.*\}/, '').replace(/-/g, ' ');
  if (firstSegment) {
    return [firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1)];
  }
  return ['General'];
}

/**
 * Main generator function
 */
async function generate() {
  // eslint-disable-next-line
  console.log('Generating OpenAPI spec...\n');

  // Route file mappings: file path -> base path
  const routeMappings = [
    // Main index.js routes
    { file: 'src/index.js', basePath: '' },
    // Organization routes (new org-scoped architecture)
    { file: 'src/routes/orgs/index.js', basePath: '/api/orgs' },
    { file: 'src/routes/orgs/projects.js', basePath: '/api/orgs/{orgId}/projects' },
    {
      file: 'src/routes/orgs/members.js',
      basePath: '/api/orgs/{orgId}/projects/{projectId}/members',
    },
    {
      file: 'src/routes/orgs/invitations.js',
      basePath: '/api/orgs/{orgId}/projects/{projectId}/invitations',
    },
    {
      file: 'src/routes/orgs/pdfs.js',
      basePath: '/api/orgs/{orgId}/projects/{projectId}/studies/{studyId}/pdfs',
    },
    // Legacy routes (deprecated, kept for backward compatibility detection)
    { file: 'src/routes/projects.js', basePath: '/api/projects' },
    { file: 'src/routes/members.js', basePath: '/api/projects/{projectId}/members' },
    // Note: src/routes/pdfs.js removed - replaced by org-scoped routes in src/routes/orgs/pdfs.js
    { file: 'src/routes/invitations.js', basePath: '/api/invitations' },
    // Other routes
    { file: 'src/routes/users.js', basePath: '/api/users' },
    { file: 'src/routes/billing/index.js', basePath: '/api/billing' },
    { file: 'src/routes/admin/index.js', basePath: '/api/admin' },
    { file: 'src/routes/contact.js', basePath: '/api/contact' },
    { file: 'src/routes/avatars.js', basePath: '/api/users/avatar' },
    { file: 'src/routes/google-drive.js', basePath: '/api/google-drive' },
    { file: 'src/routes/account-merge.js', basePath: '/api/accounts/merge' },
    { file: 'src/routes/email.js', basePath: '/api/email' },
    { file: 'src/routes/database.js', basePath: '/api/db' },
    { file: 'src/routes/admin/users.js', basePath: '/api/admin' },
    { file: 'src/routes/admin/storage.js', basePath: '/api/admin' },
  ];

  // Parse all route files
  const allEndpoints = [];
  for (const { file, basePath } of routeMappings) {
    const filePath = path.join(ROOT, file);
    if (fs.existsSync(filePath)) {
      const endpoints = parseRouteFile(filePath, basePath);
      allEndpoints.push(...endpoints);
      // eslint-disable-next-line
      console.log(`  Parsed ${file}: ${endpoints.length} endpoints`);
    } else {
      // eslint-disable-next-line
      console.log(`  Skipped ${file}: not found`);
    }
  }

  // eslint-disable-next-line
  console.log(`\nTotal endpoints found: ${allEndpoints.length}`);

  // Load api-docs.yaml for descriptions and overrides
  const apiDocs = loadApiDocs();

  // Merge endpoints with docs
  const paths = mergeWithDocs(allEndpoints, apiDocs);

  // Build final spec
  const spec = {
    ...baseSpec,
    paths,
    tags: apiDocs.tags || generateTags(paths),
    components: {
      ...baseSpec.components,
      schemas: apiDocs.schemas || {},
    },
  };

  // Write output
  const outputPath = path.join(ROOT, '/openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
  // eslint-disable-next-line
  console.log(`\nGenerated: ${outputPath}`);

  // Also generate a summary
  const pathCount = Object.keys(paths).length;
  const operationCount = Object.values(paths).reduce(
    (sum, methods) => sum + Object.keys(methods).length,
    0,
  );
  // eslint-disable-next-line
  console.log(`  ${pathCount} paths, ${operationCount} operations`);

  // Pretty CLI notice for local docs
  const colors = {
    reset: '\u001b[0m',
    bold: '\u001b[1m',
    green: '\u001b[32m',
    cyan: '\u001b[36m',
  };
  // eslint-disable-next-line
  console.log(
    `\n${colors.bold}${colors.green}Docs available at:${colors.reset} ${colors.cyan}http://localhost:8787/docs${colors.reset}\n`,
  );
}

/**
 * Generate tags from paths
 */
function generateTags(paths) {
  const tagSet = new Set();
  for (const pathMethods of Object.values(paths)) {
    for (const operation of Object.values(pathMethods)) {
      operation.tags?.forEach(tag => tagSet.add(tag));
    }
  }
  return Array.from(tagSet)
    .sort()
    .map(name => ({ name }));
}

// Run generator
generate().catch(err => {
  // eslint-disable-next-line
  console.error('Error:', err);
  // eslint-disable-next-line
  process.exit(1);
});
