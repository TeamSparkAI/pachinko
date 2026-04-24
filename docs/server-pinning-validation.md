# Server pinning (package baseline)

## Overview

The **Pinning** tab on a pinnable MCP server still lets you capture **package metadata** and raw **`initialize`** / **`tools/list`** responses for a chosen package version, and stores that payload as **`pinningInfo`** on the server record.

## Policy enforcement removed

**Policy-based pinning validation has been removed.** The engine no longer registers a `pinning` condition or evaluates stored baselines against live MCP traffic. That path did not align with non–JSON-RPC webhook flows (e.g. external tool gateways).

Stored **`pinningInfo`** remains available for **reference, UX, or future features**; it is not automatically enforced by the policy engine today.

For historical detail on the old behavior, see git history for this file and `PolicyConditionPinning`.
