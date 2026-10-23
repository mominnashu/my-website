import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, ArrowUpRight, ArrowRight, Users, Building2, MessageSquare, Smartphone, Link, Check, ScanLine, ChevronDown, Menu, X, FileSearch, CircleCheck, Clock3, GraduationCap, BriefcaseBusiness, LockKeyhole, Layers3 } from 'lucide-react';
import PricingSection from '../components/PricingSection';
import './LandingPage.css';

export const services = [
  { id: 'social_profile', title: 'Social accounts', desc: 'Check a profile that may be impersonating a person or brand.', input: 'Full profile screenshot with handle, posts, followers and following.', icon: Users },
  { id: 'brand_page', title: 'Brand pages', desc: 'Compare a suspicious page with your official brand details.', input: 'Page screenshot showing its name and full URL. Add official brand details once in your workspace.', icon: Building2 },
  { id: 'scam_text', title: 'Messages', desc: 'Review suspicious messages, offers and requests for personal information.', input: 'Paste the complete message in English, or upload a clear screenshot.', icon: MessageSquare },
  { id: 'mobile_app', title: 'Mobile apps', desc: 'Check an app listing against your official app and developer details.', input: 'App listing screenshot with name, package ID and labelled developer. Add official brand details once in your workspace.', icon: Smartphone },
  { id: 'url', title: 'Website links', desc: 'Look for warning signs in a suspicious website address.', input: 'Paste a complete HTTP or HTTPS link, or upload a screenshot with a readable full URL.', icon: Link },
];
export function serviceName(id) { return services.find(s => s.id === id)?.title || 'Evidence check'; }
export function socialProfileOutcome(d) {
  if (d?.detectorType !== 'social_profile') return null;
  const verdict = String(d?.verdict || '').toLowerCase();
  if (verdict.includes('unavailable')) return 'Check could not finish';
  if (verdict.includes('fake') || verdict.includes('impersonat')) return 'Fake profile';
  if (verdict.includes('real') || verdict.includes('genuine') || verdict.includes('authentic') || verdict.includes('legitimate') || verdict.includes('no issue')) return 'Real profile';
  return Number(d?.riskScore) >= 50 ? 'Fake profile' : 'Real profile';
}
function plainLanguageOutcome(d) {
  const verdict = String(d?.verdict || '').toLowerCase();
  const riskBand = String(d?.riskBand || '').toLowerCase();
  const labels = {
    brand_page: verdict.includes('impersonat') ? 'Likely brand impersonation' : verdict.includes('suspicious') ? 'Suspicious brand page' : verdict.includes('review') ? 'Brand page needs review' : verdict.includes('no issue') || verdict.includes('legitimate') || verdict.includes('authentic') ? 'No impersonation found' : null,
    scam_text: verdict.includes('scam') || verdict.includes('phishing') ? 'Scam message' : verdict.includes('legitimate') ? 'Legitimate message' : verdict.includes('review') || verdict.includes('suspicious') ? 'Message needs review' : null,
    mobile_app: verdict.includes('impersonat') || verdict.includes('fake') ? 'Likely fake app' : verdict.includes('suspicious') ? 'Suspicious app' : verdict.includes('review') ? 'App needs review' : verdict.includes('legitimate') || verdict.includes('no issue') ? 'Legitimate app' : null,
    url: riskBand === 'critical' || riskBand === 'high' ? 'High risk detected' : riskBand === 'medium' ? 'Risk detected — use caution' : riskBand === 'low' ? 'Risk not detected' : verdict.includes('phishing') || verdict.includes('high risk') ? 'High risk detected' : verdict.includes('suspicious') || verdict.includes('review') ? 'Risk detected — use caution' : verdict.includes('legitimate') || verdict.includes('low risk') || verdict.includes('no issue') ? 'Risk not detected' : null,
  };
  return labels[d?.detectorType] || null;
}
export function findingTitle(d) {
  const profileOutcome = socialProfileOutcome(d);
  if (profileOutcome) return profileOutcome;
  if (d?.verdict === 'Detector Unavailable') return 'Check could not finish';
  return plainLanguageOutcome(d) || d?.verdict || 'Result unavailable';
}
const examples = {
  social_profile: { subject: '@yourbrand_helpdesk', caption: 'Social account', finding: 'An account using a similar identity', detail: 'Review the handle and profile against the original account.' },
  brand_page: { subject: 'Your Brand · Customer Care', caption: 'Brand page', finding: 'A page claiming to represent your brand', detail: 'Compare the page address with your official brand details.' },
  scam_text: { subject: '“Send your OTP to unlock your account”', caption: 'Message', finding: 'A request for sensitive information', detail: 'Verify the sender before replying or sharing information.' },
  mobile_app: { subject: 'Your Brand Rewards', caption: 'App listing', finding: 'An unfamiliar app publisher', detail: 'Check the package and developer against your official listing.' },
  url: { subject: 'yourbrand-support.example', caption: 'Website link', finding: 'A website address that needs a closer look', detail: 'Compare the full address with your official website.' },
};
const faqs = [
  ['Who can use RiskProtect?', 'Students, independent professionals, and organizations can create a workspace. Choose a plan based on the number of evidence checks you need each month.'],
  ['What can I check?', 'Check social accounts, brand pages, messages, mobile app listings, and website links. Paste message text or a website link directly, or upload a clear screenshot. Brand page and app checks also need your official brand details.'],
  ['How does the free trial work?', 'Every paid plan starts with a three-day trial, limited to 25 checks in total. Students can choose the free plan, Student Starter for ₹99, or Student Plus for ₹199 after the trial. No payment is collected during the trial.'],
  ['Can I ask someone to review a result?', 'Yes. Send a finding with a note from your workspace. The RiskProtect platform team can review your request, respond, and update its status. You can follow the response in Review requests.'],
  ['Does a result confirm fraud or block a website?', 'A result highlights potential warning signs to help you decide what to review. Verify the original source before taking action. RiskProtect does not currently remove content or block websites.'],
];
function ProductPreview({ selected, organization }) {
  const example = examples[selected];
  const Icon = services.find(s => s.id === selected).icon;
  return <div className="rp-preview-shell">
    <div className="rp-preview-top"><div className="rp-window-dots"><i/><i/><i/></div><span><LockKeyhole size={11}/> workspace.riskprotect</span><span className="rp-demo-label">PRODUCT PREVIEW · SAMPLE DATA</span></div>
    <div className="rp-preview-body">
      <aside className="rp-preview-sidebar"><span className="rp-preview-logo"><ShieldCheck size={19}/> RiskProtect</span><small>{organization ? 'TEAM WORKSPACE' : 'YOUR WORKSPACE'}</small><span><Layers3 size={14}/> Overview</span><span className="rp-preview-active"><ScanLine size={14}/> Check evidence</span><span><FileSearch size={14}/> Findings</span><span><MessageSquare size={14}/> Review requests</span><div className="rp-preview-account"><span>{organization ? 'AC' : 'JD'}</span><div>{organization ? 'Acme workspace' : 'My workspace'}<small>{organization ? 'Organization admin' : 'Professional'}</small></div></div></aside>
      <div className="rp-preview-main"><div className="rp-preview-heading"><div><span className="rp-micro-label">A CLEARER NEXT STEP</span><h3>From suspicious to understood.</h3></div><span className="rp-preview-status"><i/> Evidence checked</span></div><div key={selected} className="rp-preview-content"><div className="rp-evidence-card"><span className="rp-evidence-type"><Icon size={15}/>{example.caption}</span><div className="rp-evidence-document"><div className="rp-doc-avatar"><Icon size={26}/></div><strong>{example.subject}</strong><span>{example.finding}</span><div className="rp-document-lines"><i/><i/><i/></div><div className="rp-scan-line"/></div><span className="rp-evidence-safe"><LockKeyhole size={12}/> Checked securely in your workspace</span></div><div className="rp-finding-card"><div className="rp-finding-icon"><ShieldCheck size={22}/></div><span className="rp-micro-label">YOUR FINDING</span><h4>Review recommended</h4><p>{example.detail}</p><div className="rp-preview-next"><span><Check size={14}/> Finding saved</span><span><Check size={14}/> Ready for your review</span></div><div className="rp-preview-review"><MessageSquare size={15}/><div>Need a second look?<small>Send the finding to the platform team.</small></div><ArrowUpRight size={16}/></div></div></div></div>
    </div>
  </div>;
}
export default function LandingPage({ onStart, onSignIn }) {
  const [selected, setSelected] = useState('social_profile');
  const [organization, setOrganization] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const rootRef = useRef(null);
  const start = () => onStart(organization ? 'organization' : 'professional');
  const navigateTo = (event, selector) => {
    event.preventDefault();
    setMenuOpen(false);
    const target = selector === '#' ? rootRef.current : rootRef.current?.querySelector(selector);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  useEffect(() => {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('rp-visible'); observer.unobserve(entry.target); } }), { threshold: 0.12 });
    rootRef.current?.querySelectorAll('.rp-reveal').forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, []);
  return <div className="rp-site" ref={rootRef}>
    <header className="rp-header"><div className="rp-nav-wrap"><a className="rp-logo" href="#" onClick={event => navigateTo(event, '#')}><span><ShieldCheck size={23}/></span>Risk<span className="rp-logo-accent">Protect</span></a><nav className={menuOpen ? 'rp-navigation is-open' : 'rp-navigation'} aria-label="Main navigation">{[['#features', 'Features'], ['#workflow', 'How it works'], ['#pricing', 'Pricing'], ['#faq', 'FAQ']].map(([href, title]) => <a key={href} href={href} onClick={event => navigateTo(event, href)}>{title}</a>)}</nav><div className="rp-nav-actions"><button className="rp-button rp-button-outline" onClick={onSignIn}>Sign in</button><button className="rp-button rp-button-white" onClick={start}>Get started <ArrowUpRight size={15}/></button><button className="rp-menu-button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button></div></div></header>
    <main>
      <section className="rp-hero"><div className="rp-hero-glow" aria-hidden="true"/><div className="rp-hero-copy">
        <div className="rp-audience-toggle"><span className={!organization ? 'is-active' : ''}>FOR INDIVIDUALS</span><button role="switch" aria-label="Show organization workspace" aria-checked={organization} onClick={() => setOrganization(!organization)}><span/></button><span className={organization ? 'is-active' : ''}>FOR ORGANIZATIONS</span></div>
        <div className="rp-hero-badge"><span/> Digital risk protection, made simple <ArrowUpRight size={13}/></div>
        <h1>Spot the risk.<br/><span>Protect your trust.</span></h1><p key={String(organization)}>{organization ? 'Give your team one place to check brand impersonation, review suspicious evidence, and keep every report moving.' : 'A strange message. An unfamiliar link. A profile that feels off. Check the warning signs before you make your next move.'}</p>
        <div className="rp-hero-actions"><button className="rp-button rp-button-orange rp-main-cta" onClick={start}>Start protecting {organization ? 'your brand' : 'yourself'} <ArrowRight size={18}/></button><a className="rp-hero-secondary" href="#features">Explore the platform <ArrowUpRight size={16}/></a></div><div className="rp-hero-assurances"><span><Check size={13}/> 3-day trial on paid plans</span><span><Check size={13}/> No card required</span></div>
      </div><div className="rp-product-container"><div className="rp-service-picker" aria-label="Preview a protection service"><span>What would you like to check?</span><div>{services.map(({ id, title, icon: Icon }) => <button key={id} aria-pressed={selected === id} className={selected === id ? 'is-selected' : ''} onClick={() => setSelected(id)}><Icon size={14}/>{title}</button>)}</div></div><ProductPreview selected={selected} organization={organization}/></div></section>
      <section className="rp-audience-strip rp-reveal"><span>BUILT FOR EVERY WAY YOU WORK</span><div><span><GraduationCap/> Students</span><span><BriefcaseBusiness/> Professionals</span><span><Building2/> Organizations</span></div></section>
      <section id="features" className="rp-section rp-features rp-reveal"><div className="rp-section-heading"><span className="rp-kicker">FIVE SERVICES. ONE CONNECTED WORKSPACE.</span><h2>Less uncertainty.<br/><span>More confidence.</span></h2><p>Make sense of suspicious activity with clear findings and a practical next step.</p></div><div className="rp-feature-grid">
        <article className="rp-feature-card"><div className="rp-feature-icon"><ScanLine/></div><h3>Check what looks suspicious</h3><p>Paste a message or website link. Upload screenshots of profiles, pages, and app listings.</p><div className="rp-mini-services">{services.slice(0, 4).map(({ title, icon: Icon }) => <span key={title}><Icon size={14}/>{title}<Check size={12}/></span>)}</div></article>
        <article className="rp-feature-card"><div className="rp-feature-icon"><ShieldCheck/></div><h3>Understand the finding</h3><p>See a readable result and review priority. Save your findings and return to the evidence when needed.</p><div className="rp-mini-finding"><div className="rp-sample-caption">EXAMPLE FINDING</div><ShieldCheck size={34}/><strong>Review recommended</strong><span>Check the source before taking action</span><div><i/><i/><i/><i/><i/></div></div></article>
        <article className="rp-feature-card"><div className="rp-feature-icon"><MessageSquare/></div><h3>Keep every review moving</h3><p>Ask the platform team for a second review, add context, and track the response in your workspace.</p><div className="rp-mini-timeline"><span><CircleCheck size={17}/><div>Request submitted<small>Your evidence stays attached</small></div></span><span><Clock3 size={17}/><div>Under review<small>Platform team checks your request</small></div></span><span><CircleCheck size={17}/><div>Response received<small>See the status and reply</small></div></span></div></article>
      </div></section>
      <section id="workflow" className="rp-section rp-workflow rp-reveal"><div className="rp-section-heading"><span className="rp-kicker">FROM A QUESTION TO A CLEARER NEXT STEP</span><h2>How <span>RiskProtect</span> works</h2><p>A simple workflow for your own safety or your organization’s brand.</p></div><div className="rp-workflow-grid">{[['01', 'Make it your workspace', 'Choose student, professional, or organization access. Add official brand details when you need them.'], ['02', 'Bring the evidence', 'Choose a service. Paste your message or link, or upload a screenshot with the required information.'], ['03', 'Review the finding', 'Read the result and priority. Check the original source and decide what deserves attention.'], ['04', 'Follow it through', 'Save an investigation or send a review request. Keep notes and track the platform team’s reply.']].map(([n, title, description]) => <article key={n}><span>{n}</span><h3>{title}</h3><p>{description}</p></article>)}</div><div className="rp-workflow-cta"><div><h3>A small check can make a big difference.</h3><p>Put a clear review process between suspicion and your next action.</p></div><button className="rp-button rp-button-orange" onClick={start}>Create your workspace <ArrowRight size={17}/></button></div></section>
      <PricingSection onSelect={onStart}/>
      <section className="rp-section rp-brand-section rp-reveal"><div><span className="rp-kicker">FOR THE PEOPLE BEHIND THE BRAND</span><h2>Your brand.<br/><span>Your workspace.</span></h2><p>Keep official domains, accounts, and app details together. Review findings in your company workspace and send the ones that need help to the platform team.</p><div className="rp-brand-checks"><span><Check size={16}/> Official brand details as your reference</span><span><Check size={16}/> Findings and investigations in one place</span><span><Check size={16}/> Review requests with a visible status</span></div><button className="rp-button rp-button-outline" onClick={() => onStart('organization')}>Explore organization access <ArrowUpRight size={16}/></button></div><div className="rp-review-demo"><div className="rp-review-demo-head"><span><ShieldCheck size={18}/> Acme workspace</span><span className="rp-sample-caption">ILLUSTRATIVE EXAMPLE</span></div><span className="rp-micro-label">REVIEW REQUEST</span><h3>A suspicious support account</h3><div className="rp-report-note">“This profile is using our company name. Please review the finding.”</div><div className="rp-report-progress"><span><Check size={12}/> Submitted</span><i/><span className="current"><Clock3 size={12}/> Reviewing</span><i/><span>Resolved</span></div><div className="rp-owner-response"><div>RP</div><p><strong>RiskProtect platform team</strong>Your team can see the response and follow the request’s status.</p></div><div className="rp-demo-footer"><LockKeyhole size={13}/> Your company’s request, with all the context.</div></div></section>
      <section id="faq" className="rp-section rp-faq rp-reveal"><div className="rp-section-heading"><span className="rp-kicker">A LITTLE MORE CLARITY</span><h2>Frequently asked <span>questions</span></h2><p>What to know before your first check.</p></div><div className="rp-faq-list">{faqs.map(([question, answer], index) => <article className={openFaq === index ? 'is-open' : ''} key={question}><h3><button id={'faq-question-' + index} aria-expanded={openFaq === index} aria-controls={'faq-answer-' + index} onClick={() => setOpenFaq(openFaq === index ? null : index)}>{question}<ChevronDown size={18}/></button></h3><div className="rp-faq-answer" id={'faq-answer-' + index} aria-labelledby={'faq-question-' + index} aria-hidden={openFaq !== index}><div><p>{answer}</p></div></div></article>)}</div></section>
      <section className="rp-final-cta rp-reveal"><div className="rp-final-glow" aria-hidden="true"/><span className="rp-kicker">YOUR NEXT STEP STARTS HERE</span><h2>Stay curious.<br/>Stay cautious. <span>Stay protected.</span></h2><p>Start checking suspicious activity with RiskProtect.</p><button className="rp-button rp-button-orange" onClick={start}>Get started for free <ArrowRight size={18}/></button><small>Free student plan · Three-day trial on paid plans</small></section>
    </main><footer className="rp-footer"><div className="rp-footer-main"><div><a className="rp-logo" href="#"><span><ShieldCheck size={23}/></span>Risk<span className="rp-logo-accent">Protect</span></a><p>Clarity for the people protecting<br/>their identity, their work, and their brand.</p></div><div><strong>Platform</strong><a href="#features">Our services</a><a href="#workflow">How it works</a><a href="#pricing">Plans and pricing</a></div><div><strong>Get started</strong><button onClick={() => onStart('student')}>For students</button><button onClick={() => onStart('professional')}>For professionals</button><button onClick={() => onStart('organization')}>For organizations</button></div><div><strong>Your workspace</strong><button onClick={onSignIn}>Sign in</button><a href="#faq">Common questions</a><a href="#features">What you can check</a></div></div><div className="rp-footer-bottom"><span>© {new Date().getFullYear()} RiskProtect. All rights reserved.</span><span>Evidence checks support your judgment. Verify before taking action.</span></div></footer>
  </div>;
}

