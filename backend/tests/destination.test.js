// tests/destination.test.js
const { createMockRes } = require("./testUtils");

jest.mock("../db", () => ({
  query: jest.fn()
}));

const connection = require("../db");
const {
  destinations_availability_cities,
  destinations_features,
  destinations_random
} = require("../routes/destinations");

describe("destinations_availability_cities", () => {
  beforeEach(() => {
    connection.query.mockReset();
  });

  it("returns 400 if originCityIds is missing or empty", async () => {
    const res = createMockRes();

    await destinations_availability_cities({ body: {} }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "originCityIds must be a non-empty array of integers."
    });
  });

  it("uses sane defaults and returns destinations on success", async () => {
    const rows = [
      {
        cityId: 1,
        cityName: "City A",
        countryId: 100,
        countryName: "Country A",
        reachableFromAll: true,
        reachableFrom: [10]
      }
    ];
    connection.query.mockResolvedValueOnce({ rows });

    const req = {
      body: {
        originCityIds: [10],
        maxStop: "2",       // string that should be parsed
        limit: "5",         // string that should be parsed
        requireAllReach: true
      }
    };
    const res = createMockRes();

    await destinations_availability_cities(req, res);

    // Check SQL params
    expect(connection.query).toHaveBeenCalledTimes(1);
    const [sql, params] = connection.query.mock.calls[0];
    expect(Array.isArray(params[0])).toBe(true);           // originCityIds
    expect(params[1]).toBe(2);                             // maxStopsEffective
    expect(params[2]).toBe(1);                             // originCount
    expect(params[3]).toBe(true);                          // requireAllReach
    expect(params[4]).toBe(5);                             // limitEffective

    expect(res.json).toHaveBeenCalledWith({ destinations: rows });
  });

  it("falls back to defaults when maxStop / limit are invalid", async () => {
    connection.query.mockResolvedValueOnce({ rows: [] });

    const req = {
      body: {
        originCityIds: [1, 2],
        maxStop: "not-a-number",
        limit: "0"
      }
    };
    const res = createMockRes();

    await destinations_availability_cities(req, res);

    const [, params] = connection.query.mock.calls[0];
    expect(params[1]).toBe(1);   // default maxStopsEffective
    expect(params[4]).toBe(20);  // default limitEffective
  });

  it("returns 500 when the DB query throws", async () => {
    connection.query.mockRejectedValueOnce(new Error("Boom"));

    const req = {
      body: {
        originCityIds: [1]
      }
    };
    const res = createMockRes();

    await destinations_availability_cities(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Database query failed",
      destinations: []
    });
  });
});
  
