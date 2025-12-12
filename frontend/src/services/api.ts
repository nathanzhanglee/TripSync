const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    // Handle network errors (e.g., backend not running, CORS issues)
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(
        `Failed to connect to backend at ${API_BASE_URL}. ` +
        `Please ensure the backend server is running on port 3001. ` +
        `Error: ${error.message}`
      );
    }
    throw error;
  }
}

// Route 1: POST /destinations/availability/cities
export interface AvailableCity {
  cityId: number;
  cityName: string;
  countryId: number;
  countryName: string;
  reachableFromAll: boolean;
  reachableFrom: number[];
}

export interface AvailableCitiesResponse {
  destinations: AvailableCity[];
}

export async function getAvailableCities(params: {
  originCityIds: number[];
  requireAllReach?: boolean;
  maxStop?: number;
  limit?: number;
}): Promise<AvailableCitiesResponse> {
  return apiCall<AvailableCitiesResponse>('/destinations/availability/cities', {
    method: 'POST',
    body: JSON.stringify({
      originCityIds: params.originCityIds,
      requireAllReach: params.requireAllReach ?? false,
      maxStop: params.maxStop ?? 1,
      limit: params.limit ?? 20,
    }),
  });
}

// Route 3: POST /destinations/features
export interface DestinationMatch {
  id: number;
  scope: 'city' | 'country';
  name: string;
  countryId: number;
  countryName: string;
  avgTemperature: number | null;
  avgFoodPrice: number | null;
  avgHotelRating: number | null;
  hotelCount: number;
  poiCount: number;
  matchingPoiCount: number;
  foodScore: number;
  attractionsScore: number;
  hotelScore: number;
  compositeScore: number;
}

export interface DestinationsFeaturesResponse {
  destinations: DestinationMatch[];
}

export async function getDestinationsByFeatures(params: {
  scope: 'city' | 'country';
  candidateCityIds?: number[];
  minTemp?: number;
  maxTemp?: number;
  maxAvgFoodPrice?: number;
  minHotelRating?: number;
  minHotelCount?: number;
  minPoiCount?: number;
  preferredCategories?: string[];
  limit?: number;
}): Promise<DestinationsFeaturesResponse> {
  return apiCall<DestinationsFeaturesResponse>('/destinations/features', {
    method: 'POST',
    body: JSON.stringify({
      scope: params.scope,
      candidateCityIds: params.candidateCityIds,
      minTemp: params.minTemp,
      maxTemp: params.maxTemp,
      maxAvgFoodPrice: params.maxAvgFoodPrice,
      minHotelRating: params.minHotelRating,
      minHotelCount: params.minHotelCount,
      minPoiCount: params.minPoiCount,
      preferredCategories: params.preferredCategories,
      limit: params.limit ?? 20,
    }),
  });
}

// Route 4: POST /planning/itineraries
export interface ItineraryDay {
  day: number;
  pois: Array<{
    poiId: number;
    name: string;
    category: string;
    cityId: number;
    cityName: string;
  }>;
}

export interface ItineraryResponse {
  itinerary: ItineraryDay[];
  totalDays: number;
}

export async function generateItinerary(params: {
  cityIds: number[];
  numDays: number;
  poisPerDay: number;
  preferredCategoriesByDay?: string[][];
  avoidCategories?: string[];
  level?: 'city' | 'country';
}): Promise<ItineraryResponse> {
  // Backend expects cityId (singular), so use the first city from the array
  const cityId = params.cityIds && params.cityIds.length > 0 ? params.cityIds[0] : null;
  
  if (!cityId && params.level !== 'country') {
    throw new Error('At least one city ID is required');
  }

  return apiCall<ItineraryResponse>('/planning/itineraries', {
    method: 'POST',
    body: JSON.stringify({
      cityId: cityId,
      numDays: params.numDays,
      poisPerDay: params.poisPerDay,
      preferredCategoriesByDay: params.preferredCategoriesByDay,
      avoidCategories: params.avoidCategories,
      level: params.level ?? 'city',
    }),
  });
}

// Route 5: GET /destinations/random
export interface RandomDestination {
  scope: 'city' | 'country';
  cityId: number | null;
  cityName: string | null;
  countryId: number;
  countryName: string;
}

export async function getRandomDestination(scope: 'city' | 'country' = 'city'): Promise<RandomDestination | null> {
  return apiCall<RandomDestination | null>(`/destinations/random?scope=${scope}`);
}

// Route 6: GET /countries
export interface Country {
  countryId: number;
  name: string;
  cityCount: number;
  gdp?: number;
  avgHeatIndex?: number;
}

