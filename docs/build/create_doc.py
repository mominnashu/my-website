from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from pathlib import Path
from PIL import Image

ROOT=Path(r'H:\RiskProtect mvp')
OUT=ROOT/'docs/output/RiskProtect_Product_and_Technical_Documentation.docx'
ORANGE='FF7900'; BLACK='171717'; DARK='252525'; GREY='6B6B6B'; LIGHT='F4F2EF'; BORDER='D9D9D9'
doc=Document()
sec=doc.sections[0]
sec.top_margin=Inches(.72); sec.bottom_margin=Inches(.68); sec.left_margin=Inches(.78); sec.right_margin=Inches(.78)
styles=doc.styles
styles['Normal'].font.name='Aptos'; styles['Normal']._element.rPr.rFonts.set(qn('w:eastAsia'),'Aptos'); styles['Normal'].font.size=Pt(9.5); styles['Normal'].font.color.rgb=RGBColor.from_string(BLACK)
styles['Normal'].paragraph_format.space_after=Pt(6); styles['Normal'].paragraph_format.line_spacing=1.15
for name,size in [('Title',30),('Heading 1',20),('Heading 2',14),('Heading 3',11)]:
    st=styles[name]; st.font.name='Aptos Display'; st._element.rPr.rFonts.set(qn('w:eastAsia'),'Aptos Display'); st.font.size=Pt(size); st.font.bold=True; st.font.color.rgb=RGBColor(0,0,0); st.paragraph_format.space_before=Pt(14); st.paragraph_format.space_after=Pt(7); st.paragraph_format.keep_with_next=True
styles['Title'].paragraph_format.space_before=Pt(0)
if 'Caption' in styles:
    styles['Caption'].font.name='Aptos'; styles['Caption'].font.size=Pt(8); styles['Caption'].font.italic=True; styles['Caption'].font.color.rgb=RGBColor.from_string(GREY)

# Header/footer
header=sec.header.paragraphs[0]; header.text='RISKPROTECT  PRODUCT AND TECHNICAL DOCUMENTATION'; header.style=styles['Normal']; header.alignment=WD_ALIGN_PARAGRAPH.RIGHT
for run in header.runs: run.font.size=Pt(7); run.font.bold=True; run.font.color.rgb=RGBColor.from_string(GREY)
footer=sec.footer.paragraphs[0]; footer.alignment=WD_ALIGN_PARAGRAPH.CENTER
run=footer.add_run('RiskProtect  |  Internal product reference  |  '); run.font.size=Pt(7); run.font.color.rgb=RGBColor.from_string(GREY)
fld=OxmlElement('w:fldSimple'); fld.set(qn('w:instr'),'PAGE'); footer._p.append(fld)

def shade(cell, fill):
    tcPr=cell._tc.get_or_add_tcPr(); shd=tcPr.find(qn('w:shd'))
    if shd is None: shd=OxmlElement('w:shd'); tcPr.append(shd)
    shd.set(qn('w:fill'),fill)
def margins(cell,top=90,start=110,bottom=90,end=110):
    tc=cell._tc.get_or_add_tcPr(); mar=tc.first_child_found_in('w:tcMar')
    if mar is None: mar=OxmlElement('w:tcMar'); tc.append(mar)
    for side,val in [('top',top),('start',start),('bottom',bottom),('end',end)]:
        node=mar.find(qn('w:'+side))
        if node is None: node=OxmlElement('w:'+side); mar.append(node)
        node.set(qn('w:w'),str(val)); node.set(qn('w:type'),'dxa')
def borders(table,color=BORDER):
    tblPr=table._tbl.tblPr; tb=tblPr.find(qn('w:tblBorders'))
    if tb is None: tb=OxmlElement('w:tblBorders'); tblPr.append(tb)
    for edge in ('top','left','bottom','right','insideH','insideV'):
        el=OxmlElement('w:'+edge); el.set(qn('w:val'),'single'); el.set(qn('w:sz'),'5'); el.set(qn('w:color'),color); tb.append(el)
