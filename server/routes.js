const { Pool, types } = require('pg');
const config = require('./config.json');

// Parse BIGINT
types.setTypeParser(20, val => parseInt(val, 10));

// PostgreSQL connection (same pattern as homework)
const connection = new Pool({
  host: config.rds_host,
  user: config.rds_user,
  password: config.rds_password,
  port: config.rds_port,
  database: config.rds_db,
  ssl: {
    rejectUnauthorized: false,
  },
});

// connection.connect((err) => err && console.log(err));

// ----------------------
// Route 1: cities
// ----------------------
const destinations_availability_cities = async function (req, res) {
  const {
    originCityIds,
    requireAllReach = false,
    maxStop = 1,
    maxTravelTime = null, // unused for now
    limit = 20
  } = req.body || {};

  if (!Array.isArray(originCityIds) || originCityIds.length === 0) {
    return res.status(400).json({
      error: "originCityIds must be a non-empty array of integers."
    });
  }

  const originCount = originCityIds.length;
  const maxStopsNum = Number(maxStop);
  const maxStopsEffective =
    Number.isInteger(maxStopsNum) && maxStopsNum >= 0 ? maxStopsNum : 1;
  const limitEffective = Number(limit) > 0 ? Number(limit) : 20;

  const sql = `
    WITH origins AS (
      -- Expand origin city IDs
      SELECT unnest($1::int[]) AS origin_city_id
    ),
    origin_airports AS (
      -- Airports in each origin city
      SELECT DISTINCT
        o.origin_city_id,
        a.airportid AS origin_airport_id
      FROM origins o
      JOIN airports a
        ON a.cityid = o.origin_city_id
    ),
    reachable AS (
      -- Routes from origin airports to destination airports,
      -- then map destination airports back to destination cities
      SELECT
        oa.origin_city_id,
        a_dest.cityid AS dest_city_id
      FROM origin_airports oa
      JOIN routes r
        ON r.sourceid = oa.origin_airport_id
      JOIN airports a_dest
        ON a_dest.airportid = r.destinationid
      WHERE r.stops <= $2
    ),
    dest_agg AS (
      -- Aggregate which origins can reach each destination city
      SELECT
        dest_city_id,
        array_agg(DISTINCT origin_city_id) AS reachable_from,
        COUNT(DISTINCT origin_city_id)     AS origin_reach_count
      FROM reachable
      GROUP BY dest_city_id
    )
    SELECT
      c.cityid     AS "cityId",
      c.name       AS "cityName",
      co.countryid AS "countryId",
      co.name      AS "countryName",
      (dest_agg.origin_reach_count = $3) AS "reachableFromAll",
      dest_agg.reachable_from            AS "reachableFrom"
    FROM dest_agg
    JOIN cities c
      ON c.cityid = dest_agg.dest_city_id
    JOIN countries co
      ON co.countryid = c.countryid
    WHERE ($4::boolean = false OR dest_agg.origin_reach_count = $3)
    ORDER BY "reachableFromAll" DESC, "cityName"
    LIMIT $5;
  `;

  const params = [
    originCityIds,      // $1 :: integer[]
    maxStopsEffective,  // $2
    originCount,        // $3
    requireAllReach,    // $4
    limitEffective      // $5
  ];

  try {
    const { rows } = await connection.query(sql, params);
    return res.json({ destinations: rows });
  } catch (err) {
    console.error("Route 1 error:", err);
    return res.status(500).json({
      error: "Database query failed",
      destinations: []
    });
  }
};

