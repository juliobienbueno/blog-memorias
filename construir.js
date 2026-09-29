// Genera el sitio estático en la carpeta "sitio/" con las columnas guardadas en Supabase.
// Vercel lo ejecuta solo cada vez que se publica.
//   node construir.js                      → lee las columnas desde Supabase
//   node construir.js --local respaldo.json → usa un archivo de respaldo (para probar sin internet)
const fs=require('fs');
const path=require('path');
const N=require('./lib/nucleo.js');

const RAIZ=__dirname;
const SALIDA=path.join(RAIZ,'sitio');

const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const parrafos=txt=>String(txt||'').trim().split(/\n\s*\n/).filter(Boolean).map(p=>`<p>${esc(p.replace(/\s*\n\s*/g,' '))}</p>`).join('\n');
const recorte=(t,n)=>{t=String(t||'').replace(/\s+/g,' ').trim();return t.length<=n?t:t.slice(0,t.lastIndexOf(' ',n)).replace(/[,;:.]$/,'')+'…';};
const flecha=d=>`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><path d="${d}"/></svg>`;

const ordenar=cols=>cols.sort((a,b)=>((a.anio||9999)-(b.anio||9999))||((a.mes||0)-(b.mes||0))||a.titulo.localeCompare(b.titulo,'es'));

// Trae todas las columnas desde Supabase (de a 500)
async function traerColumnas(CFG){
  const url=(process.env.SUPABASE_URL||CFG.supabaseUrl||'').replace(/\/$/,'');
  const clave=process.env.SUPABASE_KEY||CFG.supabaseKey;
  if(!url||!clave)throw new Error('Falta supabaseUrl o supabaseKey en sitio.config.json');
  const campos='id,titulo,bajada,fecha,anio,mes,tema,notas,epigrafe,cuerpo,texto';
  const todas=[];
  for(let desde=0;;desde+=500){
    const r=await fetch(`${url}/rest/v1/columnas?select=${campos}&order=id&offset=${desde}&limit=500`,{headers:{apikey:clave}});
    if(!r.ok)throw new Error(`Supabase respondió ${r.status}: ${await r.text()}`);
    const lote=await r.json();todas.push(...lote);
    if(lote.length<500)break;
  }
  return todas;
}

// Trae los mensajes del día. Si la tabla aún no existe, sigue sin ellos.
async function traerMensajes(CFG){
  const url=(process.env.SUPABASE_URL||CFG.supabaseUrl||'').replace(/\/$/,'');
  const clave=process.env.SUPABASE_KEY||CFG.supabaseKey;
  try{
    const r=await fetch(`${url}/rest/v1/mensajes?select=id,texto,fecha&order=id`,{headers:{apikey:clave}});
    if(!r.ok)throw new Error(`Supabase respondió ${r.status}`);
    return await r.json();
  }catch(e){console.warn('Aviso: no se pudieron leer los mensajes del día ('+e.message+'). Se usa el subtítulo de sitio.config.json.');return [];}
}

