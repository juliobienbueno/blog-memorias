// Panel de "Camino al andar": habla directamente con Supabase (sin librerías externas).
// La seguridad la dan los usuarios de Supabase y las reglas de la base de datos:
// sin sesión iniciada, nadie puede crear, editar ni borrar columnas.
(function(){
'use strict';
const C=window.CONFIG, N=window.Nucleo;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();

// ================= Supabase =================
const CLAVE_SESION='cal-sesion';
let sesion=null;
try{sesion=JSON.parse(sessionStorage.getItem(CLAVE_SESION)||'null');}catch{}
function guardarSesion(d){
  sesion=d?{access_token:d.access_token,refresh_token:d.refresh_token,expira:Date.now()+(d.expires_in||3600)*1000,email:(d.user&&d.user.email)||(sesion&&sesion.email)||''}:null;
  try{sesion?sessionStorage.setItem(CLAVE_SESION,JSON.stringify(sesion)):sessionStorage.removeItem(CLAVE_SESION);}catch{}
}
async function leerRespuesta(r){
  const t=await r.text();let d=null;try{d=t?JSON.parse(t):null;}catch{}
  if(!r.ok){
    const m=d&&(d.msg||d.message||d.error_description||d.error)||t||('Error '+r.status);
    const e=new Error(traducir(m));e.status=r.status;throw e;
  }
  return d;
}
function traducir(m){
  m=String(m);
  if(/invalid login credentials/i.test(m))return 'Correo o contraseña incorrectos.';
  if(/email not confirmed/i.test(m))return 'Este correo aún no está confirmado.';
  if(/password should be at least/i.test(m))return 'La contraseña es muy corta.';
  if(/same.*password|different from the old/i.test(m))return 'La contraseña nueva debe ser distinta de la actual.';
  if(/rate limit|too many/i.test(m))return 'Demasiados intentos. Espera unos minutos.';
  if(/jwt expired|invalid jwt/i.test(m))return 'Tu sesión terminó. Vuelve a entrar.';
  if(/row-level security|permission denied/i.test(m))return 'No tienes permiso para hacer esto. Vuelve a entrar.';
  if(/mensajes/.test(m)&&/does not exist|could not find the table|PGRST205/i.test(m))return 'Falta crear la tabla de mensajes en Supabase: ejecuta el archivo supabase/mensajes.sql en el SQL Editor.';
  if(/failed to fetch|networkerror/i.test(m))return 'No hay conexión con el servidor. Revisa tu internet.';
  return m;
}
async function auth(ruta,cuerpo,{metodo='POST',conSesion=false}={}){
  const h={apikey:C.supabaseKey,'Content-Type':'application/json'};
  if(conSesion)h.Authorization='Bearer '+(await token());
  const r=await fetch(C.supabaseUrl+'/auth/v1/'+ruta,{method:metodo,headers:h,body:cuerpo?JSON.stringify(cuerpo):undefined});
  return leerRespuesta(r);
}
let renovando=null;
async function token(){
  if(!sesion)throw Object.assign(new Error('Tu sesión terminó. Vuelve a entrar.'),{status:401});
  if(Date.now()>sesion.expira-60000){
    renovando=renovando||auth('token?grant_type=refresh_token',{refresh_token:sesion.refresh_token}).then(guardarSesion).finally(()=>renovando=null);
    try{await renovando;}catch(e){guardarSesion(null);throw Object.assign(new Error('Tu sesión terminó. Vuelve a entrar.'),{status:401});}
  }
  return sesion.access_token;
}
async function rest(ruta,{metodo='GET',cuerpo,prefer,headers={}}={}){
  const h={apikey:C.supabaseKey,Authorization:'Bearer '+(await token()),...headers};
  if(cuerpo!==undefined)h['Content-Type']='application/json';
  if(prefer)h.Prefer=prefer;
  const r=await fetch(C.supabaseUrl+'/rest/v1/'+ruta,{method:metodo,headers:h,body:cuerpo!==undefined?JSON.stringify(cuerpo):undefined});
  try{return await leerRespuesta(r);}catch(e){if(e.status===401)salirForzado();throw e;}
}
async function subirOriginal(id,archivo){
  const r=await fetch(`${C.supabaseUrl}/storage/v1/object/originales/${encodeURIComponent(id)}.docx`,{method:'POST',
    headers:{apikey:C.supabaseKey,Authorization:'Bearer '+(await token()),'x-upsert':'true','Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},body:archivo});
  return leerRespuesta(r);
}
async function borrarOriginal(id){
  try{await fetch(`${C.supabaseUrl}/storage/v1/object/originales`,{method:'DELETE',
    headers:{apikey:C.supabaseKey,Authorization:'Bearer '+(await token()),'Content-Type':'application/json'},body:JSON.stringify({prefixes:[id+'.docx']})});}catch{}
}
const DB={
  lista:()=>rest('columnas?select=id,titulo,bajada,fecha,anio,mes,tema,archivo,avisos,editado_en_panel,texto&order=anio.asc.nullslast,mes.asc.nullsfirst,titulo.asc'),
  una:async id=>(await rest('columnas?select=*&id=eq.'+encodeURIComponent(id)))[0]||null,
  guardar:regs=>rest('columnas?on_conflict=id',{metodo:'POST',cuerpo:regs,prefer:'resolution=merge-duplicates,return=representation'}),
  cambiar:async(id,campos)=>(await rest('columnas?id=eq.'+encodeURIComponent(id),{metodo:'PATCH',cuerpo:campos,prefer:'return=representation'}))[0],
  borrar:id=>rest('columnas?id=eq.'+encodeURIComponent(id),{metodo:'DELETE'}),
  todas:async()=>{const t=[];for(let d=0;;d+=500){const l=await rest(`columnas?select=*&order=id&offset=${d}&limit=500`);t.push(...l);if(l.length<500)return t;}},
  ajuste:async k=>((await rest('ajustes?select=valor&clave=eq.'+k))[0]||{}).valor||'',
  mensajes:()=>rest('mensajes?select=id,texto,fecha,actualizado_por&order=id'),
  nuevoMensaje:m=>rest('mensajes',{metodo:'POST',cuerpo:[m],prefer:'return=representation'}),
  cambiarMensaje:async(id,m)=>(await rest('mensajes?id=eq.'+id,{metodo:'PATCH',cuerpo:m,prefer:'return=representation'}))[0],
  borrarMensaje:id=>rest('mensajes?id=eq.'+id,{metodo:'DELETE'}),
  fijarAjuste:(k,v)=>rest('ajustes?on_conflict=clave',{metodo:'POST',cuerpo:[{clave:k,valor:v}],prefer:'resolution=merge-duplicates'})
};

// ================= Publicación en Vercel =================
let hook='',timerPub=null,cuentaPub=0;
const ESPERA_PUB=20;
function barraPub(txt,clase,boton=true){const b=$('#publicar');b.hidden=false;b.className='publicar '+(clase||'');$('#pub-txt').textContent=txt;$('#pub-ahora').hidden=!boton;}
function hayCambios(){
  if(!hook){barraPub('Los cambios quedaron guardados. Para que el sitio se actualice solo, agrega la dirección de publicación en Ajustes.','error',false);return;}
  clearInterval(timerPub);cuentaPub=ESPERA_PUB;
  const tic=()=>{if(cuentaPub<=0){clearInterval(timerPub);publicar();return;}barraPub(`Cambios guardados. Se publicarán en el sitio en ${cuentaPub} s…`,'pendiente');cuentaPub--;};
  tic();timerPub=setInterval(tic,1000);
}
async function publicar(){
  clearInterval(timerPub);
  if(!hook){barraPub('Falta la dirección de publicación (Ajustes).','error',false);return;}
  try{
    await fetch(hook,{method:'POST',mode:'no-cors'});
    barraPub('Publicando… el sitio estará al día en uno o dos minutos.','ok',false);
    setTimeout(()=>{if($('#publicar').classList.contains('ok'))$('#publicar').hidden=true;},90000);
  }catch(e){barraPub('No se pudo avisar a Vercel: '+traducir(e.message),'error');}
}
$('#pub-ahora').onclick=publicar;
addEventListener('beforeunload',e=>{if(cuentaPub>0||sucio){e.preventDefault();e.returnValue='';}});

// ================= Vistas =================
function mostrar(v){
  for(const id of ['v-acceso','v-lista','v-editor','v-mensajes'])$('#'+id).hidden=id!==v;
  $('#acciones').hidden=v==='v-acceso';
}
function formAcceso(f){for(const id of ['f-entrar','f-recuperar','f-nueva'])$('#'+id).hidden=id!==f;mostrar('v-acceso');const i=$('#'+f+' input');if(i)i.focus();}
function salirForzado(){guardarSesion(null);formAcceso('f-entrar');$('#a-msg').textContent='Tu sesión terminó. Vuelve a entrar.';}

$('#f-entrar').addEventListener('submit',async e=>{
  e.preventDefault();$('#a-msg').textContent='';$('#a-boton').disabled=true;
  try{guardarSesion(await auth('token?grant_type=password',{email:$('#a-correo').value.trim(),password:$('#a-clave').value}));$('#a-clave').value='';await iniciar();}
  catch(err){$('#a-msg').textContent=err.message;}
  finally{$('#a-boton').disabled=false;}
});
$('#a-olvide').onclick=()=>{$('#r-correo').value=$('#a-correo').value;$('#r-msg').textContent='';formAcceso('f-recuperar');};
$('#r-volver').onclick=()=>formAcceso('f-entrar');
$('#f-recuperar').addEventListener('submit',async e=>{
  e.preventDefault();const m=$('#r-msg');m.className='msg';m.textContent='';
  try{await auth('recover?redirect_to='+encodeURIComponent(location.origin+location.pathname),{email:$('#r-correo').value.trim()});
    m.className='msg ok';m.textContent='Listo. Si el correo está registrado, te llegará un enlace en unos minutos (revisa también la carpeta de spam).';}
  catch(err){m.textContent=err.message;}
});
$('#f-nueva').addEventListener('submit',async e=>{
  e.preventDefault();const m=$('#n-msg');m.textContent='';
  if($('#n-clave').value!==$('#n-clave2').value){m.textContent='Las contraseñas no coinciden.';return;}
  try{await auth('user',{password:$('#n-clave').value},{metodo:'PUT',conSesion:true});await iniciar();}
  catch(err){m.textContent=err.message;}
});
$('#b-salir').onclick=async()=>{
  if(sucio){estado('Guarda los cambios antes de salir.','error');return;}
  try{await auth('logout',null,{conSesion:true});}catch{}
  guardarSesion(null);location.hash='';formAcceso('f-entrar');
};

// Cambiar contraseña
const dc=$('#d-clave'),da=$('#d-ajustes');
document.querySelectorAll('[data-cerrar]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('#b-clave').onclick=()=>{$('#f-clave').reset();$('#c-msg').textContent='';dc.showModal();};
$('#f-clave').addEventListener('submit',async e=>{
  e.preventDefault();
  if($('#c-nueva').value!==$('#c-nueva2').value){$('#c-msg').textContent='Las contraseñas no coinciden.';return;}
  try{await auth('user',{password:$('#c-nueva').value},{metodo:'PUT',conSesion:true});dc.close();nota('ok','Contraseña cambiada.');}
  catch(err){$('#c-msg').textContent=err.message;}
});

// Ajustes y respaldo
$('#b-ajustes').onclick=async()=>{$('#j-msg').textContent='';$('#j-resp').textContent='';$('#j-hook').value=hook;da.showModal();};
$('#f-ajustes').addEventListener('submit',async e=>{
  e.preventDefault();const v=$('#j-hook').value.trim(),m=$('#j-msg');m.className='msg';
  if(v&&!/^https:\/\/api\.vercel\.com\//.test(v)){m.textContent='Debe ser una dirección de Vercel que empiece con https://api.vercel.com/';return;}
  try{await DB.fijarAjuste('vercel_deploy_hook',v);hook=v;m.className='msg ok';m.textContent='Guardado.';}catch(err){m.textContent=err.message;}
});
$('#j-bajar').onclick=async()=>{
  const m=$('#j-resp');m.className='msg';m.textContent='Preparando…';
  try{const t=await DB.todas();const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([JSON.stringify(t,null,1)],{type:'application/json'}));
    a.download=`camino-al-andar-respaldo-${new Date().toISOString().slice(0,10)}.json`;a.click();
    m.className='msg ok';m.textContent=`Respaldo con ${t.length} columnas descargado.`;}
  catch(err){m.textContent=err.message;}
};
const CAMPOS_DB=['id','titulo','bajada','fecha','fecha_original','fecha_manual','anio','mes','tema','notas','epigrafe','cuerpo','texto','archivo','avisos','editado_en_panel'];
function aRegistro(x){
  // acepta el formato de la base de datos y el de la versión de escritorio (columnas.json)
  const r={id:x.id,titulo:x.titulo,bajada:x.bajada||'',fecha:x.fecha||'',fecha_original:x.fecha_original??x.fechaOriginal??'',
    fecha_manual:x.fecha_manual??x.fechaManual??null,anio:x.anio||null,mes:x.mes||null,tema:x.tema||'',notas:x.notas||[],epigrafe:x.epigrafe||[],
    cuerpo:x.cuerpo||[],texto:x.texto||'',archivo:x.archivo||'',avisos:x.avisos||[],editado_en_panel:x.editado_en_panel??x.editadoEnPanel??null,
    actualizado_por:sesion&&sesion.email};
  return r;
}
$('#j-subir').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;const m=$('#j-resp');m.className='msg';
  try{
    let datos=JSON.parse((await f.text()).replace(/^﻿/,''));
    if(!Array.isArray(datos))throw new Error('El archivo no tiene el formato de un respaldo.');
    datos=datos.filter(x=>x&&x.id&&x.titulo&&!x.ejemplo).map(aRegistro);
    if(!datos.length)throw new Error('El respaldo no trae columnas.');
    for(let i=0;i<datos.length;i+=20){m.textContent=`Cargando ${Math.min(i+20,datos.length)} de ${datos.length}…`;await DB.guardar(datos.slice(i,i+20));}
    m.className='msg ok';m.textContent=`Listo: ${datos.length} columnas cargadas.`;await cargar();hayCambios();
  }catch(err){m.textContent='No se pudo cargar: '+err.message;}
};

// ================= Lista =================
let cols=[];
function nota(clase,html){const li=document.createElement('li');li.className=clase;li.innerHTML=html;$('#log').prepend(li);return li;}
async function cargar(){
  try{cols=await DB.lista();pintar();}
  catch(err){$('#filas').innerHTML=`<tr><td colspan="5" class="vacio">${esc(err.message)}</td></tr>`;}
}
function pintar(){
  const q=norm($('#filtro').value),solo=$('#soloAvisos').checked;
  const vis=cols.filter(c=>(!solo||(c.avisos||[]).length)&&(!q||norm(c.titulo).includes(q)));
  const conAviso=cols.filter(c=>(c.avisos||[]).length).length;
  $('#cuenta').textContent=` · ${cols.length} columna${cols.length===1?'':'s'}${conAviso?` · ${conAviso} por revisar`:''}`;
  $('#filas').innerHTML=vis.length?vis.map(c=>`<tr data-id="${esc(c.id)}">
    <td class="t"><a href="/columnas/${esc(c.id)}.html" target="_blank" rel="noopener">${esc(c.titulo)}</a>${c.bajada?`<small>${esc(c.bajada)}</small>`:''}
      ${c.editado_en_panel?'<span class="chip ed">editada en el panel</span> ':''}${(c.avisos||[]).map(a=>`<span class="chip">${esc(a)}</span>`).join(' ')}</td>
    <td><input data-campo="fecha" value="${esc(c.fecha)}" placeholder="Julio de 1990" aria-label="Fecha"></td>
    <td><input data-campo="tema" value="${esc(c.tema)}" placeholder="Sin tema" aria-label="Tema"></td>
    <td class="n">${N.contarPalabras(c.texto).toLocaleString('es-CL')}</td>
    <td class="acc"><button class="btn chico" data-editar type="button">Editar</button><button class="btn chico peligro" data-quitar type="button">Quitar</button></td></tr>`).join('')
    :`<tr><td colspan="5" class="vacio">${cols.length?'Ninguna coincide.':'Aún no hay columnas. Arrastra los Word arriba.'}</td></tr>`;
}
$('#filtro').oninput=pintar;$('#soloAvisos').onchange=pintar;
$('#filas').addEventListener('change',async e=>{
  const inp=e.target.closest('input[data-campo]');if(!inp)return;
  const id=inp.closest('tr').dataset.id,c=cols.find(x=>x.id===id);
  const campos=inp.dataset.campo==='tema'?{tema:inp.value.trim()}:(()=>{const r=N.aplicarFecha({avisos:c.avisos},inp.value);return {fecha:r.fecha,fecha_manual:r.fecha_manual,anio:r.anio,mes:r.mes,avisos:r.avisos};})();
  try{const r=await DB.cambiar(id,{...campos,actualizado_por:sesion.email});Object.assign(c,r);inp.classList.add('guardado');setTimeout(pintar,700);hayCambios();}
  catch(err){nota('error',esc(err.message));}
});
$('#filas').addEventListener('click',async e=>{
  const ed=e.target.closest('[data-editar]');
  if(ed){location.hash='editar/'+ed.closest('tr').dataset.id;return;}
  const b=e.target.closest('[data-quitar]');if(!b)return;
  if(!b.classList.contains('si')){b.classList.add('si');b.textContent='¿Seguro?';setTimeout(()=>{if(b.isConnected){b.classList.remove('si');b.textContent='Quitar';}},3000);return;}
  const id=b.closest('tr').dataset.id;
  try{await DB.borrar(id);borrarOriginal(id);cols=cols.filter(c=>c.id!==id);pintar();hayCambios();}catch(err){nota('error',esc(err.message));}
});

// ================= Carga de Word =================
async function inflar(datos){
  const s=new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
const zona=$('#zona');
['dragenter','dragover'].forEach(ev=>zona.addEventListener(ev,e=>{e.preventDefault();zona.classList.add('encima');}));
['dragleave','drop'].forEach(ev=>zona.addEventListener(ev,e=>{e.preventDefault();zona.classList.remove('encima');}));
zona.addEventListener('drop',e=>subir([...e.dataTransfer.files]));
$('#archivo').onchange=e=>{subir([...e.target.files]);e.target.value='';};
async function subir(archivos){
  archivos=archivos.filter(f=>/\.docx?$/i.test(f.name)&&!f.name.startsWith('~$'));
  let alguno=false;
  for(const f of archivos){
    const li=nota('',`Cargando ${esc(f.name)}…`);
    try{
      if(/\.doc$/i.test(f.name))throw new Error('Está en el formato antiguo .doc. Ábrelo en Word y usa «Guardar como» → Documento de Word (.docx).');
      const d=await N.leerWord(new Uint8Array(await f.arrayBuffer()),inflar);
      const id=N.slug(d.titulo);
      const previa=await DB.una(id);
      const reg={id,titulo:d.titulo,bajada:d.bajada,notas:d.notas,epigrafe:d.epigrafe,fecha:d.fecha,fecha_original:d.fechaOriginal,anio:d.anio,mes:d.mes,
        texto:d.texto,cuerpo:d.cuerpo,archivo:f.name,avisos:d.avisos,editado_en_panel:null,tema:previa?previa.tema:'',
        fecha_manual:previa?previa.fecha_manual:null,actualizado_por:sesion.email};
      // si antes se corrigió la fecha a mano y el Word sigue sin año válido, se mantiene la corrección
      if(reg.fecha_manual&&(!d.anio||d.avisos.some(a=>/año/.test(a))))N.aplicarFecha(reg,reg.fecha_manual);
      await DB.guardar([reg]);alguno=true;
      let aviso='';try{await subirOriginal(id,f);}catch(err){aviso=' · No se guardó una copia del Word original: '+err.message;}
      li.className=reg.avisos.length?'aviso':'ok';
      li.innerHTML=`${previa?'Actualizada':'Nueva'}: <b>${esc(reg.titulo)}</b>${reg.fecha?` · ${esc(reg.fecha)}`:''}<small>${esc(f.name)}${reg.avisos.length?' · Revisar: '+esc(reg.avisos.join('; ')):''}${esc(aviso)}</small>`;
    }catch(err){li.className='error';li.innerHTML=`No se pudo cargar <b>${esc(f.name)}</b><small>${esc(err.message)}</small>`;}
  }
  if(alguno){await cargar();hayCambios();}
}

// ================= Editor =================
const CAMPOS={titulo:'#e-titulo',bajada:'#e-bajada',fecha:'#e-fecha',tema:'#e-tema',epigrafe:'#e-epigrafe',notas:'#e-nota',cuerpo:'#e-cuerpo'};
let actual=null,registro=null,original={},sucio=false;
function estado(txt,clase=''){for(const e of [$('#ed-estado'),$('#ed-estado2')]){e.textContent=txt;e.className='estado '+clase;}}
function crecer(t){t.style.height='auto';t.style.height=Math.max(t.scrollHeight+4,t.id==='e-cuerpo'?innerHeight*.65:0)+'px';}
function valores(){const v={};for(const [k,s] of Object.entries(CAMPOS))v[k]=$(s).value;return v;}
function editable(r){return {titulo:r.titulo,bajada:r.bajada||'',fecha:r.fecha||'',tema:r.tema||'',
  epigrafe:N.listaAEditable(r.epigrafe),notas:N.listaAEditable(r.notas),cuerpo:N.cuerpoAEditable(r.cuerpo)};}
function llenar(r){
  registro=r;actual=r.id;original=editable(r);
  for(const [k,s] of Object.entries(CAMPOS))$(s).value=original[k];
  $('#ed-ver').href='/columnas/'+r.id+'.html';
  const quien=r.actualizado_por?` por ${r.actualizado_por}`:'';
  $('#ed-origen').textContent=(r.archivo?`Cargada desde «${r.archivo}».`:'')+(r.editado_en_panel?` Editada en el panel el ${new Date(r.editado_en_panel).toLocaleString('es-CL')}${quien}.`:'');
  sucio=false;estado((r.avisos||[]).length?'Revisar: '+r.avisos.join('; '):'Sin cambios');
  document.querySelectorAll('.editor textarea').forEach(crecer);
}
async function abrirEditor(id){
  mostrar('v-editor');scrollTo(0,0);estado('Cargando…');
  try{const r=await DB.una(id);if(!r)throw new Error('No existe esa columna.');llenar(r);$('#e-cuerpo').setSelectionRange(0,0);}
  catch(err){estado(err.message,'error');}
}
function cerrarEditor(){mostrar('v-lista');actual=null;registro=null;cargar();}
$('#v-editor').addEventListener('input',e=>{
  if(e.target.matches('textarea'))crecer(e.target);
  const v=valores();sucio=Object.keys(CAMPOS).some(k=>v[k]!==original[k]);
  estado(sucio?'Cambios sin guardar':'Sin cambios',sucio?'sucio':'');
});
async function guardar(){
  if(!actual||!sucio)return;
  const v=valores(),c={};
  if(v.titulo!==original.titulo){if(!v.titulo.trim()){estado('El título no puede quedar vacío.','error');return;}c.titulo=v.titulo.replace(/\s+/g,' ').trim();}
  if(v.bajada!==original.bajada)c.bajada=v.bajada.replace(/\s+/g,' ').trim();
  if(v.tema!==original.tema)c.tema=v.tema.trim();
  if(v.fecha!==original.fecha){const r=N.aplicarFecha({avisos:registro.avisos},v.fecha);Object.assign(c,{fecha:r.fecha,fecha_manual:r.fecha_manual,anio:r.anio,mes:r.mes,avisos:r.avisos});}
  if(v.notas!==original.notas)c.notas=N.editableALista(v.notas);
  if(v.epigrafe!==original.epigrafe)c.epigrafe=N.editableALista(v.epigrafe,{html:true});
  if(v.cuerpo!==original.cuerpo){c.cuerpo=N.editableACuerpo(v.cuerpo);c.texto=N.cuerpoATexto(c.cuerpo);}
  if(['titulo','bajada','notas','epigrafe','cuerpo'].some(k=>k in c))c.editado_en_panel=new Date().toISOString();
  c.actualizado_por=sesion.email;
  $('#ed-guardar').disabled=$('#ed-guardar2').disabled=true;estado('Guardando…');
  try{const pos=$('#e-cuerpo').selectionStart;llenar(await DB.cambiar(actual,c));$('#e-cuerpo').setSelectionRange(pos,pos);
    estado('Guardado.','ok');hayCambios();}
  catch(err){estado('No se guardó: '+err.message,'error');}
  finally{$('#ed-guardar').disabled=$('#ed-guardar2').disabled=false;}
}
$('#ed-guardar').onclick=$('#ed-guardar2').onclick=guardar;
addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'&&actual){e.preventDefault();guardar();}});
let avisoSalir=false;
$('#ed-volver').onclick=()=>{
  if(sucio&&!avisoSalir){avisoSalir=true;estado('Tienes cambios sin guardar. Pulsa de nuevo «Volver» para descartarlos.','error');setTimeout(()=>avisoSalir=false,4000);return;}
  avisoSalir=false;sucio=false;location.hash='';
};
function ruta(){const m=location.hash.match(/^#editar\/([\w-]+)$/);if(m)abrirEditor(m[1]);else if(location.hash==='#mensajes'){actual=null;abrirMensajes();}else if(actual||$('#v-lista').hidden)cerrarEditor();}
addEventListener('hashchange',()=>{
  if(!sesion)return;
  if(sucio&&!location.hash.startsWith('#editar/'+actual)){history.replaceState(null,'','#editar/'+actual);estado('Tienes cambios sin guardar. Guarda o pulsa dos veces «Volver» para descartarlos.','error');return;}
  ruta();
});

// ================= Mensajes del día =================
let msjs=[];
const LARGO_IDEAL=160;
const diaLargo=iso=>{const [y,m,d]=iso.split('-').map(Number);return new Date(Date.UTC(y,m-1,d,12)).toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});};
const sumarDias=(iso,n)=>{const [y,m,d]=iso.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10);};
async function abrirMensajes(){
  mostrar('v-mensajes');scrollTo(0,0);
  try{msjs=await DB.mensajes();pintarMensajes();}
  catch(err){$('#m-lista').innerHTML=`<li class="vacio">${esc(err.message)}</li>`;$('#m-hoy').textContent='';$('#m-prox').innerHTML='';}
}
function pintarMensajes(){
  const hoy=N.hoyChile(),m=N.mensajeDelDia(msjs,hoy);
  const sinFecha=msjs.filter(x=>!x.fecha).length;
  $('#m-cuenta').textContent=` · ${msjs.length} mensaje${msjs.length===1?'':'s'}${msjs.length?` · ${sinFecha} se turnan`:''}`;
  $('#m-hoy').innerHTML=m?`Hoy, ${esc(diaLargo(hoy))}, se muestra: <q>${esc(m.texto)}</q>`:'Todavía no hay mensajes: bajo el título de la portada no aparece nada. Agrega el primero aquí abajo.';
  $('#m-prox').innerHTML=msjs.length?[...Array(7)].map((_,i)=>{const d=sumarDias(hoy,i),x=N.mensajeDelDia(msjs,d);
    return `<li><b>${i===0?'Hoy':i===1?'Mañana':esc(diaLargo(d).replace(/ de \d{4}$/,'').replace(/^./,c=>c.toUpperCase()))}</b><span>${x?esc(x.texto):'<i>(nada)</i>'}${x&&x.fecha?' <span class="chip">con fecha</span>':''}</span></li>`;}).join(''):'';
  const orden=[...msjs].sort((a,b)=>(a.fecha?0:1)-(b.fecha?0:1)||String(a.fecha||'').localeCompare(String(b.fecha||''))||a.id-b.id);
  $('#m-lista').innerHTML=orden.length?orden.map(x=>`<li data-id="${x.id}">
    <div><textarea data-c="texto" maxlength="400" aria-label="Texto del mensaje">${esc(x.texto)}</textarea>
      ${x.fecha&&x.fecha<hoy?'<span class="chip">esa fecha ya pasó</span>':''}${x.texto.length>LARGO_IDEAL?' <span class="chip">largo: en el celular puede quedar cortado</span>':''}</div>
    <input data-c="fecha" type="date" value="${esc(x.fecha||'')}" aria-label="Fecha (opcional)" title="Déjala vacía para que se turne con los demás">
    <div class="acc"><button class="btn chico" data-guardar type="button">Guardar</button><button class="btn chico peligro" data-quitar type="button">Quitar</button></div></li>`).join('')
    :'<li class="vacio">Aún no hay mensajes.</li>';
}
function largoNuevo(){const n=$('#m-texto').value.trim().length;$('#m-largo').textContent=n?`${n} caracteres${n>LARGO_IDEAL?' · un poco largo: en el celular puede quedar cortado':''}`:'';}
$('#m-texto').addEventListener('input',largoNuevo);
$('#f-msj').addEventListener('submit',async e=>{
  e.preventDefault();const t=$('#m-texto').value.replace(/\s+/g,' ').trim(),f=$('#m-fecha').value||null,msg=$('#m-msg');msg.className='msg';msg.textContent='';
  if(!t){msg.textContent='Escribe el mensaje.';return;}
  try{const [r]=await DB.nuevoMensaje({texto:t,fecha:f,actualizado_por:sesion.email});msjs.push(r);
    $('#f-msj').reset();largoNuevo();pintarMensajes();msg.className='msg ok';msg.textContent='Mensaje agregado.';hayCambios();}
  catch(err){msg.textContent=err.message;}
});
$('#m-lista').addEventListener('click',async e=>{
  const li=e.target.closest('li[data-id]');if(!li)return;const id=+li.dataset.id;
  if(e.target.closest('[data-guardar]')){
    const t=li.querySelector('[data-c=texto]').value.replace(/\s+/g,' ').trim(),f=li.querySelector('[data-c=fecha]').value||null;
    if(!t){nota('error','El mensaje no puede quedar vacío. Usa «Quitar» para borrarlo.');return;}
    try{const r=await DB.cambiarMensaje(id,{texto:t,fecha:f,actualizado_por:sesion.email});Object.assign(msjs.find(x=>x.id===id),r);
      li.querySelectorAll('textarea,input').forEach(x=>x.classList.add('guardado'));setTimeout(pintarMensajes,700);hayCambios();}
    catch(err){alertaMsj(li,err.message);}
    return;
  }
  const b=e.target.closest('[data-quitar]');if(!b)return;
  if(!b.classList.contains('si')){b.classList.add('si');b.textContent='¿Seguro?';setTimeout(()=>{if(b.isConnected){b.classList.remove('si');b.textContent='Quitar';}},3000);return;}
  try{await DB.borrarMensaje(id);msjs=msjs.filter(x=>x.id!==id);pintarMensajes();hayCambios();}catch(err){alertaMsj(li,err.message);}
});
function alertaMsj(li,t){let p=li.querySelector('.msg');if(!p){p=document.createElement('p');p.className='msg';li.firstElementChild.append(p);}p.textContent=t;}

// ================= Inicio =================
async function iniciar(){
  $('#quien').textContent=sesion.email;
  mostrar('v-lista');
  try{hook=await DB.ajuste('vercel_deploy_hook');}catch{hook='';}
  await cargar();ruta();
}
(function arrancar(){
  if(!C||!C.supabaseUrl||!C.supabaseKey){document.body.innerHTML='<p style="padding:30px">Falta configurar Supabase en sitio.config.json.</p>';return;}
  // regreso desde el correo de recuperación de contraseña: #access_token=…&type=recovery
  const h=new URLSearchParams(location.hash.slice(1));
  if(h.get('access_token')){
    guardarSesion({access_token:h.get('access_token'),refresh_token:h.get('refresh_token'),expires_in:+h.get('expires_in')||3600});
    history.replaceState(null,'',location.pathname);
    auth('user',null,{metodo:'GET',conSesion:true}).then(u=>{sesion.email=u.email;guardarSesion({...sesion,expires_in:(sesion.expira-Date.now())/1000,user:u});}).catch(()=>{});
    if(h.get('type')==='recovery'){formAcceso('f-nueva');return;}
  }
  if(h.get('error_description')){history.replaceState(null,'',location.pathname);formAcceso('f-entrar');$('#a-msg').textContent='El enlace no es válido o ya venció. Pide uno nuevo.';return;}
  if(sesion)iniciar().catch(()=>salirForzado());else formAcceso('f-entrar');
})();
})();
