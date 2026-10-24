import dns from 'node:dns/promises';
import net from 'node:net';
import { Brand } from '../models/Brand.js';
import { BrandVerification } from '../models/BrandVerification.js';

const timeout = ms => AbortSignal.timeout(ms);
const cleanText = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

function normalizeDomain(value='') {
  const raw = value.trim().toLowerCase();
  if (!raw) return '';
  try { return new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function isPublicIp(address) {
  if (!net.isIP(address)) return false;
  return !/^(10\.|127\.|169\.254\.|192\.168\.|0\.|::1$|fc|fd|fe80)/i.test(address) && !/^172\.(1[6-9]|2\d|3[01])\./.test(address);
}

async function publicDomain(domain) {
  if (!domain) return false;
  try { const addresses = await dns.lookup(domain, { all: true }); return addresses.length > 0 && addresses.every(item => isPublicIp(item.address)); } catch { return false; }
}

async function wikipediaSources(query) {
  try {
    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.searchParams.set('action','query'); url.searchParams.set('list','search'); url.searchParams.set('srsearch',query); url.searchParams.set('srlimit','8'); url.searchParams.set('format','json'); url.searchParams.set('origin','*');
    const response = await fetch(url, { signal: timeout(7000), headers: { 'User-Agent':'RiskProtectBrandVerifier/1.0' } });
    if (!response.ok) return [];
    const data = await response.json();
    return (data?.query?.search || []).map(item => ({ source:'Wikipedia', title:item.title, url:`https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replaceAll(' ','_'))}`, snippet:cleanText(item.snippet) }));
  } catch { return []; }
}

async function duckDuckGoSources(query) {
  try {
    const url = new URL('https://api.duckduckgo.com/'); url.searchParams.set('q',query); url.searchParams.set('format','json'); url.searchParams.set('no_html','1'); url.searchParams.set('skip_disambig','0');
    const response = await fetch(url, { signal: timeout(7000), headers: { 'User-Agent':'RiskProtectBrandVerifier/1.0' } });
    if (!response.ok) return [];
    const data = await response.json();
    const topics = (data.RelatedTopics || []).flatMap(item => item.Topics || [item]).filter(item => item.FirstURL);
    const primary = data.AbstractURL ? [{ FirstURL:data.AbstractURL, Text:data.AbstractText, Result:data.Heading }] : [];
    return [...primary,...topics].slice(0,10).map(item => ({ source:'DuckDuckGo', title:cleanText(item.Result || item.Text).slice(0,120) || query, url:item.FirstURL, snippet:cleanText(item.Text) }));
  } catch { return []; }
}

const SOCIAL_HOSTS = {
  'instagram.com':'Instagram', 'facebook.com':'Facebook', 'x.com':'X',
  'twitter.com':'X', 'linkedin.com':'LinkedIn', 'youtube.com':'YouTube',
  'tiktok.com':'TikTok', 'threads.net':'Threads',
};

function discoveryDetails(sources, brandName) {
  const socialHandles=[];
  const relatedNames=[];
  for (const source of sources) {
    try {
      const url=new URL(source.url); const host=url.hostname.replace(/^www\./,'');
      const platform=SOCIAL_HOSTS[host];
      const handle=decodeURIComponent(url.pathname.split('/').filter(Boolean)[0] || '').replace(/^@/,'');
      if (platform && handle && !['share','watch','company','in'].includes(handle.toLowerCase())) socialHandles.push({platform,handle:`@${handle}`,url:source.url,verification:'public_reference'});
    } catch { /* Ignore malformed public result links. */ }
    const title=cleanText(source.title).replace(new RegExp(brandName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'ig'),'').replace(/[|–—:-]+/g,' ').trim();
    if (title.length>=2 && title.length<=80) relatedNames.push(title);
  }
  return {
    socialHandles:socialHandles.filter((item,index,all)=>all.findIndex(other=>other.platform===item.platform&&other.handle.toLowerCase()===item.handle.toLowerCase())===index).slice(0,20),
    relatedNames:[...new Set(relatedNames.map(value=>value.replace(/\s+/g,' ')))].slice(0,20),
  };
}

async function inspectClaimedWebsite(domain, brandName) {
  if (!await publicDomain(domain)) return null;
  try {
    const response = await fetch(`https://${domain}`, { signal:timeout(7000), redirect:'manual', headers:{ 'User-Agent':'RiskProtectBrandVerifier/1.0' } });
    if (response.status >= 300 && response.status < 400) return { source:'Claimed website', title:`${brandName} website`, url:`https://${domain}`, snippet:'The website redirected to another address. Add the final official domain to the brand reference before verification.', brandMentioned:false };
    const html = (await response.text()).slice(0,250000);
    const brandMentioned = html.toLowerCase().includes(brandName.toLowerCase());
    return { source:'Claimed website', title:`${brandName} website`, url:`https://${domain}`, snippet:brandMentioned ? 'The claimed website contains the submitted brand name.' : 'The website responded, but the submitted brand name was not clearly found.', brandMentioned };
  } catch { return { source:'Claimed website', title:`${brandName} website`, url:`https://${domain}`, snippet:'The claimed website could not be reached securely.', brandMentioned:false }; }
}

async function appleAppSources(query){
  try{const url=new URL('https://itunes.apple.com/search');url.searchParams.set('term',query);url.searchParams.set('entity','software');url.searchParams.set('limit','10');const response=await fetch(url,{signal:timeout(7000)});if(!response.ok)return {items:[],status:'unavailable'};const data=await response.json();return {status:'connected',items:(data.results||[]).map(app=>({platform:'Apple App Store',name:cleanText(app.trackName),publisher:cleanText(app.sellerName),packageId:app.bundleId,url:app.trackViewUrl,icon:app.artworkUrl100,description:cleanText(app.description)}))};}catch{return {items:[],status:'unavailable'};}
}

async function youtubeChannelSources(query){
  const key=process.env.YOUTUBE_API_KEY;
  if(!key)return {items:[],status:'not_configured'};
  try{const url=new URL('https://www.googleapis.com/youtube/v3/search');url.searchParams.set('part','snippet');url.searchParams.set('type','channel');url.searchParams.set('maxResults','10');url.searchParams.set('q',query);url.searchParams.set('key',key);const response=await fetch(url,{signal:timeout(7000)});if(!response.ok)return {items:[],status:'unavailable'};const data=await response.json();return {status:'connected',items:(data.items||[]).map(item=>({source:'YouTube',title:cleanText(item.snippet?.channelTitle||item.snippet?.title),url:`https://www.youtube.com/channel/${item.id?.channelId}`,snippet:cleanText(item.snippet?.description)}))};}catch{return {items:[],status:'unavailable'};}
}

export async function verifyBrandIdentity({ brandName, claimedDomain }, user) {
  const domain = normalizeDomain(claimedDomain);
  const registered = await Brand.find({ organizationId:user.organizationId, status:'active' }).select('name officialDomains officialSocialHandles officialAppPackages');
  const matchingRecord = registered.find(brand => brand.name.toLowerCase() === brandName.toLowerCase());
  const officialDomains = (matchingRecord?.officialDomains || []).map(normalizeDomain);
  const domainMatches = Boolean(domain && officialDomains.includes(domain));
  const [wiki,ddg,social,apps,youtube,website] = await Promise.all([wikipediaSources(brandName),duckDuckGoSources(brandName),duckDuckGoSources(`${brandName} official Instagram Facebook LinkedIn X YouTube`),appleAppSources(brandName),youtubeChannelSources(brandName),domain ? inspectClaimedWebsite(domain,brandName) : null]);
  const sources = [...wiki,...ddg,...social,...youtube.items,...apps.items.map(app=>({source:app.platform,title:`${app.name} — ${app.publisher}`,url:app.url,snippet:app.description})),...(website?[website]:[])].filter((item,index,all)=>item.url&&all.findIndex(other=>other.url===item.url)===index).slice(0,40);
  const discovery=discoveryDetails(sources,brandName);
  const signals = [];
  if (matchingRecord) signals.push('The brand name matches a brand already registered in this workspace.');
  if (domainMatches) signals.push('The claimed domain matches the official domain stored in this workspace.');
  if (website?.brandMentioned) signals.push('The claimed website contains the submitted brand name.');
  if (sources.length) signals.push(`${sources.length} public web references were found.`);
  let status='needs_proof',confidence=20;
  if (domainMatches && website?.brandMentioned) { status='verified'; confidence=95; }
  else if (domainMatches || (matchingRecord && website?.brandMentioned)) { status='likely_match'; confidence=70; }
  else if (domain && website && !website.brandMentioned && sources.length) { status='conflicting'; confidence=35; }
  const summary = status==='verified' ? 'Ownership signals match the brand reference and official domain stored in this workspace.' : status==='likely_match' ? 'Several identity signals match, but additional domain ownership proof is recommended.' : status==='conflicting' ? 'Public evidence was found, but the claimed website does not clearly support the ownership claim.' : 'Public references alone cannot prove ownership. Add the official domain to the brand record and verify control of that domain.';
  return BrandVerification.create({ organizationId:user.organizationId, requestedBy:user.id, brandName, claimedDomain:domain, status, confidence, summary, signals, sources, appCandidates:apps.items, providerStatus:[{provider:'Apple App Store',status:apps.status},{provider:'YouTube',status:youtube.status},{provider:'Public web search',status:'connected'}], ...discovery });
}
