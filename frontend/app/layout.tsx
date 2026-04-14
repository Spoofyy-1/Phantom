import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Phantom — Synthetic User Testing',
  description: 'Test your website through the eyes of diverse real-world personas powered by AI.',
  openGraph: {
    title: 'Phantom',
    description: 'Synthetic user testing with AI personas',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var t = localStorage.getItem('phantom-theme') || 'dark';
            document.documentElement.setAttribute('data-theme', t);
          })()
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
