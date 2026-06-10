import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? "https://build-block.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing"],
        disallow: ["/admin", "/account", "/plans", "/create", "/api"],
      },
    ],
    sitemap: `${url}/sitemap.xml`,
  };
}
