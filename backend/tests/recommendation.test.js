// tests/recommendation.test.js
const { createMockRes } = require("./testUtils");

jest.mock("../db", () => ({
  query: jest.fn()
}));

const connection = require("../db");
const {
  get_recommendations_cities_top_attractions,
  get_recommendations_cities_warm_budget,
  get_recommendations_cities_balanced,
  get_recommendations_cities_best_per_country
} = require("../routes/recommendations");

describe("get_recommendations_cities_top_attractions", () => {
  beforeEach(() => {
    connection.query.mockReset();
  });

  it("uses default limit when query param is invalid", async () => {
    connection.query.mockResolvedValueOnce({ rows: [] });

    const req = { query: { limit: "not-a-number" } };
    const res = createMockRes();

    await get_recommendations_cities_top_attractions(req, res);

    const [, params] = connection.query.mock.calls[0];
    expect(params[0]).toBe(10); // default limit
    expect(res.json).toHaveBeenCalledWith({
      cities: [],
      limit: 10
    });
  });

  it("passes parsed limit and returns cities", async () => {
    const rows = [{ cityId: 1, name: "City A" }];
    connection.query.mockResolvedValueOnce({ rows });

    const req = { query: { limit: "5" } };
    const res = createMockRes();

    await get_recommendations_cities_top_attractions(req, res);

    expect(res.json).toHaveBeenCalledWith({
      cities: rows,
      limit: 5
    });
  });

  it("returns 500 on DB error", async () => {
    connection.query.mockRejectedValueOnce(new Error("oops"));

    const req = { query: {} };
    const res = createMockRes();

    await get_recommendations_cities_top_attractions(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Database query failed",
      cities: [],
      limit: 10
    });
  });
});

describe("get_recommendations_cities_warm_budget", () => {
  beforeEach(() => {
    connection.query.mockReset();
  });

  it("uses defaults when params are missing", async () => {
    connection.query.mockResolvedValueOnce({ rows: [] });

    const req = { query: {} };
    const res = createMockRes();

    await get_recommendations_cities_warm_budget(req, res);

    const [, params] = connection.query.mock.calls[0];
    expect(params[0]).toBe(10);  // default limit
    expect(params[1]).toBe(18.0); // default minTemp
    expect(params[2]).toBe(3);   // poiThreshold

    expect(res.json).toHaveBeenCalledWith({
      cities: [],
      limit: 10,
      minTemp: 18.0
    });
  });

  it("parses and uses provided limit and minTemp", async () => {
    const rows = [{ cityId: 1, cityName: "City A" }];
    connection.query.mockResolvedValueOnce({ rows });

    const req = { query: { limit: "3", minTemp: "25.5" } };
    const res = createMockRes();

    await get_recommendations_cities_warm_budget(req, res);

    expect(res.json).toHaveBeenCalledWith({
      cities: rows,
      limit: 3,
      minTemp: 25.5
    });
  });

  it("returns 500 on DB error", async () => {
    connection.query.mockRejectedValueOnce(new Error("fail"));

    const req = { query: {} };
    const res = createMockRes();

    await get_recommendations_cities_warm_budget(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Database query failed",
      cities: [],
      limit: 10,
      minTemp: 18.0
    });
  });
});

describe("get_recommendations_cities_balanced", () => {
  beforeEach(() => {
    connection.query.mockReset();
  });

  it("uses default limit when invalid", async () => {
    connection.query.mockResolvedValueOnce({ rows: [] });

    const req = { query: { limit: "bad" } };
    const res = createMockRes();

    await get_recommendations_cities_balanced(req, res);

    const [, params] = connection.query.mock.calls[0];
    expect(params[0]).toBe(20);

    expect(res.json).toHaveBeenCalledWith({
      cities: [],
      limit: 20
    });
  });

  it("returns cities on success", async () => {
    const rows = [{ cityId: 1, cityName: "City A" }];
    connection.query.mockResolvedValueOnce({ rows });

    const req = { query: { limit: "5" } };
    const res = createMockRes();

    await get_recommendations_cities_balanced(req, res);

    expect(res.json).toHaveBeenCalledWith({
      cities: rows,
      limit: 5
    });
  });

  it("returns 500 on DB error", async () => {
    connection.query.mockRejectedValueOnce(new Error("boom"));

    const req = { query: {} };
    const res = createMockRes();

    await get_recommendations_cities_balanced(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Database query failed",
      cities: [],
      limit: 20
    });
  });
});

describe("get_recommendations_cities_best_per_country", () => {
  beforeEach(() => {
    connection.query.mockReset();
  });

  it("uses defaults when params invalid", async () => {
    connection.query.mockResolvedValueOnce({ rows: [] });

    const req = { query: { minPoi: "bad", minHotels: "-1" } };
    const res = createMockRes();

    await get_recommendations_cities_best_per_country(req, res);

    const [, params] = connection.query.mock.calls[0];
    expect(params[0]).toBe(5); // default minPoi
    expect(params[1]).toBe(5); // default minHotels

    expect(res.json).toHaveBeenCalledWith({
      bestCities: [],
      minPoi: 5,
      minHotels: 5
    });
  });

  it("uses provided minPoi and minHotels", async () => {
    const rows = [{ countryId: 1, cityId: 10 }];
    connection.query.mockResolvedValueOnce({ rows });

    const req = { query: { minPoi: "7", minHotels: "9" } };
    const res = createMockRes();

    await get_recommendations_cities_best_per_country(req, res);

    expect(res.json).toHaveBeenCalledWith({
      bestCities: rows,
      minPoi: 7,
      minHotels: 9
    });
  });

  it("returns 500 on DB error", async () => {
    connection.query.mockRejectedValueOnce(new Error("err"));

    const req = { query: {} };
    const res = createMockRes();

    await get_recommendations_cities_best_per_country(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Database query failed",
      bestCities: [],
      minPoi: 5,
      minHotels: 5
    });
  });
});
