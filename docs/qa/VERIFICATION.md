# RiskProtect workflow verification

Verified with synthetic screenshots in an isolated MongoDB database. No real company accounts were promoted or used for report tests.

| Check | Result |
| --- | --- |
| Social-account image upload and persisted prediction | Passed over HTTP and in browser |
| Brand-page image upload and persisted assessment | Passed over HTTP and in browser |
| Message image upload and persisted prediction | Passed over HTTP and in browser |
| Mobile-app image upload and persisted assessment | Passed over HTTP and in browser |
| Website-link image upload and persisted prediction | Passed over HTTP and in browser |
| Incomplete profile screenshot | Rejected with 422 |
| Blank screenshot | Rejected with readable 422 response after fix |
| Company report visible in product-owner dashboard | Passed, including a browser-submitted report |
| Owner response and resolved status visible to submitting company | Passed over HTTP and in browser |
| Other company sees no findings or reports from submitting company | Passed |
| Customer findings filters by priority and evidence type | Passed over HTTP and in browser |
| Customer brand list displays registered backend records | Passed after response-shape fix |
| Owner role survives refreshed authentication session | Passed after session-response fix |
| Algorithm names and internal feature forms removed from mounted customer pages | Verified in source and rendered screens |
| Frontend production build | Passed |
| Backend tests | 27 passed |
| Existing prediction-service tests | 11 passed |

The workflow tests verify extraction, routing, persistence, permissions and display. They do not measure detection accuracy. Existing model APIs and backend-to-model call formats were not changed. The existing service test suite reports dependency-version and feature-name warnings; release accuracy work should address these alongside the original preprocessing validation described in the project document.

Changes made while testing: blank-image errors now return a useful validation response; logout clears the previous workspace view; restored sessions unwrap the existing user response correctly; saved findings have a matching authenticated backend endpoint; the brand screen reads the backend brand list correctly and accepts explicit official developer details.

Reproducible fixtures are in backend/tests/fixtures. The isolated QA helpers are backend/scripts/qa-server.js and backend/scripts/qa-upload-check.js. They require an existing configured database connection and the running prediction service. Start the test server from backend/, then run the upload helper from backend/. The test server uses a separate database whose name starts with riskprotect_qa_. Its localhost-only /__qa_cleanup endpoint drops that test database and stops the helper; it is not part of the normal application.

The final browser-dependent verification helper checks the browser-created report and resolution; its expected counts assume the five HTTP uploads followed by the five browser uploads. Temporary QA credentials and the isolated database were removed after verification. Screenshots contain only fictional QA data.
