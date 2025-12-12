// tests/cities.test.js
const { createMockRes } = require("./testUtils");

jest.mock("../db", () => ({
  query: jest.fn()
}));

const connection = require("../db");
const {
  get_cities,
  get_city_by_id,
  get_city_pois,
  get_city_hotels
} = require("../routes/cities");

beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  console.error.mockRestore();
});

describe("get_cities", () => {
  beforeEach(() => {
    connection.query.mockReset();
  });

  it("returns cities with default pagination and no filters", async () => {
    connection.query
      // count query
      .mockResolvedValueOnce({ rows: [{ total: "2" }] })
      // list query
      .mockResolvedValueOnce({
        rows: [
          {
            cityId: 1,
            name: "City A",
            countryId: 10,
            countryName: "Country A",
            latitude: 1.23,
            longitude: 4.56,
            avgTemperature: 20,
            avgFoodPrice: 10,
            avgGasPrice: 5,
            avgMonthlySalary: 1000
          }
        ]
      });

    const req = { query: {} };
    const res = createMockRes();

    await get_cities(req, res);

    expect(connection.query).toHaveBeenCalledTimes(2);

    const response = res.json.mock.calls[0][0];
    expect(Array.isArray(response.cities)).toBe(true);
    expect(response.cities.length).toBe(1);
    expect(response.page).toBe(1);
    expect(response.pageSize).toBe(20);
    expect(response.total).toBe(2);

    // second query params: [limit, offset] -> [20, 0]
    const [, params2] = connection.query.mock.calls[1];
    expect(params2).toEqual([20, 0]);
  });

  it("applies filters and pagination correctly", async () => {
    connection.query
      .mockResolvedValueOnce({ rows: [{ total: "5" }] })
      .mockResolvedValueOnce({ rows: [] });

    const req = {
      query: {
        search: "Lon",
        countryId: "2",
        minTemp: "10",
        maxTemp: "30",
        maxFood: "50",
        page: "2",
        pageSize: "10"
      }
    };
    const res = createMockRes();

    await get_cities(req, res);

    expect(connection.query).toHaveBeenCalledTimes(2);

    // 1st query: count
    const [, params1] = connection.query.mock.calls[0];
    // params1 is mutated later, so just check the first 5 entries
    expect(params1.slice(0, 5)).toEqual(["%Lon%", 2, 10, 30, 50]);    

    // 2nd query: list
    const [, params2] = connection.query.mock.calls[1];
    // params1 plus [limit, offset] => [ "%Lon%", 2, 10, 30, 50, 10, 10 ]
    expect(params2).toEqual(["%Lon%", 2, 10, 30, 50, 10, 10]);

    const response = res.json.mock.calls[0][0];
    expect(response.page).toBe(2);
    expect(response.pageSize).toBe(10);
    expect(response.total).toBe(5);
  });

  it("returns 500 on DB error and preserves page/pageSize", async () => {
    connection.query.mockRejectedValueOnce(new Error("db fail"));

    const req = {
      query: {
        page: "3",
        pageSize: "5"
      }
    };
    const res = createMockRes();

    await get_cities(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Database query failed",
      cities: [],
      page: 3,
      pageSize: 5,
      total: 0
    });
  });
});