def table(headers,rows,widths=None):
    t=doc.add_table(rows=1, cols=len(headers)); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.autofit=False; borders(t)
    for i,h in enumerate(headers):
        c=t.rows[0].cells[i]; c.text=h; shade(c,DARK); margins(c); c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
        for r in c.paragraphs[0].runs: r.font.bold=True; r.font.color.rgb=RGBColor(255,255,255); r.font.size=Pt(8.5)
    for ri,row in enumerate(rows):
        cells=t.add_row().cells
        for i,v in enumerate(row):
            cells[i].text=str(v); margins(cells[i]); cells[i].vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            if ri%2: shade(cells[i],'FAF9F7')
            for p in cells[i].paragraphs:
                p.paragraph_format.space_after=Pt(0); p.paragraph_format.line_spacing=1.05
                for r in p.runs: r.font.size=Pt(8.2)
    if widths:
        for row in t.rows:
            for i,w in enumerate(widths): row.cells[i].width=Inches(w)
    doc.add_paragraph().paragraph_format.space_after=Pt(2)
    return t
def bullet(text,level=0):
    p=doc.add_paragraph(style='List Bullet' if level==0 else 'List Bullet 2'); p.paragraph_format.space_after=Pt(3); p.add_run(text); return p
def numbered(text):
    p=doc.add_paragraph(style='List Number'); p.paragraph_format.space_after=Pt(3); p.add_run(text); return p
def para(text,bold_lead=None):
    p=doc.add_paragraph()
    if bold_lead and text.startswith(bold_lead):
        p.add_run(bold_lead).bold=True; p.add_run(text[len(bold_lead):])
    else:p.add_run(text)
    return p
def picture(path,caption,width=6.8):
    path=ROOT/path
    if path.exists():
        p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.keep_with_next=True
        p.add_run().add_picture(str(path),width=Inches(width))
        c=doc.add_paragraph(caption,style='Caption'); c.alignment=WD_ALIGN_PARAGRAPH.CENTER

def page(): doc.add_page_break()

# Cover
p=doc.add_paragraph(); p.paragraph_format.space_before=Pt(38); p.alignment=WD_ALIGN_PARAGRAPH.CENTER
r=p.add_run('RiskProtect'); r.font.name='Aptos Display'; r.font.size=Pt(44); r.font.bold=True; r.font.color.rgb=RGBColor.from_string(BLACK)
r2=p.add_run(' ●'); r2.font.size=Pt(28); r2.font.color.rgb=RGBColor.from_string(ORANGE)
t=doc.add_paragraph('Product and Technical Documentation',style='Title'); t.alignment=WD_ALIGN_PARAGRAPH.CENTER
s=doc.add_paragraph('SaaS product scope, workflows, dashboards, subscriptions, platform operations and browser protection'); s.alignment=WD_ALIGN_PARAGRAPH.CENTER
for run in s.runs: run.font.size=Pt(13); run.font.color.rgb=RGBColor.from_string(GREY)
doc.add_paragraph('\n')
picture(Path('docs/ui/landing-redesign.jpg'),'RiskProtect public product experience',6.9)
p=doc.add_paragraph('Version 1.1  |  24 October 2026'); p.alignment=WD_ALIGN_PARAGRAPH.CENTER
for r in p.runs:r.font.size=Pt(9);r.font.color.rgb=RGBColor.from_string(GREY)

page(); doc.add_heading('Document purpose',0)
para('This document explains RiskProtect as a complete software as a service product. It gives business owners, product teams, developers, reviewers and operators one reference for what the product does, who uses it, how evidence moves through the system, how subscriptions control usage, and how the Chrome extension connects to the same workspace.')
para('The product helps students, professionals and organizations check suspicious online evidence before they act. Users can paste message text or website links, upload screenshots for supported evidence types, read a plain-language result, save investigations and request a second review. The platform owner manages companies, plans, reports, statuses and activity from the super-admin workspace.')
doc.add_heading('How to use this document',1)
bullet('Business readers can start with Product scope, Audiences, Business model and Roadmap.')
bullet('Product and design teams can use the workflows, output language and dashboard sections.')
bullet('Engineering teams can use Architecture, Data, API integration, deployment and verification sections.')
bullet('Operations teams can use Super-admin operations, incident handling and release checklists.')
doc.add_heading('Contents',1)
for item in ['1 Product scope','2 Audiences and access','3 Account creation and free trial','4 Audience dashboards','5 Evidence checking workflow','6 Protection services','7 Findings, alerts and investigations','8 Super-admin operations','9 Subscription business model','10 System architecture','11 Data and API integration','12 Security and privacy','13 Chrome extension','14 Deployment and configuration','15 Testing and release checks','16 Roadmap and operating decisions','17 Glossary']:
    bullet(item)

