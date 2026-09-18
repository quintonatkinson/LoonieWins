/**
 * Assassin: Raw JavaScript injection script for WebView autofill.
 * Used by ContestBrowser injectedJavaScript. Parity with web field coverage.
 */

import type { AutoFillData } from '../../types/profile'

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
 * Returns a string of raw JavaScript for WebView injectedJavaScript.
 */
export function getInjectionScript(userProfile: AutoFillData = {}): string {
  const u = toProfile(userProfile)
  const json = JSON.stringify(u)

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
var dispatch=function(el){
  if(!el||typeof el.dispatchEvent!=='function')return;
  try{el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:el.value}));}catch(e){
    try{el.dispatchEvent(new Event('input',{bubbles:true}));}catch(e2){}
  }
  try{el.dispatchEvent(new Event('change',{bubbles:true}));}catch(e){}
  try{el.dispatchEvent(new Event('blur',{bubbles:true}));}catch(e){}
};
var fill=function(el,val){
  if(!val||!el)return;
  if(el.tagName==='SELECT'){
    var want=String(val).toLowerCase();
    var opts=el.options||[];
    for(var i=0;i<opts.length;i++){
      var t=(opts[i].text||'').toLowerCase();
      var v=(opts[i].value||'').toLowerCase();
      if(t===want||v===want||t.indexOf(want)>=0||v.indexOf(want)>=0){el.value=opts[i].value;dispatch(el);return;}
    }
    return;
  }
  if(!setNative(el,val))el.value=val;
  el.setAttribute&&el.setAttribute('value',val);
  dispatch(el);
};
var hay=function(el){
  return [(el.name||''),(el.id||''),(el.placeholder||''),(el.getAttribute&&el.getAttribute('aria-label')||''),(el.getAttribute&&el.getAttribute('autocomplete')||'')].join(' ').toLowerCase();
};
var match=function(el){
  var s=hay(el);
  if(el.type==='email'||/e-?mail/.test(s)){if(u.email){fill(el,u.email);return;}}
  if(/(first|fname|given)/.test(s)){if(u.first_name){fill(el,u.first_name);return;}}
  if(/(last|lname|surname|family)/.test(s)){if(u.last_name){fill(el,u.last_name);return;}}
  if(/\\bname\\b/.test(s)&&!/(user|file|company)/.test(s)){if(u.full_name){fill(el,u.full_name);return;}}
  if(/(address|street)/.test(s)){if(u.address){fill(el,u.address);return;}}
  if(/(city|town)/.test(s)){if(u.city){fill(el,u.city);return;}}
  if(/(province|state)/.test(s)){if(u.province){fill(el,u.province);return;}}
  if(/(postal|zip)/.test(s)){if(u.postal_code){fill(el,u.postal_code);return;}}
  if(/(phone|mobile|tel)/.test(s)){if(u.phone){fill(el,u.phone);return;}}
};
var run=function(){
  var q=document.querySelectorAll('input,select,textarea');
  for(var i=0;i<q.length;i++){
    var el=q[i];
    var ty=(el.type||'').toLowerCase();
    if(ty==='hidden'||ty==='submit'||ty==='button'||ty==='checkbox'||ty==='radio'||ty==='file')continue;
    match(el);
  }
};
run();
setTimeout(run,800);
setTimeout(run,2000);
}catch(e){}
})();`
}
