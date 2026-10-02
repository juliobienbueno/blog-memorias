// Núcleo de "Camino al andar": lee Word (.docx), entiende fechas y convierte el texto editable.
// Funciona igual en el navegador (panel) y en Node (construcción del sitio en Vercel). Sin dependencias.
(function(raiz,fabrica){
  if(typeof module==='object'&&module.exports)module.exports=fabrica();
  else raiz.Nucleo=fabrica();
})(typeof self!=='undefined'?self:this,function(){
'use strict';

// ---------- abrir el .docx (es un .zip) ----------
// inflar(Uint8Array) → Promise<Uint8Array>  (descomprime "deflate-raw")
async function abrirDocx(bytes,inflar){
  const u8=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);
  let eocd=-1;
  for(let i=u8.length-22;i>=Math.max(0,u8.length-65557);i--){if(dv.getUint32(i,true)===0x06054b50){eocd=i;break;}}
  if(eocd<0)throw new Error('no parece un archivo Word (.docx)');
  const n=dv.getUint16(eocd+10,true);let p=dv.getUint32(eocd+16,true);
  const dec=new TextDecoder('utf-8');
  for(let k=0;k<n;k++){
    if(dv.getUint32(p,true)!==0x02014b50)break;
    const metodo=dv.getUint16(p+10,true),tam=dv.getUint32(p+20,true);
    const ln=dv.getUint16(p+28,true),le=dv.getUint16(p+30,true),lc=dv.getUint16(p+32,true);
    const off=dv.getUint32(p+42,true);
    const nombre=dec.decode(u8.subarray(p+46,p+46+ln));
    if(nombre==='word/document.xml'){
      const ini=off+30+dv.getUint16(off+26,true)+dv.getUint16(off+28,true);
      const datos=u8.subarray(ini,ini+tam);
      return dec.decode(metodo===8?await inflar(datos):datos);
    }
    p+=46+ln+le+lc;
  }
  throw new Error('no se encontró el contenido del documento');
}
async function leerWord(bytes,inflar){return leerWordXml(await abrirDocx(bytes,inflar));}

// ---------- XML de Word a líneas ----------
const ENT={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
const desEnt=s=>s.replace(/&(#x?[0-9a-f]+|\w+);/gi,(m,e)=>e[0]==='#'?String.fromCodePoint(e[1]==='x'||e[1]==='X'?parseInt(e.slice(2),16):+e.slice(1)):(ENT[e]??m));
const activo=(rpr,tag)=>{const m=rpr.match(new RegExp(`<w:${tag}(?:\\s[^>]*)?/?>`));return !!m&&!/w:val="(0|false|none)"/.test(m[0]);};
function esRojo(hex){
  if(!/^[0-9a-f]{6}$/i.test(hex||''))return false;
  const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);
  return r>=150&&g<90&&b<90;
}

// Cada párrafo de Word se divide en "líneas" en los saltos de línea (Mayús+Enter),
// porque muchas columnas separan así el intertítulo del texto o la fecha del texto.
function lineasDeXml(xml){
  const cuerpo=(xml.match(/<w:body>([\s\S]*)<\/w:body>/)||[,xml])[1];
  const lineas=[];
  for(const pm of cuerpo.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)){
    const p=pm[0];
    const ppr=(p.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/)||[,''])[1];
    const centrado=/<w:jc w:val="center"/.test(ppr);
    let actual=[];
    const cerrar=()=>{lineas.push({runs:actual,centrado});actual=[];};
    for(const rm of p.matchAll(/<w:r[\s>][\s\S]*?<\/w:r>/g)){
      const r=rm[0];
      const rpr=(r.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)||[,''])[1];
      const fmt={b:activo(rpr,'b'),i:activo(rpr,'i'),rojo:esRojo((rpr.match(/<w:color w:val="(\w+)"/)||[,''])[1]),
        resaltado:/<w:highlight w:val="(?!none)\w+"/.test(rpr)};
      for(const tm of r.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br(?:\s[^>]*)?\/>|<w:cr\/>|<w:noBreakHyphen\/>/g)){
        if(tm[1]!==undefined)actual.push({t:desEnt(tm[1]),...fmt});
        else if(/^<w:(br|cr)/.test(tm[0])){if(!/w:type="page"/.test(tm[0]))cerrar();}
        else if(tm[0].startsWith('<w:tab'))actual.push({t:' ',...fmt});
        else actual.push({t:'-',...fmt});
      }
    }
    cerrar();
  }
  return lineas.map(l=>{
    const texto=l.runs.map(r=>r.t).join('').replace(/\s+/g,' ').trim();
    const cuenta=k=>{let s=0,t=0;for(const r of l.runs){const n=r.t.replace(/\s/g,'').length;t+=n;if(r[k])s+=n;}return t?s/t:0;};
    return {...l,texto,b:cuenta('b'),i:cuenta('i'),rojo:cuenta('rojo'),resaltado:cuenta('resaltado')};
  }).filter(l=>/[0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ¿¡"“]/.test(l.texto));
}

// ---------- fechas ----------
const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const NOMBRE_MES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const sinTilde=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
function distancia(a,b){
  const d=Array.from({length:a.length+1},(_,i)=>[i,...Array(b.length).fill(0)]);
  for(let j=1;j<=b.length;j++)d[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return d[a.length][b.length];
}
// Reconoce el mes aunque venga pegado ("Juliode") o con una letra de menos ("Julo")
function mesDe(palabra){
  const w=sinTilde(palabra.toLowerCase()).replace(/[^a-z]/g,'');
  if(w.length<3)return 0;
  if(w==='setiembre')return 9;
  for(let k=0;k<12;k++){const m=MESES[k];if(w===m||(w.startsWith(m)&&/^(de)?$/.test(w.slice(m.length))))return k+1;}
  for(let k=0;k<12;k++){const m=MESES[k];if(distancia(w.replace(/de$/,''),m)<=1&&w.length>=4)return k+1;}
  return 0;
}
// Devuelve {anio, mes, texto, dudosa}
function leerFecha(t){
  const s=String(t||'').trim();
  const dmy=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if(dmy){let a=+dmy[3];if(a<100)a+=a<=30?2000:1900;const m=+dmy[2];
    return {anio:a,mes:m>=1&&m<=12?m:null,texto:m>=1&&m<=12?`${NOMBRE_MES[m-1]} de ${a}`:String(a),dudosa:false};}
  const palabras=s.replace(/^santiago\s*,?\s*/i,'').split(/[\s,.]+/).filter(Boolean);
  let mes=0;for(const p of palabras.slice(0,3)){mes=mesDe(p);if(mes)break;}
  const ya=s.match(/(?:^|\D)((?:19|20)\d\d)(?!\d)/);
  const raro=!ya&&s.match(/(?:19|20)\d{3,}/);
  const anio=ya?+ya[1]:null;
  const actual=new Date().getFullYear();
  const dudosa=!!raro||(anio&&(anio<1940||anio>actual));
  const texto=anio?(mes?`${NOMBRE_MES[mes-1]} de ${anio}`:String(anio)):s;
  return {anio,mes:mes||null,texto,dudosa};
}
function esFecha(t){
  const s=t.trim();
  if(s.length>45)return false;
  if(/^santiago\b/i.test(sinTilde(s)))return true;
  if(/^\(?\d{1,2}\/\d{1,2}\/\d{2,4}\)?\.?$/.test(s))return true;
  if(/^(año\s+)?(19|20)\d\d\.?$/i.test(s))return true;
  const primera=s.replace(/^\d{1,2}\s+de\s+/i,'').split(/[\s,]+/)[0];
  return !!mesDe(primera)&&/(19|20)\d\d/.test(s)&&s.split(/\s+/).length<=5;
}
// "Septiembre de 2000EN UN COLEGIO…" → ["Septiembre de 2000", "EN UN COLEGIO…"]
function separarFechaPegada(t){
  const m=t.match(/^((?:\d{1,2}\s+de\s+)?[A-Za-zÁÉÍÓÚáéíóú]+\s*(?:de)?\s*(?:19|20)\d\d)\s*(\S.{15,})$/);
  if(m&&esFecha(m[1]))return [m[1],m[2]];
  return null;
}

// ---------- texto ----------
const letras=t=>t.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g,'');
const todoMayus=t=>{const l=letras(t);return l.length>=3&&l===l.toUpperCase();};
const escHtml=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function htmlRuns(runs,{sinCursiva=false}={}){
  const g=[];
  for(const r of runs){const i=sinCursiva?false:r.i;const u=g[g.length-1];if(u&&u.b===r.b&&u.i===i)u.t+=r.t;else g.push({t:r.t,b:r.b,i});}
  return g.map(({t,b,i})=>{
    const m=t.match(/^(\s*)([\s\S]*?)(\s*)$/);let x=escHtml(m[2]);
    if(!x)return t.replace(/\s+/g,' ');
    if(i)x=`<em>${x}</em>`;if(b)x=`<strong>${x}</strong>`;
    return (m[1]?' ':'')+x+(m[3]?' ':'');
  }).join('').replace(/\s+/g,' ').replace(/^[.\s]+(?=\S)/,'').trim();
}
const cuantasBajada=b=>b.length;
const limpio=t=>t.replace(/^[.\s]+(?=\S)/,'').replace(/\s+/g,' ').trim();

// Devuelve { titulo, bajada, notas[], epigrafe[], fecha, fechaOriginal, anio, mes, texto, cuerpo[], avisos[] }
function leerWordXml(xml){
  if(!xml)throw new Error('no se encontró el contenido del documento');
  let ls=lineasDeXml(xml);
  if(!ls.length)throw new Error('el documento está vacío');
  // separa fechas pegadas al texto
  ls=ls.flatMap(l=>{const s=separarFechaPegada(l.texto);if(!s)return [l];
    return [{...l,texto:s[0],runs:[{t:s[0]}],b:0,i:0},{...l,texto:s[1],runs:[{t:s[1]}]}];});

  let i=0,fechaOriginal='';
  // fecha antes del título, p. ej. "(12/11/01)"
  if(esFecha(ls[0].texto)&&ls.length>1){fechaOriginal=ls[0].texto;i=1;}

  // título: primera línea (y las siguientes si también van en negrita, cuando el título se partió)
  const tit=[ls[i].texto];i++;
  if(ls[i-1].b>=.6)while(i<ls.length&&tit.length<3&&ls[i].b>=.6&&ls[i].i<.5&&!ls[i].rojo&&!esFecha(ls[i].texto)&&ls[i].texto.length<120)tit.push(ls[i++].texto);
  const titulo=limpio(tit.join(' ')).replace(/\s*[.]$/,'').replace(/:\s*$/,'');

  // encabezado: bajada · notas (rojo) · epígrafe (resaltado) · fecha
  // La bajada es lo que va entre el título y la fecha (normalmente en cursiva).
  // Si no hay fecha cerca, se toman como bajada solo las líneas en cursiva.
  const bajada=[],notas=[],epigrafe=[];
  const fechaAntes=!!fechaOriginal;
  let posFecha=-1;
  if(!fechaAntes)for(let k=i;k<Math.min(ls.length,i+7);k++){if(esFecha(ls[k].texto)){posFecha=k;break;}}
  while(i<ls.length){
    const l=ls[i];
    if(l.rojo>=.5){notas.push(limpio(l.texto));i++;continue;}
    if(posFecha>=0&&i<posFecha){
      if(l.resaltado>=.5)epigrafe.push(htmlRuns(l.runs));else bajada.push(limpio(l.texto));
      i++;continue;
    }
    if(i===posFecha){fechaOriginal=l.texto;i++;continue;}
    if(posFecha<0&&l.resaltado>=.5&&!bajada.length&&!fechaAntes){epigrafe.push(htmlRuns(l.runs));i++;continue;}
    if(posFecha<0&&l.i>=.6&&l.texto.length<700&&cuantasBajada(bajada)<3){bajada.push(limpio(l.texto));i++;continue;}
    break;
  }

  // cuerpo
  const cuerpo=[];
  ls.slice(i).forEach((l,k,arr)=>{
    const t=l.texto;
    if(l.rojo>=.5)cuerpo.push({tipo:'nota',html:escHtml(limpio(t))});
    else if(t.length<=90&&!/[.;,]$/.test(t)&&arr.length>1&&(todoMayus(t)&&!/:$/.test(t)||l.b>=.9))cuerpo.push({tipo:'h',html:escHtml(limpio(t))});
    else if(l.resaltado>=.5)cuerpo.push({tipo:'cita',html:htmlRuns(l.runs)});
    else cuerpo.push({tipo:'p',html:htmlRuns(l.runs)});
  });

  const avisos=[];
  const f=leerFecha(fechaOriginal);
  if(!fechaOriginal)avisos.push('falta la fecha');
  else if(f.dudosa)avisos.push(`revisa el año ("${fechaOriginal}")`);
  else if(!f.anio)avisos.push(`la fecha no tiene año ("${fechaOriginal}")`);
  if(!cuerpo.length)avisos.push('no encontré el texto de la columna');
  const texto=ls.slice(i).map(l=>l.texto).join('\n\n');
  return {titulo,bajada:bajada.join(' '),notas,epigrafe,fecha:fechaOriginal?f.texto:'',fechaOriginal,anio:f.anio,mes:f.mes,texto,cuerpo,avisos};
}


// ---------- texto editable (panel) ----------
const escHtml2=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const desHtml=s=>String(s).replace(/<\/?(p|br)\s*\/?>/g,' ').replace(/<strong>([\s\S]*?)<\/strong>/g,'**$1**').replace(/<em>([\s\S]*?)<\/em>/g,'*$1*')
  .replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&');
const aHtml=s=>escHtml2(s.trim()).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>');
const sinMarcas=s=>desHtml(s).replace(/\*\*(.+?)\*\*/g,'$1').replace(/\*(.+?)\*/g,'$1');

function cuerpoAEditable(cuerpo){
  return (cuerpo||[]).map(b=>{
    const t=desHtml(b.html).replace(/\s+/g,' ').trim();
    if(b.tipo==='h')return '## '+t;
    if(b.tipo==='cita')return '> '+t;
    if(b.tipo==='nota')return '!! '+t;
    return t;
  }).join('\n\n');
}
function editableACuerpo(txt){
  return String(txt||'').replace(/\r\n?/g,'\n').split(/\n\s*\n/).map(p=>p.replace(/\s*\n\s*/g,' ').trim()).filter(Boolean).map(p=>{
    let m;
    if((m=p.match(/^##\s*(.+)$/)))return {tipo:'h',html:escHtml2(sinMarcas(m[1]))};
    if((m=p.match(/^>\s*(.+)$/)))return {tipo:'cita',html:aHtml(m[1])};
    if((m=p.match(/^!!\s*(.+)$/)))return {tipo:'nota',html:escHtml2(sinMarcas(m[1]))};
    return {tipo:'p',html:aHtml(p)};
  });
}
const cuerpoATexto=cuerpo=>(cuerpo||[]).map(b=>sinMarcas(b.html).replace(/\s+/g,' ').trim()).join('\n\n');
// listas (notas, epígrafe): un elemento por párrafo
const listaAEditable=l=>(l||[]).map(x=>desHtml(x).replace(/\s+/g,' ').trim()).join('\n\n');
const editableALista=(t,{html=false}={})=>String(t||'').replace(/\r\n?/g,'\n').split(/\n\s*\n/).map(p=>p.replace(/\s*\n\s*/g,' ').trim()).filter(Boolean).map(p=>html?aHtml(p):sinMarcas(p));


// ---------- utilidades para armar un registro ----------
const slug=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90)||'columna';
function avisosDeFecha(fecha){
  const f=leerFecha(fecha);
  if(!fecha)return {f,avisos:['falta la fecha']};
  if(f.dudosa)return {f,avisos:[`revisa el año ("${fecha}")`]};
  if(!f.anio)return {f,avisos:[`la fecha no tiene año ("${fecha}")`]};
  return {f,avisos:[]};
}
// Aplica una fecha escrita a mano a un registro (formato de la base de datos)
function aplicarFecha(reg,fecha){
  fecha=String(fecha||'').trim();
  const {f,avisos}=avisosDeFecha(fecha);
  reg.fecha=f.anio?f.texto:fecha;reg.fecha_manual=fecha||null;reg.anio=f.anio;reg.mes=f.mes;
  reg.avisos=(reg.avisos||[]).filter(a=>!/fecha|año/.test(a)).concat(avisos);
  return reg;
}
const contarPalabras=t=>String(t||'').split(/\s+/).filter(Boolean).length;

// ---------- Mensaje del día ----------
// Fecha de hoy en Chile, como "2026-09-29"
function hoyChile(d){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(d||new Date());}
// Elige el mensaje que corresponde a un día ("2026-10-05"). Orden de prioridad:
//  1) un mensaje para ese día específico (tipo "dia" con esa fecha);
//  2) el mensaje de la media semana: lunes a miércoles o jueves a domingo (tipo "bloque",
//     guardado con la fecha del lunes o del jueves en que empieza);
//  3) si esa media semana quedó vacía, el último mensaje de media semana anterior;
//  4) si no hay ninguno, los mensajes antiguos sin fecha se turnan, uno por día.
// Es autocontenida porque también se copia tal cual en la portada del sitio.
function mensajeDelDia(lista,iso){
  lista=lista||[];
  const [y,mo,d]=iso.split('-').map(Number),t=Date.UTC(y,mo-1,d),dow=new Date(t).getUTCDay();
  const atras=dow>=1&&dow<=3?dow-1:(dow+3)%7; // días desde el lunes o el jueves
  const inicio=new Date(t-atras*864e5).toISOString().slice(0,10);
  const dia=lista.filter(m=>(m.tipo||'dia')==='dia'&&m.fecha===iso);
  if(dia.length)return dia[dia.length-1];
  const bloques=lista.filter(m=>m.tipo==='bloque'&&m.fecha&&m.fecha<=inicio).sort((a,b)=>a.fecha<b.fecha?-1:a.fecha>b.fecha?1:a.id-b.id);
  if(bloques.length)return bloques[bloques.length-1];
  const turno=lista.filter(m=>!m.fecha).sort((a,b)=>a.id-b.id);
  return turno.length?turno[Math.round(t/864e5)%turno.length]:null;
}
// Lunes o jueves con que empieza la media semana de un día
function inicioBloque(iso){
  const [y,mo,d]=iso.split('-').map(Number),t=Date.UTC(y,mo-1,d),dow=new Date(t).getUTCDay();
  return new Date(t-(dow>=1&&dow<=3?dow-1:(dow+3)%7)*864e5).toISOString().slice(0,10);
}
const sumarDias=(iso,n)=>{const [y,mo,d]=iso.split('-').map(Number);return new Date(Date.UTC(y,mo-1,d+n)).toISOString().slice(0,10);};

return {abrirDocx,leerWord,leerWordXml,leerFecha,slug,aplicarFecha,contarPalabras,
  cuerpoAEditable,editableACuerpo,cuerpoATexto,listaAEditable,editableALista,hoyChile,mensajeDelDia,inicioBloque,sumarDias};
});
