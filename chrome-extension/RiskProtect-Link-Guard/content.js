let pending = false;
const send = message => new Promise((resolve, reject) => {
  chrome.runtime.sendMessage(message, response => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message));
    else resolve(response);
  });
});
let protectionEnabled = false;
const linkChecks = new Map();
let hoverTimer;
send({ type: 'GET_STATE' }).then(response => { protectionEnabled = Boolean(response?.ok && response.data.autoProtect && response.data.token); }).catch(() => {});
chrome.storage.onChanged.addListener(() => send({ type: 'GET_STATE' }).then(response => { protectionEnabled = Boolean(response?.ok && response.data.autoProtect && response.data.token); }).catch(() => {}));

function eligibleLink(anchor) {
  if (!anchor?.href || anchor.target === '_download' || anchor.hasAttribute('download')) return null;
  try {
    const url = new URL(anchor.href, location.href);
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname === location.hostname || url.hostname === '127.0.0.1' || url.hostname === 'localhost') return null;
    return url.toString();
  } catch { return null; }
}

function showToast(title, detail, tone = 'checking') {
  document.getElementById('riskprotect-link-toast')?.remove();
  const toast = document.createElement('div');
  toast.id = 'riskprotect-link-toast';
  toast.className = `rp-link-toast rp-${tone}`;
  toast.innerHTML = `<span class="rp-link-dot"></span><div><strong></strong><small></small></div>`;
  toast.querySelector('strong').textContent = title;
  toast.querySelector('small').textContent = detail;
  document.documentElement.appendChild(toast);
  return toast;
}

function warningUrl(result) {
  const params = new URLSearchParams({ url: result.url, band: result.detection.riskBand, score: String(result.detection.riskScore), verdict: result.detection.verdict || 'Risk detected' });
  return chrome.runtime.getURL(`warning.html?${params}`);
}

async function precheck(anchor) {
  const url=eligibleLink(anchor);
  if(!protectionEnabled||!url||linkChecks.has(url))return;
  linkChecks.set(url,'checking');
  try{
    const response=await send({type:'CHECK_URL',url});
    if(!response?.ok)throw new Error(response?.error);
    const result=response.data,band=result.detection.riskBand;
    linkChecks.set(url,result);
    anchor.dataset.riskprotectRisk=band.toLowerCase();
    anchor.title=band==='Low'?'RiskProtect: Risk not detected':band==='Medium'?'RiskProtect: Risk detected — use caution':'RiskProtect: High risk detected — link will be blocked';
    if(band==='Medium')showToast('Risk detected',`Use caution with this link (${result.detection.riskScore}/100).`,'warning');
    if(band==='High'||band==='Critical')showToast('High risk detected','RiskProtect will block this link.','danger');
  }catch{linkChecks.delete(url);}
}

document.addEventListener('mouseover',event=>{const anchor=event.target.closest?.('a[href]');clearTimeout(hoverTimer);if(anchor)hoverTimer=setTimeout(()=>precheck(anchor),650);},true);
document.addEventListener('focusin',event=>{const anchor=event.target.closest?.('a[href]');if(anchor)precheck(anchor);},true);

document.addEventListener('click', async event => {
  if (pending || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = event.target.closest?.('a[href]');
  const url = eligibleLink(anchor);
  if (!url) return;
  if (!protectionEnabled) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  pending = true;
  const toast = showToast('Checking link', 'RiskProtect is reviewing this destination.');
  try {
    const response = await send({ type: 'CHECK_URL', url });
    if (!response.ok) throw new Error(response.error);
    const result = response.data;
    const band = result.detection.riskBand;
    if (band === 'High' || band === 'Critical') {
      location.href = warningUrl(result);
      return;
    }
    if (band === 'Medium') {
      toast.remove();
      if (confirm(`RiskProtect recommends caution (${result.detection.riskScore}/100). Open this link anyway?\n\n${url}`)) location.href = url;
      return;
    }
    showToast('No strong warning signs found', 'Opening the checked link.', 'safe');
    setTimeout(() => { location.href = url; }, 450);
  } catch (error) {
    toast.remove();
    if (confirm(`RiskProtect could not check this link: ${error.message}\n\nOpen it anyway?`)) location.href = url;
  } finally { pending = false; }
}, true);