page(); doc.add_heading('1 Product scope',0)
doc.add_heading('Product objective',1)
para('RiskProtect gives people and teams a controlled place to assess suspicious digital evidence. It combines evidence submission, server-side processing, readable outcomes, saved findings, alerts, investigations and human review requests in one account-based product.')
doc.add_heading('Current product capabilities',1)
for x in ['Public landing page with audience-specific onboarding and pricing','Email and password registration and sign-in','Three-day free trial for paid plans with a total limit of 25 checks','Separate workspaces for students, professionals and organizations','Evidence checks for social accounts, brand pages, messages, mobile apps and website links','Server-side screenshot reading and model processing','Plain-language findings with risk level and score','Alerts for higher-risk findings','Saved investigations with notes and attached findings','Second-review requests handled by the platform owner','Super-admin visibility into registered workspaces, plans, statuses, logs and reports','Chrome extension that checks the active tab and external links using the same account and backend']:
    bullet(x)
doc.add_heading('Product boundaries',1)
para('RiskProtect provides an automated assessment and a review workflow. A result supports a decision but does not prove fraud, remove online content, contact external platforms, or guarantee that a destination is safe. Users should verify important decisions through an official channel.')

page(); doc.add_heading('2 Audiences and access',0)
table(['Audience','Primary need','Workspace emphasis','Typical access'],[
['Student','Check links, profiles and messages used for study or personal activity','Simple safety language, personal checks, affordable limits','Workspace administrator for a personal account'],
['Professional','Protect independent work, reputation and client communication','Identity references, priority findings and saved investigations','Workspace administrator'],
['Organization','Coordinate brand protection and team response','Team checks, protected brands, alerts, investigations and review requests','Company administrator'],
['Platform owner','Operate the RiskProtect product','Workspace directory, reports, plan and status controls, logs and service health','Super administrator']], [1.0,1.8,2.65,1.5])
doc.add_heading('Role rules',1)
bullet('Every customer account belongs to one workspace and sees data scoped to that workspace.')
bullet('Customer administrators can use evidence checks, findings, alerts, investigations, brands, review requests and billing screens.')
bullet('The super administrator can review all registered workspaces, update subscriptions and access status, respond to reports and inspect activity logs.')
bullet('Model internals and algorithm names stay outside the customer interface. Customers see service names, risk language and recommended actions.')

page(); doc.add_heading('3 Account creation and free trial',0)
doc.add_heading('Registration sequence',1)
for x in ['Choose Student, Professional or Organization.','Enter the account holder name and workspace or organization name.','Choose a billing preference and an available plan.','Start a paid plan with a three-day free trial. No payment is collected during registration.','Use up to 25 checks during the trial.','After the trial, select and activate a paid plan to continue.']:
    numbered(x)
picture(Path('docs/ui/light-student-registration.png'),'Student registration with trial and plan selection',4.7)
doc.add_heading('Trial behavior',1)
table(['Condition','System behavior'],[
['Paid plan selected','Creates a trialing subscription for three days with a maximum of 25 checks'],
['Student Free selected','Creates an active free subscription with 10 checks each month and no trial'],
['Trial limit reached','Stops new evidence checks and directs the user to Plan and usage'],
['Trial expires','Shows a plan recommendation and requires plan activation'],
['Plan becomes active','Applies the plan monthly allowance and selected billing cycle']], [2.0,5.0])

