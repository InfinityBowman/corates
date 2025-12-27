/**
 * Minimal Google Picker helper.
 *
 * Loads https://apis.google.com/js/api.js and opens a DocsView filtered to PDFs.
 */

let googleApiScriptPromise

function loadGoogleApiScript() {
  if (googleApiScriptPromise) return googleApiScriptPromise

  googleApiScriptPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Google Picker can only be used in the browser'))
      return
    }

    // Already loaded
    if (window.gapi && window.google?.picker) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://apis.google.com/js/api.js'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google API script'))
    document.head.appendChild(script)
  })

  return googleApiScriptPromise
}

async function loadGooglePicker() {
  await loadGoogleApiScript()

  if (window.google?.picker) return
  if (!window.gapi?.load) {
    throw new Error('Google API did not initialize correctly')
  }

  await new Promise((resolve, reject) => {
    try {
      window.gapi.load('picker', { callback: resolve })
    } catch (err) {
      reject(err)
    }
  })

  if (!window.google?.picker) {
    throw new Error('Google Picker failed to load')
  }
}

/**
 * @typedef {{id: string, name: string}} PickedDriveFile
 */

/**
 * Opens Google Picker and resolves with selected PDFs.
 *
 * @param {Object} options
 * @param {string} options.oauthToken
 * @param {string} options.developerKey
 * @param {string | undefined | null} [options.appId]
 * @param {boolean} [options.multiselect]
 * @returns {Promise<PickedDriveFile[] | null>} null means user cancelled/closed.
 */
export async function pickGooglePdfFiles(options) {
  if (!options?.oauthToken) throw new Error('Missing oauthToken')
  if (!options?.developerKey) throw new Error('Missing developerKey')

  await loadGooglePicker()

  const { google } = window

  return new Promise((resolve) => {
    const docsView = new google.picker.DocsView()
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
      .setMimeTypes('application/pdf')

    let builder = new google.picker.PickerBuilder()
      .setOAuthToken(options.oauthToken)
      .setDeveloperKey(options.developerKey)
      .setCallback((data) => {
        if (data.action === google.picker.Action.CANCEL) {
          resolve(null)
          return
        }

        if (data.action !== google.picker.Action.PICKED) return

        const docs = data.docs || []
        const files = docs
          .map((doc) => {
            const id = doc.id || doc[google.picker.Document.ID]
            const name = doc.name || doc[google.picker.Document.NAME]
            if (!id || !name) return null
            return { id, name }
          })
          .filter(Boolean)

        resolve(files)
      })
      .addView(docsView)
      .setOrigin(window.location.origin)

    if (options.multiselect) {
      builder = builder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
    }

    if (options.appId) {
      builder = builder.setAppId(String(options.appId))
    }

    const picker = builder.build()
    picker.setVisible(true)
  })
}