describe("get_city_by_id", () => {
  beforeEach(() => {
    connection.query.mockReset();
  });

  it("returns 400 for invalid cityId", async () => {
    const req = { params: { cityId: "abc" } };
    const res = createMockRes();

    await get_city_by_id(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "cityId must be a positive integer."
    });
  });

  it("returns 404 when city not found", async () => {
    connection.query.mockResolvedValueOnce({ rows: [] });

    const req = { params: { cityId: "1" } };
    const res = createMockRes();

    await get_city_by_id(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "City not found." });
  });

  it("returns city details on success", async () => {
    const row = {
      cityId: 1,
      countryId: 10,
      name: "City A",
      latitude: 1.23,
      longitude: 4.56,
      avgTemperature: 20,
      latestTempYear: 2020,
      avgFoodPrice: 10,
      avgGasPrice: 5,
      avgMonthlySalary: 1000,
      poiCount: 3,
      hotelCount: 4,
      avgHotelRating: 4.5
    };
    connection.query.mockResolvedValueOnce({ rows: [row] });

    const req = { params: { cityId: "1" } };
    const res = createMockRes();

    await get_city_by_id(req, res);

    expect(res.json).toHaveBeenCalledWith(row);
  });

  it("returns 500 on DB error", async () => {
    connection.query.mockRejectedValueOnce(new Error("boom"));

    const req = { params: { cityId: "1" } };
    const res = createMockRes();

    await get_city_by_id(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Database query failed"
    });
  });
});

describe("get_city_pois", () => {
  beforeEach(() => {
    connection.query.mockReset();
  });

  it("returns 400 for invalid cityId", async () => {
    const req = { params: { cityId: "0" }, query: {} };
    const res = createMockRes();

    await get_city_pois(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "cityId must be a positive integer."
    });
  });

  it("applies category and limit correctly", async () => {
    const rows = [{ poiId: 1, name: "POI A" }];
    connection.query.mockResolvedValueOnce({ rows });

    const req = {
      params: { cityId: "5" },
      query: { category: " museum ", limit: "10" }
    };
    const res = createMockRes();

    await get_city_pois(req, res);

    expect(connection.query).toHaveBeenCalledTimes(1);
    const [, params] = connection.query.mock.calls[0];
    expect(params).toEqual([5, "museum", 10]);

    expect(res.json).toHaveBeenCalledWith({ pois: rows });
  });

  it("uses default limit and null category when inputs invalid", async () => {
    const rows = [];
    connection.query.mockResolvedValueOnce({ rows });

    const req = {
      params: { cityId: "5" },
      query: { category: "", limit: "not-a-number" }
    };
    const res = createMockRes();

    await get_city_pois(req, res);

    const [, params] = connection.query.mock.calls[0];
    expect(params).toEqual([5, null, 50]);
  });

  it("returns 500 on DB error", async () => {
    connection.query.mockRejectedValueOnce(new Error("oops"));

    const req = {
      params: { cityId: "5" },
      query: {}
    };
    const res = createMockRes();

    await get_city_pois(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Database query failed",
      pois: []
    });
  });
});

describe("get_city_hotels", () => {
  beforeEach(() => {
    connection.query.mockReset();
  });

  it("returns 400 for invalid cityId", async () => {
    const req = { params: { cityId: "abc" }, query: {} };
    const res = createMockRes();

    await get_city_hotels(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "cityId must be a positive integer."
    });
  });

  it("applies minRating and limit correctly", async () => {
    const rows = [{ hotelId: 1, name: "Hotel A" }];
    connection.query.mockResolvedValueOnce({ rows });

    const req = {
      params: { cityId: "3" },
      query: { minRating: "4.5", limit: "5" }
    };
    const res = createMockRes();

    await get_city_hotels(req, res);

    const [, params] = connection.query.mock.calls[0];
    expect(params).toEqual([3, 4.5, 5]);

    expect(res.json).toHaveBeenCalledWith({ hotels: rows });
  });

  it("uses default limit and null minRating when inputs invalid", async () => {
    const rows = [];
    connection.query.mockResolvedValueOnce({ rows });

    const req = {
      params: { cityId: "3" },
      query: { minRating: null, limit: "bad" }
    };
    const res = createMockRes();

    await get_city_hotels(req, res);

    const [, params] = connection.query.mock.calls[0];
    expect(params).toEqual([3, null, 50]);
  });

  it("returns 500 on DB error", async () => {
    connection.query.mockRejectedValueOnce(new Error("err"));

    const req = { params: { cityId: "3" }, query: {} };
    const res = createMockRes();

    await get_city_hotels(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Database query failed",
      hotels: []
    });
  });
});
