/**
 * Assassin: Raw JavaScript injection script for WebView autofill.
 * Safe: wrapped in try/catch so failures do not crash the contest page.
 */

import type { AutoFillData } from '../../types/profile'

/** Map AutoFillData to script-compatible profile (first_name, last_name, etc.) */
function toUserProfile(data: AutoFillData): {
  email?: string
  first_name?: string
  last_name?: string
  address?: string
  city?: string
  postal_code?: string
  phone?: string
} {
  const name = data.name?.trim() ?? ''
  const parts = name.split(/\s+/, 2)
  const first_name = parts[0] ?? name
  const last_name = parts[1] ?? name

  return {
    email: data.email?.trim(),
    first_name: first_name || undefined,
    last_name: last_name || undefined,
    address: data.address?.trim(),
    city: data.city?.trim(),
    postal_code: data.postalCode?.trim(),
    phone: data.phone?.trim(),
  }
}

/**
 * Returns a string of raw JavaScript that can be injected into any WebView.
 * - Iterates input, select, textarea
 * - Matches heuristics (name, id, placeholder, aria-label)
 * - Dispatches input, change, blur for React/Angular
 * - Highlights math/skill-testing fields in neon pink
 */
export function getInjectionScript(userProfile: AutoFillData): string {
  const profile = toUserProfile(userProfile)
  const json = JSON.stringify(profile)

  return `(function(){
try{
var u=${json};
var HUMANIZE=function(el){
  if(!el||typeof el.dispatchEvent!=='function')return;
  ['input','change','blur'].forEach(function(ev){
    try{el.dispatchEvent(new Event(ev,{bubbles:true}));}catch(e){}
  });
};
var fill=function(el,val){
  if(!val)return;
  if(el.tagName==='SELECT'){
    var opt=Array.from(el.options||[]).find(function(o){return(o.text||o.value||'').toLowerCase()===val.toLowerCase();});
    if(opt){el.value=opt.value;HUMANIZE(el);return;}
    for(var i=0;i<(el.options||[]).length;i++){
      if((el.options[i].value||el.options[i].text||'').toLowerCase().indexOf(val.toLowerCase())>=0){
        el.value=el.options[i].value;HUMANIZE(el);return;
      }
    }
    return;
  }
  el.value=val;
  el.setAttribute('value',val);
  HUMANIZE(el);
};
var text=function(el){
  var n=(el.name||'').toLowerCase();
  var i=(el.id||'').toLowerCase();
  var p=(el.placeholder||'').toLowerCase();
  var a=(el.getAttribute&&el.getAttribute('aria-label')||'').toLowerCase();
  var s=[n,i,p,a].join(' ');
  if(/e-?mail/i.test(s)&&u.email){fill(el,u.email);return true;}
  if(/(first.*name|fname)/i.test(s)&&u.first_name){fill(el,u.first_name);return true;}
  if(/(last.*name|lname)/i.test(s)&&u.last_name){fill(el,u.last_name);return true;}
  if(/(address|street)/i.test(s)&&u.address){fill(el,u.address);return true;}
  if(/(city|town)/i.test(s)&&u.city){fill(el,u.city);return true;}
  if(/(postal|zip)/i.test(s)&&u.postal_code){fill(el,u.postal_code);return true;}
  if(/(phone|mobile)/i.test(s)&&u.phone){fill(el,u.phone);return true;}
  return false;
};
var q=document.querySelectorAll('input,select,textarea');
for(var k=0;k<q.length;k++){
  var el=q[k];
  if(el.type==='hidden'||el.type==='submit'||el.type==='button')continue;
  text(el);
}
var labels=document.querySelectorAll('label');
var pink='#FF10F0';
for(var j=0;j<labels.length;j++){
  var lbl=labels[j];
  var t=(lbl.textContent||'').toLowerCase();
  if(/\\b(math|skill testing|equation|answer correctly)\\b/i.test(t)||/\\d+\\s*[+\\-*\\/]\\s*\\d+/.test(lbl.textContent||'')){
    var forId=lbl.getAttribute('for');
    var target=forId?document.getElementById(forId):lbl.querySelector('input,select,textarea');
    if(target){target.style.border='2px solid '+pink;target.style.boxShadow='0 0 8px '+pink;}
  }
}
}catch(e){}
})();`
}
