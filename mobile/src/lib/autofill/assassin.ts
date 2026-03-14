/**
 * Assassin: Raw JavaScript injection script for WebView autofill.
 * Used by ContestBrowser injectedJavaScript.
 */

import type { AutoFillData } from '../../types/profile'

const DEFAULT: AutoFillData = {
  name: 'John Doe',
  email: 'test@email.com',
  address: '123 Main St, Toronto ON',
}

function toProfile(data: AutoFillData): Record<string, string> {
  const name = data.name?.trim() ?? DEFAULT.name ?? ''
  const parts = name.split(/\s+/, 2)
  return {
    email: data.email?.trim() ?? DEFAULT.email ?? '',
    first_name: parts[0] ?? name,
    last_name: parts[1] ?? name,
    address: data.address?.trim() ?? DEFAULT.address ?? '',
  }
}

/**
 * Returns a string of raw JavaScript for WebView injectedJavaScript.
 * Fills input[type="email"], input[name*="name"], etc.
 */
export function getInjectionScript(userProfile: AutoFillData = DEFAULT): string {
  const u = toProfile(userProfile)
  const json = JSON.stringify(u)

  return `(function(){
try{
var u=${json};
var dispatch=function(el){
  if(!el||typeof el.dispatchEvent!=='function')return;
  ['input','change','blur'].forEach(function(ev){
    try{el.dispatchEvent(new Event(ev,{bubbles:true}));}catch(e){}
  });
};
var fill=function(el,val){
  if(!val)return;
  el.value=val;
  el.setAttribute&&el.setAttribute('value',val);
  dispatch(el);
};
var q=document.querySelectorAll('input[type="email"],input[name*="email" i],input[id*="email" i],input[placeholder*="email" i]');
for(var i=0;i<q.length;i++){var el=q[i];if(el.type!=='hidden')fill(el,u.email);}
q=document.querySelectorAll('input[name*="name" i],input[id*="name" i],input[placeholder*="name" i],input[name*="fname" i],input[name*="lname" i]');
for(i=0;i<q.length;i++){
  el=q[i];
  if(el.type==='hidden')continue;
  var n=(el.name||'').toLowerCase();
  if(/last|lname/.test(n))fill(el,u.last_name);
  else fill(el,u.first_name);
}
q=document.querySelectorAll('input[name*="address" i],input[id*="address" i],textarea[name*="address" i]');
for(i=0;i<q.length;i++){el=q[i];if(el.type!=='hidden')fill(el,u.address);}
}catch(e){}
})();`
}
