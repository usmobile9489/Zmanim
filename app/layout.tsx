import './globals.css';

export const metadata = {
  title: 'Zmanim Caller',
  description: 'Phone calls with zmanim from YidCal',
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#111418' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Frank+Ruhl+Libre:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
