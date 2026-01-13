/**
 * Health check routes
 * Provides health and liveness endpoints for monitoring
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

const health = new OpenAPIHono();

// Service status schema
const ServiceStatusSchema = z
  .object({
    status: z.enum(['healthy', 'unhealthy']).openapi({ example: 'healthy' }),
    type: z.string().openapi({ example: 'D1' }),
    error: z.string().optional().openapi({ example: 'Connection failed' }),
    bindings: z
      .object({
        USER_SESSION: z.boolean().optional(),
        PROJECT_DOC: z.boolean().optional(),
        EMAIL_QUEUE: z.boolean().optional(),
      })
      .optional(),
  })
  .openapi('ServiceStatus');

// Health response schema
const HealthResponseSchema = z
  .object({
    status: z.enum(['healthy', 'degraded']).openapi({ example: 'healthy' }),
    timestamp: z.string().openapi({ example: '2024-01-15T10:30:00.000Z' }),
    services: z.object({
      database: ServiceStatusSchema.optional(),
      storage: ServiceStatusSchema.optional(),
      durableObjects: ServiceStatusSchema.optional(),
    }),
  })
  .openapi('HealthResponse');

// Health check route
const healthRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Health'],
  summary: 'Health check with dependency checks',
  description:
    'Returns the health status of the API and its dependencies (database, storage, durable objects)',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
      description: 'All services healthy',
    },
    503: {
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
      description: 'One or more services degraded',
    },
  },
});

health.openapi(healthRoute, async c => {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {},
  };

  // Check D1 database
  try {
    const result = await c.env.DB.prepare('SELECT 1 as ok').first();
    checks.services.database = {
      status: result?.ok === 1 ? 'healthy' : 'unhealthy',
      type: 'D1',
    };
  } catch (error) {
    checks.services.database = {
      status: 'unhealthy',
      type: 'D1',
      error: error.message,
    };
    checks.status = 'degraded';
  }

  // Check R2 bucket
  try {
    await c.env.PDF_BUCKET.list({ limit: 1 });
    checks.services.storage = {
      status: 'healthy',
      type: 'R2',
    };
  } catch (error) {
    checks.services.storage = {
      status: 'unhealthy',
      type: 'R2',
      error: error.message,
    };
    checks.status = 'degraded';
  }

  // Check Durable Objects are available
  try {
    checks.services.durableObjects = {
      status:
        c.env.USER_SESSION && c.env.PROJECT_DOC && c.env.EMAIL_QUEUE ? 'healthy' : 'unhealthy',
      type: 'Durable Objects',
      bindings: {
        USER_SESSION: !!c.env.USER_SESSION,
        PROJECT_DOC: !!c.env.PROJECT_DOC,
        EMAIL_QUEUE: !!c.env.EMAIL_QUEUE,
      },
    };
  } catch (error) {
    checks.services.durableObjects = {
      status: 'unhealthy',
      type: 'Durable Objects',
      error: error.message,
    };
    checks.status = 'degraded';
  }

  const httpStatus = checks.status === 'healthy' ? 200 : 503;
  return c.json(checks, httpStatus);
});

// Liveness probe route
const livenessRoute = createRoute({
  method: 'get',
  path: '/live',
  tags: ['Health'],
  summary: 'Liveness probe',
  description: 'Simple liveness check for load balancers. Returns OK if the service is running.',
  responses: {
    200: {
      content: {
        'text/plain': {
          schema: z.string().openapi({ example: 'OK' }),
        },
      },
      description: 'Service is alive',
    },
  },
});

health.openapi(livenessRoute, c => {
  return c.text('OK');
});

export { health as healthRoutes };
