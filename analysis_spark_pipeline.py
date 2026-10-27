"""Analyze MovieLens 20M ratings with PySpark and load summaries into Cassandra."""

from __future__ import annotations

import argparse
import csv
import logging
import os
from pathlib import Path
from typing import Iterable, Mapping

from pyspark.sql import DataFrame, SparkSession, functions as F
from pyspark.sql.types import DoubleType, IntegerType, StringType, StructField, StructType


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"
TABLE_DIR = OUTPUT_DIR / "tables"
CHART_DIR = OUTPUT_DIR / "charts"
KEYSPACE = "movie_analysis"

MOVIE_SCHEMA = StructType(
    [
        StructField("movieId", IntegerType(), nullable=False),
        StructField("title", StringType(), nullable=True),
        StructField("genres", StringType(), nullable=True),
    ]
)
RATING_SCHEMA = StructType(
    [
        StructField("userId", IntegerType(), nullable=False),
        StructField("movieId", IntegerType(), nullable=False),
        StructField("rating", DoubleType(), nullable=False),
        # MovieLens releases have used both Unix seconds and timestamp strings.
        StructField("timestamp", StringType(), nullable=True),
    ]
)


def read_inputs(spark: SparkSession) -> tuple[DataFrame, DataFrame]:
    movies_path = DATA_DIR / "movie.csv"
    ratings_path = DATA_DIR / "rating.csv"
    for path in (movies_path, ratings_path):
        if not path.is_file():
            raise FileNotFoundError(f"Required MovieLens file not found: {path}")

    movies = spark.read.option("header", True).schema(MOVIE_SCHEMA).csv(str(movies_path))
    ratings = spark.read.option("header", True).schema(RATING_SCHEMA).csv(str(ratings_path))
    return movies, ratings


def build_summaries(movies: DataFrame, ratings: DataFrame) -> dict[str, DataFrame]:
    movie_stats = (
        movies.join(ratings.groupBy("movieId").agg(F.avg("rating").alias("average_rating"), F.count("rating").alias("rating_count")), "movieId", "left")
        .select(
            F.col("movieId").alias("movie_id"),
            "title",
            "genres",
            F.round("average_rating", 4).alias("average_rating"),
            F.coalesce("rating_count", F.lit(0)).cast("long").alias("rating_count"),
        )
    )

    movie_genres = movies.select("movieId", F.explode(F.split(F.col("genres"), "\\|")).alias("genre"))
    genre_stats = (
        movie_genres.join(ratings, "movieId")
        .where(F.col("genre") != "(no genres listed)")
        .groupBy("genre")
        .agg(F.round(F.avg("rating"), 4).alias("average_rating"), F.count("rating").alias("rating_count"))
    )

    rating_distribution = ratings.groupBy("rating").agg(F.count("rating").alias("rating_count"))

    release_year = F.regexp_extract("title", r"\((\d{4})\)\s*$", 1)
    movie_years = movies.withColumn(
        "year", F.when(release_year != "", release_year.cast(IntegerType()))
    ).where(F.col("year").isNotNull() & (F.col("year") > 0))
    yearly_stats = (
        movie_years.join(ratings, "movieId")
        .groupBy("year")
        .agg(F.round(F.avg("rating"), 4).alias("average_rating"), F.count("rating").alias("rating_count"))
    )

    return {
        "movie_stats": movie_stats,
        "genre_stats": genre_stats,
        "rating_distribution": rating_distribution,
        "yearly_stats": yearly_stats,
    }


