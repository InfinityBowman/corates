---
title: Single Domain Consolidation Evaluation
date: 2026-01-07
author: Team
---

## Summary

This audit evaluates consolidating the frontend and backend API under a single domain (`corates.org`) instead of using a subdomain for the API (`api.corates.org`).

**Recommendation: Migrate to single domain**

**Confidence: High**

Using a single domain simplifies architecture, improves security, reduces CORS complexity, and enables better cookie handling for authentication.

## Current Architecture

### Current Deployment

**Landing/Web Package** (`packages/landing/`)

- Deployed to `corates.org` and `www.corates.org`
- Contains frontend (SolidJS app) served by landing worker
- Wrangler config:
  ```jsonc
  {
    "name": "corates",
    "routes": [
      { "pattern": "corates.org/*", "zone_name": "corates.org" },
      { "pattern": "www.corates.org/*", "zone_name": "corates.org" },
    ],
    "vars": {
      "VITE_API_URL": "https://api.corates.org",
    },
  }
  ```

**Workers Package** (`packages/workers/`)

- Deployed separately as `corates-workers`
- Routes API calls (auth, projects, checklists, etc.)
- Currently expected to be at `https://api.corates.org`

### Current Routing Issues

1. **Separate Deployments**: Two distinct Cloudflare Workers need separate configuration
2. **CORS Required**: Frontend at `corates.org` calling `api.corates.org` requires CORS middleware
3. **Cookie Scope**: Auth cookies must include `domain=.corates.org` to work across subdomains
4. **Environment Complexity**: Two wrangler configs, two CI/CD deployments, two DNS records
5. **CSRF Protection**: Requires trusted origin whitelist (current mitigation works, but single domain is simpler)

## Single Domain Architecture

### Proposed Setup

**Single Worker** combining landing + API on `corates.org`:

```
corates.org/
  /                          → SPA frontend (index.html)
  /app.js                    → Static asset
  /api/*                     → API endpoints (/api/auth, /api/projects, etc.)
  /health                    → Health check
  /doc                       → OpenAPI docs
```

**Benefits**:

```jsonc
{
  "name": "corates",
  "routes": [
    { "pattern": "corates.org/*", "zone_name": "corates.org" },
    { "pattern": "www.corates.org/*", "zone_name": "corates.org" },
  ],
  "vars": {
    "VITE_API_URL": "/api", // Relative URL, same domain!
  },
}
```

### Implementation Approach

#### Option A: Merge Workers (Recommended)

Consolidate `packages/workers/src/index.js` into the landing worker:

```javascript
// packages/landing/worker.js
import { Hono } from 'hono';
import apiApp from './api/index.js'; // Hono app with all routes

const app = new Hono();

// API routes first (more specific)
app.route('/api', apiApp);

// Fallback to SPA shell for all other routes
app.all('*', async c => {
  const asset = await c.env.ASSETS.fetch(c.req.raw);

  if (asset.status !== 404) {
    return asset;
  }

  // 404 or HTML → serve app.html (SPA shell)
  const appHtml = await c.env.ASSETS.fetch(new URL('/app.html', c.req.url));

  if (appHtml.status === 404) {
    return asset;
  }

  return new Response(appHtml.body, {
    status: 200,
    headers: new Headers(appHtml.headers),
  });
});

export default app;
export { UserSession, ProjectDoc, EmailQueue }; // Durable Objects
```

**Effort**: 2-4 hours

- Move API routes from workers package to landing worker
- Consolidate Durable Objects exports
- Update middleware imports
- Test routing

#### Option B: Reverse Proxy (Quick Alternative)

Keep workers as separate deployment, use reverse proxy:

```javascript
// packages/landing/worker.js
export default {
  async fetch(request, env) {
    // Route /api/* to workers subdomain
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api')) {
      const apiUrl = new URL(url.pathname, 'https://corates-workers.example.com');
      apiUrl.search = url.search;
      return fetch(apiUrl, request);
    }

    // ... rest of SPA routing
  },
};
```

**Effort**: 1-2 hours (quick test)
**Trade-off**: Still two deployments, but hides subdomain from frontend

### Migration Path

