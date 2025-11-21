import { createSignal } from 'solid-js';

export default function FileUpload({ apiBase }) {
  const [selectedFile, setSelectedFile] = createSignal(null);
  const [uploading, setUploading] = createSignal(false);
  const [uploadResult, setUploadResult] = createSignal(null);
  const [uploadError, setUploadError] = createSignal('');

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
    setUploadResult(null);
    setUploadError('');
  };

  const uploadFile = async () => {
    if (!selectedFile()) {
      setUploadError('Please select a file first');
      return;
    }

    setUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile());

      const response = await fetch(`${apiBase}/api/media/upload`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        setUploadResult(result);
        setSelectedFile(null);
        // Reset the file input
        document.getElementById('file-input').value = '';
      } else {
        setUploadError(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError('Network error occurred');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div class="bg-gray-800 rounded-lg p-6">
      <h2 class="text-xl font-bold mb-4 text-blue-400">📁 File Upload (R2 Storage)</h2>
      
      {/* File Selection */}
      <div class="mb-4">
        <div class="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-gray-500 transition-colors">
          <input
            id="file-input"
            type="file"
            onChange={handleFileSelect}
            class="hidden"
          />
          <label for="file-input" class="cursor-pointer">
            <div class="text-gray-400 mb-2">
              <svg class="mx-auto h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <p class="text-sm text-gray-400">
              <span class="font-medium text-blue-400">Click to upload</span> or drag and drop
            </p>
            <p class="text-xs text-gray-500">PNG, JPG, PDF up to 10MB</p>
          </label>
        </div>
      </div>

      {/* Selected File Info */}
      {selectedFile() && (
        <div class="mb-4 p-3 bg-gray-700 rounded">
          <h3 class="font-semibold text-green-400 mb-2">Selected File:</h3>
          <div class="text-sm space-y-1">
            <p><span class="text-gray-400">Name:</span> {selectedFile().name}</p>
            <p><span class="text-gray-400">Size:</span> {formatFileSize(selectedFile().size)}</p>
            <p><span class="text-gray-400">Type:</span> {selectedFile().type || 'Unknown'}</p>
          </div>
        </div>
      )}

      {/* Upload Button */}
      <div class="mb-4">
        <button
          onClick={uploadFile}
          disabled={!selectedFile() || uploading()}
          class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors"
        >
          {uploading() ? (
            <span class="flex items-center justify-center">
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Uploading...
            </span>
          ) : (
            'Upload to R2'
          )}
        </button>
      </div>

      {/* Upload Result */}
      {uploadResult() && (
        <div class="p-3 bg-green-900 border border-green-700 rounded">
          <h3 class="font-semibold text-green-400 mb-2">✅ Upload Successful!</h3>
          <div class="text-sm space-y-1">
            <p><span class="text-gray-400">File name:</span> {uploadResult().fileName}</p>
            <p><span class="text-gray-400">URL:</span> 
              <code class="ml-1 px-2 py-1 bg-gray-800 rounded text-blue-300">{uploadResult().url}</code>
            </p>
          </div>
        </div>
      )}

      {/* Upload Error */}
      {uploadError() && (
        <div class="p-3 bg-red-900 border border-red-700 rounded">
          <h3 class="font-semibold text-red-400 mb-2">❌ Upload Failed</h3>
          <p class="text-sm text-red-300">{uploadError()}</p>
        </div>
      )}

      {/* Info */}
      <div class="mt-4 p-3 bg-blue-900 border border-blue-700 rounded">
        <h3 class="font-semibold text-blue-400 mb-2">ℹ️ How it works</h3>
        <p class="text-sm text-blue-200">
          Files are uploaded to Cloudflare R2 storage through your Workers API. 
          The worker generates unique filenames and handles the upload process.
        </p>
      </div>
    </div>
  );
}