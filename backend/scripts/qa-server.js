// Isolated live integration test server. Never points at the application's normal DB.
import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
dotenv.config();
const original = process.env.MONGODB_URI;
if (!original) throw new Error('MONGODB_URI is required for isolated integration testing');

const database = process.env.QA_DATABASE || 'riskprotect_qa_' + randomBytes(6).toString('hex');
if (!/^riskprotect_qa_[a-f0-9]{12}$/.test(database)) throw new Error('Invalid isolated test database name');
process.env.MONGODB_URI = original.replace(/^(mongodb(?:\+srv)?:\/\/[^/]+\/)[^?]*/, '$1'+database);
process.env.PORT = '5011';
// Exercise the local OCR fallback without sending test images to an external provider.
process.env.OPENAI_API_KEY = '';
const { connectDatabase } = await import('../src/config/database.js');
const { default: mongoose } = await import('mongoose');
const { default: app } = await import('../src/app.js');
await connectDatabase();
if (mongoose.connection.readyState !== 1) throw new Error('Test database connection failed');
const { default: express } = await import('express');
const outer = express();
outer.post('/__qa_cleanup',async(req,res)=>{res.json({ok:true});await shutdown();});
outer.use(app);
const server = outer.listen(5011,'127.0.0.1',()=>console.log('Isolated QA backend ready on 5011'));
async function shutdown(){ server.close(); if(mongoose.connection.name !== database) throw new Error('Refusing to clean a non-test database'); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); process.exit(0); }
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
// Cleanup is a local test-only endpoint, unavailable in the normal application.

writeFileSync('.qa-database-name',database);
