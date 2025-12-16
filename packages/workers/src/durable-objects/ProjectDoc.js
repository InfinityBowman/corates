import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { verifyAuth } from '../auth/config.js';

// y-websocket message types
const messageSync = 0;
const messageAwareness = 1;

/**
 * ProjectDoc Durable Object
 *
 * Holds the authoritative Y.Doc for a project with hierarchical structure:
 *
 * Project (this DO)
 *   - meta: Y.Map (project metadata: name, description, createdAt, etc.)
 *   - members: Y.Map (userId => { role, joinedAt })
 *   - reviews: Y.Map (reviewId => {
 *       id, name, description, createdAt, updatedAt,
 *       checklists: Y.Map (checklistId => {
 *         id, title, assignedTo (userId), status, createdAt, updatedAt,
 *         answers: Y.Map (questionKey => { value, notes, updatedAt, updatedBy })
 *       })
 *     })
 */
export class ProjectDoc {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // Map<WebSocket, { user, awarenessClientId }>
    this.sessions = new Map();
    this.doc = null;
    this.awareness = null;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Note: CORS headers are added by the main worker (index.js) when wrapping responses
    // Do NOT add them here to avoid duplicate headers

    // Debug: log upgrade header
    const upgradeHeader = request.headers.get('Upgrade');
    console.log(
      'ProjectDoc fetch - Upgrade header:',
      upgradeHeader,
      'Method:',
      request.method,
      'Path:',
      url.pathname,
    );

    // Check for internal requests (from worker routes)
    const isInternalRequest = request.headers.get('X-Internal-Request') === 'true';

