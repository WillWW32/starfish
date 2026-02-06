import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/login', '/settings', '/chat'],
      },
    ],
    sitemap: 'https://bigstarfish.com/sitemap.xml',
  };
}
