import { UserSession } from './durable-objects/UserSession.js';
import { ProjectDoc } from './durable-objects/ProjectDoc.js';
import { handleAuthRoutes } from './auth/routes.js';
import { verifyAuth, requireAuth } from './auth/config.js';
import { createEmailService } from './auth/email.js';

export { UserSession, ProjectDoc };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Dynamic CORS headers for credentialed requests
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:8787',
      // Add production origins here
    ];
    const requestOrigin = request.headers.get('Origin');
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0],
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Auth routes
      if (path.startsWith('/api/auth/')) {
        return await handleAuthRoutes(request, env, path);
      }

      // Test email endpoint (development only)
      if (path === '/api/test-email' && request.method === 'POST' && env.ENVIRONMENT !== 'production') {
        return await handleTestEmail(request, env, corsHeaders);
      }

      // API Routes (protected)
      if (path.startsWith('/api/')) {
        return await handleAPI(request, env, path);
      }

      // Health check
      if (path === '/health') {
        return new Response('OK', {
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        });
      }

      // Default response
      return new Response('Corates Workers API', {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

async function handleAPI(request, env, path) {
  // Dynamic CORS headers for credentialed requests
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:8787',
    // Add production origins here
  ];
  const requestOrigin = request.headers.get('Origin');
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };

  // Project document endpoints (require auth)
  if (path.startsWith('/api/project/')) {
    const projectId = path.split('/')[3];
    if (!projectId) {
      return new Response(JSON.stringify({ error: 'Project ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const id = env.PROJECT_DOC.idFromName(projectId);
    const projectDoc = env.PROJECT_DOC.get(id);

    const response = await projectDoc.fetch(request);

    // Handle WebSocket upgrade responses directly (status 101)
    if (response.status === 101) {
      return response;
    }

    // Ensure CORS headers are added to the response
    const corsResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        ...corsHeaders,
      },
    });

    return corsResponse;
  }

  // User session endpoints (require auth)
  if (path.startsWith('/api/sessions/')) {
    const sessionId = path.split('/')[3];
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const id = env.USER_SESSION.idFromName(sessionId);
    const session = env.USER_SESSION.get(id);

    const response = await session.fetch(request);

    // Handle WebSocket upgrade responses directly (status 101)
    if (response.status === 101) {
      return response;
    }

    // Ensure CORS headers are added to the response
    const corsResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        ...corsHeaders,
      },
    });

    return corsResponse;
  }

  // Database operations (require auth for most operations)
  if (path.startsWith('/api/db/')) {
    // Public migration endpoint (for development)
    if (path === '/api/db/migrate' && request.method === 'POST') {
      const response = await handleDatabase(request, env, path);

      // Ensure CORS headers are added to database responses
      const corsResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          ...corsHeaders,
        },
      });

      return corsResponse;
    }

    // Other DB operations require auth
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult; // Auth failed
    }

    const response = await handleDatabase(request, env, path, authResult.user);

    // Ensure CORS headers are added to database responses
    const corsResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        ...corsHeaders,
      },
    });

    return corsResponse;
  }

  // Project creation endpoint (require auth)
  if (path === '/api/projects' && request.method === 'POST') {
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult; // Auth failed
    }

    try {
      const { name, description } = await request.json();

      if (!name || !name.trim()) {
        return new Response(JSON.stringify({ error: 'Project name is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const projectId = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);

      // Create the project
      await env.DB.prepare(
        `
        INSERT INTO projects (id, name, description, createdBy, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      )
        .bind(projectId, name.trim(), description?.trim() || null, authResult.user.id, now, now)
        .run();

      // Add the creator as owner
      await env.DB.prepare(
        `
        INSERT INTO project_members (id, projectId, userId, role, joinedAt)
        VALUES (?, ?, ?, 'owner', ?)
      `,
      )
        .bind(crypto.randomUUID(), projectId, authResult.user.id, now)
        .run();

      // Return the created project
      const newProject = {
        id: projectId,
        name: name.trim(),
        description: description?.trim() || null,
        role: 'owner',
        createdAt: now,
        updatedAt: now,
      };

      return new Response(JSON.stringify(newProject), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error creating project:', error);
      return new Response(JSON.stringify({ error: 'Failed to create project' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // User projects endpoint - fetch projects user has access to
  if (path.startsWith('/api/users/') && path.includes('/projects')) {
    const userId = path.split('/')[3];
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user can access their own projects (or admin access)
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult; // Auth failed
    }

    // Only allow users to access their own projects
    if (authResult.user.id !== userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      // Query user's projects from D1
      const { results } = await env.DB.prepare(
        `
        SELECT p.id, p.name, p.description, pm.role, p.createdAt, p.updatedAt
        FROM projects p
        JOIN project_members pm ON p.id = pm.projectId
        WHERE pm.userId = ?
        ORDER BY p.updatedAt DESC
      `,
      )
        .bind(userId)
        .all();

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error fetching user projects:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch projects' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Not Found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleDatabase(request, env, path, user = null) {
  // Dynamic CORS headers for credentialed requests
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:8787',
    // Add production origins here
  ];
  const requestOrigin = request.headers.get('Origin');
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };

  try {
    // Get users (requires auth)
    if (path === '/api/db/users' && request.method === 'GET') {
      if (!user) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { results } = await env.DB.prepare(
        'SELECT id, username, email, display_name, email_verified, created_at FROM users ORDER BY created_at DESC LIMIT 20',
      ).all();
      return new Response(JSON.stringify({ users: results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create user (public registration - handled by auth routes)
    if (path === '/api/db/users' && request.method === 'POST') {
      return new Response(JSON.stringify({ error: 'Use /api/auth/register for user registration' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Run migration (public for development - should be secured in production)
    if (path === '/api/db/migrate' && request.method === 'POST') {
      try {
        // Check if tables exist
        const tableCheck = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user'").first();

        if (!tableCheck) {
          // Use the consolidated migration file from migrations folder
          return new Response(
            JSON.stringify({
              success: false,
              message: 'Please run: pnpm db:migrate in the workers directory',
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          );
        }

        return new Response(JSON.stringify({ success: true, message: 'Migration completed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (migrationError) {
        console.error('Migration error:', migrationError);
        return new Response(JSON.stringify({ error: 'Migration failed: ' + migrationError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Database operation not implemented' }), {
      status: 501,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Database error:', error);
    return new Response(JSON.stringify({ error: 'Database operation failed: ' + error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Test email handler (development only)
async function handleTestEmail(request, env, corsHeaders) {
  try {
    const { email, type } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email address required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emailService = createEmailService(env);
    let result;

    switch (type) {
      case 'verification':
        result = await emailService.sendEmailVerification(
          email,
          'http://localhost:5173/auth/verify-email?token=test-token-12345',
          'Test User',
        );
        break;
      case 'password-reset':
        result = await emailService.sendPasswordReset(
          email,
          'http://localhost:5173/auth/reset-password?token=test-token-12345',
          'Test User',
        );
        break;
      default:
        result = await emailService.sendEmail({
          to: email,
          subject: 'Test Email from CoRATES',
          html: '<h1>🎉 Test Email Success!</h1><p>This is a test email from your CoRATES application. If you received this, your email configuration is working correctly!</p>',
          text: 'Test Email Success!\n\nThis is a test email from your CoRATES application. If you received this, your email configuration is working correctly!',
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        result,
        message: `Test email sent to ${email}`,
        environment: env.ENVIRONMENT,
        realEmailSending: env.SEND_EMAILS_IN_DEV === 'true' || env.ENVIRONMENT === 'production',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Test email error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to send test email',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
}