def write_csv(data: Iterable[Mapping[str, object]], path: Path, columns: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(data)


def collect_summaries(summaries: dict[str, DataFrame]) -> dict[str, list[dict[str, object]]]:
    rows: dict[str, list[dict[str, object]]] = {}
    for name, frame in summaries.items():
        rows[name] = [row.asDict(recursive=True) for row in frame.collect()]
        logging.info("Computed %s: %s rows", name, len(rows[name]))
    return rows


def save_tables(rows: dict[str, list[dict[str, object]]]) -> None:
    for name, records in rows.items():
        columns = list(records[0].keys()) if records else []
        write_csv(records, TABLE_DIR / f"{name}.csv", columns)


def save_charts(rows: dict[str, list[dict[str, object]]]) -> None:
    CHART_DIR.mkdir(parents=True, exist_ok=True)
    matplotlib_config = OUTPUT_DIR / ".matplotlib"
    matplotlib_config.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("MPLCONFIGDIR", str(matplotlib_config))

    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    distribution = sorted(rows["rating_distribution"], key=lambda row: float(row["rating"]))
    plt.figure(figsize=(8, 5))
    plt.bar([str(row["rating"]) for row in distribution], [int(row["rating_count"]) for row in distribution])
    plt.title("MovieLens Rating Distribution")
    plt.xlabel("Rating")
    plt.ylabel("Number of ratings")
    plt.tight_layout()
    plt.savefig(CHART_DIR / "rating_distribution.png", dpi=160)
    plt.close()

    genres = sorted(rows["genre_stats"], key=lambda row: int(row["rating_count"]), reverse=True)[:12]
    genres.reverse()
    plt.figure(figsize=(9, 6))
    plt.barh([str(row["genre"]) for row in genres], [int(row["rating_count"]) for row in genres])
    plt.title("Most Rated Genres")
    plt.xlabel("Number of ratings")
    plt.tight_layout()
    plt.savefig(CHART_DIR / "genre_rating_counts.png", dpi=160)
    plt.close()

    yearly = sorted(rows["yearly_stats"], key=lambda row: int(row["year"]))
    plt.figure(figsize=(10, 5))
    plt.plot([int(row["year"]) for row in yearly], [float(row["average_rating"]) for row in yearly], marker="o", markersize=2)
    plt.title("Average Rating by Movie Release Year")
    plt.xlabel("Release year")
    plt.ylabel("Average rating")
    plt.tight_layout()
    plt.savefig(CHART_DIR / "average_rating_by_year.png", dpi=160)
    plt.close()


def load_cassandra(rows: dict[str, list[dict[str, object]]], host: str, port: int) -> None:
    try:
        from cassandra.cluster import Cluster
        from cassandra.concurrent import execute_concurrent_with_args
    except ImportError as exc:
        raise RuntimeError("cassandra-driver is missing. Install requirements.txt in the Python 3.11 environment.") from exc

    statements = {
        "movie_stats": "INSERT INTO movie_stats (movie_id, title, genres, average_rating, rating_count) VALUES (?, ?, ?, ?, ?)",
        "genre_stats": "INSERT INTO genre_stats (genre, average_rating, rating_count) VALUES (?, ?, ?)",
        "rating_distribution": "INSERT INTO rating_distribution (rating, rating_count) VALUES (?, ?)",
        "yearly_stats": "INSERT INTO yearly_stats (year, average_rating, rating_count) VALUES (?, ?, ?)",
    }
    cluster = Cluster([host], port=port, protocol_version=5)
    try:
        session = cluster.connect()
        for table, cql in statements.items():
            prepared = session.prepare(cql.replace(f"INTO {table} ", f"INTO {KEYSPACE}.{table} "))
            if table == "movie_stats":
                args = ((r["movie_id"], r["title"], r["genres"], r["average_rating"], r["rating_count"]) for r in rows[table])
            elif table == "genre_stats":
                args = ((r["genre"], r["average_rating"], r["rating_count"]) for r in rows[table])
            elif table == "rating_distribution":
                args = ((r["rating"], r["rating_count"]) for r in rows[table])
            else:
                args = ((r["year"], r["average_rating"], r["rating_count"]) for r in rows[table])
            results = execute_concurrent_with_args(session, prepared, args, concurrency=32, raise_on_first_error=True)
            logging.info("Loaded %s rows into %s", len(results), table)
    finally:
        cluster.shutdown()


def iter_rating_records(ratings_path: Path) -> Iterable[tuple[int, int, float, str]]:
    """Read raw ratings one at a time while validating the source CSV shape."""
    expected_columns = ["userId", "movieId", "rating", "timestamp"]
    with ratings_path.open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != expected_columns:
            raise ValueError(
                f"Unexpected ratings CSV columns in {ratings_path}: "
                f"{reader.fieldnames!r}; expected {expected_columns!r}"
            )
        for line_number, record in enumerate(reader, start=2):
            try:
                yield (
                    int(record["userId"]),
                    int(record["movieId"]),
                    float(record["rating"]),
                    record["timestamp"],
                )
            except (TypeError, ValueError) as exc:
                raise ValueError(
                    f"Invalid ratings CSV record at line {line_number}: {record!r}"
                ) from exc


def load_rating_records(ratings_path: Path, host: str, port: int) -> int:
    """Stream every raw ratings CSV row into Cassandra using bounded concurrency."""
    from cassandra.cluster import Cluster
    from cassandra.concurrent import execute_concurrent_with_args

    cluster = Cluster([host], port=port, protocol_version=5)
    try:
        session = cluster.connect()
        statement = session.prepare(
            f"INSERT INTO {KEYSPACE}.rating_records "
            "(user_id, movie_id, rating, rating_timestamp) VALUES (?, ?, ?, ?)"
        )
        submitted = 0
        results = execute_concurrent_with_args(
            session,
            statement,
            iter_rating_records(ratings_path),
            concurrency=64,
            raise_on_first_error=True,
            results_generator=True,
        )
        for _success, _result in results:
            submitted += 1
            if submitted % 100_000 == 0:
                logging.info("Submitted %s raw rating rows to Cassandra", f"{submitted:,}")
        logging.info("Submitted %s raw rating rows to Cassandra", f"{submitted:,}")
        return submitted
    finally:
        cluster.shutdown()


def verify_cassandra(host: str, port: int, expected_counts: dict[str, int]) -> None:
    from cassandra.cluster import Cluster

    tables = (
        "rating_records",
        "movie_stats",
        "genre_stats",
        "rating_distribution",
        "yearly_stats",
    )
    cluster = Cluster([host], port=port, protocol_version=5)
    try:
        session = cluster.connect()
        for table in tables:
            row = session.execute(f"SELECT COUNT(*) FROM {KEYSPACE}.{table}").one()
            stored_count = row.count if row else 0
            expected_count = expected_counts[table]
            logging.info(
                "Cassandra %s row count: %s (source/expected: %s)",
                table,
                f"{stored_count:,}",
                f"{expected_count:,}",
            )
            if stored_count != expected_count:
                raise RuntimeError(
                    f"Cassandra row-count mismatch for {table}: "
                    f"expected {expected_count:,}, found {stored_count:,}"
                )
    finally:
        cluster.shutdown()


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze MovieLens 20M and save summaries, charts, and Cassandra tables.")
    parser.add_argument("--cassandra-host", default="127.0.0.1")
    parser.add_argument("--cassandra-port", type=int, default=9042)
    parser.add_argument("--skip-cassandra", action="store_true", help="Compute CSV summaries and charts without connecting to Cassandra.")
    parser.add_argument("--skip-charts", action="store_true", help="Skip PNG chart generation.")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    spark = (
        SparkSession.builder.appName("MovieRatingAnalysis")
        .master("local[*]")
        .config("spark.sql.shuffle.partitions", "8")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")
    try:
        movies, ratings = read_inputs(spark)
        logging.info("Loaded MovieLens CSV inputs")
        rows = collect_summaries(build_summaries(movies, ratings))
        save_tables(rows)
        logging.info("CSV summaries written to %s", TABLE_DIR)
        if not args.skip_charts:
            save_charts(rows)
            logging.info("Charts written to %s", CHART_DIR)
        if not args.skip_cassandra:
            raw_rating_count = load_rating_records(
                DATA_DIR / "rating.csv", args.cassandra_host, args.cassandra_port
            )
            load_cassandra(rows, args.cassandra_host, args.cassandra_port)
            expected_counts = {name: len(records) for name, records in rows.items()}
            expected_counts["rating_records"] = raw_rating_count
            verify_cassandra(args.cassandra_host, args.cassandra_port, expected_counts)
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