#### Phase 1: Add API Routes to Landing Worker (1-2 hours)

1. Move `packages/workers/src` routes to `packages/landing/api/`
2. Import Durable Objects in landing worker
3. Copy middleware from workers package
4. Update `wrangler.jsonc` with durable objects config
5. Test API endpoints at `/api/health`

#### Phase 2: Update Frontend Configuration (30 minutes)

```javascript
// packages/web/.env.local
VITE_API_URL = /api  # Changed from https:/ / api.corates.org;
```

Update any hardcoded API URLs in code:

```javascript
// Before
const API_URL = 'https://api.corates.org';
const response = await fetch(`${API_URL}/auth/me`);

// After
const API_URL = '/api';
const response = await fetch(`${API_URL}/auth/me`);
```

#### Phase 3: Remove CORS Middleware (1 hour)

Since frontend and API are same domain, CORS is unnecessary:

```javascript
// DELETE: packages/workers/src/middleware/cors.js

// In API routes, remove:
app.use('*', async (c, next) => {
  const corsMiddleware = createCorsMiddleware(c.env);
  return corsMiddleware(c, next);
});
```

CORS middleware can stay for external API consumers (if applicable).

#### Phase 4: Simplify Auth Cookies (30 minutes)

Cookies now auto-scope to domain:

```javascript
// Before: Must specify domain and SameSite
response.headers.set('Set-Cookie', `auth=${token}; Domain=.corates.org; Path=/; SameSite=Lax; Secure; HttpOnly`);

// After: Simpler (domain is implicit)
response.headers.set('Set-Cookie', `auth=${token}; Path=/; SameSite=Strict; Secure; HttpOnly`);
```

Can now use `SameSite=Strict` (more secure) since no cross-domain redirects.

#### Phase 5: Update CI/CD (1-2 hours)

**Before**: Deploy landing + workers separately

```yaml
# .github/workflows/deploy-landing.yml
# .github/workflows/deploy-workers.yml (separate)
```

**After**: Single deployment

```yaml
# .github/workflows/deploy.yml
jobs:
  deploy-corates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm build
      - run: pnpm deploy --projects=landing
```

#### Phase 6: Decommission Workers Deployment (30 minutes)

1. Delete `packages/workers/wrangler.jsonc`
2. Archive workers package (or keep for reference)
3. Remove workers deployment from CI/CD
4. Update DNS: Remove `api` subdomain record

### Total Migration Effort

| Phase                     | Effort        | Notes                      |
| ------------------------- | ------------- | -------------------------- |
| 1. Add routes to landing  | 1-2 hours     | Most time-consuming        |
| 2. Update frontend config | 30 min        | Simple env var changes     |
| 3. Remove CORS            | 1 hour        | Clean up unnecessary code  |
| 4. Simplify auth cookies  | 30 min        | Actually improves security |
| 5. Update CI/CD           | 1-2 hours     | Consolidate workflows      |
| 6. Decommission workers   | 30 min        | Final cleanup              |
| **Total**                 | **5-7 hours** | Can be done incrementally  |

## Benefits

### 1. Simplified Architecture

**Before**:

- 2 wrangler configs
- 2 deployments (landing + workers)
- 2 DNS records (corates.org + api.corates.org)
- CORS middleware
- Subdomain management

**After**:

- 1 wrangler config
- 1 deployment
- 1 DNS record
- No CORS needed (internal)
- Simpler mental model

### 2. Improved Security

| Aspect          | Before                               | After                         |
| --------------- | ------------------------------------ | ----------------------------- |
| Cookie SameSite | Lax (allows cross-origin)            | Strict (only same-site)       |
| CSRF Risk       | Moderate (subdomain bypass possible) | Minimal (same origin)         |
| Cookie Scope    | Domain=.corates.org (broad)          | Implicit to domain (narrower) |
| Attack Surface  | Larger (subdomains)                  | Smaller (single origin)       |

### 3. Better Developer Experience

- One codebase, one deployment
- Relative API URLs (`/api`) instead of absolute (`https://api.corates.org`)
- Easier local testing (no need to mock API_URL env var)
- Simpler wrangler config

### 4. Reduced Operational Complexity

