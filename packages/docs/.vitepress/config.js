import { withMermaid } from 'vitepress-plugin-mermaid';

export default withMermaid({
  title: 'CoRATES Documentation',
  description: 'Collaborative Research Appraisal Tool for Evidence Synthesis - Documentation',
  base: '/',

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Architecture', link: '/architecture/' },
      { text: 'Guides', link: '/guides/' },
    ],

    sidebar: {
      '/': [
        {
          text: 'Getting Started',
          items: [{ text: 'Home', link: '/' }],
        },
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/architecture/' },
            {
              text: 'Package Architecture',
              link: '/architecture/diagrams/01-package-architecture',
            },
            { text: 'System Architecture', link: '/architecture/diagrams/02-system-architecture' },
            { text: 'Sync Flow', link: '/architecture/diagrams/03-sync-flow' },
            { text: 'Data Model', link: '/architecture/diagrams/04-data-model' },
            { text: 'Frontend Routes', link: '/architecture/diagrams/05-frontend-routes' },
            { text: 'API Routes', link: '/architecture/diagrams/06-api-routes' },
            { text: 'API Actions', link: '/architecture/diagrams/07-api-actions' },
            { text: 'Yjs Sync', link: '/architecture/diagrams/08-yjs-sync' },
          ],
        },
        {
          text: 'Guides',
          items: [
            { text: 'Overview', link: '/guides/' },
            {
              text: 'Core Development',
              items: [
                { text: 'State Management', link: '/guides/state-management' },
                { text: 'Primitives', link: '/guides/primitives' },
                { text: 'Components', link: '/guides/components' },
                { text: 'API Development', link: '/guides/api-development' },
              ],
            },
            {
              text: 'System-Specific',
              items: [
                { text: 'Authentication', link: '/guides/authentication' },
                { text: 'Yjs Sync', link: '/guides/yjs-sync' },
                { text: 'Database', link: '/guides/database' },
              ],
            },
            {
              text: 'Supporting',
              items: [
                { text: 'Configuration', link: '/guides/configuration' },
                { text: 'Testing', link: '/guides/testing' },
                { text: 'Development Workflow', link: '/guides/development-workflow' },
                { text: 'Error Handling', link: '/guides/error-handling' },
                { text: 'Style Guide', link: '/guides/style-guide' },
              ],
            },
          ],
        },
      ],
      '/architecture/': [
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/architecture/' },
            {
              text: 'Package Architecture',
              link: '/architecture/diagrams/01-package-architecture',
            },
            { text: 'System Architecture', link: '/architecture/diagrams/02-system-architecture' },
            { text: 'Sync Flow', link: '/architecture/diagrams/03-sync-flow' },
            { text: 'Data Model', link: '/architecture/diagrams/04-data-model' },
            { text: 'Frontend Routes', link: '/architecture/diagrams/05-frontend-routes' },
            { text: 'API Routes', link: '/architecture/diagrams/06-api-routes' },
            { text: 'API Actions', link: '/architecture/diagrams/07-api-actions' },
            { text: 'Yjs Sync', link: '/architecture/diagrams/08-yjs-sync' },
          ],
        },
      ],
      '/guides/': [
        {
          text: 'Guides',
          items: [
            { text: 'Overview', link: '/guides/' },
            {
              text: 'Core Development',
              items: [
                { text: 'State Management', link: '/guides/state-management' },
                { text: 'Primitives', link: '/guides/primitives' },
                { text: 'Components', link: '/guides/components' },
                { text: 'API Development', link: '/guides/api-development' },
              ],
            },
            {
              text: 'System-Specific',
              items: [
                { text: 'Authentication', link: '/guides/authentication' },
                { text: 'Yjs Sync', link: '/guides/yjs-sync' },
                { text: 'Database', link: '/guides/database' },
              ],
            },
            {
              text: 'Supporting',
              items: [
                { text: 'Configuration', link: '/guides/configuration' },
                { text: 'Testing', link: '/guides/testing' },
                { text: 'Development Workflow', link: '/guides/development-workflow' },
                { text: 'Error Handling', link: '/guides/error-handling' },
                { text: 'Style Guide', link: '/guides/style-guide' },
              ],
            },
          ],
        },
      ],
    },

    search: {
      provider: 'local',
    },

    // Uncomment and update when GitHub repository is available
    // socialLinks: [
    //   { icon: 'github', link: 'https://github.com/yourusername/corates' },
    // ],
    //
    // editLink: {
    //   pattern: 'https://github.com/yourusername/corates/edit/main/packages/docs/:path',
    //   text: 'Edit this page on GitHub',
    // },
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },

  vite: {
    optimizeDeps: {
      include: ['mermaid', 'dayjs'],
    },
    ssr: {
      noExternal: ['mermaid'],
    },
    define: {
      'import.meta.vitest': 'undefined',
    },
  },
});
