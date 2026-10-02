// Carrusel por grupos: muestra un grupo de columnas (4 en pantallas grandes, 3 en medianas,
// 2 en celulares), lo deja quieto unos segundos por tarjeta y pasa al grupo siguiente.
// Al terminar vuelve a empezar sin saltos. Se detiene mientras el mouse está encima.
(function(){
  const carousel=document.getElementById('carousel');
  if(!carousel)return;
  const viewport=document.getElementById('viewport');
  const track=document.getElementById('track');
  const contador=document.getElementById('contador');
  const avance=document.getElementById('avance'),barra=avance&&avance.firstElementChild;
  const segPorTarjeta=+carousel.dataset.segundos||10; // segundos de lectura por cada tarjeta visible
  const DUR_PASO=900;                                   // lo que dura el desplazamiento al siguiente grupo (ms)
  const reales=[...track.children];
  const N=reales.length;
  if(!N)return;

  // Una copia completa de las tarjetas al final: cuando la primera vuelta termina,
  // se vuelve al inicio sin que se note.
  reales.forEach(s=>{const c=s.cloneNode(true);c.setAttribute('aria-hidden','true');c.inert=true;track.appendChild(c);});

  const quieto=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let paso=0,vuelta=0,pv=2,x=0,hold=false,arrastre=null,salto=null,ultimo=null,visibleIdx=-1,espera=0;

  const tiempoGrupo=()=>pv*segPorTarjeta*1000;
  function medir(){
    pv=parseInt(getComputedStyle(viewport).getPropertyValue('--pv'))||2;
    const idx=paso?Math.round(x/paso):0;
    const a=reales[0].getBoundingClientRect(),b=(reales[1]||track.children[N]).getBoundingClientRect();
    paso=b.left-a.left;vuelta=paso*N;
    x=(((idx*paso)%vuelta)+vuelta)%vuelta||0;
    pintar();
  }
  function pintar(){
    track.style.transform=`translate3d(${-x}px,0,0)`;
    const idx=Math.round(x/paso)%N;
    if(idx!==visibleIdx&&contador){visibleIdx=idx;contador.textContent=N>pv?`Columnas ${idx+1} a ${Math.min(idx+pv,N)} de ${N}`:`${N} columnas`;}
  }
  function normalizar(){if(x>=vuelta)x-=vuelta;if(x<0)x+=vuelta;}

  // Mueve el carrusel suavemente a la tarjeta número "destino" (puede pasar del final: se da la vuelta)
  function moverA(destino){
    let desde=x,hasta=destino*paso;
    if(hasta<0){desde+=vuelta;hasta+=vuelta;}
    salto={desde,hasta,t0:performance.now(),dur:DUR_PASO};
    espera=0;
  }

  function cuadro(t){
    const dt=ultimo===null?0:Math.min(t-ultimo,250);ultimo=t;
    if(N>pv&&paso){
      if(salto){
        const k=Math.min((t-salto.t0)/salto.dur,1),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
        x=salto.desde+(salto.hasta-salto.desde)*e;
        if(k>=1){x=salto.hasta;salto=null;espera=0;}
        normalizar();pintar();
      }else if(!hold&&!arrastre&&!quieto&&!document.hidden){
        espera+=dt;
        if(espera>=tiempoGrupo())moverA(Math.round(x/paso)+pv);
      }
      if(barra){barra.style.width=(salto?0:Math.min(espera/tiempoGrupo(),1)*100)+'%';avance.classList.toggle('pausa',hold||!!arrastre);}
    }
    requestAnimationFrame(cuadro);
  }

  // Flechas: avanzan o retroceden un grupo completo
  function ir(d){
    if(N<=pv||!paso)return;
    const base=salto?salto.hasta:x;
    moverA(Math.round(base/paso)+d*pv);
  }
  document.getElementById('prev').onclick=()=>ir(-1);
  document.getElementById('next').onclick=()=>ir(1);

  carousel.addEventListener('mouseenter',()=>hold=true);
  carousel.addEventListener('mouseleave',()=>hold=false);
  carousel.addEventListener('focusin',()=>hold=true);
  carousel.addEventListener('focusout',()=>hold=false);
  carousel.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')ir(-1);if(e.key==='ArrowRight')ir(1);});

  // Arrastrar con el dedo o el mouse: al soltar se acomoda en la tarjeta más cercana
  viewport.addEventListener('pointerdown',e=>{if(N<=pv)return;salto=null;arrastre={x0:e.clientX,base:x,movio:false};});
  window.addEventListener('pointermove',e=>{if(!arrastre)return;const dx=e.clientX-arrastre.x0;if(Math.abs(dx)>4)arrastre.movio=true;x=arrastre.base-dx;normalizar();pintar();});
  function soltar(){
    if(!arrastre)return;const m=arrastre.movio,dx=x-arrastre.base;arrastre=null;
    if(m){
      viewport.dataset.arrastrado='1';setTimeout(()=>delete viewport.dataset.arrastrado,0);
      // un gesto corto pasa al grupo siguiente o anterior, como en las flechas
      const i=Math.round(x/paso);
      moverA(Math.abs(dx)<paso*.5?Math.round((x-dx)/paso)+(dx>0?pv:-pv):i);
    }
  }
  window.addEventListener('pointerup',soltar);
  window.addEventListener('pointercancel',soltar);
  viewport.addEventListener('click',e=>{if(viewport.dataset.arrastrado){e.preventDefault();e.stopPropagation();}},true);

  if(avance&&(quieto||N<=pv))avance.hidden=true;
  new ResizeObserver(medir).observe(carousel);
  medir();
  requestAnimationFrame(cuadro);
})();
