# RiskProtect Link Guard

Chrome Manifest V3 extension that checks external links through the existing RiskProtect website-link scan route.

## Local installation

1. Keep the RiskProtect backend and ML service running.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select this `chrome-extension` folder.
5. Open the extension and sign in with a RiskProtect account.

The local API defaults to `http://127.0.0.1:5000/api/v1`. Change it under **Connection settings** for another environment.

## Behavior

- Low risk: opens after a brief confirmation toast.
- Medium risk: asks the user before opening.
- High or Critical risk: opens the RiskProtect warning screen and adds a browser block rule for the domain.
- Results use the current account limits and appear in Findings and Alerts.
- Results are cached for six hours to avoid repeating account usage for the same URL.

## Production checklist

- Configure an HTTPS API endpoint.
- Narrow `host_permissions` to the production API when deployment requirements are final.
- Add store icons, screenshots, privacy policy and Chrome Web Store disclosures.
- Review false-positive thresholds and blocked-site appeal handling before enabling automatic blocking broadly.

### Automatic detection

When protection is enabled, opening the popup copies and checks the active HTTP/HTTPS tab automatically. On webpages, external links are prechecked after a short hover or keyboard focus and checked again from cache when clicked. Existing tabs must be refreshed once after installing or reloading the extension so Chrome can inject the updated content script.
