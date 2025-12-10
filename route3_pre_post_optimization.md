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
WITH hotel_stats AS (
  SELECT
    cityid,
    AVG(rating) AS avg_rating,
    COUNT(hotelid) AS hotel_count
  FROM hotel
  GROUP BY cityid
),
poi_stats AS (
  SELECT
    cityid,
    COUNT(poiid) AS poi_count,
    COUNT(CASE WHEN primarycategory = ANY(ARRAY['Sights & Landmarks', 'Museums']) THEN 1 END) AS matching_poi_count
  FROM pois
  GROUP BY cityid
)
SELECT
  c.cityid                    AS "cityId",
  c.name                      AS "cityName",
  co.countryid                AS "countryId",
  co.name                     AS "countryName",
  c.avgtemperaturelatestyear  AS "avgTemperature",
  c.avgfoodprice              AS "avgFoodPrice",
  COALESCE(hs.avg_rating, 0)  AS "avgHotelRating",
  COALESCE(hs.hotel_count, 0) AS "hotelCount",
  COALESCE(ps.poi_count, 0)   AS "poiCount",
  COALESCE(ps.matching_poi_count, 0) AS "matchingPoiCount"
FROM cities c
JOIN countries co ON co.countryid = c.countryid
LEFT JOIN hotel_stats hs ON hs.cityid = c.cityid
LEFT JOIN poi_stats ps ON ps.cityid = c.cityid;
```

### Post-Optimization EXPLAIN ANALYZE Output
```
Hash Left Join  (cost=234143.20..234798.48 rows=24456 width=100) (actual time=11966.020..12059.445 rows=24456 loops=1)
  Hash Cond: (c.cityid = hs.cityid)
  ->  Hash Left Join  (cost=50129.32..50720.40 rows=24456 width=60) (actual time=1855.863..1886.001 rows=24456 loops=1)
        Hash Cond: (c.cityid = ps.cityid)
        ->  Hash Join  (cost=7.51..534.38 rows=24456 width=44) (actual time=4.724..29.125 rows=24456 loops=1)
              Hash Cond: (c.countryid = co.countryid)
              ->  Seq Scan on cities c  (cost=0.00..461.56 rows=24456 width=32) (actual time=0.558..8.503 rows=24456 loops=1)
              ->  Hash  (cost=4.45..4.45 rows=245 width=16) (actual time=0.714..0.715 rows=245 loops=1)
                    Buckets: 1024  Batches: 1  Memory Usage: 20kB
                    ->  Seq Scan on countries co  (cost=0.00..4.45 rows=245 width=16) (actual time=0.022..0.053 rows=245 loops=1)
        ->  Hash  (cost=50118.13..50118.13 rows=294 width=20) (actual time=1850.121..1851.482 rows=1380 loops=1)
              Buckets: 2048 (originally 1024)  Batches: 1 (originally 1)  Memory Usage: 87kB
              ->  Subquery Scan on ps  (cost=50039.24..50118.13 rows=294 width=20) (actual time=1832.691..1842.590 rows=1381 loops=1)
                    ->  Finalize GroupAggregate  (cost=50039.24..50115.19 rows=294 width=20) (actual time=1832.684..1842.164 rows=1381 loops=1)
                          Group Key: pois.cityid
                          ->  Gather Merge  (cost=50039.24..50107.84 rows=588 width=20) (actual time=1827.706..1833.680 rows=2703 loops=1)
                                Workers Planned: 2
                                Workers Launched: 2
                                ->  Sort  (cost=49039.22..49039.95 rows=294 width=20) (actual time=1803.343..1804.169 rows=901 loops=3)
                                      Sort Key: pois.cityid
                                      Sort Method: quicksort  Memory: 60kB
                                      Worker 0:  Sort Method: quicksort  Memory: 59kB
                                      Worker 1:  Sort Method: quicksort  Memory: 60kB
                                      ->  Partial HashAggregate  (cost=49024.22..49027.16 rows=294 width=20) (actual time=1799.119..1799.509 rows=901 loops=3)
                                            Group Key: pois.cityid
                                            Batches: 1  Memory Usage: 169kB
                                            Worker 0:  Batches: 1  Memory Usage: 193kB
                                            Worker 1:  Batches: 1  Memory Usage: 193kB
                                            ->  Parallel Seq Scan on pois  (cost=0.00..41026.61 rows=799761 width=23) (actual time=0.381..1123.055 rows=639809 loops=3)
  ->  Hash  (cost=183987.38..183987.38 rows=2120 width=44) (actual time=10099.134..10156.237 rows=4722 loops=1)
        Buckets: 8192 (originally 4096)  Batches: 1 (originally 1)  Memory Usage: 323kB
        ->  Subquery Scan on hs  (cost=183413.18..183987.38 rows=2120 width=44) (actual time=10082.889..10147.062 rows=4723 loops=1)
              ->  Finalize GroupAggregate  (cost=183413.18..183966.18 rows=2120 width=44) (actual time=10082.404..10146.113 rows=4723 loops=1)
                    Group Key: hotels.cityid
                    ->  Gather Merge  (cost=183413.18..183907.88 rows=4240 width=44) (actual time=10080.879..10141.496 rows=6696 loops=1)
                          Workers Planned: 2
                          Workers Launched: 2
                          ->  Sort  (cost=182413.15..182418.45 rows=2120 width=44) (actual time=9708.583..9709.521 rows=2232 loops=3)
                                Sort Key: hotels.cityid
                                Sort Method: quicksort  Memory: 256kB
                                Worker 0:  Sort Method: quicksort  Memory: 254kB
                                Worker 1:  Sort Method: quicksort  Memory: 251kB
                                ->  Partial HashAggregate  (cost=182274.82..182296.02 rows=2120 width=44) (actual time=9699.000..9699.559 rows=2232 loops=3)
                                      Group Key: hotels.cityid
                                      Batches: 1  Memory Usage: 625kB
                                      Worker 0:  Batches: 1  Memory Usage: 625kB
                                      Worker 1:  Batches: 1  Memory Usage: 625kB
                                      ->  Parallel Seq Scan on hotels  (cost=0.00..179118.47 rows=420847 width=10) (actual time=7.924..9597.158 rows=336678 loops=3)
Planning Time: 10.751 ms
Execution Time: 12074.755 ms

```
