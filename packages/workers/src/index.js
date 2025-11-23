import { ChatRoom } from './durable-objects/ChatRoom.js';
import { UserSession } from './durable-objects/UserSession.js';
import { CollaborativeDoc } from './durable-objects/CollaborativeDoc.js';

export { ChatRoom, UserSession, CollaborativeDoc };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // API Routes
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
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Chat room endpoints
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

  // User session endpoints
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

  // Collaborative document endpoints
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

  // Media upload endpoint
  if (path === '/api/media/upload' && request.method === 'POST') {
    return await handleMediaUpload(request, env);
  }

  // Database operations
  if (path.startsWith('/api/db/')) {
    return await handleDatabase(request, env, path);
  }

  return new Response(JSON.stringify({ error: 'Not Found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleMediaUpload(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    return new Response(
      JSON.stringify({
        success: true,
        fileName,
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

async function handleDatabase(request, env, path) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Get users
    if (path === '/api/db/users' && request.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 20').all();
      return new Response(JSON.stringify({ users: results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create user
    if (path === '/api/db/users' && request.method === 'POST') {
      const body = await request.json();
      const { username, email, displayName } = body;

      if (!username || !username.trim()) {
        return new Response(JSON.stringify({ error: 'Username is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const userId = crypto.randomUUID();

      try {
        await env.DB.prepare(
          `
          INSERT INTO users (id, username, email, display_name)
          VALUES (?, ?, ?, ?)
        `,
        )
          .bind(userId, username.trim(), email?.trim() || null, displayName?.trim() || null)
          .run();

        return new Response(
          JSON.stringify({
            success: true,
            user: { id: userId, username: username.trim(), email: email?.trim(), display_name: displayName?.trim() },
          }),
          {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      } catch (dbError) {
        console.error('Database insert error:', dbError);
        if (dbError.message.includes('UNIQUE constraint failed')) {
          return new Response(JSON.stringify({ error: 'Username already exists' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw dbError;
      }
    }

    // Run migration
    if (path === '/api/db/migrate' && request.method === 'POST') {
      try {
        // Check if tables exist
        const tableCheck = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first();

        if (!tableCheck) {
          // Run basic table creation if they don't exist
          await env.DB.exec(`
            CREATE TABLE users (
              id TEXT PRIMARY KEY,
              username TEXT UNIQUE NOT NULL,
              email TEXT UNIQUE,
              display_name TEXT,
              avatar_url TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

            INSERT INTO users (id, username, display_name) VALUES
              ('system', 'system', 'System'),
              ('demo-user', 'demo', 'Demo User');

            INSERT INTO rooms (id, name, description, created_by) VALUES
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