page(); doc.add_heading('4 Audience dashboards',0)
para('The dashboard uses the audience saved on the workspace. The underlying findings and counts remain consistent, while headings, guidance, setup actions and metric labels match the user’s reason for using RiskProtect.')
doc.add_heading('Student dashboard',1)
bullet('Focuses on online study and personal safety.')
bullet('Highlights completed checks, items needing attention, saved investigations and review requests.')
bullet('Uses direct guidance before clicking, replying, paying or sharing personal information.')
picture(Path('docs/ui/dashboard-student.png'),'Student workspace dashboard',6.9)
page(); doc.add_heading('Professional dashboard',0)
bullet('Focuses on suspicious outreach, client messages, links and identity impersonation.')
bullet('Highlights professional evidence checks, priority findings, active investigations and protected identities.')
bullet('Prompts the user to register professional websites, profiles and apps when a trusted reference is needed.')
picture(Path('docs/ui/dashboard-professional.png'),'Professional workspace dashboard',6.9)
page(); doc.add_heading('Organization dashboard',0)
bullet('Focuses on team checks, brand risk visibility and coordinated response.')
bullet('Highlights priority findings, investigations and protected brands.')
bullet('Prompts administrators to register official brand details and move findings through review.')
picture(Path('docs/ui/dashboard-organization.png'),'Organization workspace dashboard',6.9)

page(); doc.add_heading('5 Evidence checking workflow',0)
for x in ['The user chooses the evidence type.','The interface explains exactly what text, link or screenshot to provide.','The frontend sends the evidence to the existing workspace scan endpoint.','The backend validates the account, plan, remaining allowance, input type and file content.','Screenshot text extraction and prediction run on the server. Raw model features remain private.','The backend stores a detection record and creates an alert when the risk is High or Critical.','The frontend displays a plain-language outcome, risk level, score and limitation.','The user may save an investigation or request a second review.']:
    numbered(x)
doc.add_heading('Prediction progress experience',1)
para('When a user runs a check, the interface covers the workspace with a transparent black layer and an animated orange dot indicator. It states that the evidence is being checked and prevents duplicate actions until the backend responds.')
doc.add_heading('Result language',1)
table(['Risk level','Website link wording','Expected action'],[
['Low','Risk not detected','The user may continue but should still verify important actions.'],
['Medium','Risk detected  Use caution','The user should inspect the source and may request another review.'],
['High','High risk detected','The product recommends stopping and investigating.'],
['Critical','High risk detected','The product blocks the extension navigation and prioritizes review.']], [1.15,2.1,3.75])

page(); doc.add_heading('6 Protection services',0)
table(['Service','Accepted evidence','Customer result','Important requirement'],[
['Social accounts','Complete profile screenshot','Real profile or Fake profile with risk level','Show handle, posts, followers and following.'],
['Brand pages','Page screenshot','Brand page risk result','Register an official brand and show page name and full URL.'],
['Messages','Pasted message text or screenshot','Message risk result','Include the complete message and requested action.'],
['Mobile apps','App listing screenshot','App listing risk result','Register an official brand and show app name, package ID and labelled developer.'],
['Website links','Pasted HTTP or HTTPS link or screenshot','Risk not detected, caution, or high risk detected','Use a complete public web address.']], [1.2,1.6,1.9,2.4])
doc.add_heading('Input safeguards',1)
bullet('Accepted screenshot formats are PNG, JPEG and WebP with a maximum size of 15 MB.')
bullet('The backend checks the actual file signature rather than trusting the browser MIME label.')
bullet('Messages must contain between 5 and 5,000 characters.')
bullet('Links must use HTTP or HTTPS, contain a hostname, omit embedded credentials and remain within 2,048 characters.')
bullet('Brand page and mobile app checks automatically use the first active registered brand when the user does not choose one.')

