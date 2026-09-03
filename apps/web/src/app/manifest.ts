import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AI Content',
    short_name: 'AI Content',
    description: 'Run several niche content workspaces from one place.',
    /**
     * `id` pins the app's identity independently of start_url. Without it the
     * install is keyed on the start URL, so changing start_url later makes
     * the browser treat it as a DIFFERENT app: existing installs are orphaned
     * and users get a second icon rather than an update.
     */
    id: '/app',
    start_url: '/app',
    /**
     * Navigating outside the scope opens a browser tab on top of the
     * installed app. Everything the app owns lives under /, and the auth
     * screens are part of the flow, so the scope is the origin root.
     */
    scope: '/',
    display: 'standalone',
    background_color: '#f6f5f2',
    theme_color: '#f6f5f2',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      // Android crops a maskable icon to the launcher's shape and keeps only
      // the central 80%. The two icons above run to the edges (measured inset
      // 0%), so they are declared 'any' only - marking them maskable would let
      // the crop eat the glyph. This variant carries the padding instead.
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