async function construir(opciones={}){
  const CFG=JSON.parse(fs.readFileSync(path.join(RAIZ,'sitio.config.json'),'utf8'));
  const URL_SITIO=(CFG.urlSitio||(process.env.VERCEL_PROJECT_PRODUCTION_URL?'https://'+process.env.VERCEL_PROJECT_PRODUCTION_URL:'')).replace(/\/$/,'');
  const columnas=ordenar(opciones.local
    ?JSON.parse(fs.readFileSync(opciones.local,'utf8').replace(/^\uFEFF/,''))
    :await traerColumnas(CFG));
  // Mensajes del día: van todos los sin fecha y los con fecha desde ayer en adelante;
  // el navegador elige el de hoy (hora de Chile), así cambia cada día sin volver a publicar.
  const ayer=N.hoyChile(new Date(Date.now()-864e5));
  const mensajes=(opciones.mensajes?JSON.parse(fs.readFileSync(opciones.mensajes,'utf8')):opciones.local?[]:await traerMensajes(CFG))
    .filter(m=>m&&String(m.texto||'').trim()&&(!m.fecha||m.fecha>=ayer)).map(m=>({id:m.id,texto:String(m.texto).trim(),fecha:m.fecha||null}));
  const msjHoy=N.mensajeDelDia(mensajes,N.hoyChile());
  if(!columnas.length)console.warn('Aviso: no hay columnas todavía. Se publica el sitio vacío (con el panel en /admin/).');
  columnas.forEach(c=>{c.resumen=c.bajada||recorte(c.texto,200);});
  const anios=columnas.map(c=>c.anio).filter(Boolean);
  const rango=anios.length?`${Math.min(...anios)} y ${Math.max(...anios)}`:'';
  const urlCol=c=>`columnas/${c.id}.html`;
  const presentacion=fs.existsSync(path.join(RAIZ,'presentacion.md'))?fs.readFileSync(path.join(RAIZ,'presentacion.md'),'utf8').replace(/\r\n?/g,'\n').trim():'';

  const FUENTES=`<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital@0;1&family=Old+Standard+TT:wght@400;700&display=swap" rel="stylesheet">`;
  const ANALITICA=CFG.goatcounter?`<script data-goatcounter="https://${esc(CFG.goatcounter)}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>`:'';
  const NAV=[['index.html','Portada'],['el-autor.html','El autor'],['buscar.html','Buscar']];

  function pagina({ruta,titulo,descripcion,cuerpo,portada=false,extraHead='',scripts=''}){
    const pre='../'.repeat(ruta.split('/').length-1);
    const canon=URL_SITIO?`${URL_SITIO}/${ruta==='index.html'?'':ruta}`:'';
    const nav=NAV.map(([h,t])=>`<a href="${pre}${h}"${h===ruta?' aria-current="page"':''}>${t}</a>`).join('');
    const mast=portada
      ?`<header class="mast"><h1 class="nombre">${esc(CFG.titulo)}</h1><p class="dia" id="mensaje-dia"${msjHoy||CFG.subtitulo?'':' hidden'}>${esc(msjHoy?msjHoy.texto:CFG.subtitulo)}</p>${presentacion?'<button type="button" class="abrir-pres" id="abrir-pres" aria-haspopup="dialog">Leer la presentación</button>':''}</header>`
      :`<header class="mast chica"><a class="nombre" href="${pre}index.html">${esc(CFG.titulo)}</a></header>`;
    const desc=descripcion||CFG.descripcion;
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo?`${titulo} · ${CFG.titulo}`:CFG.titulo)}</title>
<meta name="description" content="${esc(desc)}">
${canon?`<link rel="canonical" href="${esc(canon)}">\n<meta property="og:url" content="${esc(canon)}">`:''}
<meta property="og:site_name" content="${esc(CFG.titulo)}">
<meta property="og:title" content="${esc(titulo||CFG.titulo)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:locale" content="es_CL">
${FUENTES}
<link rel="stylesheet" href="${pre}estilos.css">
${extraHead}
${ANALITICA}
</head>
<body${portada?' class="portada"':''}>
<div class="page">
${mast}
<nav class="site-nav" aria-label="Principal">${nav}</nav>
<main>
${cuerpo}
</main>
<footer class="site-foot">${esc(CFG.titulo)}, columnas de ${esc(CFG.autor)}${CFG.contacto?`<span class="sep"> · </span><span class="contacto">Contacto: <a href="mailto:${esc(CFG.contacto)}">${esc(CFG.contacto)}</a></span>`:''}</footer>
</div>
<script>try{history.scrollRestoration='manual'}catch(e){}addEventListener('pageshow',()=>{if(!location.hash)scrollTo(0,0)});</script>
${scripts}
</body>
</html>
`;
  }

  fs.rmSync(SALIDA,{recursive:true,force:true});
  fs.mkdirSync(path.join(SALIDA,'columnas'),{recursive:true});
  const escribir=(ruta,html)=>fs.writeFileSync(path.join(SALIDA,ruta),html);
  fs.copyFileSync(path.join(RAIZ,'plantilla','estilos.css'),path.join(SALIDA,'estilos.css'));
  fs.copyFileSync(path.join(RAIZ,'plantilla','carrusel.js'),path.join(SALIDA,'carrusel.js'));

  // ---------- Portada ----------
  const tarjetas=columnas.map((c,i)=>`<li class="slide"><article class="card k${i%4}">${c.anio?`<span class="yr">${esc(c.anio)}</span>`:''}${c.tema?`<span class="tag">${esc(c.tema)}</span>`:''}<h3>${esc(c.titulo)}</h3><p${c.bajada?' class="bj"':''}>${esc(recorte(c.resumen,230))}</p><a class="more" href="${urlCol(c)}">Leer columna</a></article></li>`).join('\n');
  escribir('index.html',pagina({ruta:'index.html',portada:true,cuerpo:`