// ----------------------
// Route 2: countries
// ----------------------
const destinations_availability_countries = async function (req, res) {
  const {
    originCityIds,
    requireAllReach = false,
    maxStop = 1,
    maxTravelTime = null, // unused for now
    limit = 20
  } = req.body || {};

  if (!Array.isArray(originCityIds) || originCityIds.length === 0) {
    return res.status(400).json({
      error: "originCityIds must be a non-empty array of integers."
    });
  }

  const originCount = originCityIds.length;
  const maxStopsNum = Number(maxStop);
  const maxStopsEffective =
    Number.isInteger(maxStopsNum) && maxStopsNum >= 0 ? maxStopsNum : 1;
  const limitEffective = Number(limit) > 0 ? Number(limit) : 20;

  const sql = `
    WITH origins AS (
      -- Expand origin city IDs
      SELECT unnest($1::int[]) AS origin_city_id
    ),
    origin_airports AS (
      -- Airports in each origin city
      SELECT DISTINCT
        o.origin_city_id,
        a.airportid AS origin_airport_id
      FROM origins o
      JOIN airports a
        ON a.cityid = o.origin_city_id
    ),
    reachable AS (
      -- Routes from origin airports to destination airports,
      -- then map destination airports back to destination cities
      SELECT
        oa.origin_city_id,
        a_dest.cityid AS dest_city_id
      FROM origin_airports oa
      JOIN routes r
        ON r.sourceid = oa.origin_airport_id
      JOIN airports a_dest
        ON a_dest.airportid = r.destinationid
      WHERE r.stops <= $2
    ),
    country_reach AS (
      -- Map reachable destination cities to their countries
      SELECT DISTINCT
        r.origin_city_id,
        c.countryid AS dest_country_id
      FROM reachable r
      JOIN cities c
        ON c.cityid = r.dest_city_id
    ),
    dest_agg AS (
      -- Aggregate which origins can reach each destination country
      SELECT
        dest_country_id,
        array_agg(DISTINCT origin_city_id) AS reachable_from,
        COUNT(DISTINCT origin_city_id)     AS origin_reach_count
      FROM country_reach
      GROUP BY dest_country_id
    )
    SELECT
      co.countryid AS "countryId",
      co.name      AS "countryName",
      (dest_agg.origin_reach_count = $3) AS "reachableFromAll",
      dest_agg.reachable_from            AS "reachableFrom"
    FROM dest_agg
    JOIN countries co
      ON co.countryid = dest_agg.dest_country_id
    WHERE ($4::boolean = false OR dest_agg.origin_reach_count = $3)
    ORDER BY "reachableFromAll" DESC, "countryName"
    LIMIT $5;
  `;

  const params = [
    originCityIds,      // $1 :: integer[]
    maxStopsEffective,  // $2
    originCount,        // $3
    requireAllReach,    // $4
    limitEffective      // $5
  ];

  try {
    const { rows } = await connection.query(sql, params);
    return res.json({ destinations: rows });
  } catch (err) {
    console.error("Route 2 error:", err);
    return res.status(500).json({
      error: "Database query failed",
      destinations: []
    });
  }
};

// ----------------------
// Route 6: GET /countries
// ----------------------
const get_countries = async function (req, res) {
  const { search = null, page = '1', pageSize = '20' } = req.query || {};

  // Coerce page + pageSize
  const pageNum = parseInt(page, 10);
  const pageSizeNum = parseInt(pageSize, 10);

  const pageEffective =
    Number.isInteger(pageNum) && pageNum >= 1 ? pageNum : 1;
  const pageSizeEffective =
    Number.isInteger(pageSizeNum) && pageSizeNum >= 1 ? pageSizeNum : 20;

  const offset = (pageEffective - 1) * pageSizeEffective;
  const limit = pageSizeEffective;

  // Normalize search term: null means "no filter"
  const searchTerm =
    typeof search === 'string' && search.trim().length > 0
      ? search.trim()
      : null;

  // Query 1: total count (for pagination)
  const sqlCount = `
    SELECT COUNT(*) AS total
    FROM countries co
    WHERE
      ($1::text IS NULL
       OR co.name ILIKE '%' || $1::text || '%'
       OR co.other_name ILIKE '%' || $1::text || '%');
  `;

  // Query 2: paginated list with cityCount
  const sqlList = `
    SELECT
      co.countryid              AS "countryId",
      co.name                   AS "name",
      co.alpha_2_country_code   AS "alpha2Code",
      co.alpha_3_country_code   AS "alpha3Code",
      co.other_name             AS "otherName",
      co.gdp::float8            AS "gdp",
      co.avg_heat_index::float8 AS "avgHeatIndex",
      COUNT(ci.cityid)          AS "cityCount"
    FROM countries co
    LEFT JOIN cities ci
      ON ci.countryid = co.countryid
    WHERE
      ($1::text IS NULL
       OR co.name ILIKE '%' || $1::text || '%'
       OR co.other_name ILIKE '%' || $1::text || '%')
    GROUP BY
      co.countryid,
      co.name,
      co.alpha_2_country_code,
      co.alpha_3_country_code,
      co.other_name,
      co.gdp,
      co.avg_heat_index
    ORDER BY co.name ASC
    LIMIT $2::int
    OFFSET $3::int;
  `;

  try {
    // total count
    const countResult = await connection.query(sqlCount, [searchTerm]);
    const total = Number(countResult.rows[0]?.total) || 0;

    // paginated rows
    const listResult = await connection.query(sqlList, [
      searchTerm,
      limit,
      offset,
    ]);

    const countries = listResult.rows;

    return res.json({
      countries,
      page: pageEffective,
      pageSize: pageSizeEffective,
      total,
    });
  } catch (err) {
    console.error('Route 6 error:', err);
    return res.status(500).json({
      error: 'Database query failed',
      countries: [],
      page: pageEffective,
      pageSize: pageSizeEffective,
      total: 0,
    });
  }
};

module.exports = {
    destinations_availability_cities,
    destinations_availability_countries,
    get_countries,
};