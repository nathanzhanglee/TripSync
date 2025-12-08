const connection = require('../db');

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
      SELECT
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
// Route 3: POST /destinations/features
// ----------------------
const destinations_features = async function (req, res) {
  try {
    const {
      scope, // "city" | "country"
      candidateCityIds,
      minTemp,
      maxTemp,
      maxAvgFoodPrice,
      minHotelRating,
      minHotelCount,
      minPoiCount,
      preferredCategories, // list of primarycategory values
      weights: rawWeights,
      limit: rawLimit,
    } = req.body || {};

    if (scope !== 'city' && scope !== 'country') {
      return res.status(400).json({ error: 'scope must be "city" or "country"' });
    }

    const weights = normalizeWeights(rawWeights);
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : 20;

    const params = [];
    const where = [];
    let idx = 1;

    if (candidateCityIds && candidateCityIds.length) {
      where.push(`c.cityid = ANY($${idx})`);
      params.push(candidateCityIds);
      idx++;
    }

    if (minTemp != null) {
      where.push(`c.avgtemperaturelatestyear >= $${idx}`);
      params.push(minTemp);
      idx++;
    }

    if (maxTemp != null) {
      where.push(`c.avgtemperaturelatestyear <= $${idx}`);
      params.push(maxTemp);
      idx++;
    }

    if (maxAvgFoodPrice != null) {
      where.push(`c.avgfoodprice <= $${idx}`);
      params.push(maxAvgFoodPrice);
      idx++;
    }

    let preferredCategoriesArray = null;
    if (preferredCategories && preferredCategories.length) {
      preferredCategoriesArray = preferredCategories;
      params.push(preferredCategoriesArray);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // city-level aggregates
    const query = `
      SELECT
        c.cityid                    AS "cityId",
        c.name                      AS "cityName",
        co.countryid                AS "countryId",
        co.name                     AS "countryName",
        c.avgtemperaturelatestyear  AS "avgTemperature",
        c.avgfoodprice              AS "avgFoodPrice",
        AVG(h.rating)               AS "avgHotelRating",
        COUNT(DISTINCT h.hotelid)   AS "hotelCount",
        COUNT(DISTINCT p.poiid)     AS "poiCount",
        ${
          preferredCategoriesArray
            ? `
        COUNT(
          DISTINCT CASE
            WHEN p.primarycategory = ANY($${idx})
            THEN p.poiid
          END
        ) AS "matchingPoiCount"`
            : `0::int AS "matchingPoiCount"`
        }
      FROM cities c
      JOIN countries co ON co.countryid = c.countryid
      LEFT JOIN hotel h ON h.cityid = c.cityid
      LEFT JOIN pois   p ON p.cityid = c.cityid
      ${whereClause}
      GROUP BY
        c.cityid,
        c.name,
        co.countryid,
        co.name,
        c.avgtemperaturelatestyear,
        c.avgfoodprice
    `;

    const finalParams =
      preferredCategoriesArray && params[params.length - 1] !== preferredCategoriesArray
        ? [...params, preferredCategoriesArray]
        : params;

    const { rows: cityRows } = await connection.query(query, finalParams);

    // Apply minHotelRating / minHotelCount / minPoiCount in JS
    let filteredCities = cityRows.filter((r) => {
      if (minHotelRating != null && r.avgHotelRating != null && r.avgHotelRating < minHotelRating) {
        return false;
      }
      if (minHotelCount != null && Number(r.hotelCount) < minHotelCount) {
        return false;
      }
      if (minPoiCount != null && Number(r.poiCount) < minPoiCount) {
        return false;
      }
      return true;
    });

    if (!filteredCities.length) {
      return res.json({ destinations: [] });
    }

    // If scope="country", aggregate cities into countries
    let destinations;
    if (scope === 'city') {
      destinations = filteredCities.map((r) => ({
        id: r.cityId,
        scope: 'city',
        name: r.cityName,
        countryId: r.countryId,
        countryName: r.countryName,
        avgTemperature: r.avgTemperature,
        avgFoodPrice: r.avgFoodPrice,
        avgHotelRating: r.avgHotelRating,
        hotelCount: Number(r.hotelCount),
        poiCount: Number(r.poiCount),
        matchingPoiCount: Number(r.matchingPoiCount),
      }));
    } else {
      const map = new Map();
      for (const r of filteredCities) {
        const key = r.countryId;
        if (!map.has(key)) {
          map.set(key, {
            id: r.countryId,
            scope: 'country',
            name: r.countryName,
            countryId: r.countryId,
            countryName: r.countryName,
            temps: [],
            foodPrices: [],
            hotelRatings: [],
            hotelCount: 0,
            poiCount: 0,
            matchingPoiCount: 0,
          });
        }
        const entry = map.get(key);
        if (r.avgTemperature != null) entry.temps.push(Number(r.avgTemperature));
        if (r.avgFoodPrice != null) entry.foodPrices.push(Number(r.avgFoodPrice));
        if (r.avgHotelRating != null) entry.hotelRatings.push(Number(r.avgHotelRating));
        entry.hotelCount += Number(r.hotelCount);
        entry.poiCount += Number(r.poiCount);
        entry.matchingPoiCount += Number(r.matchingPoiCount);
      }

      destinations = Array.from(map.values()).map((e) => ({
        id: e.id,
        scope: 'country',
        name: e.name,
        countryId: e.countryId,
        countryName: e.countryName,
        avgTemperature: e.temps.length
          ? e.temps.reduce((a, b) => a + b, 0) / e.temps.length
          : null,
        avgFoodPrice: e.foodPrices.length
          ? e.foodPrices.reduce((a, b) => a + b, 0) / e.foodPrices.length
          : null,
        avgHotelRating: e.hotelRatings.length
          ? e.hotelRatings.reduce((a, b) => a + b, 0) / e.hotelRatings.length
          : null,
        hotelCount: e.hotelCount,
        poiCount: e.poiCount,
        matchingPoiCount: e.matchingPoiCount,
      }));
    }

    // Min–max normalization within this result set
    const maxFood = Math.max(...destinations.map((d) => d.avgFoodPrice || 0), 1);
    const maxPoi = Math.max(...destinations.map((d) => d.poiCount || 0), 1);
    const maxHotels = Math.max(...destinations.map((d) => d.hotelCount || 0), 1);

    const scored = destinations.map((d) => {
      const foodScore =
        d.avgFoodPrice != null ? 1 - Math.min(d.avgFoodPrice / maxFood, 1) : 0.0;
      const attractionsScore =
        d.poiCount > 0 ? Math.min(d.poiCount / maxPoi, 1) : 0.0;
      const hotelScore =
        d.hotelCount > 0 ? Math.min(d.hotelCount / maxHotels, 1) : 0.0;

      const compositeScore =
        weights.food * foodScore +
        weights.attractions * attractionsScore +
        weights.hotels * hotelScore;

      return {
        ...d,
        foodScore,
        attractionsScore,
        hotelScore,
        compositeScore,
      };
    });

    scored.sort((a, b) => b.compositeScore - a.compositeScore);
    const top = scored.slice(0, limit);

    // Sample attractions for each destination
    for (const dest of top) {
      if (dest.scope === 'city') {
        const { rows: poiRows } = await connection.query(
          `
          SELECT
            poiid      AS "poiId",
            name       AS "name",
            primarycategory AS "category",
            cityid     AS "cityId"
          FROM pois
          WHERE cityid = $1
          ORDER BY poiid
          LIMIT 5
        `,
          [dest.id],
        );
        dest.sampleAttractions = poiRows;
      } else {
        const { rows: poiRows } = await connection.query(
          `
          SELECT
            p.poiid      AS "poiId",
            p.name       AS "name",
            p.primarycategory AS "category",
            p.cityid     AS "cityId"
          FROM pois p
          JOIN cities c ON c.cityid = p.cityid
          WHERE c.countryid = $1
          ORDER BY p.poiid
          LIMIT 5
        `,
          [dest.countryId],
        );
        dest.sampleAttractions = poiRows;
      }
    }

    res.json({ destinations: top });
  } catch (err) {
    console.error("Route 3 error:", err);
    return res.status(500).json({
      error: "Database query failed",
      destinations: []
    });
  }
};

// ----------------------
// Route 5: GET /destinations/random
// ----------------------
const destinations_random = async function (req, res) {
  try {
    const scope = (req.query.scope || 'city').toLowerCase();
    const countryId = req.query.countryId
      ? parseInt(req.query.countryId, 10)
      : null;

    if (scope !== 'city' && scope !== 'country') {
      return res.status(400).json({ error: 'scope must be "city" or "country"' });
    }

    if (scope === 'country') {
      const { rows } = await connection.query(
        `
        SELECT
          countryid AS "countryId",
          name      AS "countryName"
        FROM countries
        ORDER BY RANDOM()
        LIMIT 1
      `,
      );

      if (!rows.length) {
        return res.json(null);
      }

      return res.json({
        scope: 'country',
        countryId: rows[0].countryId,
        countryName: rows[0].countryName,
        cityId: null,
        cityName: null,
      });
    }

    // scope === 'city'
    const params = [];
    let where = '';
    if (countryId != null && !Number.isNaN(countryId)) {
      where = 'WHERE c.countryid = $1';
      params.push(countryId);
    }

    const { rows } = await connection.query(
      `
      SELECT
        c.cityid    AS "cityId",
        c.name      AS "cityName",
        co.countryid AS "countryId",
        co.name     AS "countryName"
      FROM cities c
      JOIN countries co ON co.countryid = c.countryid
      ${where}
      ORDER BY RANDOM()
      LIMIT 1
    `,
      params,
    );

    if (!rows.length) {
      return res.json(null);
    }

    const row = rows[0];
    res.json({
      scope: 'city',
      countryId: row.countryId,
      countryName: row.countryName,
      cityId: row.cityId,
      cityName: row.cityName,
    });
  } catch (err) {
    console.error("Route 5 error:", err);
    return res.status(500).json({
      error: "Database query failed"
    });
  }
};

/**
 * Helper: normalize weights for /destinations/features
 */
function normalizeWeights(raw) {
  const defaults = { food: 0.33, attractions: 0.33, hotels: 0.34 };
  const merged = {
    food: raw?.food ?? defaults.food,
    attractions: raw?.attractions ?? defaults.attractions,
    hotels: raw?.hotels ?? defaults.hotels,
  };
  const sum = merged.food + merged.attractions + merged.hotels || 1;
  return {
    food: merged.food / sum,
    attractions: merged.attractions / sum,
    hotels: merged.hotels / sum,
  };
}

module.exports = {
  destinations_availability_cities,
  destinations_availability_countries,
  destinations_features,
  destinations_random,
};