// @refresh reload
import { createHandler, StartServer } from '@solidjs/start/server';

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang='en'>
        <head>
          <meta charset='utf-8' />
          <meta name='viewport' content='width=device-width, initial-scale=1' />
          <meta name='theme-color' content='#ffffff' />
          <link rel='icon' type='image/svg+xml' href='/favicon.svg' />
          <link rel='icon' type='image/png' sizes='96x96' href='/favicon-96x96.png' />
          <link rel='icon' type='image/x-icon' href='/favicon.ico' />
          <link rel='apple-touch-icon' sizes='180x180' href='/apple-touch-icon.png' />
          <link rel='manifest' href='/site.webmanifest' />
          <link
            rel='preload'
            href='/fonts/inter-latin-400-normal.woff2'
            as='font'
            type='font/woff2'
            crossorigin
          />
          <link
            rel='preload'
            href='/fonts/inter-latin-600-normal.woff2'
            as='font'
            type='font/woff2'
            crossorigin
          />
          {assets}
        </head>
        <body class='font-sans text-gray-900 antialiased'>
          <div id='app'>{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
