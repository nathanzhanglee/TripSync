import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Sparkles, Thermometer, Utensils, ArrowRight, Loader2, Calendar, Star, TrendingUp, Globe } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { 
  getRandomDestination, 
  getRecommendationsCitiesTopAttractions, 
  getRecommendationsCitiesWarmBudget,
  getRecommendationsCitiesBalanced,
  getRecommendationsCitiesBestPerCountry,
  type RandomDestination,
  type RecommendationCity,
  type WarmBudgetCity,
  type BalancedCity,
  type BestPerCountryCity
} from '../services/api';

export function HomePage() {
  const navigate = useNavigate();
  const [randomDest, setRandomDest] = useState<RandomDestination | null>(() => {
    // Try to load from sessionStorage on initial mount
    const saved = sessionStorage.getItem('surpriseDestination');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [topAttractions, setTopAttractions] = useState<RecommendationCity[]>(() => {
    // Try to load from sessionStorage on initial mount
    const saved = sessionStorage.getItem('topAttractions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [warmBudget, setWarmBudget] = useState<WarmBudgetCity[]>(() => {
    // Try to load from sessionStorage on initial mount
    const saved = sessionStorage.getItem('warmBudget');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [balanced, setBalanced] = useState<BalancedCity[]>(() => {
    const saved = sessionStorage.getItem('balanced');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [bestPerCountry, setBestPerCountry] = useState<BestPerCountryCity[]>(() => {
    const saved = sessionStorage.getItem('bestPerCountry');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [loading, setLoading] = useState({ 
    random: !randomDest, 
    topAttractions: topAttractions.length === 0, 
    warmBudget: warmBudget.length === 0,
    balanced: balanced.length === 0,
    bestPerCountry: bestPerCountry.length === 0
  });

  useEffect(() => {
    const loadData = async () => {
      // Only load random destination if we don't have one saved
      if (randomDest === null) {
        try {
          // Load random destination
          const random = await getRandomDestination('city');
          setRandomDest(random);
          // Save to sessionStorage so it persists across navigation
          sessionStorage.setItem('surpriseDestination', JSON.stringify(random));
        } catch (error) {
          console.error('Error loading random destination:', error);
        } finally {
          setLoading(prev => ({ ...prev, random: false }));
        }
      } else {
        setLoading(prev => ({ ...prev, random: false }));
      }

      // Check if we have cached data
      const cachedTop = sessionStorage.getItem('topAttractions');
      const cachedWarm = sessionStorage.getItem('warmBudget');
      const cachedBalanced = sessionStorage.getItem('balanced');
      const cachedBestPerCountry = sessionStorage.getItem('bestPerCountry');

      // Only load top attractions if we don't have them cached
      if (!cachedTop) {
        try {
          const top = await getRecommendationsCitiesTopAttractions(6);
          setTopAttractions(top.cities);
          sessionStorage.setItem('topAttractions', JSON.stringify(top.cities));
        } catch (error) {
          console.error('Error loading top attractions:', error);
        } finally {
          setLoading(prev => ({ ...prev, topAttractions: false }));
        }
      } else {
        setLoading(prev => ({ ...prev, topAttractions: false }));
      }

      // Only load warm budget cities if we don't have them cached
      if (!cachedWarm) {
        try {
          const warm = await getRecommendationsCitiesWarmBudget({ limit: 6, minTemp: 18 });
          setWarmBudget(warm.cities);
          sessionStorage.setItem('warmBudget', JSON.stringify(warm.cities));
        } catch (error) {
          console.error('Error loading warm budget cities:', error);
        } finally {
          setLoading(prev => ({ ...prev, warmBudget: false }));
        }
      } else {
        setLoading(prev => ({ ...prev, warmBudget: false }));
      }

      // Only load balanced cities if we don't have them cached
      if (!cachedBalanced) {
        try {
          const balancedData = await getRecommendationsCitiesBalanced(6);
          setBalanced(balancedData.cities);
          sessionStorage.setItem('balanced', JSON.stringify(balancedData.cities));
        } catch (error) {
          console.error('Error loading balanced cities:', error);
        } finally {
          setLoading(prev => ({ ...prev, balanced: false }));
        }
      } else {
        setLoading(prev => ({ ...prev, balanced: false }));
      }

      // Only load best per country if we don't have them cached
      if (!cachedBestPerCountry) {
        try {
          const bestData = await getRecommendationsCitiesBestPerCountry({ minPoi: 5, minHotels: 5 });
          setBestPerCountry(bestData.bestCities);
          sessionStorage.setItem('bestPerCountry', JSON.stringify(bestData.bestCities));
        } catch (error) {
          console.error('Error loading best per country cities:', error);
        } finally {
          setLoading(prev => ({ ...prev, bestPerCountry: false }));
        }
      } else {
        setLoading(prev => ({ ...prev, bestPerCountry: false }));
      }
    };

    loadData();
  }, [randomDest]);

  const handleSurpriseMe = async () => {
    try {
      setLoading(prev => ({ ...prev, random: true }));
      const random = await getRandomDestination('city');
      setRandomDest(random);
      // Update sessionStorage with new random destination
      sessionStorage.setItem('surpriseDestination', JSON.stringify(random));
    } catch (error) {
      console.error('Error getting random destination:', error);
      alert('Failed to get random destination. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, random: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <MapPin className="size-12 text-indigo-600" />
            <h1 className="text-5xl font-bold text-indigo-900">TripSync</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-12">
            Discover the perfect vacation destination for your entire friend group. 
            Find cities that match your collective interests, plan your itinerary, and explore the world together.
          </p>
          <div className="flex gap-4 justify-center">
            <Button 
              onClick={() => navigate('/discover')}
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Discover Destinations
              <ArrowRight className="size-4 ml-2" />
            </Button>
            <Button 
              onClick={() => navigate('/plan')}
              size="lg"
              variant="outline"
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              Plan Trip
              <ArrowRight className="size-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* Random Destination Card */}
        <Card className="bg-white/80 backdrop-blur shadow-xl border-indigo-100 mb-12">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-5 text-indigo-600" />
                  Surprise Destination
                </CardTitle>
                <CardDescription>Discover a random destination from our database</CardDescription>
              </div>
              {!loading.random && (
                <Button
                  onClick={handleSurpriseMe}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Sparkles className="size-4 mr-2" />
                  Surprise Me
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading.random ? (
              <div className="text-center py-8">
                <Loader2 className="size-8 animate-spin mx-auto text-indigo-600 mb-4" />
                <p className="text-gray-600">Loading surprise destination...</p>
              </div>
            ) : randomDest && randomDest.cityId ? (
              <Link
                to={`/city/${randomDest.cityId}`}
                className="flex items-center justify-between p-4 rounded-lg border border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-semibold text-indigo-900 group-hover:text-indigo-700 truncate">{randomDest.cityName}</h4>
                  <p className="text-sm text-gray-500 truncate">{randomDest.countryName}</p>
                </div>
              </Link>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No random destination available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recommendations Grid - 2x2 Layout */}
        <div className="grid md:grid-cols-2 gap-6 mt-8 mb-8">
          {/* Top Attractions Section */}
          <Card className="bg-white/80 backdrop-blur shadow-xl border-indigo-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="size-5 text-indigo-600" />
                Cities with Most Attractions
              </CardTitle>
              <CardDescription>Top destinations ranked by number of points of interest</CardDescription>
            </CardHeader>
            <CardContent>
              {loading.topAttractions ? (
                <div className="text-center py-8">
                  <Loader2 className="size-6 animate-spin mx-auto text-indigo-600" />
                </div>
              ) : (
                <div className="space-y-3">
                  {topAttractions.map((city) => (
                    <Link
                      key={city.cityId}
                      to={`/city/${city.cityId}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-indigo-900 group-hover:text-indigo-700 truncate">{city.name}</h4>
                        <p className="text-sm text-gray-500 truncate">{city.countryName}</p>
                      </div>
                      <Badge variant="secondary" className="ml-3 shrink-0 bg-indigo-100 text-indigo-700">
                        {city.poiCount} POIs
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Warm & Budget-Friendly Section */}
          <Card className="bg-white/80 backdrop-blur shadow-xl border-indigo-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Thermometer className="size-5 text-orange-600" />
                Warm & Budget-Friendly Cities
              </CardTitle>
              <CardDescription>Cities with warm weather and affordable food prices</CardDescription>
            </CardHeader>
            <CardContent>
              {loading.warmBudget ? (
                <div className="text-center py-8">
                  <Loader2 className="size-6 animate-spin mx-auto text-indigo-600" />
                </div>
              ) : (
                <div className="space-y-3">
                  {warmBudget.map((city) => (
                    <Link
                      key={city.cityId}
                      to={`/city/${city.cityId}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-orange-200 hover:border-orange-300 hover:bg-orange-50 transition-all group"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-indigo-900 group-hover:text-indigo-700 truncate">{city.name}</h4>
                        <p className="text-sm text-gray-500 truncate">{city.countryName}</p>
                      </div>
                      <div className="flex gap-2 ml-3 shrink-0">
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-xs">
                          {city.avgTemperature != null ? Number(city.avgTemperature).toFixed(1) : 'N/A'}°C
                        </Badge>
                        <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                          ${city.avgFoodPrice != null ? Number(city.avgFoodPrice).toFixed(1) : 'N/A'}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Balanced Cities Section */}
          <Card className="bg-white/80 backdrop-blur shadow-xl border-indigo-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-5 text-purple-600" />
                Balanced Cities
              </CardTitle>
              <CardDescription>Best overall balance of food prices, attractions, and hotels</CardDescription>
            </CardHeader>
            <CardContent>
              {loading.balanced ? (
                <div className="text-center py-8">
                  <Loader2 className="size-6 animate-spin mx-auto text-indigo-600" />
                </div>
              ) : (
                <div className="space-y-3">
                  {balanced.map((city) => (
                    <Link
                      key={city.cityId}
                      to={`/city/${city.cityId}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-purple-200 hover:border-purple-300 hover:bg-purple-50 transition-all group"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-indigo-900 group-hover:text-indigo-700 truncate">{city.cityName}</h4>
                        <p className="text-sm text-gray-500 truncate">{city.countryName}</p>
                      </div>
                      <Badge variant="secondary" className="ml-3 shrink-0 bg-purple-100 text-purple-700">
                        {(Number(city.compositeScore) * 100).toFixed(0)}%
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Best Per Country Section */}
          <Card className="bg-white/80 backdrop-blur shadow-xl border-indigo-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="size-5 text-blue-600" />
                Best City Per Country
              </CardTitle>
              <CardDescription>Top-rated city from each country with museums and quality hotels</CardDescription>
            </CardHeader>
            <CardContent>
              {loading.bestPerCountry ? (
                <div className="text-center py-8">
                  <Loader2 className="size-6 animate-spin mx-auto text-indigo-600" />
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {bestPerCountry.slice(0, 6).map((city) => (
                    <Link
                      key={`${city.countryId}-${city.cityId}`}
                      to={`/city/${city.cityId}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-blue-200 hover:border-blue-300 hover:bg-blue-50 transition-all group"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-indigo-900 group-hover:text-indigo-700 truncate">{city.cityName}</h4>
                        <p className="text-sm text-gray-500 truncate">{city.countryName}</p>
                      </div>
                      <div className="flex gap-2 ml-3 shrink-0">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                          {city.avgHotelRating != null ? Number(city.avgHotelRating).toFixed(1) : 'N/A'}★
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

