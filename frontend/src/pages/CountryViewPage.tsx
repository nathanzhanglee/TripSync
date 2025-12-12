import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Globe, ArrowLeft, Loader2, MapPin, Thermometer, Utensils, Shuffle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { getCountryById, getCities, type CountryDetails } from '../services/api';

export function CountryViewPage() {
  const { countryId } = useParams<{ countryId: string }>();
  const navigate = useNavigate();

  const [country, setCountry] = useState<CountryDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const [cityPool, setCityPool] = useState<Array<{ cityId: number; cityName: string }>>([]);
  const [randomCities, setRandomCities] = useState<Array<{ cityId: number; cityName: string }>>([]);
  const MAX_RANDOM_CITIES = 6;

  function pickRandom<T>(arr: T[], k: number): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, k);
  }

  const reseedCities = () => {
    if (!cityPool.length) return;
    const k = Math.min(MAX_RANDOM_CITIES, cityPool.length);
    setRandomCities(pickRandom(cityPool, k));
  };

  useEffect(() => {
    const loadCountry = async () => {
      if (!countryId) return;
      setLoading(true);

      try {
        const cid = parseInt(countryId, 10);

        const data = await getCountryById(cid);

        const validatedData: CountryDetails = {
          ...data,
          gdp: data.gdp != null && Number(data.gdp) !== 0 ? Number(data.gdp) : null,
          avgHeatIndex: data.avgHeatIndex != null ? Number(data.avgHeatIndex) : null,
          avgCityTemperature: data.avgCityTemperature != null ? Number(data.avgCityTemperature) : null,
          avgFoodPrice: data.avgFoodPrice != null ? Number(data.avgFoodPrice) : null,
          avgGasPrice: data.avgGasPrice != null ? Number(data.avgGasPrice) : null,
          avgMonthlySalary: data.avgMonthlySalary != null ? Number(data.avgMonthlySalary) : null,
          cityCount: Number(data.cityCount) || 0,
        };

        setCountry(validatedData);

        const citiesResp = await getCities({
          countryId: cid,
          page: 1,
          pageSize: 200,
        });

        const pool =
          (citiesResp.cities ?? []).map((c) => ({
            cityId: c.cityId,
            cityName: c.name,
          })) ?? [];

        setCityPool(pool);

        const k = Math.min(MAX_RANDOM_CITIES, pool.length);
        setRandomCities(pickRandom(pool, k));
      } catch (error) {
        console.error('Error loading country:', error);
        alert('Country not found');
        navigate('/browse');
      } finally {
        setLoading(false);
      }
    };

    loadCountry();
  }, [countryId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!country) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="size-4 mr-2" />
          Back
        </Button>

        <Card className="bg-white/80 backdrop-blur shadow-xl border-indigo-100 mb-6">
          <CardHeader>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Globe className="size-8 text-indigo-600" />
              {country.name}
            </CardTitle>
            <CardDescription>
              {country.alpha2Code && country.alpha3Code && (
                <span>
                  {country.alpha2Code} / {country.alpha3Code}
                </span>
              )}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {country.avgCityTemperature !== null && country.avgCityTemperature !== undefined && (
                <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-lg">
                  <Thermometer className="size-6 text-orange-600" />
                  <div>
                    <p className="text-xs text-gray-600">Avg City Temperature</p>
                    <p className="text-xl font-semibold">{Number(country.avgCityTemperature).toFixed(1)}°C</p>
                  </div>
                </div>
              )}

              {country.avgFoodPrice !== null && country.avgFoodPrice !== undefined && (
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                  <Utensils className="size-6 text-green-600" />
                  <div>
                    <p className="text-xs text-gray-600">Avg Food Price</p>
                    <p className="text-xl font-semibold">${Number(country.avgFoodPrice).toFixed(2)}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                <MapPin className="size-6 text-blue-600" />
                <div>
                  <p className="text-xs text-gray-600">Cities</p>
                  <p className="text-xl font-semibold">{country.cityCount}</p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">GDP</p>
                <p className="text-lg">
                  {country.gdp != null && country.gdp !== undefined && Number(country.gdp) > 0
                    ? (() => {
                        const gdpValue = Number(country.gdp);
                        const inTrillions = gdpValue / 1e6;
                        return `$${inTrillions.toFixed(2)} Trillion`;
                      })()
                    : 'N/A'}
                </p>
              </div>

              {country.avgHeatIndex !== null && country.avgHeatIndex !== undefined && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Average Heat Index</p>
                  <p className="text-lg">{Number(country.avgHeatIndex).toFixed(1)}</p>
                </div>
              )}

              {country.avgGasPrice !== null && country.avgGasPrice !== undefined && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Average Gas Price</p>
                  <p className="text-lg">${Number(country.avgGasPrice).toFixed(2)}</p>
                </div>
              )}

              {country.avgMonthlySalary !== null && country.avgMonthlySalary !== undefined && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Average Monthly Salary</p>
                  <p className="text-lg">${Number(country.avgMonthlySalary).toFixed(2)}</p>
                </div>
              )}
            </div>

            {country.otherName && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Also known as: {country.otherName}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur shadow-xl border-indigo-100">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Example Cities</CardTitle>
                <CardDescription>Random cities in this country</CardDescription>
              </div>

              <Button variant="outline" size="sm" onClick={reseedCities} disabled={cityPool.length === 0}>
                <Shuffle className="size-4 mr-2" />
                Shuffle
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {cityPool.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No cities found</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {randomCities.map((city) => (
                  <Link
                    key={city.cityId}
                    to={`/city/${city.cityId}`}
                    className="block p-4 rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="size-4 text-indigo-600" />
                      <span className="font-medium">{city.cityName}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
