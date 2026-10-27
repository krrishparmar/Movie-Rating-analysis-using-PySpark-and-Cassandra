# Movie Rating Analysis: Presentation and Demo Guide

Use this guide to present the project and give your teacher a short, repeatable live demo. Aim for about **7–10 minutes**, adjusting to the time you are given.

## Before class

1. Open `presentation/Movie-Rating-Analysis-Final.pptx` and check the slides and speaker notes.
2. Make sure Docker Desktop is open and the `movie-cassandra` container is running.
3. Check that the project data files and generated `output/` folder are present.
4. If you plan to rerun the analysis, do it before class so you have time to resolve any startup or processing delays:

   ```bash
   cd ~/movie-rating-analysis
   .venv/bin/python analysis.py
   ```

   The script processes the full MovieLens 20M dataset and writes summary results to Cassandra. It can take a little while, so you do not need to rerun it during the presentation if the saved results are ready.

## Suggested presentation order

### 1. Introduce the project — about 1 minute

Explain the question in your own words: the project uses MovieLens ratings to explore how movies and genres are rated, and how average ratings vary by release year. Mention that Spark processes the ratings file, while Cassandra stores every raw rating alongside the summary tables for queries.

### 2. Present the slides — about 3–5 minutes

Open `presentation/Movie-Rating-Analysis-Final.pptx` and use its speaker notes as a prompt. It covers the goal, dataset, processing workflow, charts, Cassandra summaries, findings, and limitations. Explain what each chart shows instead of reading every number on the slide.

### 3. Show a small sample of the source data — about 1 minute

In Terminal, run:

```bash
cd ~/movie-rating-analysis
head -n 6 data/movie.csv
head -n 6 data/rating.csv
```

Explain that these commands show the headers and first five records only. The movie file contains movie information such as title and genres; the ratings file contains user, movie, rating, and timestamp fields. There is no need to open or print the entire ratings file.

### 4. Walk through the code and schema — about 1–2 minutes

Open `analysis.py` and `cassandra_schema.cql` in your editor. Point out the main stages in `analysis.py`:

- `read_inputs` loads the source files.
- `build_summaries` calculates the project aggregates.
- The output and chart code saves CSV summaries and graphs.
- The Cassandra code streams every raw rating row into `rating_records`, inserts summary rows, and checks source-versus-stored table counts.

Then show the schema file. It defines the `movie_analysis` keyspace and the four tables: `movie_stats`, `genre_stats`, `rating_distribution`, and `yearly_stats`. Explain that the table keys are chosen to support the summaries this project queries.

### 5. Show the saved outputs — about 1 minute

In Terminal, run:

```bash
open output
```

Open the `charts` folder to show the graphs, then the `tables` folder to show the CSV summaries. These files are convenient evidence of the results even if you do not query Cassandra live.

### 6. Show Cassandra live — about 1–2 minutes

First check the Docker container:

```bash
docker ps
```

If `movie-cassandra` is not listed as running, start it:

```bash
docker start movie-cassandra
```

Connect to Cassandra's command-line shell:

```bash
docker exec -it movie-cassandra cqlsh
```

At the `cqlsh>` prompt, enter these statements one at a time:

```sql
 
EXIT;
```

`DESCRIBE TABLES` lists the tables in the keyspace. The `SELECT` queries display a small number of stored summary rows. The limits keep the live output manageable. `EXIT` closes the Cassandra shell.

## If the live demo has a problem

- If Docker says the container is stopped, start it with `docker start movie-cassandra` and try connecting again.
- If Cassandra is still starting, give it a moment and retry the connection.
- If the live database is unavailable, show the saved CSVs in `output/tables/` and the charts in `output/charts/`, then explain that those are the analysis results written by the script.
- Do not rerun the full analysis during class unless you have enough time; use the prepared outputs and Cassandra data for the walkthrough.

## Closing summary

Finish by summarizing the workflow: MovieLens source files → Spark calculations → charts and CSV summaries → Cassandra tables. Mention one result from your charts, and one limitation from the slides, such as the fact that an average rating does not explain why users gave a rating.

## Quick checklist

- [ ] PowerPoint opens and speaker notes are available.
- [ ] Docker Desktop is open; `movie-cassandra` is running.
- [ ] Cassandra contains the `movie_analysis` keyspace, the full `rating_records` table, and four summary tables.
- [ ] `output/charts/` and `output/tables/` contain the generated results.
- [ ] Terminal and code editor are ready, with unrelated windows closed.
