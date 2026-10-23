import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
const mocks = vi.hoisted(()=>({find:vi.fn(),findDetection:vi.fn(),listDetections:vi.fn(),countDetections:vi.fn(),create:vi.fn(),ocr:vi.fn(),predict:vi.fn(),update:vi.fn(),findOrganization:vi.fn(),updateOrganization:vi.fn()}));
vi.mock('../src/middleware/auth.js',()=>({authenticate:(req,res,next)=>{if(!req.headers.authorization)return res.sendStatus(401);req.user={id:'650000000000000000000001',organizationId:'650000000000000000000002',role:req.headers.authorization==='owner'?'super_admin':'admin'};next();},requireRoles:()=> (req,res,next)=>req.user.role==='super_admin'?next():res.sendStatus(403)}));
vi.mock('../src/models/Report.js',()=>({Report:{find:mocks.find,create:mocks.create,findByIdAndUpdate:mocks.update}}));
vi.mock('../src/models/Detection.js',()=>({Detection:{findOne:mocks.findDetection,find:mocks.listDetections,countDocuments:mocks.countDetections}}));
vi.mock('../src/models/Organization.js',()=>({Organization:{findById:mocks.findOrganization,updateOne:mocks.updateOrganization,find:vi.fn()}}));
vi.mock('../src/services/ocr.service.js',()=>({processOcrAndDetect:mocks.ocr}));
vi.mock('../src/services/detection.service.js',()=>({detectionService:{detectScamText:mocks.predict,detectUrl:mocks.predict}}));
import router from '../src/routes/workspace.routes.js';
const app=express();app.use(express.json());app.use(router);app.use((e,req,res,next)=>res.status(e.statusCode||500).json({message:e.message}));
beforeEach(()=>{vi.clearAllMocks();mocks.findOrganization.mockResolvedValue({status:'active',subscription:{planId:'organization',status:'trialing',trialEndsAt:new Date(Date.now()+86400000),monthlyChecksUsed:0}});mocks.updateOrganization.mockResolvedValue({modifiedCount:1});});
describe('Company workspace access and evidence processing',()=>{
 it('requires login',async()=>{expect((await request(app).get('/reports')).status).toBe(401);});
 it('denies company admins access to product owner directory',async()=>{expect((await request(app).get('/companies').set('Authorization','company')).status).toBe(403);});
 it('scopes company report lists on the server',async()=>{const chain={populate:vi.fn().mockReturnThis(),sort:vi.fn().mockReturnThis(),limit:vi.fn().mockResolvedValue([])};mocks.find.mockReturnValue(chain);expect((await request(app).get('/reports').set('Authorization','company')).status).toBe(200);expect(mocks.find).toHaveBeenCalledWith({organizationId:'650000000000000000000002'});});
 it('rejects reports against another company detection',async()=>{mocks.findDetection.mockResolvedValue(null);expect((await request(app).post('/reports').set('Authorization','company').send({detectionId:'650000000000000000000003',message:'Please investigate'})).status).toBe(404);expect(mocks.create).not.toHaveBeenCalled();expect(mocks.findDetection).toHaveBeenCalledWith({_id:'650000000000000000000003',organizationId:'650000000000000000000002'});});
 it('denies company admins report review mutations',async()=>{expect((await request(app).patch('/reports/650000000000000000000003').set('Authorization','company').send({status:'resolved'})).status).toBe(403);});
 it('rejects unsupported detector selection',async()=>{expect((await request(app).post('/scan').set('Authorization','company').field('detectorType','bad')).status).toBe(400);});
 it('rejects missing evidence',async()=>{expect((await request(app).post('/scan').set('Authorization','company').send({detectorType:'scam_text'})).status).toBe(422);});
 it('does not refill an exhausted three-day trial when its dates cross a month boundary', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-01T10:00:00.000Z'));
  try {
   const save = vi.fn();
   mocks.findOrganization.mockResolvedValue({ status:'active', save, subscription:{ planId:'organization', status:'trialing', trialStartsAt:new Date('2026-10-30T10:00:00.000Z'), trialEndsAt:new Date('2026-11-02T10:00:00.000Z'), usagePeriodStartedAt:new Date('2026-10-30T10:00:00.000Z'), monthlyChecksUsed:25 } });
   const response = await request(app).post('/scan').set('Authorization','company').send({ detectorType:'scam_text', text:'Check this suspicious message' });
   expect(response.status).toBe(402);
   expect(response.body.message).toContain('25 evidence checks');
   expect(save).not.toHaveBeenCalled();
   expect(mocks.predict).not.toHaveBeenCalled();
   expect(mocks.updateOrganization).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
 });
 it('checks file contents rather than trusting the MIME label',async()=>{expect((await request(app).post('/scan').set('Authorization','company').field('detectorType','scam_text').attach('image',Buffer.from('not an image'),{filename:'fake.png',contentType:'image/png'})).status).toBe(422);expect(mocks.ocr).not.toHaveBeenCalled();});
 it('processes on the server and returns only a prediction summary',async()=>{mocks.ocr.mockResolvedValue({rawText:'Secret extracted message',autofillInputs:{text:'Secret extracted message'}});mocks.predict.mockResolvedValue({_id:'650000000000000000000003',detectorType:'scam_text',verdict:'Likely Scam',riskScore:90,riskBand:'Critical',submittedInput:{secret:'internal'}});const r=await request(app).post('/scan').set('Authorization','company').field('detectorType','scam_text').attach('image',Buffer.from([137,80,78,71,13,10,26,10]),{filename:'test.png',contentType:'image/png'});expect(r.status).toBe(201);expect(r.body.data.detection.riskScore).toBe(90);expect(JSON.stringify(r.body)).not.toContain('Secret extracted');expect(r.body.data.detection.submittedInput).toBeUndefined();expect(mocks.predict).toHaveBeenCalledWith({text:'Secret extracted message'},expect.objectContaining({organizationId:'650000000000000000000002'}));});
 it('accepts direct message text through the existing message detector',async()=>{mocks.predict.mockResolvedValue({_id:'650000000000000000000003',detectorType:'scam_text',verdict:'Needs Review',riskScore:48,riskBand:'Medium'});const r=await request(app).post('/scan').set('Authorization','company').field('detectorType','scam_text').field('text','Your account is locked; send your verification code');expect(r.status).toBe(201);expect(mocks.ocr).not.toHaveBeenCalled();expect(mocks.predict).toHaveBeenCalledWith({text:'Your account is locked; send your verification code',brandId:undefined},expect.objectContaining({organizationId:'650000000000000000000002'}));expect(mocks.updateOrganization).toHaveBeenCalled();});
 it('accepts direct website links through the existing URL detector',async()=>{mocks.predict.mockResolvedValue({_id:'650000000000000000000003',detectorType:'url',verdict:'Needs Review',riskScore:48,riskBand:'Medium'});const r=await request(app).post('/scan').set('Authorization','company').field('detectorType','url').field('url','https://example.test/login');expect(r.status).toBe(201);expect(mocks.ocr).not.toHaveBeenCalled();expect(mocks.predict).toHaveBeenCalledWith({url:'https://example.test/login',brandId:undefined},expect.objectContaining({organizationId:'650000000000000000000002'}));});
 it('rejects non-HTTP website links before calling the detector',async()=>{const r=await request(app).post('/scan').set('Authorization','company').field('detectorType','url').field('url','javascript:alert(1)');expect(r.status).toBe(422);expect(mocks.predict).not.toHaveBeenCalled();});
 it('returns a validation response when OCR finds no readable evidence',async()=>{mocks.ocr.mockRejectedValue(new Error('No readable text could be extracted from image or provided text payload.'));const r=await request(app).post('/scan').set('Authorization','company').field('detectorType','scam_text').attach('image',Buffer.from([137,80,78,71,13,10,26,10]),{filename:'blank.png',contentType:'image/png'});expect(r.status).toBe(422);expect(r.body.message).toContain('clearer screenshot');expect(mocks.predict).not.toHaveBeenCalled();});

 it('paginates findings within the company and omits private model fields',async()=>{const chain={sort:vi.fn().mockReturnThis(),skip:vi.fn().mockReturnThis(),limit:vi.fn().mockResolvedValue([{_id:'test',riskBand:'High',scoreProvenance:'private implementation',submittedInput:{internal:1}}])};mocks.listDetections.mockReturnValue(chain);mocks.countDetections.mockResolvedValue(23);const r=await request(app).get('/findings?page=2&riskBand=High').set('Authorization','company');expect(r.status).toBe(200);expect(mocks.listDetections).toHaveBeenCalledWith({organizationId:'650000000000000000000002',riskBand:'High'});expect(chain.skip).toHaveBeenCalledWith(20);expect(r.body.data.totalPages).toBe(2);expect(r.body.data.items[0].scoreProvenance).toBeUndefined();expect(r.body.data.items[0].submittedInput).toBeUndefined();});
 it('rejects invalid findings filters',async()=>{expect((await request(app).get('/findings?page=-1').set('Authorization','company')).status).toBe(400);});

});