<section aria-labelledby="t-col">
  <div class="head">
    <div><h2 id="t-col">Columnas</h2>${rango?`<p>Escritas entre ${rango}</p>`:''}</div>
    <div class="arrows">
      <button class="btn" id="prev" aria-label="Columna anterior">${flecha('M13 3L6 10l7 7')}</button>
      <button class="btn" id="next" aria-label="Columna siguiente">${flecha('M7 3l7 7-7 7')}</button>
    </div>
  </div>
  <div class="carousel" id="carousel" role="region" aria-roledescription="carrusel" aria-label="Columnas" data-velocidad="${+CFG.velocidadCarrusel||40}">
    <div class="viewport" id="viewport"><ul class="track" id="track">
${tarjetas}
    </ul></div>
  </div>
</section>
${presentacion?`<dialog class="pres" id="pres" aria-labelledby="pres-t">
  <div class="cab"><h2 id="pres-t">Presentación</h2><button type="button" class="cerrar" id="cerrar-pres" aria-label="Cerrar la presentación">×</button></div>
  <div class="txt">${parrafos(presentacion)}</div>
</dialog>`:''}`,scripts:`<script src="carrusel.js"></script>
${mensajes.length?`<script>(function(){const M=${JSON.stringify(mensajes).replace(/</g,'\\u003c')};
${N.hoyChile.toString()}
${N.mensajeDelDia.toString()}
const m=mensajeDelDia(M,hoyChile()),p=document.getElementById('mensaje-dia');if(m&&p){p.textContent=m.texto;p.hidden=false;}})();</script>`:''}
<script>(function(){const d=document.getElementById('pres'),a=document.getElementById('abrir-pres');if(!d||!a)return;
a.onclick=()=>{d.showModal();d.scrollTop=0;};document.getElementById('cerrar-pres').onclick=()=>d.close();
d.addEventListener('click',e=>{if(e.target===d)d.close();});})();</script>`,
  extraHead:`<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"WebSite",name:CFG.titulo,description:CFG.descripcion,inLanguage:"es-CL",url:URL_SITIO||undefined})}</script>`}));

  // ---------- Una página por columna ----------
  columnas.forEach((c,i)=>{
    const ant=columnas[i-1],sig=columnas[i+1];
    const fechaISO=c.anio?`${c.anio}${c.mes?'-'+String(c.mes).padStart(2,'0'):''}`:undefined;
    const ld={"@context":"https://schema.org","@type":"Article",headline:c.titulo,description:c.resumen,author:{"@type":"Person",name:CFG.autor},
      datePublished:fechaISO,articleSection:c.tema||undefined,inLanguage:"es-CL",wordCount:(c.texto||'').split(/\s+/).length,
      publisher:{"@type":"Organization",name:CFG.titulo},mainEntityOfPage:URL_SITIO?`${URL_SITIO}/${urlCol(c)}`:undefined};
    const cuerpoHtml=(c.cuerpo||[]).map(b=>b.tipo==='h'?`<h2>${b.html}</h2>`:b.tipo==='nota'?`<aside class="nota">${b.html}</aside>`:b.tipo==='cita'?`<blockquote>${b.html}</blockquote>`:`<p>${b.html}</p>`).join('\n');
    escribir(urlCol(c),pagina({ruta:urlCol(c),titulo:c.titulo,descripcion:recorte(c.resumen,160),
      extraHead:`<meta property="og:type" content="article">\n<script type="application/ld+json">${JSON.stringify(ld).replace(/</g,'\\u003c')}</script>`,
      cuerpo:`
<article class="columna">
  <div class="meta">${c.tema?`<span class="tag">${esc(c.tema)}</span>`:''}${c.fecha&&c.anio?`<span>${esc(c.fecha)}</span>`:''}</div>
  <h1>${esc(c.titulo)}</h1>
  ${c.bajada?`<p class="bajada">${esc(c.bajada)}</p>`:''}
  ${(c.epigrafe||[]).length?`<blockquote class="epigrafe">${c.epigrafe.map(e=>`<p>${e}</p>`).join('')}</blockquote>`:''}
  ${(c.notas||[]).map(n=>`<aside class="nota">${esc(n)}</aside>`).join('\n')}
  <div class="cuerpo">
${cuerpoHtml}
  </div>
