import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { generateItinerary, type ItineraryDay } from '../services/api';

const POI_CATEGORIES = [
  'Museum', 'Beach', 'Park', 'Temple', 'Castle', 'Historic', 
  'Nature', 'Mountain', 'Viewpoint', 'Shopping', 'Market', 
  'Architecture', 'Palace', 'Bridge', 'Church', 'Restaurant',
  'Entertainment', 'Sports', 'Nightlife', 'Cultural'
];

export function PlanningPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const cityIds = (location.state as { cityIds?: number[] })?.cityIds || [];
  
  const [numDays, setNumDays] = useState(3);
  const [poisPerDay, setPoisPerDay] = useState(3);
  const [preferredCategoriesByDay, setPreferredCategoriesByDay] = useState([] as string[][]);
  const [avoidCategories, setAvoidCategories] = useState([] as string[]);
  const [itinerary, setItinerary] = useState(null as ItineraryDay[] | null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Initialize preferredCategoriesByDay based on numDays
    setPreferredCategoriesByDay(prev => {
      if (prev.length !== numDays) {
        // Preserve existing selections for days that still exist
        const newArray = Array(numDays).fill(null).map((_, index) => 
          prev[index] || []
        );
        return newArray;
      }
      return prev;
    });
  }, [numDays]);

  const handleCategoryToggle = (dayIndex: number, category: string) => {
    const updated = [...preferredCategoriesByDay];
    const dayCategories = updated[dayIndex] || [];
    if (dayCategories.includes(category)) {
      updated[dayIndex] = dayCategories.filter(c => c !== category);
    } else {
      updated[dayIndex] = [...dayCategories, category];
    }
    setPreferredCategoriesByDay(updated);
  };

  const handleAvoidToggle = (category: string) => {
    if (avoidCategories.includes(category)) {
      setAvoidCategories(avoidCategories.filter(c => c !== category));
    } else {
      setAvoidCategories([...avoidCategories, category]);
    }
  };

  const handleGenerate = async () => {
    if (cityIds.length === 0) {
      alert('Please select cities first. Go to Discover page to find destinations.');
      return;
    }

    setLoading(true);
    try {
      const response = await generateItinerary({
        cityIds,
        numDays,
        poisPerDay,
        preferredCategoriesByDay: preferredCategoriesByDay.length > 0 ? preferredCategoriesByDay : undefined,
        avoidCategories: avoidCategories.length > 0 ? avoidCategories : undefined,
        level: 'city',
      });
      setItinerary(response.itinerary);
    } catch (error) {
      console.error('Error generating itinerary:', error);
      alert(`Failed to generate itinerary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (cityIds.length === 0) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <Card className="bg-white/80 backdrop-blur shadow-xl border-indigo-100">
            <CardHeader>
              <CardTitle>No Cities Selected</CardTitle>
              <CardDescription>Please select cities from the Discover page first</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/discover')} className="w-full">
                Go to Discover
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="size-4 mr-2" />
          Back
        </Button>

        <div className="space-y-6">
          <Card className="bg-white/80 backdrop-blur shadow-xl border-indigo-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Calendar className="size-6 text-indigo-600" />
                Plan Your Trip
              </CardTitle>
              <CardDescription className="text-base">
                Generate a personalized itinerary for {cityIds.length} selected {cityIds.length === 1 ? 'city' : 'cities'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="numDays" className="text-base font-semibold">Number of Days</Label>
                  <Input
                    id="numDays"
                    type="number"
                    min="1"
                    max="14"
                    value={numDays}
                    onChange={(e) => setNumDays(Math.max(1, Math.min(14, parseInt(e.target.value) || 1)))}
                    className="text-lg h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="poisPerDay" className="text-base font-semibold">POIs per Day</Label>
                  <Input
                    id="poisPerDay"
                    type="number"
                    min="1"
                    max="10"
                    value={poisPerDay}
                    onChange={(e) => setPoisPerDay(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                    className="text-lg h-12"
                  />
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 text-base"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-5 mr-2 animate-spin" />
                    Generating Itinerary...
                  </>
                ) : (
                  <>
                    <Calendar className="size-5 mr-2" />
                    Generate Itinerary
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Preferred Categories by Day */}
          <Card className="bg-white/80 backdrop-blur shadow-xl border-indigo-100">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-indigo-900">Preferred Categories by Day (Optional)</CardTitle>
              <CardDescription>Select categories you'd like to prioritize for each day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {Array.from({ length: numDays }).map((_, dayIndex) => (
                  <div key={dayIndex} className="p-4 border-2 border-indigo-200 rounded-lg bg-indigo-50/50 hover:border-indigo-300 transition-colors">
                    <h4 className="font-semibold mb-3 text-indigo-900 text-base">Day {dayIndex + 1}</h4>
                    <div className="flex flex-wrap gap-2">
                      {POI_CATEGORIES.map(category => (
                        <Badge
                          key={category}
                          variant={preferredCategoriesByDay[dayIndex]?.includes(category) ? 'default' : 'outline'}
                          className={`cursor-pointer transition-all px-3 py-1 ${
                            preferredCategoriesByDay[dayIndex]?.includes(category) 
                              ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600' 
                              : 'hover:bg-indigo-100 border-indigo-300 text-indigo-700'
                          }`}
                          onClick={() => handleCategoryToggle(dayIndex, category)}
                        >
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Avoid Categories */}
          <Card className="bg-white/80 backdrop-blur shadow-xl border-indigo-100">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-indigo-900">Categories to Avoid (Optional)</CardTitle>
              <CardDescription>Select categories you'd prefer to skip in your itinerary</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {POI_CATEGORIES.map(category => (
                  <Badge
                    key={category}
                    variant={avoidCategories.includes(category) ? 'destructive' : 'outline'}
                    className={`cursor-pointer transition-all px-3 py-1 ${
                      avoidCategories.includes(category) 
                        ? 'bg-red-600 hover:bg-red-700 text-white border-red-600' 
                        : 'hover:bg-red-50 border-gray-300 text-gray-700'
                    }`}
                    onClick={() => handleAvoidToggle(category)}
                  >
                    {category}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Itinerary Results */}
        {itinerary && itinerary.length > 0 && (
          <div className="space-y-4 mt-8">
            <h2 className="text-2xl font-bold text-indigo-900 mb-6">Your Itinerary</h2>
            {itinerary.map((day) => (
              <Card key={day.day} className="bg-white/80 backdrop-blur shadow-xl border-indigo-100">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-green-600" />
                    Day {day.day}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {day.pois.length > 0 ? (
                    <div className="space-y-3">
                      {day.pois.map((poi) => (
                        <div key={poi.poiId} className="flex items-start gap-3 p-3 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
                          <MapPin className="size-5 text-indigo-600 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-indigo-900">{poi.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">{poi.category}</Badge>
                              <span className="text-sm text-gray-600">{poi.cityName}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">No POIs scheduled for this day</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

