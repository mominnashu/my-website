import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { uploadSingleImage } from '../middleware/upload.js';
import { sendSuccess } from '../utils/response.js';
import { Report } from '../models/Report.js';
import { Detection } from '../models/Detection.js';
import { Organization } from '../models/Organization.js';
import { Brand } from '../models/Brand.js';
import { processOcrAndDetect } from '../services/ocr.service.js';
import { detectionService } from '../services/detection.service.js';
import { entitlementFor, shouldRenewMonthlyUsage } from '../services/billing.service.js';
import { AuditLog } from '../models/AuditLog.js';
const router = Router();
const wrap = fn => (req,res,next) => Promise.resolve(fn(req,res)).catch(error => { if (error.name === 'ZodError') { return next(Object.assign(new Error(error.issues.map(i => i.message).join('; ')), {statusCode:400})); } if (error.message?.startsWith('No readable text') || error.message?.startsWith('Server OCR failed:')) return next(Object.assign(new Error('No readable evidence was found. Upload a clearer screenshot with the required information.'), { statusCode: 422 })); next(error); });
const fail = (message, statusCode=422) => { throw Object.assign(new Error(message), { statusCode }); };
const summary = d => ({ _id: d._id, detectorType: d.detectorType, verdict: d.verdict, riskScore: d.riskScore, riskBand: d.riskBand, limitations: 'Automated assessment of submitted evidence. Verify against the original source before taking action.', createdAt: d.createdAt });
router.use(authenticate);
router.get('/findings', wrap(async (req,res) => {
 const query = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1), riskBand: z.enum(['Low','Medium','High','Critical']).optional(), detectorType: z.enum(['social_profile','brand_page','scam_text','mobile_app','url']).optional() }).parse(req.query);
 const filter = { organizationId: req.user.organizationId };
 if(query.riskBand) filter.riskBand = query.riskBand;
 if(query.detectorType) filter.detectorType = query.detectorType;
 const [items,total] = await Promise.all([Detection.find(filter).sort({createdAt:-1}).skip((query.page-1)*20).limit(20), Detection.countDocuments(filter)]);
 return sendSuccess(res,{items:items.map(summary), total, page:query.page, totalPages:Math.max(1,Math.ceil(total/20))});
}));

