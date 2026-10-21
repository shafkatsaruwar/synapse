import type { MetadataRoute } from "next";
import { features } from "@/lib/feature-content/content";
import { getSiteUrl } from "@/lib/design-tokens/tokens";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const paths = ["/", "/features", "/privacy", "/story", "/support", "/terms", ...features.map((feature) => `/features/${feature.slug}`)];
  return paths.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
