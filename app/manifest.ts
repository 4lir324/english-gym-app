// src/app/manifest.ts
import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AI English Gym',
    short_name: 'AI English Gym',
    description: 'Learn English with AI',
    start_url: '/',
    display: 'standalone',
    background_color: '#1e130c',
    theme_color: '#1e130c',
    icons: [
      {
        // 👇 آدرس دهی از ریشه پوشه public شروع می‌شود (بدون نوشتن کلمه public)
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}