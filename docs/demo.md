# Demo

## Polices and Alerts

### Prep

[Load fresh data, set one client to run in container, add weather.com SSE disabled]

### Demo

Quick pass through menu for orientation

Dashboard

Policies
- Pop into the 4 criticials as example
  -Go through details on first one
- Filters: Explain regex, keywords, validators
  - Credit card numbers (luhn validator)
  - PII (SSN keywords)

Messages
- Toggle days to 30
- Click through all filter values
- Filter on method tools/call
- Click into a tool call message
- Click into client notification
- Click into server notification

Alerts
- Toggle days to 30
- Click through all filter values
- Filter on critical / clear
- Find tspark Amex alert - drill in
- Find PII - US Phone Number - drill in
- Find Internal Network Details - drill in

API
- The Web app is implemented through these APIs
  - The API offers even more functionality - more analytics
- Demo
  - /servers