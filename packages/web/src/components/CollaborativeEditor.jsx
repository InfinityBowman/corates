import { createSignal, createEffect, onCleanup } from 'solid-js'
import * as Y from 'yjs'

export default function CollaborativeEditor({ apiBase }) {
  const [doc, setDoc] = createSignal(null)
  const [text, setText] = createSignal('')
  const [docId, setDocId] = createSignal('demo-doc')
  const [connected, setConnected] = createSignal(false)
  const [connectedUsers, setConnectedUsers] = createSignal(0)
  const [wsConnection, setWsConnection] = createSignal(null)

  let ws
  let yDoc
  let yText
  let textAreaRef

  const connectToDocument = () => {
    try {
      // Initialize Yjs document
      yDoc = new Y.Doc()
      yText = yDoc.getText('content')

      // Listen for text changes from Yjs
      yText.observe(() => {
        const content = yText.toString()
        // Only update if content actually differs to prevent unnecessary re-renders
        if (content !== text()) {
          // Store cursor position if textarea is focused
          const cursorPos =
            textAreaRef && document.activeElement === textAreaRef ?
              textAreaRef.selectionStart
            : null

          setText(content)

          // Restore cursor position if it was stored
          if (cursorPos !== null && textAreaRef) {
            setTimeout(() => {
              textAreaRef.setSelectionRange(cursorPos, cursorPos)
            }, 0)
          }
        }
      })

      // Connect WebSocket
      const wsUrl = apiBase.replace('http', 'ws') + `/api/docs/${docId()}`
      ws = new WebSocket(wsUrl)
      setWsConnection(ws)

      ws.onopen = () => {
        setConnected(true)
        console.log('Connected to document:', docId())
      }

      ws.onmessage = event => {
        const data = JSON.parse(event.data)

        if (data.type === 'sync' || data.type === 'update') {
          const update = new Uint8Array(data.update)
          Y.applyUpdate(yDoc, update)
        }
      }

      ws.onclose = () => {
        setConnected(false)
        console.log('Disconnected from document')
      }

      ws.onerror = error => {
        console.error('WebSocket error:', error)
        setConnected(false)
      }
    } catch (error) {
      console.error('Failed to connect to document:', error)
    }
  }

  const disconnect = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close()
    }
    setWsConnection(null)
    setConnected(false)
    yDoc = null
    yText = null
  }

  const handleTextChange = e => {
    if (!yText) return

    const newContent = e.target.value
    const currentContent = yText.toString()

    if (newContent !== currentContent) {
      // Store cursor position before making changes
      const cursorPos = e.target.selectionStart

      // Calculate the difference and apply minimal changes
      const commonStart = getCommonStart(currentContent, newContent)
      const commonEnd = getCommonEnd(
        currentContent.slice(commonStart),
        newContent.slice(commonStart),
      )

      const deleteLength = currentContent.length - commonStart - commonEnd
      const insertText = newContent.slice(commonStart, newContent.length - commonEnd)

      // Apply changes to Yjs
      if (deleteLength > 0) {
        yText.delete(commonStart, deleteLength)
      }
      if (insertText.length > 0) {
        yText.insert(commonStart, insertText)
      }

      // Send update to other clients
      if (ws && ws.readyState === WebSocket.OPEN) {
        const update = Y.encodeStateAsUpdate(yDoc)
        ws.send(
          JSON.stringify({
            type: 'update',
            update: Array.from(update),
          }),
        )
      }

      // Restore cursor position after a short delay
      setTimeout(() => {
        if (textAreaRef) {
          textAreaRef.setSelectionRange(cursorPos, cursorPos)
        }
      }, 0)
    }
  }

  // Helper function to find common prefix
  const getCommonStart = (str1, str2) => {
    let i = 0
    while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
      i++
    }
    return i
  }

  // Helper function to find common suffix
  const getCommonEnd = (str1, str2) => {
    let i = 0
    while (
      i < str1.length &&
      i < str2.length &&
      str1[str1.length - 1 - i] === str2[str2.length - 1 - i]
    ) {
      i++
    }
    return i
  }

  const loadDocumentInfo = async () => {
    try {
      const response = await fetch(`${apiBase}/api/docs/${docId()}`)
      if (response.ok) {
        const data = await response.json()
        setConnectedUsers(data.connectedUsers || 0)
      }
    } catch (error) {
      console.error('Failed to load document info:', error)
    }
  }

  onCleanup(() => {
    disconnect()
  })

  return (
    <div class='bg-gray-800 rounded-lg p-6'>
      <h2 class='text-xl font-bold mb-4 text-blue-400'>
        📝 Collaborative Document (Yjs + Durable Objects)
      </h2>

      {/* Connection Controls */}
      <div class='mb-4 space-y-2'>
        <div class='flex gap-2'>
          <input
            type='text'
            placeholder='Document ID'
            value={docId()}
            onInput={e => setDocId(e.target.value)}
            class='px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm flex-1'
          />
          <button
            onClick={connectToDocument}
            disabled={connected()}
            class='px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm'
          >
            {connected() ? '🟢 Connected' : '🔴 Connect'}
          </button>
          <button
            onClick={disconnect}
            disabled={!connected()}
            class='px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm'
          >
            Disconnect
          </button>
          <button
            onClick={loadDocumentInfo}
            class='px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm'
          >
            Refresh Info
          </button>
        </div>

        {connected() && (
          <div class='text-sm text-green-400'>
            ✅ Connected • {connectedUsers()} user(s) editing
          </div>
        )}
      </div>

      {/* Text Editor */}
      <div class='mb-4'>
        <textarea
          ref={textAreaRef}
          placeholder={
            connected() ?
              'Start typing to collaborate in real-time...'
            : 'Connect to a document first'
          }
          value={text()}
          onInput={handleTextChange}
          disabled={!connected()}
          rows='10'
          class='w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded disabled:bg-gray-800 disabled:cursor-not-allowed font-mono text-sm'
        />
      </div>

      {/* Status */}
      <div class='text-xs text-gray-400 mb-4'>
        Document: <code class='text-blue-300'>{docId()}</code> • Status:{' '}
        <span class={connected() ? 'text-green-400' : 'text-red-400'}>
          {connected() ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Info */}
      <div class='p-3 bg-blue-900 border border-blue-700 rounded'>
        <h3 class='font-semibold text-blue-400 mb-2'>ℹ️ How it works</h3>
        <p class='text-sm text-blue-200'>
          This uses Yjs (CRDT) for real-time collaboration. Multiple users can edit the same
          document simultaneously. Changes are synced through Durable Objects and automatically
          merged without conflicts.
        </p>
        <p class='text-sm text-blue-200 mt-2'>
          Try opening this in multiple browser tabs with the same document ID!
        </p>
      </div>
    </div>
  )
}
