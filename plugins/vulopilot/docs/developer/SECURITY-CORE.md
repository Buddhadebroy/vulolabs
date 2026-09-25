# Security Core

Code reference for `classes/Security`. User view: [../user/SECURITY.md](../user/SECURITY.md).

## Components

| Component | Role |
|---|---|
| `MalwareScanner` | Looks for PHP files in the uploads directory and known backdoor signatures in the active theme. Display paths are derived from the directory each file was found in (`relative_to()`), not from `ABSPATH` |
| `CoreFileIntegrityScanner` | Compares core files with the WordPress.org checksums |
| `WeakPasswordScanner`, `BasicVulnerabilitiesScanner`, `SslMonitoringScanner` | Account and configuration checks |
| `LoginProtectionGuard` + `LoginAttemptRepository` | Counts failed logins per IP and blocks after the configured attempts within the lockout window |
| `FirewallGuard` + `FirewallBlockRepository` | Matches request URLs against attack patterns; logs always, blocks with a 403 only when active blocking is enabled |
| `FirewallScanner`, `LoginProtectionScanner` | Report the state of the two guards as findings |
| `SecurityScoreSnapshotRecorder` | Stores the daily score for the trend chart (`vulopilot_security_score_recorded`) |

Settings keys are in [SETTINGS-SYSTEM](SETTINGS-SYSTEM.md). Alert email: sent when a scan produces a new finding at or above the minimum severity; already-alerted open findings are not re-sent.

## Class reference

| Class | File | What it does |
|---|---|---|
| `BasicVulnerabilitiesScanner` | `classes/Security/BasicVulnerabilitiesScanner.php` | - |
| `CoreFileIntegrityScanner` | `classes/Security/CoreFileIntegrityScanner.php` | Only flags modified/missing files - the same two states core's own checksum verification reports; it does not detect unexpected *added* files, since the checksums list only enumerates files that are supposed to exist, not every fi |
| `FirewallBlockRepository` | `classes/Security/FirewallBlockRepository.php` | - |
| `FirewallGuard` | `classes/Security/FirewallGuard.php` | - |
| `FirewallScanner` | `classes/Security/FirewallScanner.php` | Turns Services\FirewallGuard's own real request block/log (`vulopilot_security_events` (type `firewall_block`)) into one real summary Finding when there's been any activity in the last 7 days - `HIGH` when a single IP repeatedly h |
| `LoginAttemptRepository` | `classes/Security/LoginAttemptRepository.php` | - |
| `LoginProtectionGuard` | `classes/Security/LoginProtectionGuard.php` | - |
| `LoginProtectionScanner` | `classes/Security/LoginProtectionScanner.php` | Turns Services\LoginProtectionGuard's own real login-attempt log (`vulopilot_security_events` (type `login_attempt`)) into real Finding rows - one per IP that actually tripped the real, currently-configured `login_max_attempts` lo |
| `MalwareScanner` | `classes/Security/MalwareScanner.php` | Two real, low-false-positive checks - no external signature feed, no network call, everything derived from files that already exist on disk: 1. |
| `SecurityScoreSnapshotRecorder` | `classes/Security/SecurityScoreSnapshotRecorder.php` | - |
| `SslMonitoringScanner` | `classes/Security/SslMonitoringScanner.php` | Flags the site not being served over HTTPS at all, and - when it is - connects to the site's own host to read its live certificate and flags an already-expired or soon-to-expire one. |
| `WeakPasswordScanner` | `classes/Security/WeakPasswordScanner.php` | Checks every administrator's password hash against a small, fixed dictionary of the most commonly used passwords, using core's own `wp_check_password()` - the same hashing/verification path core uses at login, so this never touche |
| `SecurityScoreSnapshots` | `classes/Security/Rest/SecurityScoreSnapshots.php` | `GET /security-score-snapshots?days=N` - backs SecurityTrendCard.tsx's trend chart. |

Hooks and routes registered by these classes:

- `FirewallGuard` - hooks: `init`
- `LoginProtectionGuard` - hooks: `authenticate`, `wp_login`, `wp_login_failed`
- `SecurityScoreSnapshotRecorder` - hooks: `init`, `vulopilot_scan_completed`
- `SecurityScoreSnapshots` - routes: `/security-score-snapshots`
