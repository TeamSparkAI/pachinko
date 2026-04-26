# TeamSpark Pachinko To Do

## General

### Policy application

Implement single scan (multi-regex) for perf (currently 750+ msgs/second on laptop with full policy set, perf improvement may not be high priority)

### Retention

Retention (alerts/messages) is implemented in a service and exposed at an API endpoint
- Still need a mechanism to trigger it (could have UX with stats and manual and/or do it automatically via cronjob style solution)

### Policy Import / Export

Support policy import and export via JSON

### Messages

Filter messages on error state (add dimension, filtering)

Full text search on message payload via API/UX (brute force to start)

### Testing

More unit tests and integration tests

## Cloud / Hosted (later)

* Choose cloud db (probably Postgres), adapt/implement model
* Domain: pachinko.teamspark.ai
* Google Cloud ALB deploy (provision db, move static files to cdn, etc)

