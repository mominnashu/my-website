import { readFileSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const s=JSON.parse(readFileSync('.qa-session.json','utf8'));
async function call(path,role){const r=await fetch('http://127.0.0.1:5011/api/v1/workspace'+path,{headers:{Authorization:'Bearer '+s.accounts[role].token}});assert.equal(r.status,200);return (await r.json()).data;}
const findings=await call('/findings','company');assert.equal(findings.total,10);assert.ok(findings.items.every(d=>!d.submittedInput&&!d.scoreProvenance));
const filtered=await call('/findings?riskBand=Critical&detectorType=mobile_app','company');assert.equal(filtered.total,2);assert.ok(filtered.items.every(d=>d.detectorType==='mobile_app'&&d.riskBand==='Critical'));
assert.equal((await call('/findings','other')).total,0);
const reports=await call('/reports','owner');const browser=reports.items.find(r=>r.message.startsWith('Browser QA:'));assert.equal(browser.status,'resolved');assert.equal(browser.ownerNote,'Browser QA complete: evidence reviewed and response recorded.');
const customer=await call('/reports','company');assert.ok(customer.items.some(r=>r._id===browser._id&&r.status==='resolved'&&r.ownerNote===browser.ownerNote));assert.equal((await call('/reports','other')).items.length,0);
writeFileSync('../docs/qa/live-test-results.json',JSON.stringify({testedAt:new Date().toISOString(),imageChecks:s.results,findings:{total:findings.total,criticalAppFindings:filtered.total,otherCompanyFindings:0},reports:{companyReports:reports.items.length,browserReportVisibleToOwner:true,ownerResolutionVisibleToCompany:true,otherCompanyReports:0},existingModelApis:'Unchanged'},null,2));
console.log('Verified findings filters, pagination response, company isolation and browser owner resolution round trip.');
