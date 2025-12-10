# Query 3 Optimization Report
## Route: POST /destinations/features

## Pre-Optimization Query

```sql
EXPLAIN ANALYZE
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
  COUNT(DISTINCT CASE WHEN p.primarycategory = ANY(ARRAY['Sights & Landmarks', 'Museums']) THEN p.poiid END) AS "matchingPoiCount"
FROM cities c
JOIN countries co ON co.countryid = c.countryid
LEFT JOIN hotels h ON h.cityid = c.cityid
LEFT JOIN pois p ON p.cityid = c.cityid
GROUP BY
  c.cityid,
  c.name,
  co.countryid,
  co.name,
  c.avgtemperaturelatestyear,
  c.avgfoodprice;
```

### Pre-Optimization EXPLAIN ANALYZE Output
```
GroupAggregate  (cost=568348.52..2947123.12 rows=5991720 width=100) (actual time=13994.007..23612.376 rows=24456 loops=1)
"  Group Key: c.cityid, co.countryid"
  ->  Merge Left Join  (cost=568348.52..1484960.48 rows=79272351 width=69) (actual time=13980.663..18018.817 rows=10631602 loops=1)
        Merge Cond: (c.cityid = p.cityid)
        ->  Gather Merge  (cost=237082.51..354717.50 rows=1010033 width=50) (actual time=10283.589..10709.602 rows=324593 loops=1)
              Workers Planned: 2
              Workers Launched: 2
              ->  Sort  (cost=236082.48..237134.60 rows=420847 width=50) (actual time=10175.954..10290.180 rows=108198 loops=3)
"                    Sort Key: c.cityid, co.countryid, h.hotelid"
                    Sort Method: external merge  Disk: 5376kB
                    Worker 0:  Sort Method: external merge  Disk: 6520kB
                    Worker 1:  Sort Method: external merge  Disk: 5080kB
                    ->  Hash Join  (cost=1037.11..182384.20 rows=420847 width=50) (actual time=23.793..9824.751 rows=108198 loops=3)
                          Hash Cond: (c.countryid = co.countryid)
                          ->  Parallel Hash Right Join  (cost=1029.60..181252.85 rows=420847 width=38) (actual time=23.584..9794.945 rows=108198 loops=3)
                                Hash Cond: (h.cityid = c.cityid)
                                ->  Parallel Seq Scan on hotels h  (cost=0.00..179118.47 rows=420847 width=10) (actual time=10.864..9715.779 rows=336678 loops=3)
                                ->  Parallel Hash  (cost=849.77..849.77 rows=14386 width=32) (actual time=6.510..6.845 rows=8152 loops=3)
                                      Buckets: 32768  Batches: 1  Memory Usage: 1632kB
                                      ->  Parallel Index Scan using cities_pkey on cities c  (cost=0.29..849.77 rows=14386 width=32) (actual time=0.023..11.544 rows=24456 loops=1)
                          ->  Hash  (cost=4.45..4.45 rows=245 width=16) (actual time=0.129..0.489 rows=245 loops=3)
                                Buckets: 1024  Batches: 1  Memory Usage: 20kB
                                ->  Seq Scan on countries co  (cost=0.00..4.45 rows=245 width=16) (actual time=0.039..0.429 rows=245 loops=3)
        ->  Materialize  (cost=331266.02..340863.15 rows=1919427 width=23) (actual time=3692.537..5402.239 rows=10386253 loops=1)
              ->  Sort  (cost=331266.02..336064.58 rows=1919427 width=23) (actual time=3692.040..4236.964 rows=1291623 loops=1)
                    Sort Key: p.cityid
                    Sort Method: external merge  Disk: 55192kB
                    ->  Seq Scan on pois p  (cost=0.00..52223.27 rows=1919427 width=23) (actual time=3.196..2374.201 rows=1919427 loops=1)
Planning Time: 10.328 ms
Execution Time: 23654.523 ms
```

---

## Post-Optimization Query

```sql
EXPLAIN ANALYZE
  WITH filtered_cities AS (
    SELECT c.cityid, c.name, c.countryid, c.avgtemperaturelatestyear, c.avgfoodprice
    FROM cities c
    WHERE c.avgtemperaturelatestyear >= 15
      AND c.avgtemperaturelatestyear <= 30
      AND c.avgfoodprice <= 50
    LIMIT 20
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
  LEFT JOIN LATERAL (
    SELECT AVG(h.rating) AS avg_rating, COUNT(*) AS hotel_count
    FROM hotels h
    WHERE h.cityid = fc.cityid
  ) hs ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS poi_count,
      COUNT(CASE WHEN p.primarycategory = ANY(ARRAY['Sights & Landmarks', 'Museums']) THEN 1 END) AS matching_poi_count
    FROM pois p
    WHERE p.cityid = fc.cityid
  ) ps ON true;
```

### Post-Optimization EXPLAIN ANALYZE Output
```
Nested Loop Left Join  (cost=12991.60..259720.29 rows=20 width=100) (actual time=3.139..61.993 rows=20 loops=1)
  ->  Nested Loop Left Join  (cost=541.40..10716.00 rows=20 width=84) (actual time=2.349..57.500 rows=20 loops=1)
        ->  Hash Join  (cost=7.51..37.76 rows=20 width=44) (actual time=1.191..1.293 rows=20 loops=1)
              Hash Cond: (c.countryid = co.countryid)
              ->  Limit  (cost=0.00..30.00 rows=20 width=32) (actual time=0.025..0.092 rows=20 loops=1)
                    ->  Seq Scan on cities c  (cost=0.00..644.98 rows=430 width=32) (actual time=0.024..0.085 rows=20 loops=1)
                          Filter: ((avgtemperaturelatestyear >= '15'::numeric) AND (avgtemperaturelatestyear <= '30'::numeric) AND (avgfoodprice <= '50'::numeric))
                          Rows Removed by Filter: 81
              ->  Hash  (cost=4.45..4.45 rows=245 width=16) (actual time=0.080..0.081 rows=245 loops=1)
                    Buckets: 1024  Batches: 1  Memory Usage: 20kB
                    ->  Seq Scan on countries co  (cost=0.00..4.45 rows=245 width=16) (actual time=0.009..0.037 rows=245 loops=1)
        ->  Aggregate  (cost=533.89..533.90 rows=1 width=40) (actual time=2.809..2.809 rows=1 loops=20)
              ->  Index Scan using idx_hotels_cityid on hotels h  (cost=0.42..533.15 rows=147 width=2) (actual time=0.327..2.787 rows=120 loops=20)
                    Index Cond: (cityid = c.cityid)
  ->  Aggregate  (cost=12450.19..12450.20 rows=1 width=16) (actual time=0.222..0.222 rows=1 loops=20)
        ->  Bitmap Heap Scan on pois p  (cost=51.19..12416.55 rows=4486 width=15) (actual time=0.048..0.218 rows=1 loops=20)
              Recheck Cond: (cityid = c.cityid)
              Heap Blocks: exact=26
              ->  Bitmap Index Scan on idx_pois_cityid  (cost=0.00..50.07 rows=4486 width=0) (actual time=0.045..0.045 rows=1 loops=20)
                    Index Cond: (cityid = c.cityid)
Planning Time: 7.867 ms
Execution Time: 62.770 ms
```
