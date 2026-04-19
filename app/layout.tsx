import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VideoCall Platform',
  description: 'Free self-hosted video calling',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body style={{
        margin: 0,
        padding: 0,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#f4f4f4',
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
      }}>

        {/* Global Header */}
        <header style={{
          flexShrink: 0,
          padding: '0 32px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #e7e7e7',
          background: '#fff',
          backdropFilter: 'blur(10px)',
          boxSizing: 'border-box',
          zIndex: 100,
        }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 16,
              boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
            }}>
              🎥
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#111', letterSpacing: '-0.3px' }}>
                VideoCall
              </div>
              <div style={{ fontSize: 10, color: '#888', marginTop: -1 }}>
                Free · Secure · No sign-up
              </div>
            </div>
          </a>
          <div style={{
            fontSize: 11, color: '#888',
            background: '#f4f4f4',
            padding: '4px 10px', borderRadius: 20,
            border: '1px solid #e7e7e7',
          }}>
            Beta
          </div>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>

        {/* Global Footer */}
        <footer style={{
          flexShrink: 0,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderTop: '1px solid #e7e7e7',
          background: '#fff',
        }}>
          <span style={{ fontSize: 11, color: '#aaa' }}>
            Powered by{' '}
            <span style={{ color: '#111', fontWeight: 600 }}>
              EduBridgePlatform
            </span>
            {' '}© 2026 — Launching Soon
          </span>
        </footer>

      </body>
    </html>
  );
}