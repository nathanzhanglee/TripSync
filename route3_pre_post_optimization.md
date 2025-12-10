# Query 3 Optimization Report
## Route: POST /destinations/features

---

## Optimization Techniques Applied

### 1. Covering Indexes Created
```
CREATE INDEX idx_hotels_cityid_rating ON hotels(cityid) INCLUDE (rating);
CREATE INDEX idx_pois_cityid_category ON pois(cityid) INCLUDE (primarycategory);
```

### 2. Query Reconstruction: LATERAL Joins
- **LATERAL subqueries**: Force per-city index lookups instead of full table scans
- **Index-only scans**: Covering indexes include rating and primarycategory, eliminating heap fetches
- **Per-row execution**: 897 small index scans instead of scanning entire tables

---

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
WHERE c.avgtemperaturelatestyear >= 15
  AND c.avgtemperaturelatestyear <= 30
  AND c.avgfoodprice <= 50
GROUP BY
  c.cityid,
  c.name,
  co.countryid,
  co.name,
  c.avgtemperaturelatestyear,
  c.avgfoodprice
```

### Pre-Optimization EXPLAIN ANALYZE Output
```
GroupAggregate  (cost=46105.24..383894.71 rows=105350 width=100) (actual time=1542.543..35656.353 rows=897 loops=1)
"  Group Key: c.cityid, co.countryid"
  ->  Incremental Sort  (cost=46105.24..358194.77 rows=1393318 width=69) (actual time=1536.669..29138.260 rows=8972843 loops=1)
"        Sort Key: c.cityid, co.countryid, h.hotelid"
"        Presorted Key: c.cityid, co.countryid"
        Full-sort Groups: 416  Sort Method: quicksort  Average Memory: 30kB  Peak Memory: 30kB
"        Pre-sorted Groups: 618  Sort Methods: quicksort, external merge  Average Memory: 31kB  Peak Memory: 2388kB  Average Disk: 231001kB  Peak Disk: 446016kB"
        ->  Nested Loop Left Join  (cost=46102.46..312718.92 rows=1393318 width=69) (actual time=1533.364..9643.192 rows=8972843 loops=1)
              ->  Gather Merge  (cost=46102.02..50033.00 rows=33752 width=63) (actual time=1481.969..2663.414 rows=736412 loops=1)
                    Workers Planned: 2
                    Workers Launched: 2
                    ->  Sort  (cost=45102.00..45137.16 rows=14063 width=63) (actual time=1456.493..1759.117 rows=245471 loops=3)
"                          Sort Key: c.cityid, co.countryid"
                          Sort Method: external merge  Disk: 21352kB
                          Worker 0:  Sort Method: external merge  Disk: 21784kB
                          Worker 1:  Sort Method: external merge  Disk: 22368kB
                          ->  Hash Join  (cost=968.34..44133.09 rows=14063 width=63) (actual time=3.612..1243.541 rows=245471 loops=3)
                                Hash Cond: (c.countryid = co.countryid)
                                ->  Parallel Hash Right Join  (cost=960.83..44088.02 rows=14063 width=51) (actual time=3.474..1190.277 rows=245471 loops=3)
                                      Hash Cond: (p.cityid = c.cityid)
                                      ->  Parallel Seq Scan on pois p  (cost=0.00..41027.38 rows=799838 width=23) (actual time=1.602..973.857 rows=639809 loops=3)
                                      ->  Parallel Hash  (cost=957.67..957.67 rows=253 width=32) (actual time=1.785..2.981 rows=299 loops=3)
                                            Buckets: 1024  Batches: 1  Memory Usage: 72kB
                                            ->  Parallel Index Scan using cities_pkey on cities c  (cost=0.29..957.67 rows=253 width=32) (actual time=0.017..5.526 rows=897 loops=1)
                                                  Filter: ((avgtemperaturelatestyear >= '15'::numeric) AND (avgtemperaturelatestyear <= '30'::numeric) AND (avgfoodprice <= '50'::numeric))
                                                  Rows Removed by Filter: 23559
                                ->  Hash  (cost=4.45..4.45 rows=245 width=16) (actual time=0.099..0.398 rows=245 loops=3)
                                      Buckets: 1024  Batches: 1  Memory Usage: 20kB
                                      ->  Seq Scan on countries co  (cost=0.00..4.45 rows=245 width=16) (actual time=0.023..0.352 rows=245 loops=3)
              ->  Memoize  (cost=0.43..464.63 rows=147 width=10) (actual time=0.002..0.007 rows=11 loops=736412)
                    Cache Key: c.cityid
                    Cache Mode: logical
                    Hits: 735515  Misses: 897  Evictions: 0  Overflows: 0  Memory Usage: 2928kB
                    ->  Index Scan using idx_hotels_cityid on hotels h  (cost=0.42..464.62 rows=147 width=10) (actual time=0.805..4.981 rows=76 loops=897)
                          Index Cond: (cityid = c.cityid)
