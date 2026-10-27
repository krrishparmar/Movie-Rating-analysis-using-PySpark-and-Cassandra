from pyspark.sql import SparkSession

spark = (
    SparkSession.builder
    .appName("MovieRatingAnalysisTest")
    .master("local[*]")
    .getOrCreate()
)

data = [
    (1, "Inception"),
    (2, "Interstellar"),
]

df = spark.createDataFrame(data, ["id", "movie"])
df.show()

print("Spark version:", spark.version)

spark.stop()
