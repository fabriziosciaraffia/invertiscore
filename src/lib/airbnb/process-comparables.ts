import type { AirROIComparable, TierMetrics, TopComparable } from "./types";

/** Calculate the median of a numeric array */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Filter out unusable comparables */
export function filterComparables(comparables: AirROIComparable[]): AirROIComparable[] {
  return comparables.filter((c) => {
    const { ttm_occupancy, ttm_revenue } = c.performance_metrics;
    const { num_reviews } = c.ratings;
    return ttm_occupancy > 0 && ttm_revenue > 0 && num_reviews >= 3;
  });
}

/** Split comparables into premium and standard tiers */
export function segmentByTier(comparables: AirROIComparable[]): {
  premium: AirROIComparable[];
  standard: AirROIComparable[];
} {
  const premium: AirROIComparable[] = [];
  const standard: AirROIComparable[] = [];

  for (const c of comparables) {
    const isPremium =
      c.ratings.rating_overall >= 4.7 &&
      (c.host_info.superhost || c.ratings.num_reviews >= 50);
    if (isPremium) {
      premium.push(c);
    } else {
      standard.push(c);
    }
  }

  return { premium, standard };
}

/** Calculate tier metrics (medians) from a group of comparables */
export function calcTierMetrics(comparables: AirROIComparable[]): TierMetrics {
  if (comparables.length === 0) {
    return { count: 0, median_adr: 0, median_occupancy: 0, median_annual_revenue: 0 };
  }

  return {
    count: comparables.length,
    median_adr: Math.round(median(comparables.map((c) => c.performance_metrics.ttm_avg_rate))),
    median_occupancy: Math.round(median(comparables.map((c) => c.performance_metrics.ttm_occupancy)) * 100) / 100,
    median_annual_revenue: Math.round(median(comparables.map((c) => c.performance_metrics.ttm_revenue))),
  };
}

/** Get top 10 comparables by annual revenue */
export function getTopComparables(comparables: AirROIComparable[]): TopComparable[] {
  return [...comparables]
    .sort((a, b) => b.performance_metrics.ttm_revenue - a.performance_metrics.ttm_revenue)
    .slice(0, 10)
    .map((c) => ({
      name: c.name,
      district: c.location_info.district,
      adr: Math.round(c.performance_metrics.ttm_avg_rate),
      occupancy: Math.round(c.performance_metrics.ttm_occupancy * 100) / 100,
      annual_revenue: Math.round(c.performance_metrics.ttm_revenue),
      rating: c.ratings.rating_overall,
      num_reviews: c.ratings.num_reviews,
      superhost: c.host_info.superhost,
      amenities_count: c.property_details.amenities?.length ?? 0,
      cover_photo_url: c.cover_photo_url,
    }));
}

/** Full processing pipeline */
export function processComparables(rawComparables: AirROIComparable[]) {
  const filtered = filterComparables(rawComparables);

  if (filtered.length === 0) {
    return null;
  }

  const { premium, standard } = segmentByTier(filtered);
  const allMetrics = calcTierMetrics(filtered);
  const premiumMetrics = calcTierMetrics(premium);
  const standardMetrics = calcTierMetrics(standard);
  const topComparables = getTopComparables(filtered);

  return {
    comparables_count: filtered.length,
    median_adr: allMetrics.median_adr,
    median_occupancy: allMetrics.median_occupancy,
    median_annual_revenue: allMetrics.median_annual_revenue,
    premium: premiumMetrics,
    standard: standardMetrics,
    top_comparables: topComparables,
  };
}
