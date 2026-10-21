import { notFound } from "next/navigation";
import { FeatureArticle } from "@/components/features/FeatureArticle";
import { featureBySlug, features } from "@/lib/feature-content/content";
import { pageMeta } from "@/lib/seo";

export function generateStaticParams() {
  return features.map((feature) => ({ slug: feature.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feature = featureBySlug(slug);
  if (!feature) return {};
  return pageMeta({
    title: feature.nav,
    description: feature.lede,
    path: `/features/${feature.slug}`,
  });
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feature = featureBySlug(slug);
  if (!feature) notFound();
  return <FeatureArticle feature={feature} />;
}
