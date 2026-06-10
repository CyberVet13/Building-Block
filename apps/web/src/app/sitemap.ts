import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? "https://build-block.com";
  return [
    { url, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${url}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${url}/signin`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.5 },
    { url: `${url}/signup`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.5 },
  ];
}