    try {
      // Internal sync endpoints (from D1 routes) - no auth required
      if (isInternalRequest) {
        if (url.pathname === '/sync') {
          return await this.handleSync(request);
        }
        if (url.pathname === '/sync-member') {
          return await this.handleSyncMember(request);
        }
        if (url.pathname === '/sync-pdf') {
          return await this.handleSyncPdf(request);
        }
      }

      // For HTTP requests verify auth (unless it's an upgrade to websocket)
      if (upgradeHeader !== 'websocket') {
        const { user } = await verifyAuth(request, this.env);
        if (!user) {
          return new Response(JSON.stringify({ error: 'Authentication required' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        request.user = user;
      }

      // WebSocket upgrade / real-time sync
      if (upgradeHeader === 'websocket') {
        return await this.handleWebSocket(request);
      }

      // GET returns project-level info (list of checklist ids & metadata)
      if (request.method === 'GET') {
        return await this.getProjectInfo();
      }

      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('ProjectDoc error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Handle sync request from D1 routes (project metadata and initial members)
   */
  async handleSync(request) {
    await this.initializeDoc();

    try {
      const { meta, members } = await request.json();

      // Update meta if provided
      if (meta) {
        const metaMap = this.doc.getMap('meta');
        for (const [key, value] of Object.entries(meta)) {
          if (value !== undefined) {
            metaMap.set(key, value);
          }
        }
      }

      // Update members if provided (full replacement for initial sync)
      if (members && Array.isArray(members)) {
        const membersMap = this.doc.getMap('members');
        // Clear existing members and set new ones
        for (const [userId] of membersMap.entries()) {
          membersMap.delete(userId);
        }
        for (const member of members) {
          const memberYMap = new Y.Map();
          memberYMap.set('role', member.role);
          memberYMap.set('joinedAt', member.joinedAt);
          memberYMap.set('name', member.name || null);
          memberYMap.set('email', member.email || null);
          memberYMap.set('displayName', member.displayName || null);
          memberYMap.set('image', member.image || null);
          membersMap.set(member.userId, memberYMap);
        }
      }

      // Updates are automatically broadcast via Y.doc update listener

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('handleSync error:', error);
      return new Response(JSON.stringify({ error: 'Sync failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Handle member sync request from D1 routes (add/update/remove single member)
   */
  async handleSyncMember(request) {
    await this.initializeDoc();

    try {
      const { action, member } = await request.json();
      const membersMap = this.doc.getMap('members');

      if (action === 'add') {
        const memberYMap = new Y.Map();
        memberYMap.set('role', member.role);
        memberYMap.set('joinedAt', member.joinedAt);
        memberYMap.set('name', member.name || null);
        memberYMap.set('email', member.email || null);
        memberYMap.set('displayName', member.displayName || null);
        memberYMap.set('image', member.image || null);
        membersMap.set(member.userId, memberYMap);
      } else if (action === 'update') {
        const existingMember = membersMap.get(member.userId);
        if (existingMember) {
          // Update role if provided
          if (member.role !== undefined) {
            existingMember.set('role', member.role);
          }
          // Update image if provided
          if (member.image !== undefined) {
            existingMember.set('image', member.image);
          }
          // Update display name if provided
          if (member.displayName !== undefined) {
            existingMember.set('displayName', member.displayName);
          }
          // Update name if provided
          if (member.name !== undefined) {
            existingMember.set('name', member.name);
          }
        }
      } else if (action === 'remove') {
        membersMap.delete(member.userId);
      }

      // Updates are automatically broadcast via Y.doc update listener

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('handleSyncMember error:', error);
      return new Response(JSON.stringify({ error: 'Sync failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Handle PDF sync request from routes (add/remove PDF metadata for a study)
   * Note: Y.js map key remains 'reviews' for backward compatibility
   */
  async handleSyncPdf(request) {
    await this.initializeDoc();

    try {
      const { action, studyId, studyName, pdf, fileName } = await request.json();

      // Note: Y.js map key remains 'reviews' for backward compatibility
      const studiesMap = this.doc.getMap('reviews');
      let studyYMap = studiesMap.get(studyId);

      // Create the study if it doesn't exist (handles race condition where
      // PDF upload arrives before Y.js sync creates the study)
      if (!studyYMap) {
        studyYMap = new Y.Map();
        studyYMap.set('name', studyName || 'Untitled Study');
        studyYMap.set('createdAt', Date.now());
        studyYMap.set('updatedAt', Date.now());
        studyYMap.set('checklists', new Y.Map());
        studiesMap.set(studyId, studyYMap);
      }

      // Get or create the pdfs Y.Map for this study
      let pdfsMap = studyYMap.get('pdfs');
      if (!pdfsMap) {
        pdfsMap = new Y.Map();
        studyYMap.set('pdfs', pdfsMap);
      }

      if (action === 'add' && pdf) {
        const pdfYMap = new Y.Map();
        pdfYMap.set('key', pdf.key);
        pdfYMap.set('fileName', pdf.fileName);
        pdfYMap.set('size', pdf.size);
        pdfYMap.set('uploadedBy', pdf.uploadedBy);
        pdfYMap.set('uploadedAt', pdf.uploadedAt);
        pdfsMap.set(pdf.fileName, pdfYMap);
      } else if (action === 'remove' && fileName) {
        pdfsMap.delete(fileName);
      }

      // Update study's updatedAt
      studyYMap.set('updatedAt', Date.now());

      // Updates are automatically broadcast via Y.doc update listener

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('handleSyncPdf error:', error);
      return new Response(JSON.stringify({ error: 'Sync failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  async initializeDoc() {
    if (!this.doc) {
      this.doc = new Y.Doc();
      this.awareness = new awarenessProtocol.Awareness(this.doc);

      // Load persisted state if exists
      const persistedState = await this.state.storage.get('yjs-state');
      if (persistedState) {
        Y.applyUpdate(this.doc, new Uint8Array(persistedState));
      }

      // Persist the FULL document state on every update
      // This ensures we don't lose data when the DO restarts
      this.doc.on('update', async (update, origin) => {
        // Encode the full document state, not just the incremental update
        const fullState = Y.encodeStateAsUpdate(this.doc);
        await this.state.storage.put('yjs-state', Array.from(fullState));

        // Broadcast update to all connected clients (except origin)
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, update);
        const message = encoding.toUint8Array(encoder);
        this.broadcastBinary(message, origin);
      });

      // Broadcast awareness updates to all clients
      this.awareness.on('update', ({ added, updated, removed }, origin) => {
        const changedClients = added.concat(updated, removed);
        if (changedClients.length > 0) {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageAwareness);
          encoding.writeVarUint8Array(
            encoder,
            awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients),
          );
          const message = encoding.toUint8Array(encoder);
          this.broadcastBinary(message, origin);
        }
      });
    }
  }

  async handleWebSocket(request) {
    console.log('handleWebSocket called, ENVIRONMENT:', this.env.ENVIRONMENT);

    let user = null;

    // Authenticate via cookies (standard HTTP cookie auth)
    try {
      const authResult = await verifyAuth(request, this.env);
      user = authResult.user;
      console.log('WebSocket auth result:', user ? `User ${user.id}` : 'No user');
    } catch (err) {
      console.error('WebSocket auth error:', err);
    }

    // Require authentication
    if (!user) {
      console.log('WebSocket auth failed - no user');
      return new Response('Authentication required', { status: 401 });
    }

    // Verify project membership
    // Extract projectId from URL: /api/project/:projectId/...
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const projectId = pathParts[3]; // /api/project/{projectId}/...
    console.log(`Verifying membership for user ${user.id} in project ${projectId}`);

    // Check if user is in the members map
    await this.initializeDoc();
    const membersMap = this.doc.getMap('members');
    const isMember = membersMap.has(user.id);

    if (!isMember) {
      console.log(`User ${user.id} is not a member of project ${projectId}`);
      // Use 1008 (Policy Violation) close code so client can detect membership issue
      return new Response('Not a project member', {
        status: 403,
        headers: { 'X-Close-Reason': 'not-a-member' },
      });
    }

    console.log(`User ${user.id} verified as member of project ${projectId}`);
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();
    // Store session with user info, awarenessClientId will be set when client sends awareness
    this.sessions.set(server, { user, awarenessClientId: null });

    // Log current document contents for debugging
    const reviewsMap = this.doc.getMap('reviews');
    console.log(`Document has ${reviewsMap.size} studies and ${membersMap.size} members`);

    // Note: We do NOT proactively send sync step 1 here.
    // The y-websocket client will send sync step 1 on connect,
    // and we respond via the message handler below.

    server.addEventListener('message', async event => {
      try {
        // Handle binary messages (y-websocket protocol)
        let data;
        if (event.data instanceof ArrayBuffer) {
          data = new Uint8Array(event.data);
        } else if (event.data instanceof Blob) {
          data = new Uint8Array(await event.data.arrayBuffer());
        } else {
          // String data - shouldn't happen with y-websocket binary protocol
          console.warn('Received unexpected string WebSocket message');
          return;
        }

        const decoder = decoding.createDecoder(data);
        const messageType = decoding.readVarUint(decoder);

        console.log(`Received message type: ${messageType}, data length: ${data.length}`);

        switch (messageType) {
          case messageSync: {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, messageSync);
            const syncMessageType = syncProtocol.readSyncMessage(
              decoder,
              encoder,
              this.doc,
              server,
            );
            console.log(
              `Sync message type: ${syncMessageType}, response length: ${encoding.length(encoder)}`,
            );
            // If there's a response to send (sync step 2 or update acknowledgment)
            if (encoding.length(encoder) > 1) {
              server.send(encoding.toUint8Array(encoder));
            }
            break;
          }
          case messageAwareness: {
            const awarenessUpdate = decoding.readVarUint8Array(decoder);
            awarenessProtocol.applyAwarenessUpdate(this.awareness, awarenessUpdate, server);

            // Extract and store the client's awareness ID from the update
            // The first client ID in the update is typically the sender's ID
            const awarenessDecoder = decoding.createDecoder(awarenessUpdate);
            const len = decoding.readVarUint(awarenessDecoder);
            if (len > 0) {
              const clientId = decoding.readVarUint(awarenessDecoder);
              const session = this.sessions.get(server);
              if (session && session.awarenessClientId === null) {
                session.awarenessClientId = clientId;
              }
            }
            break;
          }
          default:
            console.warn('Unknown message type:', messageType);
        }
      } catch (error) {
        console.error('WebSocket message error (ProjectDoc):', error);
      }
    });

    server.addEventListener('close', () => {
      // Remove awareness state for this client using their stored clientID
      const session = this.sessions.get(server);
      if (session && session.awarenessClientId != null) {
        awarenessProtocol.removeAwarenessStates(
          this.awareness,
          [session.awarenessClientId],
          server,
        );
      }
      this.sessions.delete(server);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Helper to convert Y.Map to plain object recursively
   */
  yMapToPlain(yMap) {
    if (!yMap || typeof yMap.toJSON !== 'function') {
      return yMap;
    }
    return yMap.toJSON();
  }

  /**
   * Get comprehensive project info with hierarchical structure:
   * Project -> Reviews -> Checklists -> Answers
   */
  async getProjectInfo() {
    await this.initializeDoc();

    const result = {
      id: this.state.id.toString(),
      meta: this.yMapToPlain(this.doc.getMap('meta')),
      members: [],
      reviews: [],
    };

    // Get members
    const membersMap = this.doc.getMap('members');
    for (const [userId, value] of membersMap.entries()) {
      result.members.push({
        userId,
        ...this.yMapToPlain(value),
      });
    }

    // Get reviews with nested checklists and pdfs
    const reviewsMap = this.doc.getMap('reviews');
    for (const [reviewId, reviewValue] of reviewsMap.entries()) {
      const reviewData = this.yMapToPlain(reviewValue);
      const review = {
        id: reviewId,
        name: reviewData.name,
        description: reviewData.description,
        createdAt: reviewData.createdAt,
        updatedAt: reviewData.updatedAt,
        checklists: [],
        pdfs: [],
      };

      // Get checklists within this review
      const checklistsMap = reviewValue.get('checklists');
      if (checklistsMap && checklistsMap.entries) {
        for (const [checklistId, checklistValue] of checklistsMap.entries()) {
          const checklistData = this.yMapToPlain(checklistValue);
          review.checklists.push({
            id: checklistId,
            title: checklistData.title,
            assignedTo: checklistData.assignedTo,
            status: checklistData.status || 'pending',
            createdAt: checklistData.createdAt,
            updatedAt: checklistData.updatedAt,
            answers: checklistData.answers || {},
          });
        }
      }

      // Get PDFs within this review
      const pdfsMap = reviewValue.get('pdfs');
      if (pdfsMap && pdfsMap.entries) {
        for (const [fileName, pdfValue] of pdfsMap.entries()) {
          const pdfData = this.yMapToPlain(pdfValue);
          review.pdfs.push({
            fileName,
            key: pdfData.key,
            size: pdfData.size,
            uploadedBy: pdfData.uploadedBy,
            uploadedAt: pdfData.uploadedAt,
          });
        }
      }

      result.reviews.push(review);
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Broadcast binary message to all connected clients
   */
  broadcastBinary(message, exclude = null) {
    this.sessions.forEach((sessionData, ws) => {
      if (ws !== exclude && ws.readyState === 1) {
        ws.send(message);
      }
    });
  }
}