export interface CountriesResponse {
  countries: Country[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getCountries(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<CountriesResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
  if (params?.search) queryParams.append('search', params.search);
  
  return apiCall<CountriesResponse>(`/countries?${queryParams.toString()}`);
}

// Route 7: GET /countries/:countryId
export interface CountryDetails extends Country {
  alpha2Code?: string;
  alpha3Code?: string;
  avgCityTemperature?: number | null;
  avgFoodPrice?: number | null;
  avgGasPrice?: number | null;
  avgMonthlySalary?: number | null;
  otherName?: string;
  exampleCities?: Array<{
    cityId: number;
    cityName: string;
  }>;
}

export async function getCountryById(countryId: number): Promise<CountryDetails> {
  return apiCall<CountryDetails>(`/countries/${countryId}`);
}

// Route 8: GET /cities
export interface City {
  cityId: number;
  name: string;
  countryId: number;
  countryName: string;
  latitude?: number | null;
  longitude?: number | null;
  avgTemperature?: number | null;
  avgFoodPrice?: number | null;
  avgGasPrice?: number | null;
  avgMonthlySalary?: number | null;
}

export interface CitiesResponse {
  cities: City[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getCities(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  countryId?: number;
  minTemp?: number;
  maxTemp?: number;
  maxFood?: number;
}): Promise<CitiesResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
  if (params?.search) queryParams.append('search', params.search);
  if (params?.countryId) queryParams.append('countryId', params.countryId.toString());
  if (params?.minTemp) queryParams.append('minTemp', params.minTemp.toString());
  if (params?.maxTemp) queryParams.append('maxTemp', params.maxTemp.toString());
  if (params?.maxFood) queryParams.append('maxFood', params.maxFood.toString());
  
  return apiCall<CitiesResponse>(`/cities?${queryParams.toString()}`);
}

// Route 9: GET /cities/:cityId
export interface CityDetails extends City {
  latestTempYear?: number;
  poiCount: number;
  hotelCount: number;
  avgHotelRating?: number | null;
}

export async function getCityById(cityId: number): Promise<CityDetails> {
  return apiCall<CityDetails>(`/cities/${cityId}`);
}

// Route 10: GET /cities/:cityId/pois
export interface POI {
  poiId: number;
  name: string;
  primaryCategory: string;
  cityId: number;
  latitude?: number | null;
  longitude?: number | null;
}

export interface POIsResponse {
  pois: POI[];
  total: number;
}

export async function getCityPois(cityId: number, params?: {
  category?: string;
  limit?: number;
}): Promise<POIsResponse> {
  const queryParams = new URLSearchParams();
  if (params?.category) queryParams.append('category', params.category);
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  
  return apiCall<POIsResponse>(`/cities/${cityId}/pois?${queryParams.toString()}`);
}

// Route 11: GET /cities/:cityId/hotels
export interface Hotel {
  hotelId: number;
  name: string;
  rating: number | null;
  address: string | null;
  description: string | null;
}

export interface HotelsResponse {
  hotels: Hotel[];
  total: number;
}

export async function getCityHotels(cityId: number, params?: {
  minRating?: number;
  limit?: number;
}): Promise<HotelsResponse> {
  const queryParams = new URLSearchParams();
  if (params?.minRating) queryParams.append('minRating', params.minRating.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  
  return apiCall<HotelsResponse>(`/cities/${cityId}/hotels?${queryParams.toString()}`);
}

// Route 12: GET /recommendations/cities/top-attractions
export interface RecommendationCity {
  cityId: number;
  name: string;
  countryId: number;
  countryName: string;
  poiCount: number;
}

export interface TopAttractionsResponse {
  cities: RecommendationCity[];
  limit: number;
}

export async function getRecommendationsCitiesTopAttractions(limit: number = 10): Promise<TopAttractionsResponse> {
  return apiCall<TopAttractionsResponse>(`/recommendations/cities/top-attractions?limit=${limit}`);
}

// Route 13: GET /recommendations/cities/warm-budget
export interface WarmBudgetCity extends RecommendationCity {
  avgTemperature: number;
  avgFoodPrice: number;
}

export interface WarmBudgetResponse {
  cities: WarmBudgetCity[];
  limit: number;
  minTemp: number;
}

export async function getRecommendationsCitiesWarmBudget(params?: {
  limit?: number;
  minTemp?: number;
}): Promise<WarmBudgetResponse> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.minTemp) queryParams.append('minTemp', params.minTemp.toString());
  
  return apiCall<WarmBudgetResponse>(`/recommendations/cities/warm-budget?${queryParams.toString()}`);
}

// Route 14: GET /recommendations/cities/balanced
export interface BalancedCity {
  cityId: number;
  cityName: string;
  countryName: string;
  avgFoodPrice: number;
  attractionCount: number;
  avgHotelRating: number;
  foodScore: number;
  attractionsScore: number;
  hotelScore: number;
  compositeScore: number;
}

export interface BalancedResponse {
  cities: BalancedCity[];
  limit: number;
}

export async function getRecommendationsCitiesBalanced(limit: number = 20): Promise<BalancedResponse> {
  return apiCall<BalancedResponse>(`/recommendations/cities/balanced?limit=${limit}`);
}

// Route 15: GET /recommendations/cities/best-per-country
export interface BestPerCountryCity {
  countryId: number;
  countryName: string;
  cityId: number;
  cityName: string;
  poiCount: number;
  hotelCount: number;
  avgHotelRating: number;
}

export interface BestPerCountryResponse {
  bestCities: BestPerCountryCity[];
  minPoi: number;
  minHotels: number;
}

export async function getRecommendationsCitiesBestPerCountry(params?: {
  minPoi?: number;
  minHotels?: number;
}): Promise<BestPerCountryResponse> {
  const queryParams = new URLSearchParams();
  if (params?.minPoi) queryParams.append('minPoi', params.minPoi.toString());
  if (params?.minHotels) queryParams.append('minHotels', params.minHotels.toString());
  
  return apiCall<BestPerCountryResponse>(`/recommendations/cities/best-per-country?${queryParams.toString()}`);
}

