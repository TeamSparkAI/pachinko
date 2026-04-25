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

## Arcade

### Test

* Test rewrite of inputs (pre) and output (post) through webhooks
* Test block (pre and post)

### Launch

* Make repo public
* Set package to public
* Publish, validate, test run from npm install
* Make video walkthrough of install (maybe show populated also)

## Demo

Show running dev server with data (tour of the app)
Stop server
npm run clean
cd to a different dir (../demo)
npm install -g teamspark-pachinko
pachinko --port 3000
Create account a log in
ngrok http 3000
Paste host into settings
Create and copy arcade key
Got to Arcade, new, paste bearer, get endpoints from pachinko, paste
Add Bob->Robert policy
Test in Arcade playground
