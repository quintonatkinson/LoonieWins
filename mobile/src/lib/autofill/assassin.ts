/**
 * Assassin: Raw JavaScript injection for native WebView autofill.
 * Parity with web field coverage + ReactNativeWebView status reports.
 */

import type { AutoFillData } from '../../types/profile'

export type AutofillReportStatus =
  | 'filled'
  | 'no_fields'
  | 'no_match'
  | 'empty_profile'
  | 'error'

export interface AutofillReport {
  type: 'loonie_autofill'
  status: AutofillReportStatus
  filled: number
  candidates: number
  reason?: string
}

export function profileHasAutofill(data?: AutoFillData | null): boolean {
  if (!data) return false
  return Boolean(
    data.email?.trim() ||
      data.name?.trim() ||
      data.firstName?.trim() ||
      data.lastName?.trim() ||
      data.address?.trim() ||
      data.phone?.trim() ||
      data.city?.trim() ||
      data.province?.trim() ||
      data.postalCode?.trim()
  )
}

function toProfile(data: AutoFillData): Record<string, string> {
  const first =
    data.firstName?.trim() || data.name?.trim().split(/\s+/)[0] || ''
  const last =
    data.lastName?.trim() || data.name?.trim().split(/\s+/).slice(1).join(' ') || ''
  const full =
    data.name?.trim() || [first, last].filter(Boolean).join(' ') || ''
  return {
    email: data.email?.trim() || '',
    first_name: first,
    last_name: last,
    full_name: full,
    address: data.address?.trim() || '',
    city: data.city?.trim() || '',
    province: data.province?.trim() || '',
    postal_code: data.postalCode?.trim() || '',
    phone: data.phone?.trim() || '',
  }
}

/**
 * Returns raw JavaScript for WebView injectedJavaScript / injectJavaScript.
 * Posts JSON AutofillReport via window.ReactNativeWebView.postMessage.
 */
export function getInjectionScript(userProfile: AutoFillData = {}): string {
  const u = toProfile(userProfile)
  const json = JSON.stringify(u)
  const hasAny = Object.values(u).some((v) => Boolean(v))

  return `(function(){
try{
var u=${json};
var HAS_PROFILE=${hasAny ? 'true' : 'false'};
var filledCount=0;
var candidateCount=0;
var report=function(status,reason){
  try{
    var payload=JSON.stringify({
      type:'loonie_autofill',
      status:status,
      filled:filledCount,
      candidates:candidateCount,
      reason:reason||''
    });
    if(window.ReactNativeWebView&&window.ReactNativeWebView.postMessage){
      window.ReactNativeWebView.postMessage(payload);
    }
  }catch(e){}
};
if(!HAS_PROFILE){
  report('empty_profile','no_profile');
  return;
}
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
  if(!val||!el)return false;
  if(el.disabled||el.readOnly)return false;
  if(el.tagName==='SELECT'){
    var want=String(val).toLowerCase();
    var opts=el.options||[];
    for(var i=0;i<opts.length;i++){
      var t=(opts[i].text||'').toLowerCase();
      var v=(opts[i].value||'').toLowerCase();
      if(t===want||v===want){el.value=opts[i].value;HUMANIZE(el);filledCount++;return true;}
    }
    for(i=0;i<opts.length;i++){
      t=(opts[i].text||'').toLowerCase();
      v=(opts[i].value||'').toLowerCase();
      if(t.indexOf(want)>=0||v.indexOf(want)>=0||want.indexOf(t)>=0){
        el.value=opts[i].value;HUMANIZE(el);filledCount++;return true;
      }
    }
    return false;
  }
  if(!setNative(el,val)){el.value=val;}
  try{el.setAttribute('value',val);}catch(e){}
  HUMANIZE(el);
  filledCount++;
  return true;
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
      var by=document.querySelector('label[for="'+String(el.id).replace(/"/g,'')+'"]');
      if(by)lbl=(by.textContent||'').toLowerCase();
    }
  }catch(e){}
  return [n,i,p,a,ac,lbl].join(' ');
};
var match=function(el){
  var s=hay(el);
  if(el.type==='email'||/e-?mail|autocomplete[^\\s]*email/i.test(s)){if(u.email)return fill(el,u.email);}
  if(/(first[_\\s-]?name|fname|given[-_]?name|autocomplete[^\\s]*given-name)/i.test(s)){if(u.first_name)return fill(el,u.first_name);}
  if(/(last[_\\s-]?name|lname|surname|family[-_]?name|autocomplete[^\\s]*family-name)/i.test(s)){if(u.last_name)return fill(el,u.last_name);}
  if(/(full[_\\s-]?name|your[_\\s-]?name|display[_\\s-]?name|\\bname\\b)/i.test(s)&&!/(user|file|company|org|team)/i.test(s)){
    if(u.full_name)return fill(el,u.full_name);
    if(u.first_name)return fill(el,u.first_name);
  }
  if(/(address|street|addr1|address1|address_line)/i.test(s)&&!/(email)/i.test(s)){if(u.address)return fill(el,u.address);}
  if(/(city|town|locality)/i.test(s)){if(u.city)return fill(el,u.city);}
  if(/(province|state|region|admin)/i.test(s)){if(u.province)return fill(el,u.province);}
  if(/(postal|zip|post[_\\s-]?code)/i.test(s)){if(u.postal_code)return fill(el,u.postal_code);}
  if(/(phone|mobile|tel|cell)/i.test(s)){if(u.phone)return fill(el,u.phone);}
  return false;
};
var highlightMath=function(){
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
var run=function(reason){
  filledCount=0;
  candidateCount=0;
  var q=document.querySelectorAll('input,select,textarea');
  for(var k=0;k<q.length;k++){
    var el=q[k];
    var ty=(el.type||'').toLowerCase();
    if(ty==='hidden'||ty==='submit'||ty==='button'||ty==='checkbox'||ty==='radio'||ty==='file'||ty==='image')continue;
    candidateCount++;
    match(el);
  }
  highlightMath();
  if(candidateCount===0)report('no_fields',reason);
  else if(filledCount===0)report('no_match',reason);
  else report('filled',reason);
};
window.__loonieAutofillRun=function(){run('manual');};
run('initial');
setTimeout(function(){run('t600');},600);
setTimeout(function(){run('t1800');},1800);
setTimeout(function(){run('t3500');},3500);
try{
  if(window.__loonieAssassinMO){window.__loonieAssassinMO.disconnect();}
  var mo=new MutationObserver(function(){
    clearTimeout(window.__loonieAssassinT);
    window.__loonieAssassinT=setTimeout(function(){run('mutation');},250);
  });
  mo.observe(document.documentElement||document.body,{childList:true,subtree:true});
  window.__loonieAssassinMO=mo;
  setTimeout(function(){try{mo.disconnect();}catch(e){}},20000);
}catch(e){}
}catch(e){
  try{
    if(window.ReactNativeWebView&&window.ReactNativeWebView.postMessage){
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type:'loonie_autofill',status:'error',filled:0,candidates:0,reason:String(e&&e.message||e)
      }));
    }
  }catch(e2){}
}
})();true;`
}
