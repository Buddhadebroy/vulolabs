# Troubleshooting and FAQ

Find what is going wrong, then follow the steps. Each answer points to the guide with more detail.

**Jump to**

- [Nothing shows / no findings](#nothing-shows--no-findings)
- [AI features are offline](#ai-features-are-offline)
- [Scheduled scans or emails do not run](#scheduled-scans-or-emails-do-not-run)
- [Scores did not change after a fix](#scores-did-not-change-after-a-fix)
- [Sitemap, robots.txt and indexing](#sitemap-robotstxt-and-indexing)
- [Backups and restore](#backups-and-restore)
- [Locked out after failed logins](#locked-out-after-failed-logins)
- [Speed scores are missing](#speed-scores-are-missing)
- [Reset or remove VuloPilot](#reset-or-remove-vulopilot)

## Nothing shows / no findings

1. Run a scan: **Dashboard → Run scan** (or the **Run ... scan** button on the page you are in).
2. If a page says a module is turned off ("SEO module is turned off"), turn it back on in **Settings → Modules**. Findings already found are not deleted.
3. If a card says "run a scan to check", the scan for that area has not run yet.

## AI features are offline

1. Open **Settings → Integrations → VuloCloud AI**.
2. **Not Connected** - click **Connect to VuloCloud**.
3. **Key needed** - the site is connected but no AI key is configured. Add one in your VuloCloud account or ask your agency.
4. **AI credits** used up - you will be asked to add more.
5. Standard scans and reports never need AI. See [AI-COPILOT](AI-COPILOT.md).

## Scheduled scans or emails do not run

Automations run on WordPress's built-in scheduler, which only wakes up when someone visits your site. On a quiet site, tasks can start late.

1. Check **Site Health → Background Tasks** for overdue events.
2. Open **Automations** and confirm the automation is switched on and not showing **Errors**.
3. For the emailed report, confirm the recipient in **Settings → Notifications** and click **Send Test Email**.
4. On a quiet site, ask your web host to trigger WordPress's scheduled tasks on a fixed timer.

See [AUTOMATIONS](AUTOMATIONS.md).

## Scores did not change after a fix

Scores are calculated from open findings, so they only change after a new scan. Re-run the scan for that area. Trend charts fill in after your first scan and update daily.

## Sitemap, robots.txt and indexing

| Problem | What to do |
|---|---|
| Sitemap not found | Turn **XML Sitemap** on in **Settings → SEO → Sitemap**. The address is `yoursite.com/sitemap_index.xml` |
| A page is missing from the sitemap | Check the post type and taxonomy are ticked, and the post is not in **Exclude posts** |
| robots.txt shows "not reachable" | Open **SEO & Visibility → Crawl & URLs → Robots & Sitemap** and check for a plugin or server rule blocking it |
| IndexNow says "Key not found or doesn't match" | Generate the key again in **Settings → SEO → Instant Indexing** and make sure `/yourkey.txt` opens on your site |
| A new page is not in Google | A sitemap and IndexNow help discovery but indexing is never guaranteed |

See [SEO](SEO.md).

## Backups and restore

- A backup shows **Failed** - open its row for the error, free up disk space if needed and create a new one.
- A restore shows "Restore failed - the site was not changed." - nothing was overwritten. Fix the reported error and retry.
- Every restore first takes a **Pre-restore safety snapshot**, so you can go back.

See [SITE-HEALTH-AND-BACKUPS](SITE-HEALTH-AND-BACKUPS.md).

## Locked out after failed logins

Login protection blocks an IP after too many failed attempts within the lockout window. Wait for the **Lockout window (minutes)** to pass. To stop blocking, turn off **Block repeated failed login attempts** in **Settings → Scanning → Security**. If you cannot reach the admin at all, ask your host to rename the `vulopilot` plugin folder temporarily, log in, then restore the name. See [SECURITY](SECURITY.md).

Active firewall blocking returns a 403 for matched requests. If a legitimate request is blocked, turn **Enable active blocking** off and review the log.

## Speed scores are missing

Connect Google PageSpeed Insights (**Settings → Integrations → PageSpeed Insights**) and run **Run Speed Test**. See [PERFORMANCE](PERFORMANCE.md).

## Reset or remove VuloPilot

- **Reset settings** to defaults: **Settings → Developer Tools → Reset settings**. Scan reports and history are kept.
- **Clear cache**: **Settings → Developer Tools → Clear cache**.
- **Uninstall**: first choose **Keep data** or **Delete everything** in **Developer Tools**, then delete the plugin.

## FAQ

**Does VuloPilot change my site by itself?** No. AI changes wait for your approval, and drafts are never published for you.

**Does it work without AI?** Yes. All scans, scores and standard reports work without AI.

**Does it track my visitors?** Crawler monitoring only logs known AI bot user agents and the pages they request - no visitor IP addresses.

**Which outside services does it contact?** Only the ones you turn on. See the **External services** section of the plugin readme.

**Where are the developer docs?** In `docs/developer`.
