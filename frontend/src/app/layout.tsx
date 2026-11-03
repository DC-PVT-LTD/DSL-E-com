import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DSL Stationery | Sri Lanka Premier Stationery Store',
  description: 'Shop authentic Sri Lankan school exercise books, CR books, pen packs, geometry kits, and office stationery. Islandwide delivery within 2-3 days.',
  keywords: ['stationery', 'sri lanka', 'atlas cr book', 'school packs', 'exercise books', 'promate', 'office supplies'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-full flex flex-col font-sans antialiased bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
