# Privacy notes for RiskProtect Link Guard

The extension reads the destination of an external link only when the user clicks it or manually submits it in the popup. The link is sent to the configured RiskProtect API under the signed-in workspace. RiskProtect stores the resulting finding so the user can review it in their dashboard.

The extension stores the authentication token, user summary, settings, recent result and a six-hour URL-result cache in Chrome local extension storage. It does not read form fields, passwords, page messages or page content. Users can sign out to remove the stored token and user summary, and can clear browser block rules from Connection settings.
