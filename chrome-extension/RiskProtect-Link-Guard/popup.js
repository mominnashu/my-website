const $ = id => document.getElementById(id);
const send = message => new Promise((resolve, reject) => {
  chrome.runtime.sendMessage(message, response => {
    const runtimeError = chrome.runtime.lastError;
    if (runtimeError) return reject(new Error(runtimeError.message || 'RiskProtect extension service is unavailable.'));
    if (!response) return reject(new Error('RiskProtect extension service did not respond. Reload the extension and try again.'));
    if (!response.ok) return reject(new Error(response.error || 'Extension request failed'));
    resolve(response.data);
  });
});
function busy(form, value) { form.querySelectorAll('button,input').forEach(element => element.disabled = value); }
function showMessage(text='') { $('message').textContent = text; }
function showResult(result) { const d=result?.detection;if(!d)return;const label=d.riskBand==='Low'?'RISK NOT DETECTED':d.riskBand==='Medium'?'RISK DETECTED':'HIGH RISK DETECTED';const verdict=d.riskBand==='Low'?'Risk not detected':d.riskBand==='Medium'?'Use caution before opening':'High risk detected — blocked';$('result').hidden=false;$('resultLabel').textContent=label;$('resultVerdict').textContent=verdict;$('resultMeta').textContent=`Risk level: ${d.riskBand} · Score ${d.riskScore}/100${result.cached?' · cached result':''}`; }
const activeTab = () => new Promise((resolve, reject) => chrome.tabs.query({ active: true, currentWindow: true }, tabs => { const error=chrome.runtime.lastError;if(error)reject(new Error(error.message));else resolve(tabs[0]); }));
async function detectCurrentTab(state) { if(!state.token)return;const tab=await activeTab();let current;try{current=new URL(tab?.url||'');}catch{return;}if(!['http:','https:'].includes(current.protocol)||['localhost','127.0.0.1'].includes(current.hostname))return;$('url').value=current.toString();showMessage('Current tab detected. Checking automatically…');try{const result=await send({type:'CHECK_URL',url:current.toString()});showResult(result);showMessage(result.cached?'Current tab checked from saved result.':'Current tab checked and saved to your workspace.');}catch(error){showMessage(error.message);}}
async function render() { const state=await send({type:'GET_STATE'});$('signedOut').hidden=Boolean(state.token);$('signedIn').hidden=!state.token;$('statusDot').classList.toggle('online',Boolean(state.token));$('autoProtect').checked=state.autoProtect;$('apiBase').value=state.apiBase;if(state.user){$('userName').textContent=state.user.name;$('workspace').textContent=state.user.organizationName||state.user.email;}const last=await send({type:'GET_LAST_RESULT'});if(last)showResult(last);if(state.autoProtect)await detectCurrentTab(state); }
$('loginForm').addEventListener('submit',async event=>{event.preventDefault();busy(event.currentTarget,true);showMessage('Signing in…');try{await send({type:'LOGIN',email:$('email').value.trim(),password:$('password').value});showMessage('');await render();}catch(error){showMessage(error.message);}finally{busy(event.currentTarget,false);}});
$('logout').addEventListener('click',async()=>{await send({type:'LOGOUT'});$('result').hidden=true;await render();});
$('autoProtect').addEventListener('change',()=>send({type:'SET_SETTINGS',values:{autoProtect:$('autoProtect').checked}}));
$('checkForm').addEventListener('submit',async event=>{event.preventDefault();busy(event.currentTarget,true);showMessage('Checking this link…');try{showResult(await send({type:'CHECK_URL',url:$('url').value,force:true}));showMessage('Saved to your RiskProtect workspace.');}catch(error){showMessage(error.message);}finally{busy(event.currentTarget,false);}});
$('saveSettings').addEventListener('click',async()=>{try{await send({type:'SET_SETTINGS',values:{apiBase:$('apiBase').value.trim()}});showMessage('Connection saved.');}catch(error){showMessage(error.message);}});
$('clearBlocks').addEventListener('click',async()=>{await send({type:'CLEAR_BLOCKS'});showMessage('Blocked-site list cleared.');});
render().catch(error=>showMessage(error.message));


