import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DSL Distributors | Supplies Without Limits',
  description: 'Supplies Without Limits. Premier distributor of authentic school exercise books, CR books, pens, geometry sets, and commercial office stationery across Sri Lanka.',
  keywords: ['stationery distribution', 'dsl distributors', 'sri lanka', 'atlas cr book', 'school packs', 'exercise books', 'promate', 'office supplies'],
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
