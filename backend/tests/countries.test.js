// tests/countries.test.js
const { createMockRes } = require("./testUtils");

jest.mock("../db", () => ({
  query: jest.fn()
}));

const connection = require("../db");
const {
  get_countries,
  get_country_by_id
} = require("../routes/countries");

beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  console.error.mockRestore();
});

describe("get_countries", () => {
  beforeEach(() => {
    connection.query.mockReset();
  });

  it("returns countries with default pagination and no search", async () => {
    connection.query
      .mockResolvedValueOnce({ rows: [{ total: "0" }] })
      .mockResolvedValueOnce({ rows: [] });

    const req = { query: {} };
    const res = createMockRes();

    await get_countries(req, res);

    expect(connection.query).toHaveBeenCalledTimes(2);

    const [, params1] = connection.query.mock.calls[0];
    expect(params1).toEqual([null]); // searchTerm

    const [, params2] = connection.query.mock.calls[1];
    expect(params2).toEqual([null, 20, 0]); // searchTerm, limit, offset

    expect(res.json).toHaveBeenCalledWith({
      countries: [],
      page: 1,
      pageSize: 20,
      total: 0
    });
  });

  it("applies search and pagination", async () => {
    const countryRow = {
      countryId: 1,
      name: "Brazil",
      alpha2Code: "BR",
      alpha3Code: "BRA",
      otherName: null,
      gdp: 123,
      avgHeatIndex: 30,
      cityCount: 10
    };

    connection.query
      .mockResolvedValueOnce({ rows: [{ total: "1" }] })
      .mockResolvedValueOnce({ rows: [countryRow] });

    const req = {
      query: {
        search: "  Bra  ",
        page: "2",
        pageSize: "5"
      }
    };
    const res = createMockRes();

    await get_countries(req, res);

    const [, params1] = connection.query.mock.calls[0];
    expect(params1).toEqual(["Bra"]);

    const [, params2] = connection.query.mock.calls[1];
    expect(params2).toEqual(["Bra", 5, 5]); // search, limit, offset

    const response = res.json.mock.calls[0][0];
    expect(response.page).toBe(2);
    expect(response.pageSize).toBe(5);
    expect(response.total).toBe(1);
    expect(response.countries).toEqual([countryRow]);
  });

  it("returns 500 on DB error", async () => {
    connection.query.mockRejectedValueOnce(new Error("fail"));

    const req = { query: { page: "3", pageSize: "10" } };
    const res = createMockRes();

    await get_countries(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Database query failed",
      countries: [],
      page: 3,
      pageSize: 10,
      total: 0
    });
  });
});

describe("get_country_by_id", () => {
  beforeEach(() => {
    connection.query.mockReset();
  });

  it("returns 400 for invalid countryId", async () => {
    const req = { params: { countryId: "abc" } };
    const res = createMockRes();

    await get_country_by_id(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "countryId must be an integer"
    });
  });

  it("returns 404 when country not found", async () => {
    connection.query.mockResolvedValueOnce({ rows: [] });

    const req = { params: { countryId: "1" } };
    const res = createMockRes();

    await get_country_by_id(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Country not found" });
  });

  it("returns country details with example cities", async () => {
    const countryRow = {
      countryId: 1,
      name: "Brazil",
      alpha2Code: "BR",
      alpha3Code: "BRA",
      otherName: null,
      gdp: 123,
      avgHeatIndex: 30,
      avgCityTemperature: 25,
      avgFoodPrice: 10,
      avgGasPrice: 5,
      avgMonthlySalary: 1000,
      cityCount: "2"
    };

    const exampleCitiesRows = [
      { cityId: 10, cityName: "City A" },
      { cityId: 11, cityName: "City B" }
    ];

    connection.query
      .mockResolvedValueOnce({ rows: [countryRow] })
      .mockResolvedValueOnce({ rows: exampleCitiesRows });

    const req = { params: { countryId: "1" } };
    const res = createMockRes();

    await get_country_by_id(req, res);

    const response = res.json.mock.calls[0][0];
    expect(response.countryId).toBe(1);
    expect(response.name).toBe("Brazil");
    expect(response.cityCount).toBe(2);
    expect(response.exampleCities).toEqual([
      { cityId: 10, cityName: "City A" },
      { cityId: 11, cityName: "City B" }
    ]);
  });

  it("returns 500 on DB error", async () => {
    connection.query.mockRejectedValueOnce(new Error("oops"));

    const req = { params: { countryId: "1" } };
    const res = createMockRes();

    await get_country_by_id(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Database query failed"
    });
  });
});
