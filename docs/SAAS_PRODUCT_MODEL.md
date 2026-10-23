# RiskProtect SaaS business model and product scope

RiskProtect should sell a company workflow for reviewing brand impersonation and suspicious evidence. The first customer is a brand, customer-support or security lead at an online business receiving suspicious profiles, messages, links and app listings. The buyer pays for quicker, organised investigation and a shared record of decisions. A prediction alone is not the product.

## What the project document means for this release

The supplied project document prioritises manual submissions, verified processing, saved company data, official brand details, investigations and access control. It treats continuous collection, notifications from external sources and subscriptions as later work. The app should describe the five customer check categories without displaying implementation names or numeric feature forms.

Customer path: create a company workspace, add official brand details, upload evidence, review a saved finding, investigate or request another review, and follow the outcome. The platform owner reviews company requests and records responses. A priority indicates review urgency; it is not a calibrated probability of fraud.

## Recommended commercial model

Use a recurring company subscription with included protected brands and monthly successful evidence checks. Avoid per-algorithm pricing. Additional brand capacity and agreed usage packages provide expansion revenue. Keep core access control and company isolation available in every paid tier.

| Proposed offer | Buyer | Commercial unit | Purpose |
| --- | --- | --- | --- |
| Pilot | A business validating the workflow | Time-limited, agreed evaluation allowance | Prove the process with its own labelled examples |
| Essential | One brand and a small review team | Company subscription with one brand and an included check allowance | Official brand reference, checks, findings and investigations |
| Growth | A business with multiple brands or more frequent submissions | Higher company subscription with more brands and checks | Expand the same workflow as usage grows |
| Managed review | A team needing investigation assistance | Separately scoped service agreement | Human investigation capacity with explicitly agreed response times |

The current public pricing proposal is Student free (10 checks/month), Professional ₹499/month (100 checks), Professional Plus ₹999/month (500 checks, 5 seats), Organization ₹4,999/month (2,500 checks, 25 seats), and Organization Scale ₹9,999/month (10,000 checks, 100 seats). Paid subscriptions begin with a three-day trial capped at 25 successful checks. These are product defaults for validation with pilot customers; the payment gateway is not connected, so the platform owner activates paid subscriptions after payment is arranged. Seat counts are packaging information and are not enforced until invitations and team membership are implemented. Do not offer unlimited human review or promise content removal.

For pricing discovery, calculate the recurring infrastructure cost, per-check extraction and prediction cost, storage and support cost, and the human minutes per managed review. Set included allowances only after measuring those costs and testing willingness to pay. Failed uploads and unreadable evidence should not consume a billable successful check. Annual commitments can follow demonstrated renewal value.

Tiered recurring security pricing is an established packaging pattern; Cloudflare provides a public example of self-service and contract tiers. This is a packaging reference, not a direct price comparison or evidence of demand for this product: https://www.cloudflare.com/plans/

Cloudflare's brand-protection documentation describes domain and visual-asset monitoring. That illustrates the distinction between a monitoring service and the manual evidence review MVP currently implemented here: https://developers.cloudflare.com/security-center/brand-protection/

## Acquisition and retention

Start with a small set of pilot companies that already receive impersonation or scam complaints. Demonstrate the workflow using their authorised examples. Measure how long it takes from a submitted item to a documented review decision. Repeated usage, useful investigations and a reliable company history should drive retention. Do not invent customer logos, accuracy percentages or prevented-loss claims.

Measure company activation (brand added and first successful check), repeat weekly company usage, time to first finding, review requests awaiting a response, investigation completion, cost per successful check, and support effort per company. Track false positives and missed risks on labelled evidence separately from usage growth.

## Required product experience

The public page explains the customer's problem and shows an explicitly illustrative evidence-review example. It explains supported checks and the next action without naming algorithms. The company navigation contains Overview, Check evidence, Findings, Alerts, Investigations, My brands, Review requests and Plan and usage. The platform owner gets Platform overview, Company reports, Activity logs and Service status, with controls to review company status and plan.

The overview uses persisted company statistics, a first-brand setup prompt, recent findings and direct next actions. Findings have company-scoped filtering, pagination, investigation creation and a review-request path. Official app developer details are entered by the company rather than guessed from its name. Customer screens omit implementation provenance and model status tables.

## Backend and release boundaries

Existing detection endpoints, Python prediction endpoints and backend-to-model request formats remain unchanged. The customer-facing workspace API wraps the existing services and returns concise summaries. Findings, reports and company lookups require backend authentication and company or owner access checks.

Image uploads have been exercised through all five services using synthetic screenshots, both over HTTP and in the browser. Company reporting, owner visibility, company isolation and owner response persistence have been exercised in an isolated database. These are workflow tests, not predictive accuracy evaluation.

Before commercial release, connect a payment provider with verified webhooks, invoices, cancellation and grace-period handling. Validate the original URL feature extractor and class mapping, test each detector on labelled examples, and measure false positives. The supplied document explicitly identifies the original URL preprocessing as unverified. Do not claim production-grade detection quality based on successful uploads. Evidence images currently process in memory and are not retained as report attachments; durable evidence storage and retention controls require separate work.

Billing state, plan selection, trial limits, successful-check usage metering, entitlement checks, owner activation controls and audit events are implemented. Payment processing, verified provider webhooks, cancellations, invoices and grace periods remain unimplemented. Team invitations, enforced seat counts, CSV exports, automatic discovery and content-removal workflows remain separate backlog items. Do not present them as available in the current app.
