import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AI Content',
    short_name: 'AI Content',
    description: 'Run several niche content workspaces from one place.',
    start_url: '/app',
    display: 'standalone',
    background_color: '#f6f5f2',
    theme_color: '#f6f5f2',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
