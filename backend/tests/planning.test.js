// tests/planning.test.js
const { createMockRes } = require("./testUtils");

jest.mock("../db", () => ({
  query: jest.fn()
}));

const connection = require("../db");
const { post_planning_itineraries } = require("../routes/planning");

beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  console.error.mockRestore();
});

describe("post_planning_itineraries validation", () => {
  beforeEach(() => {
    connection.query.mockReset();
  });

  it("returns 400 when level is missing or invalid", async () => {
    const res1 = createMockRes();
    await post_planning_itineraries({ body: { numDays: 3 } }, res1);
    expect(res1.status).toHaveBeenCalledWith(400);

    const res2 = createMockRes();
    await post_planning_itineraries({ body: { level: "planet", numDays: 3 } }, res2);
    expect(res2.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when city level has invalid or missing cityId", async () => {
    const res1 = createMockRes();
    await post_planning_itineraries(
      { body: { level: "city", numDays: 3 } },
      res1
    );
    expect(res1.status).toHaveBeenCalledWith(400);

    const res2 = createMockRes();
    await post_planning_itineraries(
      { body: { level: "city", cityId: "abc", numDays: 3 } },
      res2
    );
    expect(res2.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when country level has invalid or missing countryId", async () => {
    const res1 = createMockRes();
    await post_planning_itineraries(
      { body: { level: "country", numDays: 3 } },
      res1
    );
    expect(res1.status).toHaveBeenCalledWith(400);

    const res2 = createMockRes();
    await post_planning_itineraries(
      { body: { level: "country", countryId: "abc", numDays: 3 } },
      res2
    );
    expect(res2.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when numDays is invalid", async () => {
    const res = createMockRes();
    await post_planning_itineraries(
      { body: { level: "city", cityId: 1, numDays: 0 } },
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "numDays must be a positive integer."
    });
  });
});

describe("post_planning_itineraries level=city", () => {
  beforeEach(() => {
    connection.query.mockReset();
  });

  it("returns 404 when city does not exist", async () => {
    connection.query.mockResolvedValueOnce({ rows: [] }); // cityInfo

    const req = {
      body: { level: "city", cityId: 1, numDays: 2 }
    };
    const res = createMockRes();

    await post_planning_itineraries(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "City not found." });
  });

  it("builds a single-city itinerary with preferences and avoidCategories", async () => {
    // 1st query: city info
    connection.query
      .mockResolvedValueOnce({
        rows: [
          {
            cityid: 1,
            city_name: "Test City",
            countryid: 10,
            country_name: "Test Country"
          }
        ]
      })
      // 2nd query: POIs for the city
      .mockResolvedValueOnce({
        rows: [
          {
            poiid: 100,
            name: "Museum",
            cityid: 1,
            address: "Addr 1",
            primarycategory: "museum"
          },
          {
            poiid: 101,
            name: "Park",
            cityid: 1,
            address: "Addr 2",
            primarycategory: "park"
          }
        ]
      });

    const req = {
      body: {
        level: "city",
        cityId: 1,
        numDays: 2,
        poisPerDay: 1,
        preferredCategoriesByDay: [["museum"], []],
        avoidCategories: ["zoo"]
      }
    };
    const res = createMockRes();

    await post_planning_itineraries(req, res);

    expect(connection.query).toHaveBeenCalledTimes(2);

    // Check the params of the POI query
    const [, poiParams] = connection.query.mock.calls[1];
    expect(poiParams).toEqual([1, ["zoo"]]);

    const { itinerary, summary } = res.json.mock.calls[0][0];
    expect(itinerary.length).toBe(2);
    expect(summary.totalDays).toBe(2);
    expect(summary.totalCities).toBe(1);
    expect(summary.totalPois).toBeGreaterThan(0);
  });

  it("returns 500 on DB error", async () => {
    connection.query.mockRejectedValueOnce(new Error("db error"));

    const req = {
      body: { level: "city", cityId: 1, numDays: 2 }
    };
    const res = createMockRes();

    await post_planning_itineraries(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Database query failed",
      itinerary: [],
      summary: {
        totalDays: 0,
        totalCities: 0,
        totalPois: 0,
        categoriesUsed: []
      }
    });
  });
});

describe("post_planning_itineraries level=country", () => {
  beforeEach(() => {
    connection.query.mockReset();
  });

  it("returns 404 when no cities with POIs are found", async () => {
    connection.query.mockResolvedValueOnce({ rows: [] }); // citiesSql

    const req = {
      body: { level: "country", countryId: 10, numDays: 3 }
    };
    const res = createMockRes();

    await post_planning_itineraries(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "No cities with POIs found in this country."
    });
  });

  it("builds a multi-city itinerary with maxCities and avoidCategories", async () => {
    // 1st query: cities in country
    connection.query
      .mockResolvedValueOnce({
        rows: [
          {
            cityid: 1,
            city_name: "City A",
            countryid: 10,
            country_name: "Country",
            poi_count: "5"
          },
          {
            cityid: 2,
            city_name: "City B",
            countryid: 10,
            country_name: "Country",
            poi_count: "3"
          }
        ]
      })
      // POIs for city 1
      .mockResolvedValueOnce({
        rows: [
          {
            poiid: 100,
            name: "POI A1",
            cityid: 1,
            address: "Addr",
            primarycategory: "museum"
          }
        ]
      })
      // POIs for city 2
      .mockResolvedValueOnce({
        rows: [
          {
            poiid: 200,
            name: "POI B1",
            cityid: 2,
            address: "Addr",
            primarycategory: "park"
          }
        ]
      });

    const req = {
      body: {
        level: "country",
        countryId: 10,
        numDays: 3,
        maxCities: 2,
        poisPerDay: 1,
        preferredCategoriesByDay: [["museum"], [], []],
        avoidCategories: ["zoo"]
      }
    };
    const res = createMockRes();

    await post_planning_itineraries(req, res);

    // First query params: [countryId, avoidCategoriesArray]
    const [, firstParams] = connection.query.mock.calls[0];
    expect(firstParams).toEqual([10, ["zoo"]]);

    const { itinerary, summary } = res.json.mock.calls[0][0];
    expect(itinerary.length).toBe(3); // numDays
    expect(summary.totalDays).toBe(3);
    expect(summary.totalCities).toBeGreaterThanOrEqual(1);
    expect(summary.totalPois).toBeGreaterThan(0);
  });

  it("returns 500 on DB error", async () => {
    connection.query.mockRejectedValueOnce(new Error("boom"));

    const req = {
      body: { level: "country", countryId: 10, numDays: 3 }
    };
    const res = createMockRes();

    await post_planning_itineraries(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