page(); doc.add_heading('7 Findings alerts and investigations',0)
doc.add_heading('Findings',1)
para('Each completed check creates a finding with the evidence type, readable outcome, risk score, risk level, limitations and creation time. Customer lists exclude private model fields and remain scoped to the signed-in workspace.')
doc.add_heading('Alerts',1)
para('High and Critical results create alerts automatically. Administrators can acknowledge alerts, change their status and open an investigation.')
doc.add_heading('Investigations',1)
para('An investigation groups related findings, a title, a description, priority, status and notes. It gives customers a durable record of what they reviewed and what action they took.')
doc.add_heading('Review requests',1)
para('A customer can submit a finding with a written question. The super administrator sees the originating workspace, evidence summary and request, then changes the status from Submitted to Reviewing or Resolved and records an owner note.')

page(); doc.add_heading('8 Super admin operations',0)
para('The product owner uses the super-admin workspace to oversee customers without exposing one customer’s data to another.')
picture(Path('docs/ui/light-super-admin.png'),'Super-admin workspace showing company reports and registered workspaces',5.55)
table(['Capability','Purpose'],[
['Platform overview','See reports and registered workspace activity.'],
['Company reports','Review customer requests by company and record a response.'],
['Workspace directory','See audience, plan, usage and access status.'],
['Plan control','Assign a plan and set Trial, Active, Expired, Suspended or Pending.'],
['Access control','Suspend or restore a workspace.'],
['Activity logs','Inspect registrations, subscription changes and review actions.'],
['Service status','Confirm API, database and model service availability.']], [2.0,5.0])

page(); doc.add_heading('9 Subscription business model',0)
picture(Path('docs/ui/light-pricing-student-plans.png'),'Pricing page with separate audience plans',4.0)
table(['Plan','Price per month','Monthly checks','Seats','Trial'],[
['Student Free','₹0','10','1','No trial'],['Student Starter','₹99','40','1','3 days and 25 total checks'],['Student Plus','₹199','100','1','3 days and 25 total checks'],['Professional','₹499','100','1','3 days and 25 total checks'],['Professional Plus','₹999','500','Plan configuration','3 days and 25 total checks'],['Organization','₹4,999','2,500','25','3 days and 25 total checks'],['Organization Scale','₹9,999','10,000','Plan configuration','3 days and 25 total checks']], [1.7,1.15,1.25,.8,2.1])
doc.add_heading('Billing rules',1)
para('Paid plans support monthly and yearly billing preferences. Registration does not collect payment. A billing-preference change keeps active access and used-check count, while a paid-plan change requires manual activation unless platform rules mark it active. Monthly usage renews only for active plan periods, and a trial does not refill at a month boundary.')

page(); doc.add_heading('10 System architecture',0)
table(['Layer','Responsibility','Current technology'],[
['Web client','Landing page, authentication, dashboards, evidence forms and result presentation','React and Vite'],
['API service','Authentication, authorization, workspace scoping, billing enforcement, evidence orchestration and persistence','Node.js and Express'],
['Database','Users, workspaces, subscriptions, brands, findings, alerts, investigations, reports and audit logs','MongoDB through Mongoose'],
['Prediction service','Receives validated service-specific inputs and returns prediction data','Python service on a separate port'],
['Browser extension','Active-tab checks, link hover checks, warnings and browser blocking','Chrome Manifest V3'],
['Deployment','Static frontend plus separately hosted API, database and prediction service','Vercel configuration for frontend; backend services require independent hosting']], [1.25,3.25,2.3])
doc.add_heading('Runtime flow',1)
for x in ['The browser authenticates with the API and stores a signed token.','The customer submits evidence to the workspace scan route.','The API validates access and allowance before calling the appropriate prediction operation.','The API stores the customer-safe summary and related workflow records.','The frontend or extension receives only the result needed for the user experience.']:
    numbered(x)

