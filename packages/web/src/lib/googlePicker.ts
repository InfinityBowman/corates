/**
 * Minimal Google Picker helper.
 *
 * Loads https://apis.google.com/js/api.js and opens a DocsView filtered to PDFs.
 */

// Google API types are not available as declarations
declare global {
  interface Window {
    gapi?: {
      load: (library: string, options: { callback: () => void }) => void;
    };
    google?: {
      picker: {
        DocsView: new () => {
          setIncludeFolders: (include: boolean) => {
            setSelectFolderEnabled: (enabled: boolean) => {
              setMimeTypes: (types: string) => unknown;
            };
          };
        };

        PickerBuilder: new () => any;
        Action: {
          CANCEL: string;
          PICKED: string;
        };
        Feature: {
          MULTISELECT_ENABLED: string;
        };
        Document: {
          ID: string;
          NAME: string;
        };
      };
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

    // Already loaded
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

async function loadGooglePicker(): Promise<void> {
  await loadGoogleApiScript();

  if (window.google?.picker) return;
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

  await loadGooglePicker();

  const { google } = window;

  return new Promise(resolve => {
    const docsView = new google!.picker.DocsView()
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
      .setMimeTypes('application/pdf');

    let builder: any = new google!.picker.PickerBuilder()

      .setOAuthToken(options.oauthToken)
      .setDeveloperKey(options.developerKey)

      .setCallback((data: any) => {
        if (data.action === google!.picker.Action.CANCEL) {
          resolve(null);
          return;
        }

        if (data.action !== google!.picker.Action.PICKED) return;

        const docs: any[] = data.docs || [];
        const files = docs

          .map((doc: any) => {
            const id = doc.id || doc[google!.picker.Document.ID];
            const name = doc.name || doc[google!.picker.Document.NAME];
            if (!id || !name) return null;
            return { id, name };
          })
          .filter(Boolean) as PickedDriveFile[];

        resolve(files);
      })
      .addView(docsView)
      .setOrigin(window.location.origin);

    if (options.multiselect) {
      builder = builder.enableFeature(google!.picker.Feature.MULTISELECT_ENABLED);
    }

    if (options.appId) {
      builder = builder.setAppId(String(options.appId));
    }

    const picker = builder.build();
    picker.setVisible(true);
  });
}
