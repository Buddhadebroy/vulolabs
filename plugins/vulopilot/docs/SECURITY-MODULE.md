# VuloPilot - Security

## Audit: what already existed

| Spec item | Status before this pass |
|---|---|
| Outdated Plugins (Free) | Already fully built - `Scanners\Basic\UpdatesScanner` (category `updates`, not `security`) already flags core/plugin/theme updates via core's own `get_core_updates()`/`get_plugin_updates()`/`get_theme_updates()`. Untouched. |
| Weak Password Detection (Free) | **Did not exist at all.** |
| Basic Vulnerabilities (Free) | **Did not exist as a distinct check** - only `UpdatesScanner`'s generic "a newer version exists" (not the same as "is this specific installed version known-vulnerable"). |
| File Changes (Free) | **Did not exist at all** - no hashing/checksum code anywhere in either plugin. |

## Free - four new scanners, all category `security`

- **`UpdatesScanner`** (existing, untouched) - "Outdated Plugins."
- **`WeakPasswordScanner`** (`weak-passwords`) - "Weak Password Detection."
  Checks every administrator account's password hash against a small,
  fixed dictionary of the most commonly used passwords via core's own
  `wp_check_password()` - the same hashing/verification path core uses at
  login, so no plaintext candidate is ever stored or logged anywhere
  beyond the in-memory comparison itself. Scoped to administrators only
  (not every registered user) - the accounts whose compromise matters
  most, and checking a bounded dictionary against every user on a large
  membership site would be disproportionate cost. Deliberately a small,
  illustrative dictionary, not a large wordlist: a hardening check ("is
  this guessable in the first ten tries"), not a credential-stuffing tool.

## What's not here yet

- **A live/credentialed vulnerability intelligence feed.** See Advanced
  Vulnerabilities' own section above.
- **File-integrity monitoring for uploads/mu-plugins/wp-config.php.**
  Scoped to plugin/theme `.php` files only, matching what actually
  executes; broadening scope is a bounded, separate follow-up.
- **Alert delivery channels beyond email + the activity log** (e.g. a
  webhook/Slack integration) - same reasoning `RestTrigger`'s own
  docblock gives for not building a dedicated webhook credential system in
  `AUTOMATION-ENGINE-MODULE.md`'s pass: real, additional surface area
  deliberately not built here.
- **A UI toggle to disable individual `SecurityMonitoring` scanners
  beyond what already has one.** `enable_xmlrpc_scanner`/
  `enable_security_headers_scanner`/`enable_exposed_files_scanner` are
  real, pre-existing settings keys their respective scanners already read,
  but only `enable_rest_api_scanner` has ever had its own field on the
  Settings screen - a pre-existing gap, unrelated to this pass, left
  documented rather than silently expanded in scope.
