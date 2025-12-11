const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();

app.use(cors({
  origin: '*',
}));

app.use(express.json());

// Route 1: availability by cities
app.post('/destinations/availability/cities', routes.destinations_availability_cities);

// Route 2 has been removed

// Route 3: destinations features
app.post('/destinations/features', routes.destinations_features);

// Route 4: planning itineraries
app.post('/planning/itineraries', routes.post_planning_itineraries);

// Route 5: random destination
app.get('/destinations/random', routes.destinations_random);

// Route 6: get countries
app.get('/countries', routes.get_countries);

// Route 7: get country by id
app.get('/countries/:countryId', routes.get_country_by_id);

// Route 8: get cities
app.get('/cities', routes.get_cities);

// Route 9: get city by id
app.get('/cities/:cityId', routes.get_city_by_id);

// Route 10: get city pois
app.get('/cities/:cityId/pois', routes.get_city_pois);

// Route 11: get city hotels
app.get('/cities/:cityId/hotels', routes.get_city_hotels);

// Route 12: top attractions recommendation
app.get('/recommendations/cities/top-attractions', routes.get_recommendations_cities_top_attractions);

// Route 13: warm & budget recommendation
app.get('/recommendations/cities/warm-budget', routes.get_recommendations_cities_warm_budget);

// Route 14: balanced city lists
app.get('/recommendations/cities/balanced', routes.get_recommendations_cities_balanced);

// Route 15: best cities per country
app.get('/recommendations/cities/best-per-country', routes.get_recommendations_cities_best_per_country);

module.exports = app;
