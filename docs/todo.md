# TeamSpark Pachinko To Do (general, not Arcade-specific)

## API Auth

Web app
- Add /auth endpoint which returns bearer token (requires username/path if configured)
- Modify All API endpoints to require bearer auth
- Web app will auth user with login page

### Policy application

Implement single scan (multi-regex) for perf (currently 750+ msgs/second on laptop with full policy set, perf improvement may not be high priority)

### Retention

Retention (alerts/messages) is implemented in a service and exposed at an API endpoint
- Still need a mechanism to trigger it (could have UX with stats and manual and/or do it automatically via cronjob style solution)

### Server Management

Add stats / graphs per server (pareto of called tools, etc)

### Import

Allow policy, client, server import (maybe export) via JSON

### Messages

Filter messages on error state (add dimension, filtering)

Full text search on message payload (brute force to start)

### Testing

More unit tests and integration tests