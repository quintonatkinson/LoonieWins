/**
 * Assassin: Raw JavaScript injection for native WebView autofill.
 * Parity with web field coverage + ReactNativeWebView status reports.
 */

import type { AutoFillData } from '../../types/profile'
import { AUTOFILL_ENGINE_SOURCE } from './engine.generated'

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
 * Field matching lives in the shared engine (shared/autofill/engine.js).
 * Posts JSON AutofillReport via window.ReactNativeWebView.postMessage.
 */
export function getInjectionScript(userProfile: AutoFillData = {}): string {
  const u = toProfile(userProfile)
  const json = JSON.stringify(u)
  const hasAny = Object.values(u).some((v) => Boolean(v))

  return `(function(){
var report=function(status,filled,candidates,reason){
  try{
    if(window.ReactNativeWebView&&window.ReactNativeWebView.postMessage){
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type:'loonie_autofill',status:status,filled:filled||0,candidates:candidates||0,reason:reason||''
      }));
    }
  }catch(e){}
};
try{
var u=${json};
if(!${hasAny ? 'true' : 'false'}){report('empty_profile',0,0,'no_profile');return;}
var E=(function(){${AUTOFILL_ENGINE_SOURCE}
return loonieAutofill;})();
var run=function(reason){
  var r=E(u)||{filled:0,candidates:0};
  if(r.candidates===0)report('no_fields',0,0,reason);
  else if(r.filled===0)report('no_match',0,r.candidates,reason);
  else report('filled',r.filled,r.candidates,reason);
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
}catch(e){report('error',0,0,String(e&&e.message||e));}
})();true;`
}
