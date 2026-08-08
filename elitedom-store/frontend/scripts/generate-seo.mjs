import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnv } from "vite";

const mode = process.env.NODE_ENV === "production" ? "production" : "development";
const environment = loadEnv(mode, process.cwd(), "");
const siteUrl = (process.env.VITE_SITE_URL || environment.VITE_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const publicDirectory = join(process.cwd(), "public");

const robots = `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${siteUrl}/sitemap.xml\n`;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${siteUrl}</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`;

await mkdir(publicDirectory, { recursive: true });
await Promise.all([
  writeFile(join(publicDirectory, "robots.txt"), robots, "utf8"),
  writeFile(join(publicDirectory, "sitemap.xml"), sitemap, "utf8"),
]);

console.log(`Generated robots.txt and sitemap.xml for ${siteUrl}`);