describe("destinations_features (scope=city)", () => {
  beforeEach(() => {
    connection.query.mockReset();
  });

  it('returns 400 if scope is not "city" or "country"', async () => {
    const req = { body: { scope: "planet" } };
    const res = createMockRes();

    await destinations_features(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'scope must be "city" or "country"'
    });
  });

  it("returns empty destinations if no cities pass JS post-filter", async () => {
    // DB returns two cities, but minHotelCount drops them all
    connection.query.mockResolvedValueOnce({
      rows: [
        {
          cityId: 1,
          cityName: "City A",
          countryId: 1,
          countryName: "Country A",
          avgTemperature: 20,
          avgFoodPrice: 10,
          avgHotelRating: 3,
          hotelCount: 1,
          poiCount: 1,
          matchingPoiCount: 0
        }
      ]
    });

    const req = {
      body: {
        scope: "city",
        minHotelCount: 5 // higher than hotelCount, so everything filtered out
      }
    };
    const res = createMockRes();

    await destinations_features(req, res);

    expect(res.json).toHaveBeenCalledWith({ destinations: [] });
    // Only one query (no extra POI query)
    expect(connection.query).toHaveBeenCalledTimes(1);
  });

  it("builds WHERE clause from candidateCityIds, minTemp, maxTemp, maxAvgFoodPrice", async () => {
    // 1st query: city rows
    connection.query
      .mockResolvedValueOnce({
        rows: [
          {
            cityId: 1,
            cityName: "City A",
            countryId: 1,
            countryName: "Country A",
            avgTemperature: 20,
            avgFoodPrice: 10,
            avgHotelRating: 4,
            hotelCount: 5,
            poiCount: 10,
            matchingPoiCount: 3
          }
        ]
      })
      // 2nd query: POIs (can be empty, we just need it not to crash)
      .mockResolvedValueOnce({
        rows: []
      });
  
    const req = {
      body: {
        scope: "city",
        candidateCityIds: [1, 2],
        minTemp: 15,
        maxTemp: 30,
        maxAvgFoodPrice: 50
      }
    };
    const res = createMockRes();
  
    await destinations_features(req, res);
  
    // Check first call (the main query)
    const [sql, params] = connection.query.mock.calls[0];
  
    expect(sql).toContain("WHERE c.cityid = ANY($1)");
    expect(sql).toContain("c.avgtemperaturelatestyear >= $2");
    expect(sql).toContain("c.avgtemperaturelatestyear <= $3");
    expect(sql).toContain("c.avgfoodprice <= $4");
  
    expect(params[0]).toEqual([1, 2]); // candidateCityIds
    expect(params[1]).toBe(15);        // minTemp
    expect(params[2]).toBe(30);        // maxTemp
    expect(params[3]).toBe(50);        // maxAvgFoodPrice
  
    // And it still returns a valid response
    const responseArg = res.json.mock.calls[0][0];
    expect(Array.isArray(responseArg.destinations)).toBe(true);
    expect(responseArg.destinations.length).toBe(1);
  });  

  it("filters out cities below minHotelRating", async () => {
    connection.query.mockResolvedValueOnce({
      rows: [
        {
          cityId: 1,
          cityName: "Low Hotel City",
          countryId: 1,
          countryName: "Country A",
          avgTemperature: 20,
          avgFoodPrice: 10,
          avgHotelRating: 3, // below threshold
          hotelCount: 10,
          poiCount: 10,
          matchingPoiCount: 0
        }
      ]
    });
  
    const req = {
      body: {
        scope: "city",
        minHotelRating: 4
      }
    };
    const res = createMockRes();
  
    await destinations_features(req, res);
  
    expect(res.json).toHaveBeenCalledWith({ destinations: [] });
  });

  it("filters out cities below minPoiCount", async () => {
    connection.query.mockResolvedValueOnce({
      rows: [
        {
          cityId: 1,
          cityName: "Few POIs City",
          countryId: 1,
          countryName: "Country A",
          avgTemperature: 20,
          avgFoodPrice: 10,
          avgHotelRating: 5, // passes hotel rating
          hotelCount: 10,
          poiCount: 2,       // below threshold
          matchingPoiCount: 0
        }
      ]
    });
  
    const req = {
      body: {
        scope: "city",
        minPoiCount: 3
      }
    };
    const res = createMockRes();
  
    await destinations_features(req, res);
  
    expect(res.json).toHaveBeenCalledWith({ destinations: [] });
  });  

  it("returns scored city destinations with sampleAttractions", async () => {
    // 1st query: city rows
    connection.query
      .mockResolvedValueOnce({
        rows: [
          {
            cityId: 1,
            cityName: "City A",
            countryId: 1,
            countryName: "Country A",
            avgTemperature: 20,
            avgFoodPrice: 10,
            avgHotelRating: 4,
            hotelCount: 5,
            poiCount: 10,
            matchingPoiCount: 3
          },
          {
            cityId: 2,
            cityName: "City B",
            countryId: 2,
            countryName: "Country B",
            avgTemperature: 25,
            avgFoodPrice: 20,
            avgHotelRating: 3,
            hotelCount: 2,
            poiCount: 5,
            matchingPoiCount: 1
          }
        ]
      })
      // 2nd query: POIs for those cities
      .mockResolvedValueOnce({
        rows: [
          {
            poiId: 100,
            name: "Attraction 1",
            category: "museum",
            cityId: 1
          }
        ]
      });

    const req = {
      body: {
        scope: "city",
        weights: { food: 0.5, attractions: 0.3, hotels: 0.2 },
        limit: 1 // ensure limiting works
      }
    };
    const res = createMockRes();

    await destinations_features(req, res);

    expect(connection.query).toHaveBeenCalledTimes(2);

    const responseArg = res.json.mock.calls[0][0];
    expect(Array.isArray(responseArg.destinations)).toBe(true);
    expect(responseArg.destinations.length).toBe(1);

    const dest = responseArg.destinations[0];
    expect(dest.scope).toBe("city");
    expect(dest.foodScore).toBeDefined();
    expect(dest.attractionsScore).toBeDefined();
    expect(dest.hotelScore).toBeDefined();
    expect(dest.compositeScore).toBeDefined();
    expect(Array.isArray(dest.sampleAttractions)).toBe(true);
  });
});

