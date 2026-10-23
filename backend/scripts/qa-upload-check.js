import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config();
const base='http://127.0.0.1:5011/api/v1';
const password='Qa!'+randomBytes(18).toString('hex');
const session={password,accounts:{},results:[]};
async function call(path,token,options={}){
 const response=await fetch(base+path,{...options,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...options.headers}});
 const data=await response.json();return {status:response.status,data:data.data,error:data.error};
}
for(const role of ['company','other','owner','student']){
 const email=`${role}-${randomBytes(6).toString('hex')}@riskprotect-qa.example`;
 const payload={email,password,name:'QA '+role,organizationName:'QA '+role+' company'};
 if(role==='student')Object.assign(payload,{audience:'student',planId:'student-free'});
 const r=await call('/auth/register',null,{method:'POST',body:JSON.stringify(payload)});
 assert.equal(r.status,201,JSON.stringify(r));session.accounts[role]={email,...r.data};
}
const db=readFileSync('.qa-database-name','utf8');assert.match(db,/^riskprotect_qa_[a-f0-9]{12}$/);
await mongoose.connect(process.env.MONGODB_URI,{dbName:db});
await mongoose.connection.collection('users').updateOne({email:session.accounts.owner.email},{$set:{role:'super_admin'}});
const ownerLogin=await call('/auth/login',null,{method:'POST',body:JSON.stringify({email:session.accounts.owner.email,password})});session.accounts.owner={email:session.accounts.owner.email,...ownerLogin.data};
const companyToken=session.accounts.company.token, ownerToken=session.accounts.owner.token;
const plans=await call('/billing/plans',null);assert.equal(plans.status,200);assert.equal(plans.data.plans.length,5);assert.equal(plans.data.plans.find(p=>p.id==='professional').priceMonthly,499);
const studentSub=await call('/billing/subscription',session.accounts.student.token);assert.equal(studentSub.data.organization.audience,'student');assert.equal(studentSub.data.organization.subscription.planId,'student-free');
const wrongAudiencePlan=await call('/billing/change-plan',session.accounts.student.token,{method:'POST',body:JSON.stringify({planId:'organization'})});assert.equal(wrongAudiencePlan.status,400);
const companySub=await call('/billing/subscription',companyToken);const trialEndsAt=companySub.data.organization.subscription.trialEndsAt;assert.equal(companySub.data.organization.subscription.status,'trialing');
const planChange=await call('/billing/change-plan',companyToken,{method:'POST',body:JSON.stringify({planId:'organization-scale'})});assert.equal(planChange.status,200);assert.equal(planChange.data.organization.subscription.trialEndsAt,trialEndsAt);
assert.equal((await call('/billing/owner/logs',companyToken)).status,403);
const b=await call('/brands',companyToken,{method:'POST',body:JSON.stringify({name:'QA Bank',officialDomains:['qa-bank.example'],officialAppPackages:['com.qabank.official'],officialDevelopers:['QA Bank Limited'],officialSocialHandles:[{platform:'instagram',handle:'qabank',verified:true}]})});
assert.equal(b.status,201,JSON.stringify(b));const brand=b.data.brand || b.data;session.brandId=brand._id;
for(const type of ['social_profile','brand_page','scam_text','mobile_app','url']){
 const form=new FormData();form.append('detectorType',type);form.append('brandId',brand._id);form.append('image',new Blob([readFileSync(`tests/fixtures/${type}.png`)],{type:'image/png'}),type+'.png');
 const r=await call('/workspace/scan',companyToken,{method:'POST',body:form});
 const check={type,status:r.status,result:r.data?.detection,error:r.error?.message};session.results.push(check);console.log(JSON.stringify(check));
 if(r.status!==201)continue;
 assert.ok(r.data.detection._id);assert.equal(r.data.detection.detectorType,type);assert.equal(typeof r.data.detection.riskScore,'number');assert.ok(!('autofillInputs' in r.data));
 const saved=await mongoose.connection.collection('detections').findOne({_id:new mongoose.Types.ObjectId(r.data.detection._id)});
 check.provenance=saved.scoreProvenance;assert.ok(!/connection failure|unavailable|fallback/i.test(saved.scoreProvenance),saved.scoreProvenance);
 const report=await call('/workspace/reports',companyToken,{method:'POST',body:JSON.stringify({detectionId:saved._id.toString(),message:`QA ${type}: please review this synthetic evidence.`})});assert.equal(report.status,201,JSON.stringify(report));check.reportId=report.data.report._id;
}
const reports=await call('/workspace/reports',ownerToken);assert.equal(reports.status,200);assert.equal(reports.data.items.length,session.results.filter(r=>r.reportId).length);
for(const r of reports.data.items){assert.equal(r.organizationId._id,session.accounts.company.user.organizationId);assert.equal(r.organizationId.name,'QA company company');}
const other=await call('/workspace/reports',session.accounts.other.token);assert.equal(other.data.items.length,0);
const denied=await call('/workspace/companies',companyToken);assert.equal(denied.status,403);
const companyId=session.accounts.company.user.organizationId;
const companyEdit=await call('/billing/owner/companies/'+companyId,ownerToken,{method:'PATCH',body:JSON.stringify({planId:'organization-scale',subscriptionStatus:'active'})});assert.equal(companyEdit.status,200);assert.equal(companyEdit.data.organization.subscription.status,'active');
if(reports.data.items[0]){
 const report=reports.data.items[0];const cross=await call('/workspace/reports',session.accounts.other.token,{method:'POST',body:JSON.stringify({detectionId:report.detectionId._id,message:'Cross-company test'})});assert.equal(cross.status,404);
 const update=await call('/workspace/reports/'+report._id,ownerToken,{method:'PATCH',body:JSON.stringify({status:'reviewing',ownerNote:'QA owner has received the company evidence.'})});assert.equal(update.status,200);
 const companyReports=await call('/workspace/reports',companyToken);assert.equal(companyReports.data.items.find(x=>x._id===report._id).ownerNote,'QA owner has received the company evidence.');
}
const ownerLogs=await call('/billing/owner/logs',ownerToken);assert.equal(ownerLogs.status,200);assert.ok(ownerLogs.data.items.some(x=>x.action==='SUBSCRIPTION_CHANGED'));assert.ok(ownerLogs.data.items.some(x=>x.action==='COMPANY_UPDATED'));assert.ok(ownerLogs.data.items.some(x=>x.action==='REPORT_CREATE'));assert.ok(ownerLogs.data.items.some(x=>x.action==='REPORT_STATUS_UPDATE'));
for(const fixture of ['incomplete_profile','blank']){
 const form=new FormData();form.append('detectorType',fixture==='blank'?'scam_text':'social_profile');form.append('image',new Blob([readFileSync(`tests/fixtures/${fixture}.png`)],{type:'image/png'}),fixture+'.png');const r=await call('/workspace/scan',companyToken,{method:'POST',body:form});assert.equal(r.status,422);session.results.push({type:fixture,status:r.status,error:r.error?.message});console.log(JSON.stringify(session.results.at(-1)));
}
assert.equal(session.results.filter(r=>r.status===201).length,5);
writeFileSync('.qa-session.json',JSON.stringify(session,null,2));
console.log('Owner report visibility, company isolation, and owner reply round trip verified.');
await mongoose.disconnect();
