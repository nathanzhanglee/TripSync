const connection = require('../db');

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
  const poisPerDayEffective = Number.isInteger(Number(poisPerDay)) && Number(poisPerDay) > 0
    ? Number(poisPerDay)
    : 3;
  const avoidCategoriesArray = Array.isArray(avoidCategories) ? avoidCategories : [];

  try {
    let itinerary = [];
    let categoriesUsed = new Set();
    let citiesInItinerary = new Set();

    // Helper: take up to N from an array (mutates the array)
    const take = (arr, n) => {
      if (!Array.isArray(arr) || n <= 0) return [];
      return arr.splice(0, Math.min(n, arr.length));
    };

    // Helper: pick POIs for a day from a mutable pool, with optional category preference, and optional fallback pool
    const pickPoisForDay = ({
      pool,                // mutable array of POIs
      fallbackPool = null, // mutable array (optional)
      preferredCategories = [],
      countNeeded,
    }) => {
      let picked = [];

      const prefer = Array.isArray(preferredCategories) ? preferredCategories : [];

      // 1) take preferred from main pool
      if (prefer.length > 0 && pool.length > 0) {
        const matching = [];
        const nonMatching = [];
        for (const p of pool) {
          if (prefer.includes(p.primarycategory)) matching.push(p);
          else nonMatching.push(p);
        }
        const fromMatching = matching.slice(0, countNeeded);
        picked = picked.concat(fromMatching);

        // rebuild pool without the chosen ones
        const pickedIds = new Set(fromMatching.map(p => p.poiid));
        const rebuilt = [];
        for (const p of matching) if (!pickedIds.has(p.poiid)) rebuilt.push(p);
        for (const p of nonMatching) rebuilt.push(p);

        pool.length = 0;
        pool.push(...rebuilt);
      }

      // 2) fill remaining from main pool
      if (picked.length < countNeeded && pool.length > 0) {
        picked = picked.concat(take(pool, countNeeded - picked.length));
      }

      // 3) fallback: take from fallbackPool (try preferred first too)
      if (picked.length < countNeeded && fallbackPool && fallbackPool.length > 0) {
        if (prefer.length > 0) {
          const matching = [];
          const nonMatching = [];
          for (const p of fallbackPool) {
            if (prefer.includes(p.primarycategory)) matching.push(p);
            else nonMatching.push(p);
          }
          const need = countNeeded - picked.length;
          const fromMatching = matching.slice(0, need);
          picked = picked.concat(fromMatching);

          const pickedIds = new Set(fromMatching.map(p => p.poiid));
          const rebuilt = [];
          for (const p of matching) if (!pickedIds.has(p.poiid)) rebuilt.push(p);
          for (const p of nonMatching) rebuilt.push(p);

          fallbackPool.length = 0;
          fallbackPool.push(...rebuilt);
        }

        if (picked.length < countNeeded && fallbackPool.length > 0) {
          picked = picked.concat(take(fallbackPool, countNeeded - picked.length));
        }
      }

      return picked;
    };

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

      // Get POIs for this city + country-only POIs for that country
      const poisSql = `
        SELECT
          poiid,
          name,
          cityid,
          address,
          primarycategory
        FROM pois
        WHERE
          (
            cityid = $1
            OR (cityid IS NULL AND countryid = $3)
          )
          AND ($2::text[] IS NULL OR NOT (primarycategory = ANY($2::text[])))
        ORDER BY RANDOM();
      `;

      const poisResult = await connection.query(poisSql, [
        cityIdNum,
        avoidCategoriesArray.length > 0 ? avoidCategoriesArray : null,
        cityInfo.countryid, // $3
      ]);

      const poiPool = [...poisResult.rows]; // mutable pool

      for (let day = 1; day <= numDaysEffective; day++) {
        const dayPreferredCategories =
          preferredCategoriesByDay &&
          Array.isArray(preferredCategoriesByDay[day - 1])
            ? preferredCategoriesByDay[day - 1]
            : [];

        const dayPois = pickPoisForDay({
          pool: poiPool,
          fallbackPool: null,
          preferredCategories: dayPreferredCategories,
          countNeeded: poisPerDayEffective,
        });

        const formattedPois = dayPois.map((poi) => {
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

      // Country-only POIs pool (fallback if a city runs out, or if no cities have POIs)
      const countryOnlyPoisSql = `
        SELECT
          poiid,
          name,
          NULL::int AS cityid,
          address,
          primarycategory
        FROM pois
        WHERE
          countryid = $1
          AND cityid IS NULL
          AND ($2::text[] IS NULL OR NOT (primarycategory = ANY($2::text[])))
        ORDER BY RANDOM();
      `;
      const { rows: countryOnlyPoisPool } = await connection.query(countryOnlyPoisSql, [
        countryIdNum,
        avoidCategoriesArray.length > 0 ? avoidCategoriesArray : null
      ]);

      // Get cities in this country with CITY-POI counts (cityid NOT NULL only)
      const citiesSql = `
        SELECT
          c.cityid,
          c.name AS city_name,
          c.countryid,
          co.name AS country_name,
          COUNT(p.poiid) AS poi_count
        FROM cities c
        JOIN countries co ON co.countryid = c.countryid
        LEFT JOIN pois p
          ON p.cityid = c.cityid
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

      // If no cities have city-level POIs but we do have country-only POIs, proceed with a "country-only" itinerary
      if (citiesResult.rows.length === 0) {
        if (!countryOnlyPoisPool.length) {
          return res.status(404).json({
            error: "No POIs found in this country (neither city-level nor country-level)."
          });
        }

        // Build itinerary using country-only POIs, keep city fields null
        for (let day = 1; day <= numDaysEffective; day++) {
          const dayPreferredCategories =
            preferredCategoriesByDay &&
            Array.isArray(preferredCategoriesByDay[day - 1])
              ? preferredCategoriesByDay[day - 1]
              : [];

          const dayPois = pickPoisForDay({
            pool: countryOnlyPoisPool,
            fallbackPool: null,
            preferredCategories: dayPreferredCategories,
            countNeeded: poisPerDayEffective,
          });

          const formattedPois = dayPois.map((poi) => {
            categoriesUsed.add(poi.primarycategory);
            return {
              poiId: poi.poiid,
              name: poi.name,
              cityId: null,
              category: poi.primarycategory,
              address: poi.address
            };
          });

          itinerary.push({
            dayNumber: day,
            cityId: null,
            cityName: null,
            countryId: countryIdNum,
            countryName: null,
            categoryFocus: dayPreferredCategories,
            pois: formattedPois
          });
        }
      } else {
        // Determine how many cities to use
        const maxCitiesEffective = maxCities && Number.isInteger(Number(maxCities)) && Number(maxCities) > 0
          ? Math.min(Number(maxCities), citiesResult.rows.length)
          : Math.min(Math.ceil(numDaysEffective / 2), citiesResult.rows.length);

        const selectedCities = citiesResult.rows.slice(0, maxCitiesEffective);

        // Calculate days per city
        const daysPerCity = Math.floor(numDaysEffective / selectedCities.length);
        const extraDays = numDaysEffective % selectedCities.length;

        let currentDay = 1;

        for (let i = 0; i < selectedCities.length; i++) {
          const city = selectedCities[i];
          const daysInThisCity = daysPerCity + (i < extraDays ? 1 : 0);
          citiesInItinerary.add(city.cityid);

          // Get POIs for this city (city-level only)
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

          const cityPoiPool = [...poisResult.rows]; // mutable pool

          for (let dayInCity = 0; dayInCity < daysInThisCity; dayInCity++) {
            const dayPreferredCategories =
              preferredCategoriesByDay &&
              Array.isArray(preferredCategoriesByDay[currentDay - 1])
                ? preferredCategoriesByDay[currentDay - 1]
                : [];

            // pick from city pool, fallback to country-only pool
            const dayPois = pickPoisForDay({
              pool: cityPoiPool,
              fallbackPool: countryOnlyPoisPool,
              preferredCategories: dayPreferredCategories,
              countNeeded: poisPerDayEffective,
            });

            const formattedPois = dayPois.map((poi) => {
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
            if (currentDay > numDaysEffective) break;
          }

          if (currentDay > numDaysEffective) break;
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

module.exports = {
  post_planning_itineraries,
};