</article>
<nav class="navcol" aria-label="Otras columnas">
  ${ant?`<a href="${ant.id}.html">← Anterior<b>${esc(ant.titulo)}</b></a>`:'<span></span>'}
  ${sig?`<a class="sig" href="${sig.id}.html">Siguiente →<b>${esc(sig.titulo)}</b></a>`:''}
</nav>`}));
  });

  // ---------- El autor (texto en autor.md) ----------
  const autorTxt=fs.existsSync(path.join(RAIZ,'autor.md'))?fs.readFileSync(path.join(RAIZ,'autor.md'),'utf8').replace(/\r\n?/g,'\n'):'';
  escribir('el-autor.html',pagina({ruta:'el-autor.html',titulo:'El autor',descripcion:`Sobre ${CFG.autor}.`,cuerpo:`
<article class="columna"><h1>${esc(CFG.autor)}</h1><div class="cuerpo">${parrafos(autorTxt||'Texto sobre el autor.')}</div></article>`}));

  // ---------- Buscar (en el navegador, sin servidor) ----------
  const indice=columnas.map(c=>({t:c.titulo,a:c.anio||'',f:c.fecha||'',r:recorte(c.resumen,200),u:urlCol(c),x:`${c.bajada||''} ${c.tema||''} ${c.texto||''}`}));
  escribir('buscar.html',pagina({ruta:'buscar.html',titulo:'Buscar',descripcion:`Buscar entre las columnas de ${CFG.autor}.`,cuerpo:`
<div class="head"><div><h1>Buscar</h1><p>Busca por palabra, título o año</p></div></div>
<input class="buscador" id="q" type="search" placeholder="Escribe una palabra…" aria-label="Buscar columnas" autocomplete="off">
<p class="contador" id="n" aria-live="polite"></p>
<ul class="lista" id="res"></ul>`,scripts:`<script>
const D=${JSON.stringify(indice).replace(/</g,'\\u003c')};
const norm=s=>String(s).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();
D.forEach(d=>d.z=norm([d.t,d.a,d.f,d.x].join(' ')));
const q=document.getElementById('q'),res=document.getElementById('res'),n=document.getElementById('n');
const e=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function f(){const p=norm(q.value).split(/\\s+/).filter(Boolean);const r=D.filter(d=>p.every(w=>d.z.includes(w)));
n.textContent=p.length?r.length+' resultado'+(r.length===1?'':'s'):D.length+' columnas';
res.innerHTML=r.map(d=>'<li><span class="a">'+e(d.a)+'</span><span><a href="'+d.u+'">'+e(d.t)+'</a><small>'+e(d.r)+'</small></span></li>').join('');}
q.addEventListener('input',f);const u=new URLSearchParams(location.search).get('q');if(u)q.value=u;f();
</script>`}));

  // ---------- SEO: sitemap y robots ----------
  if(URL_SITIO){
    const urls=['','el-autor.html',...columnas.map(urlCol)];
    escribir('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u=>`  <url><loc>${esc(URL_SITIO+'/'+u)}</loc></url>`).join('\n')}\n</urlset>\n`);
  }
  escribir('robots.txt',`User-agent: *\nAllow: /\nDisallow: /admin/\n${URL_SITIO?`Sitemap: ${URL_SITIO}/sitemap.xml\n`:''}`);
  // ---------- Panel de administración (/admin/) ----------
  fs.mkdirSync(path.join(SALIDA,'admin'),{recursive:true});
  for(const f of ['index.html','panel.js'])fs.copyFileSync(path.join(RAIZ,'admin',f),path.join(SALIDA,'admin',f));
  fs.copyFileSync(path.join(RAIZ,'lib','nucleo.js'),path.join(SALIDA,'admin','nucleo.js'));
  escribir('admin/config.js',`window.CONFIG=${JSON.stringify({supabaseUrl:(process.env.SUPABASE_URL||CFG.supabaseUrl||'').replace(/\/$/,''),supabaseKey:process.env.SUPABASE_KEY||CFG.supabaseKey,sitio:CFG.titulo})};\n`);
  return columnas.length;
}

module.exports={construir};
if(require.main===module){
  const k=process.argv.indexOf('--local'),j=process.argv.indexOf('--mensajes');
  construir({local:k>0?process.argv[k+1]:undefined,mensajes:j>0?process.argv[j+1]:undefined})
    .then(n=>console.log(`Listo: ${n} columnas → carpeta "sitio".`))
    .catch(e=>{console.error('No se pudo armar el sitio: '+e.message);process.exit(1);});
}
