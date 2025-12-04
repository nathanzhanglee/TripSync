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

// Route 6: get countries
app.get('/countries', routes.get_countries);

app.listen(config.server_port, () => {
  console.log(`Server running at http://${config.server_host}:${config.server_port}/`);
});

module.exports = app;
