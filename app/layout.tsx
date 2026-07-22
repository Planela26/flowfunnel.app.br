import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { Providers } from './providers'
import { Suspense } from 'react'
import { AffiliateTracker } from '@/components/AffiliateTracker'
import { MetaPixelTracker } from '@/components/MetaPixelTracker'
import { MetaAdvancedMatching } from '@/components/MetaAdvancedMatching'
import AppShell from '@/components/AppShell'
import ChunkErrorReloader from '@/components/ChunkErrorReloader'
import CookieConsent from '@/components/CookieConsent'

const inter = Inter({ subsets: ['latin'] })

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://flowfunnel.com.br')

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'FlowFunnel — Rastreie seu Funil de Vendas no WhatsApp',
    template: '%s | FlowFunnel',
  },
  description:
    'FlowFunnel é a plataforma brasileira que rastreia cada etapa do seu funil de vendas no WhatsApp e mostra onde você está perdendo dinheiro. Integre Meta Ads, Google Ads, TikTok, Hotmart, Eduzz e Kiwify em minutos.',
  applicationName: 'FlowFunnel',
  keywords: [
    'funil de vendas',
    'rastreamento WhatsApp',
    'Meta Ads',
    'Google Ads',
    'TikTok Ads',
    'Hotmart',
    'Eduzz',
    'Kiwify',
    'analytics de lançamento',
    'CRM WhatsApp',
    'SaaS Brasil',
  ],
  authors: [{ name: 'FlowFunnel' }],
  creator: 'FlowFunnel',
  publisher: 'FlowFunnel',
  icons: {
    icon: [
      { url: '/icon.jpg', type: 'image/jpeg' },
    ],
    apple: [
      { url: '/apple-icon.jpg', type: 'image/jpeg' },
    ],
    shortcut: ['/icon.jpg'],
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: SITE_URL,
    siteName: 'FlowFunnel',
    title: 'FlowFunnel — Rastreie seu Funil de Vendas no WhatsApp',
    description:
      'Descubra onde seu lançamento no WhatsApp está perdendo vendas. Rastreamento ponta-a-ponta de Meta Ads, Google, TikTok e checkout.',
    images: [
      {
        url: '/flowfunnel-logo.jpg',
        width: 1200,
        height: 1200,
        alt: 'FlowFunnel',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'FlowFunnel — Rastreie seu Funil de Vendas no WhatsApp',
    description:
      'Descubra onde seu lançamento no WhatsApp está perdendo vendas.',
    images: ['/flowfunnel-logo.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'FlowFunnel',
  alternateName: 'FlowFunnel SaaS',
  url: SITE_URL,
  logo: `${SITE_URL}/flowfunnel-logo.jpg`,
  description:
    'Plataforma brasileira de rastreamento de funil de vendas no WhatsApp com integração a Meta Ads, Google Ads, TikTok, Hotmart, Eduzz e Kiwify.',
  sameAs: [] as string[],
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'FlowFunnel',
  url: SITE_URL,
  inLanguage: 'pt-BR',
  publisher: {
    '@type': 'Organization',
    name: 'FlowFunnel',
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/flowfunnel-logo.jpg`,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={inter.className}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        {/* Meta Pixel (2 pixels) */}
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '2203835897111572');
            fbq('init', '1499523888575243');
            fbq('track', 'PageView');
          `}
        </Script>
        <noscript>
          <img height="1" width="1" style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=2203835897111572&ev=PageView&noscript=1"
            alt=""
          />
          <img height="1" width="1" style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=1499523888575243&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        <Providers>
          <ThemeProvider>
            <ChunkErrorReloader />
            <Suspense fallback={null}><AffiliateTracker /></Suspense>
            <Suspense fallback={null}><MetaPixelTracker /></Suspense>
            <MetaAdvancedMatching />
            <AppShell>{children}</AppShell>
            <CookieConsent />
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  )
}
