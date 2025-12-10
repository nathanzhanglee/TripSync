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
// Route 4: POST /planning/itineraries
// ----------------------
const post_planning_itineraries = async function (req, res) {
  const {
    level,
    cityId = null,
    countryId = null,
    numDays,
    maxCities = null,
    poisPerDay = 3,
    preferredCategoriesByDay = null,
    avoidCategories = []
  } = req.body || {};

  // Validation
  if (!level || (level !== 'city' && level !== 'country')) {
    return res.status(400).json({
      error: "level must be either 'city' or 'country'."
    });
  }

  if (level === 'city' && (!cityId || !Number.isInteger(Number(cityId)))) {
    return res.status(400).json({
      error: "cityId is required and must be an integer when level = 'city'."
    });
  }

  if (level === 'country' && (!countryId || !Number.isInteger(Number(countryId)))) {
    return res.status(400).json({
      error: "countryId is required and must be an integer when level = 'country'."
    });
  }

  if (!numDays || !Number.isInteger(Number(numDays)) || numDays <= 0) {
    return res.status(400).json({
      error: "numDays must be a positive integer."
    });
  }

  const numDaysEffective = Number(numDays);
  const poisPerDayEffective = Number.isInteger(Number(poisPerDay)) && poisPerDay > 0 
    ? Number(poisPerDay) 
    : 3;
  const avoidCategoriesArray = Array.isArray(avoidCategories) ? avoidCategories : [];

  try {
    let itinerary = [];
    let categoriesUsed = new Set();
    let citiesInItinerary = new Set();

    if (level === 'city') {
      // Single-city itinerary
      const cityIdNum = Number(cityId);
      
      // Get city info
      const cityInfoSql = `
        SELECT c.cityid, c.name AS city_name, c.countryid, co.name AS country_name
        FROM cities c
        JOIN countries co ON co.countryid = c.countryid
        WHERE c.cityid = $1;
      `;
      const cityInfoResult = await connection.query(cityInfoSql, [cityIdNum]);
      
      if (cityInfoResult.rows.length === 0) {
        return res.status(404).json({ error: "City not found." });
      }

      const cityInfo = cityInfoResult.rows[0];
      citiesInItinerary.add(cityIdNum);

      // Get POIs for this city
      const poisSql = `
        SELECT 
          poiid, 
          name, 
          cityid,
          address, 
          primarycategory
        FROM pois
        WHERE 
          cityid = $1
          AND ($2::text[] IS NULL OR NOT (primarycategory = ANY($2::text[])))
        ORDER BY RANDOM();
      `;
      
      const poisResult = await connection.query(poisSql, [
        cityIdNum,
        avoidCategoriesArray.length > 0 ? avoidCategoriesArray : null
      ]);

      const allPois = poisResult.rows;

      // Distribute POIs across days
      for (let day = 1; day <= numDaysEffective; day++) {
        const dayPreferredCategories = 
          preferredCategoriesByDay && 
          Array.isArray(preferredCategoriesByDay[day - 1])
            ? preferredCategoriesByDay[day - 1]
            : [];

        // Filter POIs for this day based on preferences
        let dayPois = [];
        let remainingPois = [...allPois];

        // First, try to match preferred categories
        if (dayPreferredCategories.length > 0) {
          const matchingPois = remainingPois.filter(poi =>
            dayPreferredCategories.includes(poi.primarycategory)
          );
          
          const numToTake = Math.min(poisPerDayEffective, matchingPois.length);
          dayPois = matchingPois.slice(0, numToTake);
          
          // Remove selected POIs from available pool
          const selectedIds = new Set(dayPois.map(p => p.poiid));
          remainingPois = remainingPois.filter(p => !selectedIds.has(p.poiid));
        }

        // Fill remaining slots with any available POIs
        if (dayPois.length < poisPerDayEffective && remainingPois.length > 0) {
          const numNeeded = poisPerDayEffective - dayPois.length;
          const additionalPois = remainingPois.slice(0, numNeeded);
          dayPois = [...dayPois, ...additionalPois];
          
          // Remove selected POIs
          const selectedIds = new Set(additionalPois.map(p => p.poiid));
          remainingPois = remainingPois.filter(p => !selectedIds.has(p.poiid));
        }

        // Update remaining POIs for next iteration
        allPois.length = 0;
        allPois.push(...remainingPois);

        // Format POIs for response
        const formattedPois = dayPois.map(poi => {
          categoriesUsed.add(poi.primarycategory);
          return {
            poiId: poi.poiid,
            name: poi.name,
            cityId: poi.cityid,
            category: poi.primarycategory,
            address: poi.address
          };
        });

        itinerary.push({
          dayNumber: day,
          cityId: cityInfo.cityid,
          cityName: cityInfo.city_name,
          countryId: cityInfo.countryid,
          countryName: cityInfo.country_name,
          categoryFocus: dayPreferredCategories,
          pois: formattedPois
        });
      }

    } else {
      // Multi-city itinerary (level = 'country')
      const countryIdNum = Number(countryId);
      
      // Get cities in this country with POI counts
      const citiesSql = `
        SELECT 
          c.cityid, 
          c.name AS city_name, 
          c.countryid,
          co.name AS country_name,
          COUNT(p.poiid) AS poi_count
        FROM cities c
        JOIN countries co ON co.countryid = c.countryid
        LEFT JOIN pois p ON p.cityid = c.cityid
          AND ($2::text[] IS NULL OR NOT (p.primarycategory = ANY($2::text[])))
        WHERE c.countryid = $1
        GROUP BY c.cityid, c.name, c.countryid, co.name
        HAVING COUNT(p.poiid) > 0
        ORDER BY COUNT(p.poiid) DESC;
      `;
      
      const citiesResult = await connection.query(citiesSql, [
        countryIdNum,
        avoidCategoriesArray.length > 0 ? avoidCategoriesArray : null
      ]);

      if (citiesResult.rows.length === 0) {
        return res.status(404).json({ 
          error: "No cities with POIs found in this country." 
        });
      }

      // Determine how many cities to use
      const maxCitiesEffective = maxCities && Number.isInteger(Number(maxCities)) && maxCities > 0
        ? Math.min(Number(maxCities), citiesResult.rows.length)
        : Math.min(Math.ceil(numDaysEffective / 2), citiesResult.rows.length);

      const selectedCities = citiesResult.rows.slice(0, maxCitiesEffective);
      
      // Calculate days per city (distribute evenly)
      const daysPerCity = Math.floor(numDaysEffective / selectedCities.length);
      const extraDays = numDaysEffective % selectedCities.length;

      let currentDay = 1;

      for (let i = 0; i < selectedCities.length; i++) {
        const city = selectedCities[i];
        const daysInThisCity = daysPerCity + (i < extraDays ? 1 : 0);
        citiesInItinerary.add(city.cityid);

        // Get POIs for this city
        const poisSql = `
          SELECT 
            poiid, 
            name, 
            cityid,
            address, 
            primarycategory
          FROM pois
          WHERE 
            cityid = $1
            AND ($2::text[] IS NULL OR NOT (primarycategory = ANY($2::text[])))
          ORDER BY RANDOM();
        `;
        
        const poisResult = await connection.query(poisSql, [
          city.cityid,
          avoidCategoriesArray.length > 0 ? avoidCategoriesArray : null
        ]);

        const allPois = poisResult.rows;

        // Distribute POIs across days in this city
        for (let dayInCity = 0; dayInCity < daysInThisCity; dayInCity++) {
          const dayPreferredCategories = 
            preferredCategoriesByDay && 
            Array.isArray(preferredCategoriesByDay[currentDay - 1])
              ? preferredCategoriesByDay[currentDay - 1]
              : [];

          // Filter POIs for this day
          let dayPois = [];
          let remainingPois = [...allPois];

          // Match preferred categories first
          if (dayPreferredCategories.length > 0) {
            const matchingPois = remainingPois.filter(poi =>
              dayPreferredCategories.includes(poi.primarycategory)
            );
            
            const numToTake = Math.min(poisPerDayEffective, matchingPois.length);
            dayPois = matchingPois.slice(0, numToTake);
            
            const selectedIds = new Set(dayPois.map(p => p.poiid));
            remainingPois = remainingPois.filter(p => !selectedIds.has(p.poiid));
          }

          // Fill remaining slots
          if (dayPois.length < poisPerDayEffective && remainingPois.length > 0) {
            const numNeeded = poisPerDayEffective - dayPois.length;
            const additionalPois = remainingPois.slice(0, numNeeded);
            dayPois = [...dayPois, ...additionalPois];
            
            const selectedIds = new Set(additionalPois.map(p => p.poiid));
            remainingPois = remainingPois.filter(p => !selectedIds.has(p.poiid));
          }

          // Update remaining POIs
          allPois.length = 0;
          allPois.push(...remainingPois);

          // Format POIs
          const formattedPois = dayPois.map(poi => {
            categoriesUsed.add(poi.primarycategory);
            return {
              poiId: poi.poiid,
              name: poi.name,
              cityId: poi.cityid,
              category: poi.primarycategory,
              address: poi.address
            };
          });

          itinerary.push({
            dayNumber: currentDay,
            cityId: city.cityid,
            cityName: city.city_name,
            countryId: city.countryid,
            countryName: city.country_name,
            categoryFocus: dayPreferredCategories,
            pois: formattedPois
          });

          currentDay++;
        }
      }
    }

    // Calculate summary
    const totalPois = itinerary.reduce((sum, day) => sum + day.pois.length, 0);

    const summary = {
      totalDays: numDaysEffective,
      totalCities: citiesInItinerary.size,
      totalPois: totalPois,
      categoriesUsed: Array.from(categoriesUsed)
    };

    return res.json({
      itinerary,
      summary
    });

  } catch (err) {
    console.error("Route 4 error:", err);
    return res.status(500).json({
      error: "Database query failed",
      itinerary: [],
      summary: {
        totalDays: 0,
        totalCities: 0,
        totalPois: 0,
        categoriesUsed: []
      }
    });
  }
};

