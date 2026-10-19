/**
 * Assassin: Raw JavaScript injection script for WebView autofill.
 * Safe: wrapped in try/catch so failures do not crash the contest page.
 * Hardened for React controlled inputs, SPA delayed mounts, and province/state.
 */

import type { AutoFillData } from '../../types/profile'

/** Map AutoFillData to script-compatible profile (first_name, last_name, etc.) */
function toUserProfile(data: AutoFillData): {
  email?: string
  first_name?: string
  last_name?: string
  full_name?: string
  address?: string
  city?: string
  province?: string
  postal_code?: string
  phone?: string
} {
  const first_name =
    data.firstName?.trim() ||
    data.name?.trim().split(/\s+/)[0] ||
    undefined
  const last_name =
    data.lastName?.trim() ||
    data.name?.trim().split(/\s+/).slice(1).join(' ') ||
    undefined
  const full_name =
    data.name?.trim() ||
    [first_name, last_name].filter(Boolean).join(' ') ||
    undefined

  return {
    email: data.email?.trim() || undefined,
    first_name: first_name || undefined,
    last_name: last_name || undefined,
    full_name: full_name || undefined,
    address: data.address?.trim() || undefined,
    city: data.city?.trim() || undefined,
    province: data.province?.trim() || undefined,
    postal_code: data.postalCode?.trim() || undefined,
    phone: data.phone?.trim() || undefined,
  }
}

/**
 * Returns a string of raw JavaScript that can be injected into any WebView.
 * - Iterates input, select, textarea
 * - Matches heuristics (name, id, placeholder, aria-label, autocomplete)
 * - Uses native value setter + InputEvent for React/Angular
 * - Re-runs on DOM mutations and delayed timeouts for SPA forms
 * - Highlights math/skill-testing fields in neon pink
 */
export function getInjectionScript(userProfile: AutoFillData): string {
  const profile = toUserProfile(userProfile)
  const json = JSON.stringify(profile)

  return `(function(){
try{
var u=${json};
var DESC=Object.getOwnPropertyDescriptor;
var setNative=function(el,val){
  try{
    var proto=el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;
    var d=DESC.call(Object,proto,'value')||DESC(proto,'value');
    if(d&&d.set){d.set.call(el,val);return true;}
  }catch(e){}
  return false;
};
var HUMANIZE=function(el){
  if(!el||typeof el.dispatchEvent!=='function')return;
  try{el.dispatchEvent(new Event('focus',{bubbles:true}));}catch(e){}
  try{el.dispatchEvent(new InputEvent('input',{bubbles:true,cancelable:true,inputType:'insertText',data:el.value}));}catch(e){
    try{el.dispatchEvent(new Event('input',{bubbles:true}));}catch(e2){}
  }
  try{el.dispatchEvent(new Event('change',{bubbles:true}));}catch(e){}
  try{el.dispatchEvent(new Event('blur',{bubbles:true}));}catch(e){}
};
var fill=function(el,val){
  if(!val||!el)return;
  if(el.disabled||el.readOnly)return;
  if(el.tagName==='SELECT'){
    var want=String(val).toLowerCase();
    var opts=el.options||[];
    for(var i=0;i<opts.length;i++){
      var t=(opts[i].text||'').toLowerCase();
      var v=(opts[i].value||'').toLowerCase();
      if(t===want||v===want){el.value=opts[i].value;HUMANIZE(el);return;}
    }
    for(i=0;i<opts.length;i++){
      t=(opts[i].text||'').toLowerCase();
      v=(opts[i].value||'').toLowerCase();
      if(t.indexOf(want)>=0||v.indexOf(want)>=0||want.indexOf(t)>=0){
        el.value=opts[i].value;HUMANIZE(el);return;
      }
    }
    return;
  }
  if(!setNative(el,val)){el.value=val;}
  try{el.setAttribute('value',val);}catch(e){}
  HUMANIZE(el);
};
var hay=function(el){
  var n=(el.name||'').toLowerCase();
  var i=(el.id||'').toLowerCase();
  var p=(el.placeholder||'').toLowerCase();
  var a=(el.getAttribute&&el.getAttribute('aria-label')||'').toLowerCase();
  var ac=(el.getAttribute&&el.getAttribute('autocomplete')||'').toLowerCase();
  var lbl='';
  try{
    if(el.labels&&el.labels[0])lbl=(el.labels[0].textContent||'').toLowerCase();
    else if(el.id){
      var by=document.querySelector('label[for="'+el.id.replace(/"/g,'')+'"]');
      if(by)lbl=(by.textContent||'').toLowerCase();
    }
  }catch(e){}
  return [n,i,p,a,ac,lbl].join(' ');
};
var text=function(el){
  var s=hay(el);
  if(el.type==='email'||/e-?mail|autocomplete[^\\s]*email/i.test(s)){if(u.email){fill(el,u.email);return true;}}
  if(/(first[_\\s-]?name|fname|given[-_]?name|autocomplete[^\\s]*given-name)/i.test(s)){if(u.first_name){fill(el,u.first_name);return true;}}
  if(/(last[_\\s-]?name|lname|surname|family[-_]?name|autocomplete[^\\s]*family-name)/i.test(s)){if(u.last_name){fill(el,u.last_name);return true;}}
  if(/(full[_\\s-]?name|your[_\\s-]?name|display[_\\s-]?name|^name$|\\bname\\b)/i.test(s)&&!/(user|file|company|org|team)/i.test(s)){
    if(u.full_name){fill(el,u.full_name);return true;}
    if(u.first_name){fill(el,u.first_name);return true;}
  }
  if(/(address|street|addr1|address1|address_line)/i.test(s)&&!/(email)/i.test(s)){if(u.address){fill(el,u.address);return true;}}
  if(/(city|town|locality)/i.test(s)){if(u.city){fill(el,u.city);return true;}}
  if(/(province|state|region|admin)/i.test(s)){if(u.province){fill(el,u.province);return true;}}
  if(/(postal|zip|post[_\\s-]?code)/i.test(s)){if(u.postal_code){fill(el,u.postal_code);return true;}}
  if(/(phone|mobile|tel|cell)/i.test(s)){if(u.phone){fill(el,u.phone);return true;}}
  return false;
};
var run=function(){
  var q=document.querySelectorAll('input,select,textarea');
  for(var k=0;k<q.length;k++){
    var el=q[k];
    var ty=(el.type||'').toLowerCase();
    if(ty==='hidden'||ty==='submit'||ty==='button'||ty==='checkbox'||ty==='radio'||ty==='file'||ty==='image')continue;
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
};
run();
setTimeout(run,600);
setTimeout(run,1800);
setTimeout(run,3500);
try{
  if(window.__loonieAssassinMO){window.__loonieAssassinMO.disconnect();}
  var mo=new MutationObserver(function(){
    clearTimeout(window.__loonieAssassinT);
    window.__loonieAssassinT=setTimeout(run,250);
  });
  mo.observe(document.documentElement||document.body,{childList:true,subtree:true});
  window.__loonieAssassinMO=mo;
  setTimeout(function(){try{mo.disconnect();}catch(e){}},20000);
}catch(e){}
}catch(e){}
})();`
}
