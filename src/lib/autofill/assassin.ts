/**
 * Assassin: Raw JavaScript injection script for WebView autofill.
 * Safe: wrapped in try/catch so failures do not crash the contest page.
 * Hardened for React controlled inputs, SPA delayed mounts, and province/state.
 */

import type { AutoFillData } from '../../types/profile'
import { AUTOFILL_ENGINE_SOURCE } from './engine.generated'

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
 * Returns a string of raw JavaScript that can be injected into any WebView / same-origin frame.
 * Field matching lives in the shared engine (shared/autofill/engine.js); this wrapper re-runs it
 * for SPA forms that mount late. Re-runs never overwrite values the user typed.
 */
export function getInjectionScript(userProfile: AutoFillData): string {
  const json = JSON.stringify(toUserProfile(userProfile))

  return `(function(){
try{
var u=${json};
var E=(function(){${AUTOFILL_ENGINE_SOURCE}
return loonieAutofill;})();
var run=function(){try{return E(u);}catch(e){return null;}};
window.__loonieAutofillRun=run;
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
