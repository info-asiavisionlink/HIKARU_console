import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@hikaru/types', '@hikaru/lib', '@hikaru/ui'],

  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },

  // フォントファイルをPDF生成APIルートのサーバーレス関数バンドルに含める
  outputFileTracingIncludes: {
    '/api/invoices/[id]/pdf': ['./public/fonts/*.otf'],
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
