import { createSignal, createEffect } from 'solid-js';

/**
 * Client-side QR Code component using dynamic import
 * This keeps the TOTP secret secure by generating the QR code locally
 * instead of sending it to a third-party service.
 */
export default function QRCode(props) {
  const [dataUrl, setDataUrl] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(true);

  createEffect(() => {
    const data = props.data;
    if (!data) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    // Dynamic import to code-split the qrcode library
    // Capture reactive value before async operation
    const size = props.size || 200;

    import('qrcode')
      .then(QRCodeLib => {
        return QRCodeLib.toDataURL(data, {
          width: size,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'M',
        });
      })
      .then(url => {
        setDataUrl(url);
        setLoading(false);
      })
      .catch(err => {
        console.error('QR code generation failed:', err);
        setError('Failed to generate QR code');
        setLoading(false);
      });
  });

  return (
    <div
      class={`flex items-center justify-center ${props.class || ''}`}
      style={{ width: `${props.size || 200}px`, height: `${props.size || 200}px` }}
    >
      {loading() && (
        <div class='w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin' />
      )}
      {error() && <p class='text-red-500 text-sm text-center'>{error()}</p>}
      {!loading() && !error() && dataUrl() && (
        <img src={dataUrl()} alt={props.alt || 'QR Code'} class='w-full h-full' />
      )}
    </div>
  );
}
