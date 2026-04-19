import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createAuth } from '@corates/workers/auth-config';
import {
  createDomainError,
  createValidationError,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { authMiddleware } from '@/server/middleware/auth';

interface OrgApiMethods {
  listOrganizations: (req: { headers: Headers }) => Promise<unknown>;
  createOrganization: (req: {
    headers: Headers;
    body: Record<string, unknown>;
  }) => Promise<unknown>;
}

function getOrgApi(): OrgApiMethods {
  return createAuth(env).api as unknown as OrgApiMethods;
}

export const handleGet = async ({ request }: { request: Request }) => {
  try {
    const orgApi = getOrgApi();
    const result = await orgApi.listOrganizations({ headers: request.headers });
    return Response.json(result, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error listing organizations:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'list_organizations',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const handlePost = async ({ request }: { request: Request }) => {
  try {
    const body = (await request.json()) as {
      name?: string;
      slug?: string;
      logo?: string;
      metadata?: Record<string, unknown>;
    };

    if (body.name === undefined || body.name === null) {
      return Response.json(
        createValidationError('name', VALIDATION_ERRORS.FIELD_REQUIRED.code, null, 'required'),
        { status: 400 },
      );
    }

    if (!body.name.trim()) {
      return Response.json(createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'name_required' }), {
        status: 403,
      });
    }

    const orgApi = getOrgApi();
    const result = await orgApi.createOrganization({
      headers: request.headers,
      body: {
        name: body.name.trim(),
        slug: body.slug,
        logo: body.logo,
        metadata: body.metadata,
      },
    });

    return Response.json(result, { status: 201 });
  } catch (err) {
    const error = err as Error;
    console.error('Error creating organization:', error);
    if (error.message?.includes('slug')) {
      return Response.json(createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'slug_taken' }), {
        status: 403,
      });
    }
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'create_organization',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/orgs')({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: handleGet,
      POST: handlePost,
    },
  },
});