describe("destinations_features (scope=country)", () => {
  beforeEach(() => {
    connection.query.mockReset();
  });

  it("aggregates by country and returns sampleAttractions", async () => {
    // 1st query: city rows for multiple cities in same country
    connection.query
      .mockResolvedValueOnce({
        rows: [
          {
            cityId: 1,
            cityName: "City A",
            countryId: 10,
            countryName: "Country X",
            avgTemperature: 20,
            avgFoodPrice: 10,
            avgHotelRating: 4,
            hotelCount: 2,
            poiCount: 3,
            matchingPoiCount: 1
          },
          {
            cityId: 2,
            cityName: "City B",
            countryId: 10,
            countryName: "Country X",
            avgTemperature: 22,
            avgFoodPrice: 12,
            avgHotelRating: 5,
            hotelCount: 3,
            poiCount: 4,
            matchingPoiCount: 2
          }
        ]
      })
      // 2nd query: POIs aggregated per country
      .mockResolvedValueOnce({
        rows: [
          {
            poiId: 200,
            name: "Country Attraction",
            category: "park",
            cityId: 1,
            countryId: 10
          }
        ]
      });

    const req = {
      body: {
        scope: "country",
        preferredCategories: ["museum", "park"]
      }
    };
    const res = createMockRes();

    await destinations_features(req, res);

    const { destinations } = res.json.mock.calls[0][0];
    expect(destinations.length).toBe(1);
    const d = destinations[0];
    expect(d.scope).toBe("country");
    expect(d.countryId).toBe(10);
    expect(d.avgTemperature).toBeGreaterThan(0);
    expect(d.hotelCount).toBe(5); // 2 + 3
    expect(Array.isArray(d.sampleAttractions)).toBe(true);
  });

  it("returns 500 on DB error", async () => {
    connection.query.mockRejectedValueOnce(new Error("DB down"));

    const req = { body: { scope: "country" } };
    const res = createMockRes();

    await destinations_features(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Database query failed",
      destinations: []
    });
  });
});

describe("destinations_random", () => {
  beforeEach(() => {
    connection.query.mockReset();
  });

  it("returns 400 for invalid scope", async () => {
    const req = { query: { scope: "galaxy" } };
    const res = createMockRes();

    await destinations_random(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'scope must be "city" or "country"'
    });
  });

  it("returns null when no city rows are found", async () => {
    // For scope=city, destinations_random does one query
    connection.query.mockResolvedValueOnce({ rows: [] });
  
    const req = { query: { scope: "city" } };
    const res = createMockRes();
  
    await destinations_random(req, res);
  
    expect(res.json).toHaveBeenCalledWith(null);
  });  

  it("returns a random country when scope=country", async () => {
    connection.query.mockResolvedValueOnce({
      rows: [{ countryId: 1, countryName: "Country A" }]
    });

    const req = { query: { scope: "country" } };
    const res = createMockRes();

    await destinations_random(req, res);

    expect(connection.query).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      scope: "country",
      countryId: 1,
      countryName: "Country A",
      cityId: null,
      cityName: null
    });
  });

  it("returns null when no country rows", async () => {
    connection.query.mockResolvedValueOnce({ rows: [] });

    const req = { query: { scope: "country" } };
    const res = createMockRes();

    await destinations_random(req, res);

    expect(res.json).toHaveBeenCalledWith(null);
  });

  it("returns random city; filters by countryId when provided", async () => {
    connection.query.mockResolvedValueOnce({
      rows: [
        {
          cityId: 10,
          cityName: "City A",
          countryId: 1,
          countryName: "Country A"
        }
      ]
    });

    const req = { query: { scope: "city", countryId: "1" } };
    const res = createMockRes();

    await destinations_random(req, res);

    // Check that a param was used (countryId parsed as int)
    const [, params] = connection.query.mock.calls[0];
    expect(params).toEqual([1]);

    expect(res.json).toHaveBeenCalledWith({
      scope: "city",
      countryId: 1,
      countryName: "Country A",
      cityId: 10,
      cityName: "City A"
    });
  });

  it("returns 500 on DB error", async () => {
    connection.query.mockRejectedValueOnce(new Error("DB crash"));

    const req = { query: { scope: "city" } };
    const res = createMockRes();

    await destinations_random(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Database query failed"
    });
  });
});
