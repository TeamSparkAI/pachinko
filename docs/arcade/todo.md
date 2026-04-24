# Pachinko / Arcade.dev To Do

## Update model (and code) to match Arcade payloads better

* Adapt our data model and UX to the Arcade.dev payload
  - We are going to change our db, but we don't need to do any migrations
    - Remove existing migrations and make a new 001 migration to create the db per the current schema with the changes indicated below
  - Add "source" column, set to "arcade" when adding from Arcade webhook
  - Replace serverName (in db, and usage/ux) with new payloadToolkit populated from Arcade tool.toolkit
  - Add payloadToolVersion from Arcade tool.version
  - Consilidate sessionId and payloadMessageId to just use payloadMessageId (remove sessionId and change places that refer to for matching to use payloadMessageId)
  - Remove clientId, serverId, sourceIP
  - Remove client and server tables, remove client and server menu items and pages
  - Update scripts in load-sample-data (remove client/server part, remove non-tool-call / and tool result messages, inject the rest of the Arcade payload somehow)
    - One way to do this would be to convert the messages (json files) to values that could be easily converted to Arcade pre and post messages and sent to the filter function (similar to how the tool call and result messages work now)
  - When we're done we should be able to create a new db and populate it with sample data that will appear to have been from Arcade


## Multitenant

* Add tennants / users tables
* Add tennant ID to all other tables
* Landing page (Welcome, login, create account)
* Auth is user/pass for now, OAuth later, one account per tenant, auth enforcement in UX
* Tenant config (tenant name/id, which will be used in filter routes) - starts with auto-generated tenantID and bearerToken
* Require bearer token (auto-generate, allow to regenerate)
* Show full endpoints in server setup (on tenant config view page)
* Allow enable/disable of each endpoint?  Later?
* Add tennant ID to filter API paths (all API paths? Added bearer auth to all API paths?)

## Cloud

* Choose cloud db, adapt/implement model
* Domain: pachinko.teamspark.ai
* Google Cloud ALB deploy