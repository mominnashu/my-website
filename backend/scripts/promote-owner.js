// Run locally with: node scripts/promote-owner.js registered-owner@example.com
// Public registration never grants product-owner privileges.
import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/database.js';
import { User } from '../src/models/User.js';
const email = process.argv[2];
if (!email || !email.includes('@')) throw new Error('Provide the email of an existing registered owner account');
await connectDatabase();
if (mongoose.connection.readyState !== 1) throw new Error('A connected database is required');
try {
 const user = await User.findOneAndUpdate({email:email.toLowerCase(),status:'active'}, {role:'super_admin'}, {new:true});
 if (!user) throw new Error('Register the owner account first');
 console.log('Product-owner role assigned. Sign out and sign in again.');
} finally { await mongoose.disconnect(); }
