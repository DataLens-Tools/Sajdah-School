// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Sajdah Qur'an School",
  description: 'Online Qur’an, Tajweed & Arabic',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* ❌ remove any bg-gradient / dark classes from body */}
      <body className="min-h-screen bg-white text-slate-900">
        {children}
      </body>
    </html>
  );
}
