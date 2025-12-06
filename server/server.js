const express = require('express');
const cors = require('cors');
const config = require('./config.json');
const routes = require('./routes');

const app = express();

app.use(cors({
  origin: '*',
}));

// needed so req.body works with JSON POSTs
app.use(express.json());

// Route 1: availability by cities
app.post('/destinations/availability/cities', routes.destinations_availability_cities);

// Route 2: availability by countries
app.post('/destinations/availability/countries', routes.destinations_availability_countries);

// Route 4: planning itineraries
app.post('/planning/itineraries', routes.post_planning_itineraries);

// Route 6: get countries
app.get('/countries', routes.get_countries);

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

app.listen(config.server_port, () => {
  console.log(`Server running at http://${config.server_host}:${config.server_port}/`);
});

module.exports = app;