page(); doc.add_heading('11 Data and API integration',0)
doc.add_heading('Core records',1)
table(['Record','Key information'],[
['User','Name, email, role, status and workspace reference'],['Workspace','Name, audience, access status, subscription and creator'],['Brand','Official domains, social handles, app packages and developers'],['Finding','Evidence type, source metadata, result, risk score, risk level and owner workspace'],['Alert','Finding reference, severity and workflow status'],['Investigation','Title, description, priority, status, findings and notes'],['Review request','Workspace, finding, customer message, status and owner response'],['Audit log','Actor, workspace, action, resource and timestamp']], [1.55,5.45])
doc.add_heading('Customer-facing API groups',1)
table(['Route group','Purpose'],[
['/api/v1/auth','Register, sign in and read the current account'],['/api/v1/workspace','Run evidence checks, list findings, manage review requests and provide super-admin company data'],['/api/v1/brands','Manage official reference data'],['/api/v1/alerts','List and update alerts'],['/api/v1/cases','Create and manage investigations'],['/api/v1/billing','List plans, read subscriptions and manage owner controls'],['/api/v1/system','Health, service and workspace statistics']], [2.0,5.0])
para('Existing model API contracts remain unchanged. New frontend and extension behavior calls the workspace scan route, which adapts customer input to the existing service methods.')

page(); doc.add_heading('12 Security and privacy',0)
for x in ['JWT authentication protects customer and owner routes.','Server authorization scopes customer findings, reports and brands to the signed-in workspace.','Role checks protect super-admin company and report update operations.','Plan middleware blocks scans after trial expiry or allowance exhaustion.','Screenshot processing occurs on the server, and raw extracted values or model features are not returned to the customer interface.','File content validation reduces the risk of mislabeled uploads.','Audit logs record registration, subscription and report status activity.','The extension reads a destination only when the active tab is checked, a user hovers or focuses an external link, clicks a protected link, or submits a link manually.']:
    bullet(x)
doc.add_heading('Production security actions',1)
bullet('Use HTTPS for the frontend, API and prediction service.')
bullet('Store secrets in the deployment provider rather than source files.')
bullet('Restrict CORS and extension host permissions to approved production domains.')
bullet('Publish a privacy policy and retention policy before public release.')
bullet('Rotate signing secrets and database credentials on an operating schedule.')
bullet('Monitor authentication failures, scan volume, service errors and unusual block-rule activity.')

page(); doc.add_heading('13 Chrome extension',0)
doc.add_heading('Purpose and behavior',1)
para('RiskProtect Link Guard extends the website-link service into Chrome. It uses the same account, subscription allowance and backend result. Version 1.1.0 detects the active tab when the popup opens and prechecks external links after a short hover or keyboard focus.')
table(['Risk result','Extension behavior'],[
['Risk not detected','Shows the result and permits navigation.'],['Risk detected  Use caution','Shows a warning and asks the user before navigation.'],['High risk detected','Adds a browser block rule and opens a dedicated warning page.']], [2.2,4.8])
doc.add_heading('Extension components',1)
bullet('Popup for sign-in, active-tab detection, manual link checking, settings and recent result.')
bullet('Background service worker for API calls, caching, authentication state and dynamic browser rules.')
bullet('Content script for hover, focus and click protection on HTTP and HTTPS pages.')
bullet('Warning page for High and Critical results with a controlled open-once option.')
bullet('Six-hour cache with a maximum of 300 stored URL results to reduce repeat allowance use.')
doc.add_heading('Local installation',1)
for x in ['Open chrome://extensions.','Enable Developer mode.','Choose Load unpacked.','Select the chrome-extension folder that directly contains manifest.json.','Confirm version 1.1.0.','Sign in and refresh existing browser tabs once.']:
    numbered(x)

page(); doc.add_heading('14 Deployment and configuration',0)
doc.add_heading('Local services',1)
table(['Service','Default address','Start location'],[
['Frontend','http://127.0.0.1:5173','frontend'],['Backend API','http://127.0.0.1:5000','backend'],['Prediction service','http://127.0.0.1:8001','ml-service']], [1.5,2.5,3.0])
para('The start_all.bat script starts all three services for local development. The frontend development server proxies /api calls to the backend.')
doc.add_heading('Vercel frontend deployment',1)
para('The root vercel.json installs frontend dependencies, runs the Vite production build, publishes frontend/dist and rewrites browser routes to index.html. The API, database and prediction service require separate hosting. The production frontend must point /api traffic to the deployed backend.')
doc.add_heading('Required production configuration',1)
bullet('Frontend public URL and API base URL')
bullet('Database connection string')
bullet('JWT signing secret and token duration')
bullet('Prediction service base URL and timeouts')
bullet('Approved CORS origins')
bullet('Extension API URL and restricted host permissions')

