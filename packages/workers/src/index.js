import { ChatRoom } from './durable-objects/ChatRoom.js';
import { UserSession } from './durable-objects/UserSession.js';
import { CollaborativeDoc } from './durable-objects/CollaborativeDoc.js';
import { handleAuthRoutes } from './auth/routes.js';
import { verifyAuth, requireAuth } from './auth/config.js';
import { createEmailService } from './auth/email.js';

export { ChatRoom, UserSession, CollaborativeDoc };

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

  // Chat room endpoints (require auth)
  if (path.startsWith('/api/rooms/')) {
    const roomId = path.split('/')[3];
    if (!roomId) {
      return new Response(JSON.stringify({ error: 'Room ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const id = env.CHAT_ROOM.idFromName(roomId);
    const room = env.CHAT_ROOM.get(id);

    return await room.fetch(request);
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

    return await session.fetch(request);
  }

  // Collaborative document endpoints (require auth)
  if (path.startsWith('/api/docs/')) {
    const docId = path.split('/')[3];
    if (!docId) {
      return new Response(JSON.stringify({ error: 'Document ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const id = env.COLLABORATIVE_DOC.idFromName(docId);
    const doc = env.COLLABORATIVE_DOC.get(id);

    return await doc.fetch(request);
  }

  // Media upload endpoint (require auth)
  if (path === '/api/media/upload' && request.method === 'POST') {
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult; // Auth failed
    }
    return await handleMediaUpload(request, env, authResult.user);
  }

  // Database operations (require auth for most operations)
  if (path.startsWith('/api/db/')) {
    // Public migration endpoint (for development)
    if (path === '/api/db/migrate' && request.method === 'POST') {
      return await handleDatabase(request, env, path);
    }

    // Other DB operations require auth
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult; // Auth failed
    }
    return await handleDatabase(request, env, path, authResult.user);
  }

  return new Response(JSON.stringify({ error: 'Not Found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleMediaUpload(request, env, user) {
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
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate unique filename
    const fileName = `${Date.now()}-${file.name}`;

    // Upload to R2
    await env.MEDIA_BUCKET.put(fileName, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // Store file metadata in database
    const fileRecord = {
      id: crypto.randomUUID(),
      filename: fileName,
      originalName: file.name,
      fileType: file.type,
      fileSize: file.size,
      uploadedBy: user.id,
      bucketKey: fileName,
      createdAt: new Date().toISOString(),
    };

    await env.DB.prepare(
      `
      INSERT INTO media_files (id, filename, original_name, file_type, file_size, uploaded_by, bucket_key, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
      .bind(
        fileRecord.id,
        fileRecord.filename,
        fileRecord.originalName,
        fileRecord.fileType,
        fileRecord.fileSize,
        fileRecord.uploadedBy,
        fileRecord.bucketKey,
        fileRecord.createdAt,
      )
      .run();

    return new Response(
      JSON.stringify({
        success: true,
        file: fileRecord,
        url: `/api/media/${fileName}`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Media upload error:', error);
    return new Response(JSON.stringify({ error: 'Upload failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
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
        const tableCheck = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first();

        if (!tableCheck) {
          // Run the migration file content (simplified version)
          await env.DB.exec(`
            CREATE TABLE users (
              id TEXT PRIMARY KEY,
              username TEXT UNIQUE NOT NULL,
              email TEXT UNIQUE NOT NULL,
              display_name TEXT,
              avatar_url TEXT,
              email_verified BOOLEAN DEFAULT FALSE,
              password_hash TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE auth_sessions (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              expires_at DATETIME NOT NULL,
              token TEXT UNIQUE NOT NULL,
              ip_address TEXT,
              user_agent TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE auth_accounts (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              provider TEXT NOT NULL,
              provider_account_id TEXT NOT NULL,
              access_token TEXT,
              refresh_token TEXT,
              expires_at DATETIME,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(provider, provider_account_id),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE rooms (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT,
              is_public BOOLEAN DEFAULT 1,
              created_by TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (created_by) REFERENCES users(id)
            );

            INSERT OR IGNORE INTO users (id, username, email, display_name, email_verified) VALUES
              ('system', 'system', 'system@corates.com', 'System', TRUE),
              ('demo-user', 'demo', 'demo@corates.com', 'Demo User', TRUE);

            INSERT OR IGNORE INTO rooms (id, name, description, created_by) VALUES
              ('general', 'General', 'General discussion room', 'system'),
              ('random', 'Random', 'Random conversations', 'system');
          `);
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