// ----------------------
// Route 3: POST /destinations/features
// ----------------------
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

    // Build WHERE clause for cities
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

    // Track index for preferred categories
    let preferredCategoriesIdx = null;
    if (preferredCategories && preferredCategories.length) {
      preferredCategoriesIdx = idx;
      params.push(preferredCategories);
      idx++;
    }

    const citiesWhereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // OPTIMIZED: Push city filtering into CTEs to avoid scanning entire hotel/pois tables
    // filtered_cities CTE filters cities first, then hotel_stats and poi_stats only aggregate matching rows
    const query = `
      WITH filtered_cities AS (
        SELECT c.cityid, c.name, c.countryid, c.avgtemperaturelatestyear, c.avgfoodprice
        FROM cities c
        ${citiesWhereClause}
      ),
      hotel_stats AS (
        SELECT
          h.cityid,
          AVG(h.rating) AS avg_rating,
          COUNT(*) AS hotel_count
        FROM hotel h
        INNER JOIN filtered_cities fc ON fc.cityid = h.cityid
        GROUP BY h.cityid
      ),
      poi_stats AS (
        SELECT
          p.cityid,
          COUNT(*) AS poi_count
          ${preferredCategoriesIdx ? `, COUNT(CASE WHEN p.primarycategory = ANY($${preferredCategoriesIdx}) THEN 1 END) AS matching_poi_count` : ', 0 AS matching_poi_count'}
        FROM pois p
        INNER JOIN filtered_cities fc ON fc.cityid = p.cityid
        GROUP BY p.cityid
      )
      SELECT
        fc.cityid                    AS "cityId",
        fc.name                      AS "cityName",
        co.countryid                 AS "countryId",
        co.name                      AS "countryName",
        fc.avgtemperaturelatestyear  AS "avgTemperature",
        fc.avgfoodprice              AS "avgFoodPrice",
        COALESCE(hs.avg_rating, 0)   AS "avgHotelRating",
        COALESCE(hs.hotel_count, 0)  AS "hotelCount",
        COALESCE(ps.poi_count, 0)    AS "poiCount",
        COALESCE(ps.matching_poi_count, 0) AS "matchingPoiCount"
      FROM filtered_cities fc
      JOIN countries co ON co.countryid = fc.countryid
      LEFT JOIN hotel_stats hs ON hs.cityid = fc.cityid
      LEFT JOIN poi_stats ps ON ps.cityid = fc.cityid
    `;

    const { rows: cityRows } = await connection.query(query, params);

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

    // OPTIMIZED: Batch fetch sample attractions in a single query instead of N queries
    if (top.length > 0) {
      if (scope === 'city') {
        // Get all city IDs we need attractions for
        const cityIds = top.map(d => d.id);
        const { rows: allPoiRows } = await connection.query(
          `
          SELECT * FROM (
            SELECT
              poiid      AS "poiId",
              name       AS "name",
              primarycategory AS "category",
              cityid     AS "cityId",
              ROW_NUMBER() OVER (PARTITION BY cityid ORDER BY poiid) AS rn
            FROM pois
            WHERE cityid = ANY($1)
          ) sub
          WHERE rn <= 5
          ORDER BY "cityId", rn
          `,
          [cityIds]
        );

        // Group POIs by cityId
        const poiMap = new Map();
        for (const poi of allPoiRows) {
          if (!poiMap.has(poi.cityId)) {
            poiMap.set(poi.cityId, []);
          }
          poiMap.get(poi.cityId).push({
            poiId: poi.poiId,
            name: poi.name,
            category: poi.category,
            cityId: poi.cityId
          });
        }

        // Assign to destinations
        for (const dest of top) {
          dest.sampleAttractions = poiMap.get(dest.id) || [];
        }
      } else {
        // Country scope - batch by country IDs
        const countryIds = top.map(d => d.countryId);
        const { rows: allPoiRows } = await connection.query(
          `
          SELECT * FROM (
            SELECT
              p.poiid      AS "poiId",
              p.name       AS "name",
              p.primarycategory AS "category",
              p.cityid     AS "cityId",
              c.countryid  AS "countryId",
              ROW_NUMBER() OVER (PARTITION BY c.countryid ORDER BY p.poiid) AS rn
            FROM pois p
            JOIN cities c ON c.cityid = p.cityid
            WHERE c.countryid = ANY($1)
          ) sub
          WHERE rn <= 5
          ORDER BY "countryId", rn
          `,
          [countryIds]
        );

        // Group POIs by countryId
        const poiMap = new Map();
        for (const poi of allPoiRows) {
          if (!poiMap.has(poi.countryId)) {
            poiMap.set(poi.countryId, []);
          }
          poiMap.get(poi.countryId).push({
            poiId: poi.poiId,
            name: poi.name,
            category: poi.category,
            cityId: poi.cityId
          });
        }

        // Assign to destinations
        for (const dest of top) {
          dest.sampleAttractions = poiMap.get(dest.countryId) || [];
        }
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

// ----------------------
// Route 7: GET /countries/:countryId
// ----------------------
const get_country_by_id = async function (req, res) {
  try {
    const countryId = parseInt(req.params.countryId, 10);
    if (Number.isNaN(countryId)) {
      return res.status(400).json({ error: 'countryId must be an integer' });
    }

    const { rows } = await connection.query(
      `
      SELECT
        co.countryid            AS "countryId",
        co.name                 AS "name",
        co.alpha_2_country_code AS "alpha2Code",
        co.alpha_3_country_code AS "alpha3Code",
        co.other_name           AS "otherName",
        co.gdp                  AS "gdp",
        co.avg_heat_index       AS "avgHeatIndex",
        AVG(ci.avgtemperaturelatestyear) AS "avgCityTemperature",
        AVG(ci.avgfoodprice)            AS "avgFoodPrice",
        AVG(ci.avggasprice)             AS "avgGasPrice",
        AVG(ci.avgmonthlysalary)        AS "avgMonthlySalary",
        COUNT(ci.cityid)                AS "cityCount"
      FROM countries co
      LEFT JOIN cities ci
        ON ci.countryid = co.countryid
      WHERE co.countryid = $1
      GROUP BY
        co.countryid,
        co.name,
        co.alpha_2_country_code,
        co.alpha_3_country_code,
        co.other_name,
        co.gdp,
        co.avg_heat_index
    `,
      [countryId],
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Country not found' });
    }

    const country = rows[0];

    const { rows: exampleCities } = await connection.query(
      `
      SELECT
        cityid AS "cityId",
        name   AS "cityName"
      FROM cities
      WHERE countryid = $1
      ORDER BY name
      LIMIT 5
    `,
      [countryId],
    );

    res.json({
      countryId: country.countryId,
      name: country.name,
      alpha2Code: country.alpha2Code,
      alpha3Code: country.alpha3Code,
      otherName: country.otherName,
      gdp: country.gdp,
      avgHeatIndex: country.avgHeatIndex,
      avgCityTemperature: country.avgCityTemperature,
      avgFoodPrice: country.avgFoodPrice,
      avgGasPrice: country.avgGasPrice,
      avgMonthlySalary: country.avgMonthlySalary,
      cityCount: Number(country.cityCount),
      exampleCities: exampleCities.map((c) => ({
        cityId: c.cityId,
        cityName: c.cityName,
      })),
    });
  } catch (err) {
    console.error('Route 7 error:', err);
    return res.status(500).json({
      error: 'Database query failed'
    });
  }
};

// ----------------------
// Route 8: GET /cities
// ----------------------
const get_cities = async function (req, res) {
  // Define page and pageSize outside try block for catch block access
  let page = 1;
  let pageSize = 20;

  try {
    const search = req.query.search || null;
    const countryId = req.query.countryId
      ? parseInt(req.query.countryId, 10)
      : null;
    const minTemp = req.query.minTemp != null ? parseFloat(req.query.minTemp) : null;
    const maxTemp = req.query.maxTemp != null ? parseFloat(req.query.maxTemp) : null;
    const maxFood = req.query.maxFood != null ? parseFloat(req.query.maxFood) : null;
    page = Math.max(parseInt(req.query.page || '1', 10), 1);
    pageSize = Math.max(parseInt(req.query.pageSize || '20', 10), 1);
    const limit = pageSize;
    const offset = (page - 1) * pageSize;

    const params = [];
    const where = [];
    let idx = 1;

    if (search) {
      where.push(`c.name ILIKE $${idx}`);
      params.push(`%${search}%`);
      idx++;
    }

    if (countryId != null && !Number.isNaN(countryId)) {
      where.push(`c.countryid = $${idx}`);
      params.push(countryId);
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

    if (maxFood != null) {
      where.push(`c.avgfoodprice <= $${idx}`);
      params.push(maxFood);
      idx++;
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalResult = await connection.query(
      `
      SELECT COUNT(*) AS total
      FROM cities c
      ${whereClause}
    `,
      params,
    );
    const total = parseInt(totalResult.rows[0].total, 10);

    // Add limit and offset as parameters
    const limitIdx = idx;
    const offsetIdx = idx + 1;
    params.push(limit);
    params.push(offset);

    const cityResult = await connection.query(
      `
      SELECT
        c.cityid                   AS "cityId",
        c.name                     AS "name",
        c.countryid                AS "countryId",
        co.name                    AS "countryName",
        c.latitude                 AS "latitude",
        c.longitude                AS "longitude",
        c.avgtemperaturelatestyear AS "avgTemperature",
        c.avgfoodprice             AS "avgFoodPrice",
        c.avggasprice              AS "avgGasPrice",
        c.avgmonthlysalary         AS "avgMonthlySalary"
      FROM cities c
      JOIN countries co ON co.countryid = c.countryid
      ${whereClause}
      ORDER BY c.name
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `,
      params,
    );

    res.json({
      cities: cityResult.rows.map((r) => ({
        cityId: r.cityId,
        name: r.name,
        countryId: r.countryId,
        countryName: r.countryName,
        latitude: r.latitude,
        longitude: r.longitude,
        avgTemperature: r.avgTemperature,
        avgFoodPrice: r.avgFoodPrice,
        avgGasPrice: r.avgGasPrice,
        avgMonthlySalary: r.avgMonthlySalary,
      })),
      page,
      pageSize,
      total,
    });
  } catch (err) {
    console.error('Route 8 error:', err);
    return res.status(500).json({
      error: 'Database query failed',
      cities: [],
      page,
      pageSize,
      total: 0
    });
  }
};

// ----------------------
// Route 9: GET /cities/:cityId
// ----------------------
const get_city_by_id = async function (req, res) {
  const { cityId } = req.params || {};
  const cityIdNum = parseInt(cityId, 10);

  if (!Number.isInteger(cityIdNum) || cityIdNum <= 0) {
    return res.status(400).json({
      error: "cityId must be a positive integer.",
    });
  }

  const sql = `
    SELECT
      c.cityid                         AS "cityId",
      c.countryid                      AS "countryId",
      c.name                           AS "name",
      c.latitude::float8               AS "latitude",
      c.longitude::float8              AS "longitude",
      c.avgtemperaturelatestyear::float8 AS "avgTemperature",
      c.latesttempyear                 AS "latestTempYear",
      c.avgfoodprice::float8           AS "avgFoodPrice",
      c.avggasprice::float8            AS "avgGasPrice",
      c.avgmonthlysalary::float8       AS "avgMonthlySalary",
      COUNT(DISTINCT p.poiid)::int     AS "poiCount",
      COUNT(DISTINCT h.hotelid)::int   AS "hotelCount",
      AVG(h.rating)::float8            AS "avgHotelRating"
    FROM cities c
    LEFT JOIN pois p
      ON p.cityid = c.cityid
    LEFT JOIN hotel h
      ON h.cityid = c.cityid
    WHERE c.cityid = $1
    GROUP BY
      c.cityid,
      c.countryid,
      c.name,
      c.latitude,
      c.longitude,
      c.avgtemperaturelatestyear,
      c.latesttempyear,
      c.avgfoodprice,
      c.avggasprice,
      c.avgmonthlysalary;
  `;

  try {
    const { rows } = await connection.query(sql, [cityIdNum]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "City not found." });
    }

    // Single city object
    return res.json(rows[0]);
  } catch (err) {
    console.error("Route 9 error:", err);
    return res.status(500).json({
      error: "Database query failed",
    });
  }
};

// ----------------------
// Route 10: GET /cities/:cityId/pois
// ----------------------
const get_city_pois = async function (req, res) {
  const { cityId } = req.params || {};
  const { category = null, limit = '50' } = req.query || {};

  const cityIdNum = parseInt(cityId, 10);
  const limitNum = parseInt(limit, 10);

  if (!Number.isInteger(cityIdNum) || cityIdNum <= 0) {
    return res.status(400).json({
      error: "cityId must be a positive integer.",
    });
  }

  const limitEffective =
    Number.isInteger(limitNum) && limitNum > 0 ? limitNum : 50;

  const categoryFilter =
    typeof category === 'string' && category.trim().length > 0
      ? category.trim()
      : null;

  const sql = `
    SELECT
      p.poiid            AS "poiId",
      p.name             AS "name",
      p.latitude::float8 AS "latitude",
      p.longitude::float8 AS "longitude",
      p.address          AS "address",
      p.primarycategory  AS "primaryCategory"
    FROM pois p
    WHERE
      p.cityid = $1
      AND ($2::text IS NULL OR p.primarycategory = $2::text)
    ORDER BY p.name ASC
    LIMIT $3::int;
  `;

  const params = [cityIdNum, categoryFilter, limitEffective];

  try {
    const { rows } = await connection.query(sql, params);
    return res.json({ pois: rows });
  } catch (err) {
    console.error("Route 10 error:", err);
    return res.status(500).json({
      error: "Database query failed",
      pois: [],
    });
  }
};

// ----------------------
// Route 11: GET /cities/:cityId/hotels
// ----------------------
const get_city_hotels = async function (req, res) {
  const { cityId } = req.params || {};
  const { minRating = null, limit = '50' } = req.query || {};

  const cityIdNum = parseInt(cityId, 10);
  const limitNum = parseInt(limit, 10);
  const minRatingNum =
    minRating !== null && minRating !== undefined
      ? Number(minRating)
      : null;

  if (!Number.isInteger(cityIdNum) || cityIdNum <= 0) {
    return res.status(400).json({
      error: "cityId must be a positive integer.",
    });
  }

  const limitEffective =
    Number.isInteger(limitNum) && limitNum > 0 ? limitNum : 50;

  const sql = `
    SELECT
      h.hotelid    AS "hotelId",
      h.name       AS "name",
      h.rating::float8 AS "rating",
      h.address    AS "address",
      h.description AS "description"
    FROM hotel h
    WHERE
      h.cityid = $1
      AND ($2::numeric IS NULL OR h.rating >= $2::numeric)
    ORDER BY
      h.rating DESC NULLS LAST,
      h.name ASC
    LIMIT $3::int;
  `;

  const params = [cityIdNum, minRatingNum, limitEffective];

  try {
    const { rows } = await connection.query(sql, params);
    return res.json({ hotels: rows });
  } catch (err) {
    console.error("Route 11 error:", err);
    return res.status(500).json({
      error: "Database query failed",
      hotels: [],
    });
  }
};

// ----------------------
// Route 12: GET /recommendations/cities/top-attractions
// ----------------------
const get_recommendations_cities_top_attractions = async function (req, res) {
  const { limit = '10' } = req.query || {};
  const limitNum = parseInt(limit, 10);
  const limitEffective =
    Number.isInteger(limitNum) && limitNum > 0 ? limitNum : 10;

  const sql = `
    SELECT
      c.cityid                AS "cityId",
      c.name                  AS "name",
      co.countryid            AS "countryId",
      co.name                 AS "countryName",
      COUNT(p.poiid)::int     AS "poiCount"
    FROM cities c
    JOIN countries co
      ON co.countryid = c.countryid
    LEFT JOIN pois p
      ON p.cityid = c.cityid
    GROUP BY
      c.cityid,
      c.name,
      co.countryid,
      co.name
    ORDER BY
      "poiCount" DESC,
      "name" ASC
    LIMIT $1::int;
  `;

  try {
    const { rows } = await connection.query(sql, [limitEffective]);
    return res.json({
      cities: rows,
      limit: limitEffective,
    });
  } catch (err) {
    console.error("Route 12 error:", err);
    return res.status(500).json({
      error: "Database query failed",
      cities: [],
      limit: limitEffective,
    });
  }
};

// ----------------------
// Route 13: GET /recommendations/cities/warm-budget
// ----------------------
const get_recommendations_cities_warm_budget = async function (req, res) {
  const { limit = '10', minTemp = '18.0' } = req.query || {};

  const limitNum = parseInt(limit, 10);
  const minTempNum = Number(minTemp);

  const limitEffective =
    Number.isInteger(limitNum) && limitNum > 0 ? limitNum : 10;

  const minTempEffective =
    Number.isFinite(minTempNum) ? minTempNum : 18.0;

  // can tune the POI threshold
  const poiThreshold = 3;

  const sql = `
    SELECT
      c.cityid                         AS "cityId",
      c.name                           AS "name",
      co.countryid                     AS "countryId",
      co.name                          AS "countryName",
      c.avgtemperaturelatestyear::float8 AS "avgTemperature",
      c.avgfoodprice::float8           AS "avgFoodPrice",
      COUNT(p.poiid)::int              AS "poiCount"
    FROM cities c
    JOIN countries co
      ON co.countryid = c.countryid
    LEFT JOIN pois p
      ON p.cityid = c.cityid
    WHERE
      c.avgtemperaturelatestyear IS NOT NULL
      AND c.avgtemperaturelatestyear >= $2::numeric
      AND c.avgfoodprice IS NOT NULL
    GROUP BY
      c.cityid,
      c.name,
      co.countryid,
      co.name,
      c.avgtemperaturelatestyear,
      c.avgfoodprice
    HAVING COUNT(p.poiid) >= $3::int
    ORDER BY
      c.avgfoodprice ASC,
      "poiCount" DESC,
      c.name ASC
    LIMIT $1::int;
  `;

  const params = [limitEffective, minTempEffective, poiThreshold];

  try {
    const { rows } = await connection.query(sql, params);
    return res.json({
      cities: rows,
      limit: limitEffective,
      minTemp: minTempEffective,
    });
  } catch (err) {
    console.error("Route 13 error:", err);
    return res.status(500).json({
      error: "Database query failed",
      cities: [],
      limit: limitEffective,
      minTemp: minTempEffective,
    });
  }
};


module.exports = {
    destinations_availability_cities,
    destinations_availability_countries,
    post_planning_itineraries,
    destinations_features,
    destinations_random,
    get_countries,
    get_country_by_id,
    get_cities,
    get_city_by_id,
    get_city_pois,
    get_city_hotels,
    get_recommendations_cities_top_attractions,
    get_recommendations_cities_warm_budget,
};


