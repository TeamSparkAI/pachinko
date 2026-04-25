# Pre-hook payload

`context.user_id` is often an email or stable id from the Arcade run; below it uses a placeholder instead of a real address.

```json
{
  "context": {
    "authorization": [
      {
        "oauth2": {
          "user_info": {
            "avatar_url": "https://avatars.githubusercontent.com/u/51585?v=4",
            "bio": null,
            "blog": "",
            "company": null,
            "created_at": "2009-02-04T01:28:19Z",
            "email": null,
            "events_url": "https://api.github.com/users/BobDickinson/events{/privacy}",
            "followers": 23,
            "followers_url": "https://api.github.com/users/BobDickinson/followers",
            "following": 2,
            "following_url": "https://api.github.com/users/BobDickinson/following{/other_user}",
            "gists_url": "https://api.github.com/users/BobDickinson/gists{/gist_id}",
            "gravatar_id": "",
            "hireable": null,
            "html_url": "https://github.com/BobDickinson",
            "id": 51585,
            "location": "Redmond, WA",
            "login": "BobDickinson",
            "name": "Bob Dickinson",
            "node_id": "MDQ6VXNlcjUxNTg1",
            "notification_email": null,
            "organizations_url": "https://api.github.com/users/BobDickinson/orgs",
            "public_gists": 3,
            "public_repos": 18,
            "received_events_url": "https://api.github.com/users/BobDickinson/received_events",
            "repos_url": "https://api.github.com/users/BobDickinson/repos",
            "site_admin": false,
            "starred_url": "https://api.github.com/users/BobDickinson/starred{/owner}{/repo}",
            "subscriptions_url": "https://api.github.com/users/BobDickinson/subscriptions",
            "twitter_username": null,
            "type": "User",
            "updated_at": "2026-01-10T04:59:36Z",
            "url": "https://api.github.com/users/BobDickinson",
            "user_view_type": "public"
          }
        }
      }
    ],
    "secrets": ["GITHUB_SERVER_URL"],
    "user_id": "user@example.com"
  },
  "execution_id": "tc_3CnEHHFcnENnaM8mghIVE3I1RaV",
  "inputs": {},
  "tool": {
    "name": "WhoAmI",
    "toolkit": "Github",
    "version": "3.1.3"
  }
}
```

# Post-hook payload

```json
{
  "context": {
    "authorization": [
      {
        "oauth2": {
          "user_info": {
            "avatar_url": "https://avatars.githubusercontent.com/u/51585?v=4",
            "bio": null,
            "blog": "",
            "company": null,
            "created_at": "2009-02-04T01:28:19Z",
            "email": null,
            "events_url": "https://api.github.com/users/BobDickinson/events{/privacy}",
            "followers": 23,
            "followers_url": "https://api.github.com/users/BobDickinson/followers",
            "following": 2,
            "following_url": "https://api.github.com/users/BobDickinson/following{/other_user}",
            "gists_url": "https://api.github.com/users/BobDickinson/gists{/gist_id}",
            "gravatar_id": "",
            "hireable": null,
            "html_url": "https://github.com/BobDickinson",
            "id": 51585,
            "location": "Redmond, WA",
            "login": "BobDickinson",
            "name": "Bob Dickinson",
            "node_id": "MDQ6VXNlcjUxNTg1",
            "notification_email": null,
            "organizations_url": "https://api.github.com/users/BobDickinson/orgs",
            "public_gists": 3,
            "public_repos": 18,
            "received_events_url": "https://api.github.com/users/BobDickinson/received_events",
            "repos_url": "https://api.github.com/users/BobDickinson/repos",
            "site_admin": false,
            "starred_url": "https://api.github.com/users/BobDickinson/starred{/owner}{/repo}",
            "subscriptions_url": "https://api.github.com/users/BobDickinson/subscriptions",
            "twitter_username": null,
            "type": "User",
            "updated_at": "2026-01-10T04:59:36Z",
            "url": "https://api.github.com/users/BobDickinson",
            "user_view_type": "public"
          }
        }
      }
    ],
    "secrets": ["GITHUB_SERVER_URL"],
    "user_id": "user@example.com"
  },
  "execution_id": "tc_3CnEHHFcnENnaM8mghIVE3I1RaV",
  "inputs": {},
  "output": {
    "organizations": { "count": 0 },
    "profile": {
      "avatar_url": "https://avatars.githubusercontent.com/u/51585?v=4",
      "blog": "",
      "created_at": "2009-02-04T01:28:19Z",
      "html_url": "https://github.com/BobDickinson",
      "id": 51585,
      "location": "Redmond, WA",
      "login": "BobDickinson",
      "name": "Bob Dickinson",
      "type": "User"
    },
    "teams": { "count": 0 }
  },
  "success": true,
  "tool": {
    "name": "WhoAmI",
    "toolkit": "Github",
    "version": "3.1.3"
  }
}
```
