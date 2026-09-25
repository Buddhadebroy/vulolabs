# AI Copilot

AI Copilot is a chat page where you ask questions about your own site. It reads your live scan data (scans, traffic, security, store health) and answers with real recommendations.

> AI features need a VuloCloud connection. See [GETTING-STARTED](GETTING-STARTED.md#7-connect-the-optional-services). Without one, the rest of VuloPilot still works.

**In this guide**

1. [Before you start](#1-before-you-start)
2. [Ask a question](#2-ask-a-question)
3. [Write a blog post](#3-write-a-blog-post)
4. [Attach a file or image](#4-attach-a-file-or-image)
5. [Review, approve and undo](#5-review-approve-and-undo)
6. [The side panels](#6-the-side-panels)
7. [AI credits and connection](#7-credits-and-connection)

## 1. Before you start

1. Go to **Settings → Integrations → VuloCloud AI** and click **Connect to VuloCloud**.
2. The status should read **Connected**. If it says **Key needed**, add an AI key from your VuloCloud account (or ask your agency to).
3. Open **VuloPilot → AI Copilot**. The header shows **Online** when the assistant can answer and **Offline** when it cannot.

## 2. Ask a question

1. Type in the box that says **Ask VuloPilot anything about your website...** and send, or click a suggested prompt.
2. Suggested prompts include: **Improve my homepage**, **Why is traffic dropping?**, **Fix my Core Web Vitals**, **Generate schema**, **Improve checkout**, **Optimize WooCommerce**, **Write a blog**, **Find security issues** and **Make my site GEO ready**.
3. Read the answer. Answers are advice based on your real data. For SEO, performance, security and similar topics, the Copilot advises; you make the change or use the fix buttons elsewhere in VuloPilot.

To start over, use the new-chat button on the chat card.

## 3. Write a blog post

Ask for a blog post ("Write a blog about ...") and the Copilot writes it and saves it as a **draft**. The action is logged in **Reports → History** with an **Undo**.

```
You ask  →  Copilot writes a draft post  →  Saved as draft (not published)  →  Undo available
```

Drafts are never published for you.

## 4. Attach a file or image

- Click **Attach** or **Upload File**.
- You can attach a `.txt` or `.csv` file for it to read, or a `.jpg`, `.png`, `.gif` or `.webp` image for it to look at.
- The file is uploaded to your Media Library first so the AI can read it. If you see "That file wasn't uploaded", use the **Upload File** button so it is saved to the Media Library.

## 5. Review, approve and undo

- The **Auto-applies** switch, when on, lets VuloPilot prepare a fix itself. The change still waits for your approval before it goes live - nothing changes on your site without your say.
- If a change goes wrong, use **Undo**. You will see "Change undone." If it cannot be undone you will see an error; try again.

## 6. The side panels

| Panel | What it shows |
|---|---|
| **Recent conversations** | Your past chats. Click **View all history** to open the full timeline in Reports → History |
| **Issues** | Findings from your most recent scans, grouped by check, with **More Details** |
| **Recommended by VuloPilot** | High-impact actions, such as critical security or performance items, with **Investigate with AI** or **Improve with AI** |
| **Site Overview / Overall Health** | Score and open issues by category (SEO & Visibility, Performance, Security, Content) with **View all issues** |

## 7. Credits and connection

- Some AI actions use **AI credits**. When they run out you will be asked to add more.
- To disconnect: Settings → Integrations → VuloCloud AI → **Disconnect**. AI features that rely on your organization's key stop working until you reconnect.

## Related guides

- [CONTENT](CONTENT.md) - more AI writing tools
- [REPORTS](REPORTS.md) - the History timeline that logs AI actions
- [SETTINGS](SETTINGS.md#integrations) - connection settings
