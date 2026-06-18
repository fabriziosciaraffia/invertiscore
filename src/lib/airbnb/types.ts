// ─── AirROI API types ───────────────────────────────

export interface AirROIComparable {
  listing_id: string;
  name: string;
  cover_photo_url: string;
  property_details: {
    bedrooms: number;
    baths: number;
    guests: number;
    amenities: string[];
  };
  location_info: {
    district: string;
    latitude: number;
    longitude: number;
  };
  performance_metrics: {
    ttm_avg_rate: number;
    ttm_occupancy: number;
    ttm_revenue: number;
    ttm_revpar: number;
  };
  ratings: {
    rating_overall: number;
    num_reviews: number;
  };
  host_info: {
    superhost: boolean;
    professional_management: boolean;
  };
  pricing_info: {
    cleaning_fee: number;
  };
}

export interface AirROIResponse {
  comparables: AirROIComparable[];
}

// ─── Franco processed types ─────────────────────────

export interface TierMetrics {
  count: number;
  median_adr: number;
  median_occupancy: number;
  median_annual_revenue: number;
}

export interface TopComparable {
  name: string;
  district: string;
  adr: number;
  occupancy: number;
  annual_revenue: number;
  rating: number;
  num_reviews: number;
  superhost: boolean;
  amenities_count: number;
  cover_photo_url: string;
}

export interface AirbnbEstimateData {
  address: string;
  bedrooms: number;
  baths: number;
  guests: number;
  comparables_count: number;
  median_adr: number;
  median_occupancy: number;
  median_annual_revenue: number;
  premium: TierMetrics;
  standard: TierMetrics;
  top_comparables: TopComparable[];
  expires_at: string;
}

export interface AirbnbEstimateDirectData {
  address: string;
  bedrooms: number;
  baths: number;
  guests: number;
  estimated_adr: number;
  estimated_occupancy: number;
  estimated_annual_revenue: number;
  percentiles: Record<string, unknown>;
  monthly_revenue: unknown[];
  currency: string;
  comparables_count: number;
  expires_at: string;
}

/**
 * Resumen DISPLAY-ONLY de la ocupación REALIZADA de la pool de comparables
 * (mediana de `performance_metrics.ttm_occupancy`). Transparencia 2026-06.
 * Independiente del path de scoring (direct/comparables): se computa leyendo
 * `comparable_listings` aparte, NUNCA entra a processComparables ni al motor.
 */
export interface RealizedOccupancy {
  /** Mediana ttm_occupancy de la pool válida (decimal 0–1). */
  p50: number;
  /** Mediana ttm_occupancy del subset superhost (decimal; 0 si nSuperhost===0). */
  p50Superhost: number;
  /** Comparables válidos (ttm_occupancy>0 && ttm_revenue>0). */
  n: number;
  /** Comparables válidos con host superhost. */
  nSuperhost: number;
}

export interface AirbnbEstimateSuccess {
  success: true;
  cached: boolean;
  source?: "comparables" | "calculator_direct";
  data: AirbnbEstimateData | AirbnbEstimateDirectData;
  /** Display-only — resumen de occ realizada de comparable_listings. No altera
   *  el path de scoring; ausente/null si no hubo pool válida. */
  realizedOccupancy?: RealizedOccupancy | null;
}

export interface AirbnbEstimateError {
  success: false;
  error: "airbnb_api_error" | "no_comparables" | "no_credits" | "validation_error";
  message: string;
}

export type AirbnbEstimateResponse = AirbnbEstimateSuccess | AirbnbEstimateError;
