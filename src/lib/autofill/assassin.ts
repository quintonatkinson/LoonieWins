/**
 * Assassin: Raw JavaScript injection for Capgo InAppBrowser + rare same-origin embeds.
 * Sets window.__loonieFillResult so callers can avoid burning Smart-Fill without a likely fill.
 */

import type { AutoFillData } from '../../types/profile'

export type AutofillWall = 'captcha' | 'sign-in' | 'purchase'

export interface AssassinFillResult {
  status: 'filled' | 'no_fields' | 'no_match' | 'empty_profile' | 'error'
  filled: number
  candidates: number
  requiredEmpty?: number
  walls?: AutofillWall[]
}

/** Map AutoFillData to script-compatible profile */
function toUserProfile(data: AutoFillData): Record<string, string | undefined> {
  const first_name =
    data.firstName?.trim() || data.name?.trim().split(/\s+/)[0] || undefined
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
    dob: data.dateOfBirth?.trim() || undefined,
  }
}

/**
 * Returns a string of raw JavaScript that can be injected into any WebView / same-origin doc.
 */
export function getInjectionScript(userProfile: AutoFillData): string {
  const profile = toUserProfile(userProfile)
  const json = JSON.stringify(profile)
  const hasAny = Object.values(profile).some((v) => Boolean(v))

  return `(function(){
try{
var u=${json};
var HAS_PROFILE=${hasAny ? 'true' : 'false'};
var filledCount=0;
var candidateCount=0;
var requiredEmpty=0;
var walls=[];
var finish=function(status,reason){
  window.__loonieFillResult={status:status,filled:filledCount,candidates:candidateCount,requiredEmpty:requiredEmpty,walls:walls,reason:reason||''};
};
if(!HAS_PROFILE){finish('empty_profile','no_profile');return;}
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
  var tit=(el.getAttribute&&el.getAttribute('title')||'').toLowerCase();
  var dn=(el.getAttribute&&(el.getAttribute('data-name')||el.getAttribute('data-field')||el.getAttribute('data-testid'))||'').toLowerCase();
  var lbl='';
  try{
    if(el.labels&&el.labels[0])lbl=(el.labels[0].textContent||'').toLowerCase();
    else if(el.id){
      var by=document.querySelector('label[for="'+String(el.id).replace(/"/g,'')+'"]');
      if(by)lbl=(by.textContent||'').toLowerCase();
    }
    if(!lbl&&el.parentElement){
      var prev=el.previousElementSibling;
      if(prev&&(/^LABEL$/i.test(prev.tagName)||/label/i.test(prev.className||'')))lbl=(prev.textContent||'').toLowerCase();
    }
  }catch(e){}
  return [n,i,p,a,ac,tit,dn,lbl].join(' ');
};
var dobParts=function(raw){
  var s=String(raw||'').trim();
  if(!s)return null;
  var m=s.match(/^(\\d{4})[-\\/](\\d{1,2})[-\\/](\\d{1,2})$/);
  if(m)return{y:m[1],mo:('0'+m[2]).slice(-2),d:('0'+m[3]).slice(-2)};
  m=s.match(/^(\\d{1,2})[-\\/](\\d{1,2})[-\\/](\\d{4})$/);
  if(m)return{y:m[3],mo:('0'+m[1]).slice(-2),d:('0'+m[2]).slice(-2)};
  return null;
};
var fillDob=function(el){
  if(!u.dob)return false;
  var parts=dobParts(u.dob);
  var ty=(el.type||'').toLowerCase();
  if(ty==='date'&&parts)return fill(el,parts.y+'-'+parts.mo+'-'+parts.d);
  var s=hay(el);
  if(/yyyy|year|birth[_\\s-]?year/i.test(s)&&parts)return fill(el,parts.y);
  if(/mm|month|birth[_\\s-]?month/i.test(s)&&parts&&!/yyyy|year/i.test(s))return fill(el,parts.mo);
  if(/\\bdd\\b|day|birth[_\\s-]?day/i.test(s)&&parts&&!/birthday|dob/i.test(s))return fill(el,parts.d);
  if(parts){
    if(/iso|yyyy/.test(s))return fill(el,parts.y+'-'+parts.mo+'-'+parts.d);
    return fill(el,parts.mo+'/'+parts.d+'/'+parts.y);
  }
  return fill(el,u.dob);
};
var match=function(el){
  var s=hay(el);
  var ty=(el.type||'').toLowerCase();
  if(ty==='email'||/e-?mail|autocomplete[^\\s]*email/i.test(s)){if(u.email)return fill(el,u.email);}
  if(/(first[_\\s-]?name|fname|given[-_]?name|autocomplete[^\\s]*given-name)/i.test(s)){if(u.first_name)return fill(el,u.first_name);}
  if(/(last[_\\s-]?name|lname|surname|family[-_]?name|autocomplete[^\\s]*family-name)/i.test(s)){if(u.last_name)return fill(el,u.last_name);}
  if(/(full[_\\s-]?name|your[_\\s-]?name|display[_\\s-]?name|\\bname\\b)/i.test(s)&&!/(user|file|company|org|team|user[_\\s-]?name)/i.test(s)){
    if(u.full_name)return fill(el,u.full_name);
    if(u.first_name)return fill(el,u.first_name);
  }
  if(/(address|street|addr1|address1|address[_\\s-]?line|address-line1)/i.test(s)&&!/(email)/i.test(s)){if(u.address)return fill(el,u.address);}
  if(/(city|town|locality)/i.test(s)){if(u.city)return fill(el,u.city);}
  if(/(province|state|region|admin)/i.test(s)){if(u.province)return fill(el,u.province);}
  if(/(postal|zip|post[_\\s-]?code)/i.test(s)){if(u.postal_code)return fill(el,u.postal_code);}
  if(ty==='tel'||/(phone|mobile|tel|cell)/i.test(s)){if(u.phone)return fill(el,u.phone);}
  if(ty==='date'||/(birth|dob|date[_\\s-]?of[_\\s-]?birth|birthday|bday|born)/i.test(s)){return fillDob(el);}
  return false;
};
var highlightMath=function(){
  var labels=document.querySelectorAll('label,legend,p,span,div');
  var pink='#FF10F0';
  for(var j=0;j<labels.length&&j<400;j++){
    var lbl=labels[j];
    var t=(lbl.textContent||'').toLowerCase();
    if(!/\\b(math|skill[_\\s-]?testing|equation|answer correctly)\\b/i.test(t)&&!/\\d+\\s*[+\\-*\\/]\\s*\\d+/.test(lbl.textContent||''))continue;
    var forId=lbl.getAttribute&&lbl.getAttribute('for');
    var target=forId?document.getElementById(forId):lbl.querySelector&&lbl.querySelector('input,select,textarea');
    if(!target&&lbl.nextElementSibling&&/^(INPUT|SELECT|TEXTAREA)$/i.test(lbl.nextElementSibling.tagName))target=lbl.nextElementSibling;
    if(target&&!target.dataset.loonieSkillHi){
      target.style.border='2px solid '+pink;
      target.style.boxShadow='0 0 8px '+pink;
      target.dataset.loonieSkillHi='1';
    }
  }
};
var isEmpty=function(el){
  if(el.tagName==='SELECT')return !el.value||el.selectedIndex<=0;
  return !String(el.value||'').trim();
};
var highlightRequiredEmpty=function(){
  requiredEmpty=0;
  var first=null;
  var q=document.querySelectorAll('input,select,textarea');
  for(var k=0;k<q.length;k++){
    var el=q[k];
    var ty=(el.type||'').toLowerCase();
    if(ty==='hidden'||ty==='submit'||ty==='button'||ty==='image'||ty==='file')continue;
    var req=el.required||el.getAttribute('aria-required')==='true'||/required|mandatory/i.test(hay(el));
    if(!req||!isEmpty(el)||el.disabled)continue;
    requiredEmpty++;
    el.style.outline='2px solid #fbbf24';
    el.style.outlineOffset='2px';
    if(!first)first=el;
  }
  return first;
};
var findSubmit=function(){
  var cand=document.querySelectorAll('button,input[type=submit],input[type=button],a[role=button]');
  for(var i=0;i<cand.length;i++){
    var el=cand[i];
    var t=((el.innerText||el.value||el.getAttribute('aria-label')||'')+'').toLowerCase();
    if(/submit|enter|enter now|apply|register|sign me up|join|claim|send|continue|next|finish|done/i.test(t)&&!/cancel|back|previous|login|sign in|log in/i.test(t)){
      return el;
    }
  }
  return document.querySelector('button[type=submit],input[type=submit]');
};
var detectWalls=function(){
  walls=[];
  var html=((document.body&&document.body.innerHTML)||'').toLowerCase();
  var text=((document.body&&(document.body.innerText||document.body.textContent))||'').toLowerCase();
  if(/recaptcha|hcaptcha|g-recaptcha|cf-turnstile|captcha|i'?m not a robot/.test(html)||/\\bcaptcha\\b/.test(text))walls.push('captcha');
  if(/\\b(sign\\s*in|log\\s*in|create (an )?account|already have an account)\\b/.test(text)&&document.querySelector('input[type=password]'))walls.push('sign-in');
  if(/\\b(purchase|buy now|add to cart|checkout|order now|pay now)\\b/.test(text)&&!/no purchase|without purchase|no purchase necessary/i.test(text))walls.push('purchase');
};
var scrollFocus=function(el){
  if(!el)return;
  try{el.scrollIntoView({behavior:'smooth',block:'center'});}catch(e){try{el.scrollIntoView(true);}catch(e2){}}
  try{el.focus();}catch(e){}
};
var run=function(){
  filledCount=0;
  candidateCount=0;
  var q=document.querySelectorAll('input,select,textarea');
  for(var k=0;k<q.length;k++){
    var el=q[k];
    var ty=(el.type||'').toLowerCase();
    if(ty==='hidden'||ty==='submit'||ty==='button'||ty==='checkbox'||ty==='radio'||ty==='file'||ty==='image'||ty==='password')continue;
    candidateCount++;
    match(el);
  }
  highlightMath();
  detectWalls();
  var emptyEl=highlightRequiredEmpty();
  var submit=findSubmit();
  if(emptyEl)scrollFocus(emptyEl);
  else if(submit){
    try{submit.style.outline='2px solid #2dd4bf';submit.style.outlineOffset='3px';}catch(e){}
    scrollFocus(submit);
  }
  if(candidateCount===0)finish('no_fields');
  else if(filledCount===0)finish('no_match');
  else finish('filled');
};
window.__loonieAutofillRun=run;
run();
setTimeout(run,600);
setTimeout(run,1800);
setTimeout(run,3500);
setTimeout(run,8000);
try{
  if(window.__loonieAssassinMO){window.__loonieAssassinMO.disconnect();}
  var mo=new MutationObserver(function(){
    clearTimeout(window.__loonieAssassinT);
    window.__loonieAssassinT=setTimeout(run,300);
  });
  mo.observe(document.documentElement||document.body,{childList:true,subtree:true});
  window.__loonieAssassinMO=mo;
  setTimeout(function(){try{mo.disconnect();}catch(e){}},45000);
}catch(e){}
}catch(e){
  try{window.__loonieFillResult={status:'error',filled:0,candidates:0,reason:String(e&&e.message||e)};}catch(e2){}
}
})();`
}

/** Read last fill result from a same-origin iframe document after inject. */
export function readFillResult(win: Window | null | undefined): AssassinFillResult | null {
  try {
    const r = (win as Window & { __loonieFillResult?: AssassinFillResult })
      ?.__loonieFillResult
    if (!r || typeof r !== 'object') return null
    return r
  } catch {
    return null
  }
}
