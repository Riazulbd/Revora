# Getting rider feedback into Slack

**Short answer to "where can I see it?": in a Slack channel of your choosing.**
Each message posts there within a second or two of a rider tapping Send, and it
carries their plan, app version, device and uid so you can act on it without
asking follow-up questions.

The Firestore copy at `feedback/{id}` is the permanent record. Slack is the
notification — if Slack is down or unconfigured, nothing is lost.

## Not the Firebase "Slack" extension

The Firebase Extensions catalogue offers Slack extensions for build and alerting
events, not for your own documents, and they will not give you the message body
formatted the way you want it. `relayFeedbackToSlack` in `functions/src/feedback.ts`
is a dozen lines and does exactly the job.

## Setup

1. **Create the Slack app and webhook**
   - api.slack.com/apps → **Create New App** → *From scratch* → name it `Revora`
   - **Incoming Webhooks** → toggle on → **Add New Webhook to Workspace**
   - Pick the channel, e.g. `#revora-feedback`
   - Copy the URL (`https://hooks.slack.com/services/T…/B…/…`)

2. **Store it as a secret.** It is a credential: anyone holding it can post into
   your channel as Revora. It goes in Secret Manager, never in source or in
   `firebase functions:config`.

   ```bash
   firebase functions:secrets:set SLACK_FEEDBACK_WEBHOOK_URL --project ai-fuel-assistant
   # paste the URL when prompted
   ```

3. **Deploy.**

   ```bash
   firebase deploy --only functions:relayFeedbackToSlack --project ai-fuel-assistant
   ```

4. **Test** by sending feedback from the app (More → Feedback & support). It
   should appear in the channel immediately.

## What a message looks like

```
🐞 PROBLEM · FREE
The odometer will not save. I typed 5588 and it says it is below my last reading.

✉️ rider@example.com | 📱 Google Pixel 8 · android 15 | 🏷️ v1.3 | 🆔 `abc123…` | 📄 `xY7…`
```

The 🆔 is the Firebase uid — enough to find the account in the console. The 📄 is
the feedback document id, for quoting in a reply.

## Replying

There is no in-app inbox, deliberately: building a two-way support channel is a
product in itself, and email already works. Reply to the address in the message.
If a rider left none, you can read but not answer — which is why the field is
prompted for but never required.

If you later want threads in Slack to reach the rider, the honest options are a
push notification (`expo-notifications` is already wired) or a proper support
inbox. Both are real work; neither is needed at this size.

## Cost and failure behaviour

One Firestore write and one function invocation per message. At any realistic
volume this is inside the free tier.

`retry: false` is deliberate: a duplicate support ping is worse than a missed
one, and the Firestore document survives regardless. If the webhook fails, the
function logs the status code — never the body, because a Slack error can echo
the webhook URL back — and `notifiedAt` stays null, so unrelayed messages are
easy to find:

```bash
# In the Firebase console, filter feedback where notifiedAt == null
```

## Privacy

The message body, the rider's own email if they typed one, their uid, plan, app
version and device model go to Slack. **Their fuel logs, documents, photos and
motorcycle details never do.** If you add fields to `Feedback`, remember they
land in a third-party workspace and keep it to what triage genuinely needs.
