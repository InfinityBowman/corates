/// <reference types="google.picker" />
/* global google */
/**
 * Minimal Google Picker helper.
 *
 * Loads https://apis.google.com/js/api.js and opens a DocsView filtered to PDFs.
 *
 * Picker types come from `@types/google.picker` (declares the global
 * `google.picker` namespace, opted into via the reference directive above —
 * the project tsconfig pins `types: ["vite/client"]` so we don't pollute the
 * global type space project-wide). `gapi.load` isn't covered by that package
 * and is the only other Google API we use, so it gets a small stub here
 * rather than pulling in `@types/gapi`.
 */

declare global {
  interface Window {
    gapi?: {
      load: (library: string, options: { callback: () => void }) => void;
    };
    google?: {
      picker: typeof google.picker;
    };
  }
}

let googleApiScriptPromise: Promise<void> | undefined;

function loadGoogleApiScript(): Promise<void> {
  if (googleApiScriptPromise) return googleApiScriptPromise;

  googleApiScriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Google Picker can only be used in the browser'));
      return;
    }

    if (window.gapi && window.google?.picker) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google API script'));
    document.head.appendChild(script);
  });

  return googleApiScriptPromise;
}

async function loadGooglePicker(): Promise<typeof google.picker> {
  await loadGoogleApiScript();

  if (window.google?.picker) return window.google.picker;
  if (!window.gapi?.load) {
    throw new Error('Google API did not initialize correctly');
  }

  await new Promise<void>((resolve, reject) => {
    try {
      window.gapi!.load('picker', { callback: resolve });
    } catch (err) {
      reject(err);
    }
  });

  if (!window.google?.picker) {
    throw new Error('Google Picker failed to load');
  }
  return window.google.picker;
}

interface PickedDriveFile {
  id: string;
  name: string;
}

interface PickerOptions {
  oauthToken: string;
  developerKey: string;
  appId?: string | null;
  multiselect?: boolean;
}

/**
 * Opens Google Picker and resolves with selected PDFs.
 * Returns null if user cancelled/closed.
 */
export async function pickGooglePdfFiles(
  options: PickerOptions,
): Promise<PickedDriveFile[] | null> {
  if (!options?.oauthToken) throw new Error('Missing oauthToken');
  if (!options?.developerKey) throw new Error('Missing developerKey');

  const picker = await loadGooglePicker();

  return new Promise(resolve => {
    const docsView = new picker.DocsView()
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
      .setMimeTypes('application/pdf');

    let builder = new picker.PickerBuilder()
      .setOAuthToken(options.oauthToken)
      .setDeveloperKey(options.developerKey)
      .setCallback((data: google.picker.ResponseObject) => {
        if (data.action === picker.Action.CANCEL) {
          resolve(null);
          return;
        }

        if (data.action !== picker.Action.PICKED) return;

        const docs = data.docs ?? [];
        const files = docs
          .map((doc): PickedDriveFile | null => {
            const id = doc.id;
            const name = doc.name;
            if (!id || !name) return null;
            return { id, name };
          })
          .filter((f): f is PickedDriveFile => f !== null);

        resolve(files);
      })
      .addView(docsView)
      .setOrigin(window.location.origin);

    if (options.multiselect) {
      builder = builder.enableFeature(picker.Feature.MULTISELECT_ENABLED);
    }

    if (options.appId) {
      builder = builder.setAppId(String(options.appId));
    }

    builder.build().setVisible(true);
  });
}
