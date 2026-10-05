(function(){
  'use strict';
  const KEY='vgme_auth_v3';
  const HANDOFF='vgme_handoff_v1';
  const TAB_PREFIX='vgme_tab_access:';
  const TTL=8*60*60*1000;
  const HANDOFF_TTL=60*1000;
  const HASH='2702ec432139d1a0eefd778b203463c5d2b602dcf2f1be2c7e970dba9a9ec57f';
  const TOKEN='a461f362';

  function storageGet(){
    try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){return null}
  }
  function storageSet(){
    try{localStorage.setItem(KEY,JSON.stringify({token:TOKEN,exp:Date.now()+TTL}));return true}catch(e){return false}
  }
  function storageClear(){
    try{localStorage.removeItem(KEY);localStorage.removeItem(HANDOFF)}catch(e){}
    try{
      for(let i=sessionStorage.length-1;i>=0;i--){const k=sessionStorage.key(i);if(k&&k.startsWith(TAB_PREFIX))sessionStorage.removeItem(k)}
    }catch(e){}
  }
  function valid(){
    const s=storageGet();
    if(!s||s.token!==TOKEN||!Number.isFinite(+s.exp)||Date.now()>=+s.exp){storageClear();return false}
    return true;
  }
  function fnv1a(s){
    let h=0x811c9dc5,b=new TextEncoder().encode(s);
    for(let i=0;i<b.length;i++){h^=b[i];h=Math.imul(h,0x01000193)>>>0}
    return ('0000000'+h.toString(16)).slice(-8);
  }
  async function sha256(t){
    const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  async function verify(v){
    try{if(window.crypto&&crypto.subtle&&await sha256(v)===HASH)return true}catch(e){}
    return fnv1a(v)===TOKEN;
  }
  function unlock(){
    const lock=document.getElementById('vgme-auth-lock');
    if(lock)lock.remove();
    document.documentElement.classList.remove('vgme-auth-pending');
    document.documentElement.style.visibility='';
  }
  function addLogout(){
    if(document.getElementById('vgme-auth-logout'))return;
    const b=document.createElement('button');
    b.id='vgme-auth-logout';
    b.type='button';
    b.textContent='Cerrar sesión';
    b.setAttribute('aria-label','Cerrar sesión del Portal VGME');
    Object.assign(b.style,{position:'fixed',right:'14px',bottom:'12px',zIndex:'2147483000',border:'1px solid rgba(40,58,82,.16)',borderRadius:'7px',background:'rgba(255,255,255,.92)',color:'#526176',padding:'6px 9px',font:'600 10px Inter,Arial,sans-serif',boxShadow:'0 4px 16px rgba(15,33,58,.08)',cursor:'pointer',opacity:'.55',backdropFilter:'blur(6px)'});
    b.onmouseenter=()=>b.style.opacity='1';
    b.onmouseleave=()=>b.style.opacity='.55';
    b.onclick=()=>{storageClear();location.reload()};
    document.body.appendChild(b);
  }
  function gate(afterSuccess){
    unlock();
    document.body.style.overflow='hidden';
    const style=document.createElement('style');
    style.id='vgme-auth-style';
    style.textContent=`
      .vgme-auth-overlay{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(780px 460px at 18% -10%,rgba(28,88,174,.42),transparent 65%),linear-gradient(145deg,#0a234b,#031022 72%);font-family:Inter,Arial,sans-serif}
      .vgme-auth-card{width:min(410px,100%);text-align:center}
      .vgme-auth-logo{display:block;width:min(310px,82%);max-height:82px;object-fit:contain;margin:0 auto 23px}
      .vgme-auth-card h2{margin:0 0 7px;color:#fff;font-size:26px;line-height:1.12;font-weight:800}
      .vgme-auth-card p{margin:0 0 20px;color:#b9c6d9;font-size:12.5px;line-height:1.55}
      .vgme-auth-card input{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);color:#fff;border-radius:8px;padding:13px 14px;outline:none;text-align:center;font-size:14px}
      .vgme-auth-card input:focus{border-color:#ffc800;box-shadow:0 0 0 3px rgba(255,200,0,.08)}
      .vgme-auth-card button{width:100%;margin-top:10px;border:0;border-radius:8px;padding:12px 14px;background:#ffc800;color:#07172f;font-size:13px;font-weight:800;cursor:pointer}
      .vgme-auth-error{height:18px;margin-top:9px;color:#f4aaaa;font-size:11.5px}
    `;
    document.head.appendChild(style);
    const o=document.createElement('div');
    o.className='vgme-auth-overlay';
    o.innerHTML=`<div class="vgme-auth-card"><img class="vgme-auth-logo" src="https://www.uniminuto.edu/sites/default/files/2023-02/uniminuto%20blanco_1.png" alt="UNIMINUTO"><h2>Portal VGME</h2><p>Acceso interno · Vicerrectoría de Mercadeo y Experiencia</p><input type="password" autocomplete="current-password" placeholder="Clave de acceso" aria-label="Clave de acceso"><button type="button">Entrar</button><div class="vgme-auth-error" aria-live="polite"></div></div>`;
    document.body.appendChild(o);
    const input=o.querySelector('input'),btn=o.querySelector('button'),err=o.querySelector('.vgme-auth-error');
    let busy=false;
    async function submit(){
      if(busy)return;busy=true;btn.disabled=true;
      const ok=await verify(input.value.trim());
      if(ok){storageSet();if(afterSuccess)afterSuccess();o.remove();style.remove();document.body.style.overflow='';addLogout()}
      else{err.textContent='Clave incorrecta';input.value='';input.focus()}
      btn.disabled=false;busy=false;
    }
    btn.addEventListener('click',submit);
    input.addEventListener('keydown',e=>{if(e.key==='Enter')submit()});
    setTimeout(()=>input.focus(),50);
  }

  // Acceso heredado SOLO si viene de un clic real dentro del portal (referrer) o de un
  // "handoff" reciente (nonce de un solo uso, 60s) escrito por la página de origen — nunca
  // por el solo hecho de tener la clave guardada. Así, un enlace guardado y abierto después
  // sin pasar por el índice vuelve a pedir la clave, aunque la sesión global siga vigente.
  const TAB_KEY=TAB_PREFIX+location.pathname;
  function tabGranted(){
    try{return sessionStorage.getItem(TAB_KEY)===TOKEN}catch(e){return false}
  }
  function grantTab(){try{sessionStorage.setItem(TAB_KEY,TOKEN)}catch(e){}}
  function portalReferrer(){
    if(!document.referrer)return false;
    try{
      const r=new URL(document.referrer);
      if(r.origin!==location.origin)return false;
      // Basado solo en el nombre del archivo del índice (VGME_Index.html), sin asumir en qué
      // carpeta del sitio vive — así funciona sin importar la profundidad de cada módulo.
      const file=r.pathname.split('/').pop()||'';
      return /^vgme_index(\.html)?$/i.test(file);
    }catch(e){return false}
  }
  function consumeHandoff(){
    let nonce='';
    try{nonce=new URL(location.href).searchParams.get('vgme_handoff')||''}catch(e){}
    if(!nonce)return false;
    let h=null;
    try{h=JSON.parse(localStorage.getItem(HANDOFF)||'null')}catch(e){}
    let ok=!!(h&&h.token===TOKEN&&h.nonce===nonce&&h.path===location.pathname&&Number.isFinite(+h.exp)&&Date.now()<+h.exp&&valid());
    try{localStorage.removeItem(HANDOFF)}catch(e){}
    try{
      const u=new URL(location.href);u.searchParams.delete('vgme_handoff');
      history.replaceState(null,'',u.pathname+(u.search?u.search:'')+(u.hash?u.hash:''));
    }catch(e){}
    return ok;
  }
  function start(){
    const globalOk=valid();
    const inherited=globalOk&&(consumeHandoff()||portalReferrer()||tabGranted());
    if(inherited){grantTab();unlock();addLogout()}
    else gate(grantTab);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
