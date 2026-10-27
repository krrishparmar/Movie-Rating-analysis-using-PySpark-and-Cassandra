CREATE KEYSPACE IF NOT EXISTS movie_analysis
WITH replication = {
    'class': 'SimpleStrategy',
    'replication_factor': 1
};

USE movie_analysis;

CREATE TABLE IF NOT EXISTS rating_records (
    user_id INT,
    movie_id INT,
    rating DOUBLE,
    rating_timestamp TEXT,
    PRIMARY KEY ((user_id), movie_id)
);

CREATE TABLE IF NOT EXISTS movie_stats (
    movie_id INT PRIMARY KEY,
    title TEXT,
    genres TEXT,
    average_rating DOUBLE,
    rating_count BIGINT
);

CREATE TABLE IF NOT EXISTS genre_stats (
    genre TEXT PRIMARY KEY,
    average_rating DOUBLE,
    rating_count BIGINT
);

CREATE TABLE IF NOT EXISTS rating_distribution (
    rating DOUBLE PRIMARY KEY,
    rating_count BIGINT
);

CREATE TABLE IF NOT EXISTS yearly_stats (
    year INT PRIMARY KEY,
    average_rating DOUBLE,
    rating_count BIGINT
);