- Single CI/CD pipeline
- No subdomain DNS issues
- Easier rollbacks (one deployment instead of two)
- Single worker log stream
- Single rate limiting/DDoS protection config

### 5. Better Cookie Handling

```javascript
// Before: Auth tokens available to subdomains (security risk)
Set-Cookie: auth=token; Domain=.corates.org; Path=/

// After: Auth tokens scoped to exact domain (secure)
Set-Cookie: auth=token; Path=/; SameSite=Strict
```

## Concerns & Mitigations

| Concern                       | Impact | Mitigation                                        |
| ----------------------------- | ------ | ------------------------------------------------- |
| Loss of subdomain separation  | Low    | Single domain is cleaner anyway                   |
| Route conflicts (/api vs SPA) | Low    | API routes first, then SPA catch-all              |
| Worker size limits            | Low    | Combined size still well under Cloudflare limits  |
| CORS for external consumers   | Medium | Keep CORS headers for `/api/*` (optional feature) |
| Rollback complexity           | Low    | Single deployment = easier rollback               |

## Testing Checklist

- [ ] API routes respond at `/api/health`
- [ ] Frontend loads at `/`
- [ ] API calls work with relative URL `/api/auth/me`
- [ ] Auth cookies set with `SameSite=Strict`
- [ ] SPA routing works (404s → app.html)
- [ ] Static assets load (JS, CSS, images)
- [ ] Both `corates.org` and `www.corates.org` work
- [ ] OpenAPI docs at `/api/doc`
- [ ] Health check at `/api/health`

## Decision: Migrate to Single Domain

**Confidence: High**

Rationale:

- ✅ Significantly simpler architecture
- ✅ Better security (stricter SameSite, no CORS bypass risks)
- ✅ Easier to deploy and maintain
- ✅ Better developer experience
- ✅ Moderate effort (5-7 hours)
- ✅ Can be done incrementally (Phase 1 → 2 → 3, etc.)
- ⚠️ Requires careful routing order (API before SPA catch-all)
- ⚠️ Some local development setup changes (but simpler overall)

## Implementation Checklist

- [ ] Move `/packages/workers/src` routes to `/packages/landing/api/`
- [ ] Copy Durable Objects config from workers to landing wrangler
- [ ] Import Durable Objects in landing worker.js
- [ ] Copy middleware (auth, security headers, etc.) to landing
- [ ] Update landing worker.js routing (API → SPA fallback)
- [ ] Change `VITE_API_URL` from `https://api.corates.org` to `/api`
- [ ] Remove hardcoded API URLs in frontend code
- [ ] Remove CORS middleware (keep security headers)
- [ ] Update auth cookie logic (remove Domain, add SameSite=Strict)
- [ ] Consolidate CI/CD workflows
- [ ] Test all API endpoints
- [ ] Test SPA routing (404s, deep links)
- [ ] Test auth flow end-to-end
- [ ] Remove `api.corates.org` DNS record
- [ ] Archive or delete workers package

## Related Considerations

### External API Consumers (If Applicable)

If other services call the API, keep CORS headers:

```javascript
// In landing worker, keep CORS for /api routes if needed
app.use(
  '/api/*',
  cors({
    origin: 'https://trusted-domain.com',
    credentials: true,
  }),
);
```

### API Versioning

Single domain simplifies API versioning:

```
/api/v1/projects       (old version)
/api/v2/projects       (new version)
```

Or continue with header-based versioning:

```javascript
GET / api / projects;
Accept: application / vnd.corates.v2 + json;
```

## Effort Estimate

**Total**: 5-7 hours spread over 1-2 days

- Does not require extensive testing per phase
- Can be broken into smaller PRs
- Low risk of breaking existing functionality

## Next Steps

1. **Review** this evaluation with team
2. **Start Phase 1** (move routes, 1-2 hours)
3. **Test Phase 1** (API endpoints respond)
4. **Complete Phases 2-6** (incrementally)
5. **Remove old workers deployment** (final cleanup)

---

## References

- [Cloudflare Workers Routing](https://developers.cloudflare.com/workers/configuration/routing/)
- [HTTP Cookies - SameSite](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [CORS Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Hono Routing](https://hono.dev/api/routing)
