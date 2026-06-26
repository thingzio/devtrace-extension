# Privacy Policy — DevTrace for GitHub

**Effective date:** 2026-06-26

DevTrace for GitHub ("the extension") is a browser extension that displays
[DevTrace](https://devtrace.thingz.io) contributor trust scores inline on
`github.com`. This policy explains exactly what data the extension handles.

## Summary

The extension does not track you, does not use analytics, and does not sell or
share data with third parties. It only contacts DevTrace, and only when you
click a score badge.

## What the extension accesses

- **The username you click.** When you click a DevTrace badge next to a GitHub
  username, that username is sent to the DevTrace API
  (`https://devtrace.thingz.io`) to retrieve its trust score.
- **The current repository (only when you provide an API token).** If you have
  configured a DevTrace API token, the `owner/repo` of the page you are viewing
  is also sent, so the score can include repository-specific context. Without a
  token, the repository is not sent.
- **Your optional API token.** If you choose to enter a DevTrace API token in the
  extension's options, it is stored locally in your browser via
  `chrome.storage.sync` and attached only to requests made to DevTrace. It is
  never sent anywhere else.

The extension does **not** read, collect, or transmit your browsing history, the
content of pages you visit, your GitHub credentials, cookies, form data, or any
personal information beyond the items listed above.

## How data is used

The username (and, when authenticated, the repository) is sent to DevTrace solely
to compute and return a trust score, which the extension then displays. The
extension stores no request logs and retains no data beyond a short-lived
in-memory cache (about five minutes) used to avoid duplicate requests during a
browsing session. This cache is discarded when the browser's service worker is
unloaded and is never written to disk.

## Data storage and sync

Your optional API token is stored using `chrome.storage.sync`. If you are signed
into Chrome with sync enabled, this means the token may be synchronized across
your signed-in Chrome browsers by Google as part of normal Chrome Sync. You can
remove the token at any time from the extension's options page ("Clear"), which
deletes it from storage.

## Permissions

The extension requests the minimum permissions required to function:

- **`storage`** — to save your optional API token locally.
- **Host access to `https://devtrace.thingz.io/*`** — to fetch trust scores from
  the DevTrace API.

It requests no access to any other website and no `tabs`, history, or broad host
permissions.

## Third-party service

Score requests are served by DevTrace (`https://devtrace.thingz.io`). Data you
send to DevTrace through this extension is handled under DevTrace's own privacy
practices. See [devtrace.thingz.io](https://devtrace.thingz.io) for details.

## Changes to this policy

If this policy changes, the updated version will be published in this repository
with a new effective date.

## Contact

Questions about this policy can be raised via the project's issue tracker at
<https://github.com/thingzio/devtrace-extension/issues>.