page(); doc.add_heading('15 Testing and release checks',0)
doc.add_heading('Automated coverage',1)
para('The backend test suite currently covers API health, authentication validation, billing rules, usage limits, workspace access, server-side evidence handling, input validation, customer-safe response summaries and company scoping. The verified suite contains 47 passing tests across six files.')
doc.add_heading('Release checklist',1)
for x in ['Build the frontend production bundle.','Run all backend tests with localhost socket access.','Validate extension JavaScript syntax and manifest file references.','Confirm frontend, backend and prediction service health endpoints return HTTP 200.','Check registration and sign-in text contrast.','Check Student, Professional, Organization and Super-admin dashboards.','Run one valid input through each evidence service.','Confirm High and Critical results create alerts.','Submit and resolve a review request by company.','Check trial expiry and plan-limit responses.','Reload the unpacked extension and verify version 1.1.0.','Check active-tab, hover, click, warning and open-once extension flows.']:
    bullet(x)
doc.add_heading('Result acceptance criteria',1)
bullet('Customer-facing outputs use understandable language and never expose algorithm names or raw features.')
bullet('Website results remain consistent: Risk not detected, Risk detected  Use caution, or High risk detected.')
bullet('All customer records remain scoped to the correct workspace.')
bullet('Model API contracts remain unchanged.')

page(); doc.add_heading('16 Roadmap and operating decisions',0)
table(['Priority','Recommended next work','Reason'],[
['Before production','Deploy backend and prediction service behind HTTPS and connect the Vercel frontend','The current Vercel file publishes only the static frontend.'],['Before payments','Integrate a payment provider and webhook-driven subscription activation','Current activation is manual.'],['Before extension store release','Finalize icons, screenshots, privacy disclosures, support URL and permission justification','Chrome Web Store review requires these materials.'],['Before broad automatic blocking','Measure false positives and define an appeal process','Blocking affects user navigation and trust.'],['Operational maturity','Add monitoring, structured error dashboards, backups and retention rules','The product needs observable and recoverable production services.'],['Team expansion','Add invitations and workspace member roles','Organization plans advertise multiple seats.']], [1.25,3.4,2.35])
doc.add_heading('Decisions already established',1)
bullet('The visual system uses a light default theme with black, white and orange accents.')
bullet('The product serves students, professionals and organizations.')
bullet('The product owner is the super administrator, while registered customers administer their own workspaces.')
bullet('Paid plans start with a three-day trial and a total limit of 25 checks.')
bullet('The customer interface does not name algorithms.')
bullet('The extension starts with Chrome, account sign-in and automatic blocking for higher-risk links.')

page(); doc.add_heading('17 Glossary',0)
table(['Term','Meaning'],[
['Audience','Student, Professional or Organization account category.'],['Workspace','The customer data boundary containing its users, subscription and product records.'],['Finding','A stored result from an evidence check.'],['Risk level','Low, Medium, High or Critical classification used to guide action.'],['Alert','A workflow record created for a higher-risk finding.'],['Investigation','A saved case containing findings, status and notes.'],['Review request','A customer request for the platform owner to inspect a finding.'],['Super administrator','The RiskProtect product owner role with cross-workspace operations.'],['Official brand details','Trusted domains, social handles, app packages and developer names used as references.'],['Trial allowance','Up to 25 checks during the first three days of a paid plan.'],['Monthly allowance','The number of checks available for an active plan period.'],['Dynamic block rule','A Chrome browser rule created for a domain with a High or Critical result.']], [1.75,5.25])

# Keep title and captions with content
for p in doc.paragraphs:
    if p.style.name.startswith('Heading') or p.style.name=='Title': p.paragraph_format.keep_with_next=True

doc.core_properties.title='RiskProtect Product and Technical Documentation'
doc.core_properties.subject='Product, business, architecture and operations reference'
doc.core_properties.author='RiskProtect'
doc.save(OUT)
print(OUT)


