import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';
import { BrandVerification } from '../models/BrandVerification.js';
import { verifyBrandIdentity } from '../services/brandVerification.service.js';

const router=Router(); router.use(authenticate);
router.post('/', async(req,res,next)=>{try{const body=z.object({brandName:z.string().trim().min(2).max(120),claimedDomain:z.string().trim().max(253).optional().default('')}).parse(req.body);const verification=await verifyBrandIdentity(body,req.user);return sendSuccess(res,{verification},201);}catch(error){next(error);}});
router.get('/',async(req,res,next)=>{try{const items=await BrandVerification.find({organizationId:req.user.organizationId}).sort({createdAt:-1}).limit(50);return sendSuccess(res,{items});}catch(error){next(error);}});
export default router;
