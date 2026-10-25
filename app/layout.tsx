import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const poppins = localFont({
  src: [
    { path: './fonts/Poppins-Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/Poppins-Medium.ttf', weight: '500', style: 'normal' },
    { path: './fonts/Poppins-SemiBold.ttf', weight: '600', style: 'normal' },
    { path: './fonts/Poppins-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-poppins',
  display: 'swap',
});
const inter = localFont({
  src: './fonts/Inter.ttf',
  weight: '100 900',
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  icons: { icon: '/brand/radia-genz.png', apple: '/brand/radia-genz.png' },
  title: 'Radia — Your Radiography Learning Companion',
  description: 'Read your radiography lectures, practice source-linked questions, build recall with flashcards, and prepare with custom timed exams.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return <html lang="en" suppressHydrationWarning className={`${poppins.variable} ${inter.variable}`}><head><script dangerouslySetInnerHTML={{__html: `try{const s=JSON.parse(localStorage.getItem('radia-study-v1')||'null');document.documentElement.dataset.theme=s?.state?.theme==='dark'?'dark':'light'}catch{}`}}/></head><body>{children}</body></html>;
}