router.get('/reports', wrap(async (req,res) => {
 const filter = req.user.role === 'super_admin' ? {} : { organizationId: req.user.organizationId };
 const items = await Report.find(filter).populate('organizationId','name').populate('detectionId','detectorType verdict riskScore riskBand').sort({createdAt:-1}).limit(200);
 return sendSuccess(res,{items});
}));
router.post('/reports', wrap(async (req,res) => {
 const body = z.object({detectionId:z.string().regex(/^[a-f\d]{24}$/i),message:z.string().trim().min(5).max(2000)}).parse(req.body);
 const detection = await Detection.findOne({_id:body.detectionId,organizationId:req.user.organizationId});
 if (!detection) fail('Detection not found in your company workspace',404);
 const report = await Report.create({...body,organizationId:req.user.organizationId,createdBy:req.user.id});
 await AuditLog.create({organizationId:req.user.organizationId,actorId:req.user.id,action:'REPORT_CREATE',resourceType:'Report',resourceId:report._id.toString(),details:{status:report.status}});
 return sendSuccess(res,{report},201);
}));
router.patch('/reports/:id', requireRoles('super_admin'), wrap(async (req,res) => {
 const body = z.object({status:z.enum(['submitted','reviewing','resolved']),ownerNote:z.string().trim().max(2000).default('')}).parse(req.body);
 if (!/^[a-f\d]{24}$/i.test(req.params.id)) fail('Invalid report',400);
 const report = await Report.findByIdAndUpdate(req.params.id,body,{new:true,runValidators:true});
 if (!report) fail('Report not found',404);
 await AuditLog.create({organizationId:report.organizationId,actorId:req.user.id,action:'REPORT_STATUS_UPDATE',resourceType:'Report',resourceId:report._id.toString(),details:{status:report.status,hasOwnerNote:!!report.ownerNote}});
 return sendSuccess(res,{report});
}));
router.get('/companies', requireRoles('super_admin'), wrap(async (req,res) => {
 const items = await Organization.find().select('name status audience subscription createdAt').sort({createdAt:-1}).limit(200);
 return sendSuccess(res,{items});
}));
router.post('/scan', uploadSingleImage, wrap(async (req,res) => {
 const detectorType = z.enum(['social_profile','brand_page','scam_text','mobile_app','url']).parse(req.body.detectorType);
 let brand = null;
 if (req.body.brandId) {
  if (!/^[a-f\d]{24}$/i.test(req.body.brandId)) fail('Choose a registered brand');
  brand = await Brand.findOne({_id:req.body.brandId,organizationId:req.user.organizationId});
  if (!brand) fail('Brand not found in your company workspace',404);
 }
 if (['brand_page','mobile_app'].includes(detectorType) && !brand) {
  brand = await Brand.findOne({organizationId:req.user.organizationId,status:'active'}).sort({createdAt:1});
  if (!brand) fail('Add your official brand details in My brands before checking this type of evidence');
 }
 const organization = await Organization.findById(req.user.organizationId);
 if (shouldRenewMonthlyUsage(organization?.subscription)) {
  organization.subscription.monthlyChecksUsed = 0;
  organization.subscription.usagePeriodStartedAt = new Date();
  await organization.save();
 }
 const entitlement = entitlementFor(organization);
 if (!entitlement.allowed) fail(entitlement.reason === 'trial_expired' ? 'Your 3-day trial has ended. Choose a plan to continue.' : entitlement.reason === 'usage_limit_reached' ? `You have used your ${entitlement.limit} evidence checks for this period.` : 'Your workspace does not currently have an active plan.', 402);
 // Direct message and website checks use the existing detector service methods;
 // model endpoint contracts remain unchanged. Screenshot OCR stays available as fallback.
 let directInputs = null;
 if (detectorType === 'scam_text' && typeof req.body.text === 'string' && req.body.text.trim()) {
  const text = req.body.text.trim();
  if (text.length < 5 || text.length > 5000) fail('Paste a message between 5 and 5,000 characters');
  directInputs = { text, brandId: brand?._id?.toString() };
 }
 if (detectorType === 'url' && typeof req.body.url === 'string' && req.body.url.trim()) {
  const value = req.body.url.trim();
  if (value.length > 2048) fail('Website link must be 2,048 characters or fewer');
  let parsed;
  try { parsed = new URL(value); } catch { fail('Enter a complete website link beginning with https:// or http://'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) fail('Enter a valid public HTTP or HTTPS website link');
  directInputs = { url: parsed.toString(), brandId: brand?._id?.toString() };
 }
 if (directInputs) {
  const methods = { scam_text:'detectScamText', url:'detectUrl' };
  const detection = await detectionService[methods[detectorType]](directInputs,req.user);
  await Organization.updateOne({_id:organization._id},{$inc:{'subscription.monthlyChecksUsed':1}});
  return sendSuccess(res,{detection:summary(detection)},201);
 }
 if (!req.file) fail(detectorType === 'scam_text' ? 'Paste the message text or upload a PNG, JPEG or WebP screenshot' : detectorType === 'url' ? 'Enter a website link or upload a PNG, JPEG or WebP screenshot' : 'Upload a PNG, JPEG or WebP screenshot');
 const b = req.file.buffer;
 const valid = (b[0]===0x89 && b.subarray(1,4).toString()==='PNG') || (b[0]===0xff && b[1]===0xd8 && b[2]===0xff) || (b.subarray(0,4).toString()==='RIFF' && b.subarray(8,12).toString()==='WEBP');
 if (!valid) fail('The file contents must be a PNG, JPEG or WebP image');
 // Extract on the server only. Never return raw OCR or numeric features to clients.
 const extracted = await processOcrAndDetect({detectorType:detectorType==='brand_page'?'scam_text':detectorType,image:b,brandId:brand?._id?.toString(),brandName:brand?.name,user:req.user,extractOnly:true});
 const text = extracted.rawText || '';
 let inputs = extracted.autofillInputs;
 if (detectorType==='social_profile' && (!/followers/i.test(text) || !/following|follows/i.test(text) || !/posts|tweets/i.test(text) || inputs.username==='detected_account')) fail('Upload a complete profile screenshot showing the handle, posts, followers and following counts');
 if (detectorType==='url' && !/https?:\/\/[^\s]+|www\.[^\s]+/i.test(text)) fail('The screenshot must show a readable website URL');
 if (detectorType==='mobile_app') {
  const pkg = text.match(/\b(?:com|org|net|in)\.[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+\b/);
  const dev = text.match(/(?:offered by|developer|published by)\s*[:\n]?\s*([^\n]+)/i);
  if (!pkg || !dev) fail('Include the app name, package ID and labelled developer in the screenshot');
  inputs = {...inputs,package_name:pkg[0],developer_name:dev[1].trim(),brand_name:brand.name,official_package_name:'',official_developer_name:''};
 }
 if (detectorType==='brand_page') {
  const url = text.match(/https?:\/\/[^\s]+/i)?.[0];
  if (!url) fail('Include the page name and full page URL in the screenshot');
  inputs = {brandId:brand._id.toString(),pageName:text.split('\n').find(l=>l.trim()&&!l.includes('http'))?.trim(),pageUrl:url,bio:text,platform:'web'};
  if (!inputs.pageName) fail('The page name could not be read; upload a clearer screenshot');
 }
 const methods = {social_profile:'detectSocialProfile',brand_page:'detectBrandPage',scam_text:'detectScamText',mobile_app:'detectMobileApp',url:'detectUrl'};
 const detection = await detectionService[methods[detectorType]](inputs,req.user);
 await Organization.updateOne({_id:organization._id},{$inc:{'subscription.monthlyChecksUsed':1}});
 return sendSuccess(res,{detection:summary(detection)},201);
}));
export default router;
