# Submissions

Open **VuloForm > Submissions** and choose a form at the top right.

## The list

Each row shows the first answers, when it arrived and its status.

- **Inbox** is everything except spam. **New** has not been opened yet. **Read** has. **Spam** was caught by the spam protection.
- **Search** looks through all answers.
- **Date range** limits the list to a period.

## Reading one

Select **View**. You see every answer with its label, the page it was sent from, and what happened to each notification and webhook. Opening a submission marks it as read.

Uploaded files appear as buttons; select one to download it.

From here you can:

- **Mark as new** to come back to it later.
- **Mark as spam**, or **Not spam** for something caught by mistake. Marking as "not spam" later does not send the notifications that were skipped.
- **Delete** it, after confirming. Its uploaded files are deleted too.

## What the delivery lines mean

| Status | Meaning |
| --- | --- |
| Handed off | The email or text was passed to your site's mail or SMS system. VuloForm cannot see whether it reached the inbox. |
| Delivered | The webhook's receiver confirmed it got the data. |
| Will retry | The webhook failed for now and will be tried again. |
| Failed | It could not be sent. The line says why. |
| Skipped | Nothing was sent, for example no valid address, or SMS is not set up. |

## Exporting

**Export CSV** downloads the submissions of the chosen form, with the current search, status and date filters applied. Open it in any spreadsheet program.

File uploads appear as file names. Download the files themselves from each submission.

## Spam

Submissions caught as spam are kept under **Spam** so you can check for mistakes. No notification or webhook is sent for them.
