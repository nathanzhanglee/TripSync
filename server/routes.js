const { Pool, types } = require('pg');
const config = require('./config.json');

// Parse BIGINT (if you have big ints in your data)
types.setTypeParser(20, val => parseInt(val, 10)); // DO NOT DELETE IF YOU NEED IT

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

connection.connect((err) => err && console.log(err));

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
    const maxStopsEffective = Number.isInteger(maxStop) ? maxStop : 1;
    const limitEffective = Number(limit) > 0 ? Number(limit) : 20;
  
    const sql = `
      WITH origins AS (
        SELECT unnest($1::int[]) AS origin_city_id
      ),
      reachable AS (
        SELECT
          o.origin_city_id,
          r.destinationid AS dest_city_id
        FROM origins o
        JOIN routes r ON r.sourceid = o.origin_city_id
        WHERE r.stops <= $2
      ),
      dest_agg AS (
        SELECT
          dest_city_id,
          array_agg(DISTINCT origin_city_id) AS reachable_from,
          COUNT(DISTINCT origin_city_id) AS origin_reach_count
        FROM reachable
        GROUP BY dest_city_id
      )
      SELECT
        c.cityid        AS "cityId",
        c.name          AS "cityName",
        co.countryid    AS "countryId",
        co.name         AS "countryName",
        (dest_agg.origin_reach_count = $3) AS "reachableFromAll",
        dest_agg.reachable_from            AS "reachableFrom"
      FROM dest_agg
      JOIN cities c ON c.cityid = dest_agg.dest_city_id
      JOIN countries co ON co.countryid = c.countryid
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
  
    connection.query(sql, params, (err, dbRes) => {
      if (err) {
        console.error("Route 1 error:", err);
        return res.status(500).json({ 
          error: "Database query failed",
          destinations: [] 
        });
      }
      res.json({ destinations: dbRes.rows });
    });
  };
  

module.exports = {
    destinations_availability_cities,
};