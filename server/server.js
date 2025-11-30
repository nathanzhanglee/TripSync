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

// later you’ll add more routes here…

app.listen(config.server_port, () => {
  console.log(`Server running at http://${config.server_host}:${config.server_port}/`);
});

module.exports = app;
