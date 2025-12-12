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

    const req = { query: { minPoi: "bad", minHotels: "-1", mode: "nope" } };
    const res = createMockRes();

    await get_recommendations_cities_best_per_country(req, res);

    const [, params] = connection.query.mock.calls[0];
    expect(params[0]).toBe(1); // default minPoi
    expect(params[1]).toBe(1); // default minHotels
    expect(params[2]).toBe(1); // default topKPerCountry (perCountry mode)

    expect(res.json).toHaveBeenCalledWith({
      bestCities: [],
      minPoi: 1,
      minHotels: 1,
      mode: "perCountry",
      limit: undefined,
      topKPerCountry: 1,
      returned: 0
    });
  });

  it("perCountry: uses provided minPoi/minHotels/topKPerCountry", async () => {
    const rows = [{ countryId: 1, cityId: 10, rankInCountry: 1 }];
    connection.query.mockResolvedValueOnce({ rows });

    const req = { query: { minPoi: "7", minHotels: "9", mode: "perCountry", topKPerCountry: "3" } };
    const res = createMockRes();

    await get_recommendations_cities_best_per_country(req, res);

    const [, params] = connection.query.mock.calls[0];
    expect(params).toEqual([7, 9, 3]);

    expect(res.json).toHaveBeenCalledWith({
      bestCities: rows,
      minPoi: 7,
      minHotels: 9,
      mode: "perCountry",
      limit: undefined,
      topKPerCountry: 3,
      returned: rows.length
    });
  });

  it("global: uses limit as the third param and returns limit in payload", async () => {
    const rows = [{ countryId: 1, cityId: 10 }];
    connection.query.mockResolvedValueOnce({ rows });

    const req = { query: { mode: "global", limit: "5", minPoi: "2", minHotels: "3" } };
    const res = createMockRes();

    await get_recommendations_cities_best_per_country(req, res);

    const [, params] = connection.query.mock.calls[0];
    expect(params).toEqual([2, 3, 5]);

    expect(res.json).toHaveBeenCalledWith({
      bestCities: rows,
      minPoi: 2,
      minHotels: 3,
      mode: "global",
      limit: 5,
      topKPerCountry: undefined,
      returned: rows.length
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
      minPoi: 1,
      minHotels: 1
    });
  });
});