Planning Time: 4.712 ms
Execution Time: 35721.238 ms
```

---

## Post-Optimization Query (LATERAL Joins + Covering Indexes)

```sql
EXPLAIN ANALYZE
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
LEFT JOIN LATERAL (
  SELECT AVG(h.rating) AS avg_rating, COUNT(*) AS hotel_count
  FROM hotels h
  WHERE h.cityid = c.cityid
) hs ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS poi_count,
    COUNT(CASE WHEN p.primarycategory = ANY(ARRAY['Sights & Landmarks', 'Museums']) THEN 1 END) AS matching_poi_count
  FROM pois p
  WHERE p.cityid = c.cityid
) ps ON true
WHERE c.avgtemperaturelatestyear >= 15
  AND c.avgtemperaturelatestyear <= 30
  AND c.avgfoodprice <= 50;
```

### Post-Optimization EXPLAIN ANALYZE Output
```
Nested Loop Left Join  (cost=198.53..82807.29 rows=430 width=100) (actual time=0.132..1830.030 rows=897 loops=1)
  ->  Nested Loop Left Join  (cost=15.22..3978.62 rows=430 width=84) (actual time=0.122..254.001 rows=897 loops=1)
        ->  Hash Join  (cost=7.51..653.64 rows=430 width=44) (actual time=0.103..116.432 rows=897 loops=1)
              Hash Cond: (c.countryid = co.countryid)
              ->  Seq Scan on cities c  (cost=0.00..644.98 rows=430 width=32) (actual time=0.021..115.786 rows=897 loops=1)
                    Filter: ((avgtemperaturelatestyear >= '15'::numeric) AND (avgtemperaturelatestyear <= '30'::numeric) AND (avgfoodprice <= '50'::numeric))
                    Rows Removed by Filter: 23559
              ->  Hash  (cost=4.45..4.45 rows=245 width=16) (actual time=0.075..0.076 rows=245 loops=1)
                    Buckets: 1024  Batches: 1  Memory Usage: 20kB
                    ->  Seq Scan on countries co  (cost=0.00..4.45 rows=245 width=16) (actual time=0.006..0.032 rows=245 loops=1)
        ->  Aggregate  (cost=7.71..7.72 rows=1 width=40) (actual time=0.153..0.153 rows=1 loops=897)
              ->  Index Only Scan using idx_hotels_cityid_rating on hotels h  (cost=0.42..6.98 rows=146 width=2) (actual time=0.056..0.146 rows=76 loops=897)
                    Index Cond: (cityid = c.cityid)
                    Heap Fetches: 0
  ->  Aggregate  (cost=183.30..183.31 rows=1 width=16) (actual time=1.756..1.756 rows=1 loops=897)
        ->  Index Only Scan using idx_pois_cityid_category on pois p  (cost=0.43..152.44 rows=4115 width=15) (actual time=0.076..1.656 rows=820 loops=897)
              Index Cond: (cityid = c.cityid)
              Heap Fetches: 0
Planning Time: 11.421 ms
Execution Time: 1831.382 ms
```


## Performance Summary

| Metric | Pre-Optimization | Post-Optimization |
|--------|------------------|-------------------|
| Execution Time | 35,721 ms | 1,831 ms |
| Hotels scanned | 8,972,843 intermediate rows | 68,057 (76 rows × 897 cities) |
| POIs scanned | 1,919,427 (full seq scan) | 735,831 (820 rows × 897 cities) |
| Index usage | Partial (Memoize on hotels) | Index-only scans (no heap fetches) |
| Memory/Disk | 446MB disk spill | Minimal in-memory |
| Improvement | - | 19.5x faster|

---

## Query Reconstruction Explanation

The original query suffered from a row explosion problem:
```
cities (897 rows) × hotels (~76 per city) × pois (~820 per city) = 8,972,843 intermediate rows
```

This caused:
- External merge sorts spilling 446MB to disk
- Expensive `COUNT(DISTINCT)` operations to de-duplicate
- Full sequential scan on the pois table (1.9M rows)

### How LATERAL Joins + Covering Indexes Fix This

#### 1. LATERAL Subqueries
```sql
LEFT JOIN LATERAL (
  SELECT AVG(h.rating) AS avg_rating, COUNT(*) AS hotel_count
  FROM hotels h
  WHERE h.cityid = c.cityid
) hs ON true
```
- Executes subquery **for each city row** (897 times)
- Each execution uses an index lookup, not a full table scan
- Aggregates per-city data before joining, avoiding row explosion

#### 2. Covering Indexes Enable Index-Only Scans
```sql
CREATE INDEX idx_hotels_cityid_rating ON hotels(cityid) INCLUDE (rating);
CREATE INDEX idx_pois_cityid_category ON pois(cityid) INCLUDE (primarycategory);
```
- Index includes all columns needed for the query (`cityid` + `rating`/`primarycategory`)
- PostgreSQL can satisfy the query entirely from the index
- `Heap Fetches: 0` in EXPLAIN output confirms no table access needed

### Key EXPLAIN Output Indicators

| Indicator | Pre-Optimization | Post-Optimization |
|-----------|------------------|-------------------|
| Scan type | `Parallel Seq Scan on pois` | `Index Only Scan using idx_pois_cityid_category` |
| Heap fetches | N/A (full table scan) | `Heap Fetches: 0` |
| Intermediate rows | 8,972,843 | 897 (one per city) |
| Disk usage | 446MB external merge | None |
