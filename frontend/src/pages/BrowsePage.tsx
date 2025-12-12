import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Globe, MapPin, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { getCountries, getCities, type Country, type City } from '../services/api';

export function BrowsePage() {
  const [activeTab, setActiveTab] = useState<'countries' | 'cities'>('countries');
  const [search, setSearch] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [countriesPage, setCountriesPage] = useState(1);
  const [citiesPage, setCitiesPage] = useState(1);
  const [countriesTotal, setCountriesTotal] = useState(0);
  const [citiesTotal, setCitiesTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const pageSize = 20;

  // Filter function to exclude cities with numbers or non-Latin characters
  const isValidCityName = (name: string): boolean => {
    // Only allow Latin letters, spaces, hyphens, apostrophes, periods, commas, and parentheses
    // This excludes numbers and non-Latin scripts (Chinese, Japanese, Korean, etc.)
    return /^[a-zA-Z\s\-'.,()]+$/.test(name);
  };

  const loadCountries = async () => {
    setLoading(true);
    try {
      const response = await getCountries({
        page: countriesPage,
        pageSize,
        search: search || undefined,
      });
      setCountries(response.countries || []);
      setCountriesTotal(response.total || 0);
    } catch (error) {
      console.error('Error loading countries:', error);
      setCountries([]);
      setCountriesTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const loadCities = async () => {
    setLoading(true);
    try {
      // Fetch a larger batch to account for filtering
      const response = await getCities({
        page: 1,
        pageSize: 500, // Get more to account for filtering
        search: search || undefined,
      });
      // Filter out cities with numbers or non-Latin characters on the frontend
      const filteredCities = (response.cities || []).filter(city => isValidCityName(city.name));
      setCities(filteredCities);
      // Update total to reflect filtered count
      setCitiesTotal(filteredCities.length);
    } catch (error) {
      console.error('Error loading cities:', error);
      setCities([]);
      setCitiesTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'countries') {
      loadCountries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, countriesPage, search]);

  useEffect(() => {
    if (activeTab === 'cities') {
      loadCities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, citiesPage, search]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Card className="bg-white/80 backdrop-blur shadow-xl border-indigo-100 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="size-6 text-indigo-600" />
              Browse Destinations
            </CardTitle>
            <CardDescription>Explore countries and cities in our database</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => {
              setActiveTab(v as 'countries' | 'cities');
              setSearch('');
              setCountriesPage(1);
              setCitiesPage(1);
            }}>
              <TabsList className="mb-6 inline-flex h-auto w-full justify-start gap-3 rounded-none bg-transparent p-0">
                <TabsTrigger
                  value="countries"
                  className="inline-flex items-center justify-center rounded-full border border-indigo-100 bg-white/70 px-4 py-2 shadow-sm transition-all hover:bg-white hover:shadow-md data-[state=active]:border-indigo-600 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md"
                >
                  <Globe className="size-4 mr-2" />
                  Countries
                </TabsTrigger>

                <TabsTrigger
                  value="cities"
                  className="inline-flex items-center justify-center rounded-full border border-indigo-100 bg-white/70 px-4 py-2 shadow-sm transition-all hover:bg-white hover:shadow-md data-[state=active]:border-indigo-600 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md"
                >
                  <MapPin className="size-4 mr-2" />
                  Cities
                </TabsTrigger>
              </TabsList>

              <TabsContent value="countries">
                <div className="mb-6">
                  <div className="flex h-10 w-full items-center gap-2 rounded-md border border-indigo-100 bg-white/70 px-3 shadow-sm focus-within:ring-2 focus-within:ring-indigo-200">
                    <Search className="size-4 shrink-0 text-gray-400" />
                    <Input
                      placeholder="Search countries..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setCountriesPage(1);
                      }}
                      className="flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-12">
                    <Loader2 className="size-8 animate-spin mx-auto text-indigo-600 mb-4" />
                    <p className="text-gray-600">Loading countries...</p>
                  </div>
                ) : countries.length > 0 ? (
                  <>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                      {countries.map((country) => (
                        <Link key={country.countryId} to={`/country/${country.countryId}`}>
                          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <Globe className="size-5 text-indigo-600" />
                                {country.name}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2 text-sm">
                                <p className="text-gray-600">
                                  {country.cityCount} {country.cityCount === 1 ? 'city' : 'cities'}
                                </p>
                                <p className="text-gray-600">
                                  GDP: {country.gdp != null && country.gdp !== undefined && Number(country.gdp) > 0
                                    ? (() => {
                                        const gdpValue = Number(country.gdp);
                                        // GDP is stored in millions, convert to trillions: divide by 1,000,000
                                        const inTrillions = gdpValue / 1e6;
                                        return `$${inTrillions.toFixed(2)}T`;
                                      })()
                                    : 'N/A'}
                                </p>
                                {country.avgHeatIndex && (
                                  <p className="text-gray-600">
                                    Avg Heat Index: {Number(country.avgHeatIndex).toFixed(1)}
                                  </p>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        Showing {(countriesPage - 1) * pageSize + 1} to {Math.min(countriesPage * pageSize, countriesTotal)} of {countriesTotal} countries
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCountriesPage(p => Math.max(1, p - 1))}
                          disabled={countriesPage === 1}
                        >
                          <ChevronLeft className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCountriesPage(p => p + 1)}
                          disabled={countriesPage * pageSize >= countriesTotal}
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No countries found</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="cities">
                <div className="mb-6">
                  <div className="flex h-10 w-full items-center gap-2 rounded-md border border-indigo-100 bg-white/70 px-3 shadow-sm focus-within:ring-2 focus-within:ring-indigo-200">
                    <Search className="size-4 shrink-0 text-gray-400" />
                    <Input
                      placeholder="Search cities..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setCitiesPage(1);
                      }}
                      className="flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-12">
                    <Loader2 className="size-8 animate-spin mx-auto text-indigo-600 mb-4" />
                    <p className="text-gray-600">Loading cities...</p>
                  </div>
                ) : cities.length > 0 ? (
                  <>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                      {cities.slice((citiesPage - 1) * pageSize, citiesPage * pageSize).map((city) => (
                        <Link key={city.cityId} to={`/city/${city.cityId}`}>
                          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <MapPin className="size-5 text-indigo-600" />
                                {city.name}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2 text-sm">
                                <p className="text-gray-600">{city.countryName}</p>
                                {city.avgTemperature != null && (
                                  <p className="text-gray-600">
                                    Temperature: {Number(city.avgTemperature).toFixed(1)}°C
                                  </p>
                                )}
                                {city.avgFoodPrice != null && (
                                  <p className="text-gray-600">
                                    Avg Food Price: ${Number(city.avgFoodPrice).toFixed(2)}
                                  </p>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        Showing {(citiesPage - 1) * pageSize + 1} to {Math.min(citiesPage * pageSize, citiesTotal)} of {citiesTotal} cities
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCitiesPage(p => Math.max(1, p - 1))}
                          disabled={citiesPage === 1}
                        >
                          <ChevronLeft className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCitiesPage(p => p + 1)}
                          disabled={citiesPage * pageSize >= citiesTotal}
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No cities found</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

