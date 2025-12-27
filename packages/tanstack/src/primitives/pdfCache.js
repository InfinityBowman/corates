/**
 * pdfCache - Local-first PDF caching layer using IndexedDB
 *
 * This provides a cache for PDFs stored in cloud (R2) to enable:
 * - Fast loading from local cache
 * - Offline access to previously viewed PDFs
 * - Reduced bandwidth usage
 *
 * The cloud (R2) remains the source of truth. This is just a cache.
 */

const DB_NAME = 'corates-pdf-cache'
const DB_VERSION = 1
const PDF_STORE_NAME = 'pdfs'

// Shared database instance and initialization promise
let dbInstance = null
let dbInitPromise = null

/**
 * Open the IndexedDB database (singleton pattern)
 */
function openDatabase() {
  if (dbInitPromise) {
    return dbInitPromise
  }

  if (dbInstance) {
    return Promise.resolve(dbInstance)
  }

  dbInitPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      dbInitPromise = null
      reject(request.error)
    }

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      if (!db.objectStoreNames.contains(PDF_STORE_NAME)) {
        // Key is a composite: projectId:studyId:fileName
        const store = db.createObjectStore(PDF_STORE_NAME, { keyPath: 'id' })
        store.createIndex('projectId', 'projectId', { unique: false })
        store.createIndex('studyId', 'studyId', { unique: false })
        store.createIndex('cachedAt', 'cachedAt', { unique: false })
      }
    }
  })

  return dbInitPromise
}

/**
 * Get database instance
 */
async function getDb() {
  return openDatabase()
}

/**
 * Generate cache key for a PDF
 */
function getCacheKey(projectId, studyId, fileName) {
  return `${projectId}:${studyId}:${fileName}`
}

/**
 * Get a PDF from the local cache
 * @param {string} projectId
 * @param {string} studyId
 * @param {string} fileName
 * @returns {Promise<ArrayBuffer|null>} The PDF data or null if not cached
 */
export async function getCachedPdf(projectId, studyId, fileName) {
  try {
    const db = await getDb()
    const id = getCacheKey(projectId, studyId, fileName)

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PDF_STORE_NAME, 'readonly')
      const store = transaction.objectStore(PDF_STORE_NAME)
      const request = store.get(id)

      request.onsuccess = () => {
        const result = request.result
        resolve(result ? result.data : null)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.warn('Failed to read from PDF cache:', err)
    return null
  }
}

/**
 * Save a PDF to the local cache
 * @param {string} projectId
 * @param {string} studyId
 * @param {string} fileName
 * @param {ArrayBuffer} data
 */
export async function cachePdf(projectId, studyId, fileName, data) {
  try {
    const db = await getDb()
    const id = getCacheKey(projectId, studyId, fileName)

    const record = {
      id,
      projectId,
      studyId,
      fileName,
      data,
      size: data.byteLength,
      cachedAt: Date.now(),
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PDF_STORE_NAME, 'readwrite')
      const store = transaction.objectStore(PDF_STORE_NAME)
      const request = store.put(record)

      request.onsuccess = () => resolve(true)
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.warn('Failed to write to PDF cache:', err)
    // Don't throw - caching failure shouldn't break the app
  }
}

/**
 * Remove a PDF from the local cache
 * @param {string} projectId
 * @param {string} studyId
 * @param {string} fileName
 */
export async function removeCachedPdf(projectId, studyId, fileName) {
  try {
    const db = await getDb()
    const id = getCacheKey(projectId, studyId, fileName)

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PDF_STORE_NAME, 'readwrite')
      const store = transaction.objectStore(PDF_STORE_NAME)
      const request = store.delete(id)

      request.onsuccess = () => resolve(true)
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.warn('Failed to remove from PDF cache:', err)
    // Don't throw - cache cleanup failure shouldn't break the app
  }
}

/**
 * Clear all cached PDFs for a study
 * @param {string} projectId
 * @param {string} studyId
 */
export async function clearStudyCache(projectId, studyId) {
  try {
    const db = await getDb()
    const keyPrefix = `${projectId}:${studyId}:`

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PDF_STORE_NAME, 'readwrite')
      const store = transaction.objectStore(PDF_STORE_NAME)
      const request = store.openCursor()
      let deleted = 0

      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          if (cursor.key.startsWith(keyPrefix)) {
            cursor.delete()
            deleted++
          }
          cursor.continue()
        } else {
          resolve(deleted)
        }
      }
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.warn('Failed to clear study cache:', err)
  }
}

/**
 * Clear all cached PDFs for a project
 * @param {string} projectId
 */
export async function clearProjectCache(projectId) {
  try {
    const db = await getDb()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PDF_STORE_NAME, 'readwrite')
      const store = transaction.objectStore(PDF_STORE_NAME)
      const index = store.index('projectId')
      const keyRange = globalThis.IDBKeyRange.only(projectId)
      const request = index.openCursor(keyRange)
      let deleted = 0

      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          cursor.delete()
          deleted++
          cursor.continue()
        } else {
          resolve(deleted)
        }
      }
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.warn('Failed to clear project cache:', err)
  }
}

export default {
  getCachedPdf,
  cachePdf,
  removeCachedPdf,
  clearStudyCache,
  clearProjectCache,
}
