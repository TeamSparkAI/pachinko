# Pachinko / Arcade.dev To Do

## Multi-tenant

* Add tennants / users tables
* Add tennant ID to all other tables
* Landing page (Welcome, login, create account)
* Auth is user/pass for now, OAuth later, one account per tenant, auth enforcement in UX
* Tenant config (tenant name/id, which will be used in filter routes) - starts with auto-generated tenantID and bearerToken
* Require bearer token (auto-generate, allow to regenerate)
* Allow enable/disable of each endpoint?  Later?
* Add tennant ID to filter API paths (all API paths? Added bearer auth to all API paths?)

## Cloud

* Choose cloud db, adapt/implement model
* Domain: pachinko.teamspark.ai
* Google Cloud ALB deploy
