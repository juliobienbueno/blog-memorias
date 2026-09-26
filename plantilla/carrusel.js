// Carrusel en movimiento continuo: las columnas se desplazan solas, sin detenerse,
// y al terminar vuelven a empezar sin saltos. Se detiene al pasar el mouse por encima.
(function(){
  const carousel=document.getElementById('carousel');
  if(!carousel)return;
  const viewport=document.getElementById('viewport');
  const track=document.getElementById('track');
  const contador=document.getElementById('contador');
  const velocidad=+carousel.dataset.velocidad||40; // píxeles por segundo
  const reales=[...track.children];
  const N=reales.length;
  if(!N)return;

  // Una copia completa de las tarjetas al final: cuando la primera vuelta termina,
  // se vuelve al inicio sin que se note.
  reales.forEach(s=>{const c=s.cloneNode(true);c.setAttribute('aria-hidden','true');c.inert=true;track.appendChild(c);});

  const quieto=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pausaHasta=0,paso=0,vuelta=0,pv=2,x=0,hold=false,arrastre=null,salto=null,ultimo=null,visibleIdx=-1;

  function medir(){
    pv=parseInt(getComputedStyle(viewport).getPropertyValue('--pv'))||2;
    const a=reales[0].getBoundingClientRect(),b=(reales[1]||track.children[N]).getBoundingClientRect();
    paso=b.left-a.left;vuelta=paso*N;
    x=((x%vuelta)+vuelta)%vuelta||0;
    pintar();
  }
  function pintar(){
    track.style.transform=`translate3d(${-x}px,0,0)`;
    const idx=Math.round(x/paso)%N;
    if(idx!==visibleIdx&&contador){visibleIdx=idx;contador.textContent=N>pv?`Columna ${idx+1} de ${N}`:`${N} columnas`;}
  }
  function normalizar(){if(x>=vuelta)x-=vuelta;if(x<0)x+=vuelta;}

  function cuadro(t){
    const dt=ultimo===null?0:Math.min(t-ultimo,100)/1000;ultimo=t;
    if(N>pv&&paso){
      if(salto){
        const k=Math.min((t-salto.t0)/salto.dur,1),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
        x=salto.desde+(salto.hasta-salto.desde)*e;
        if(k>=1){x=salto.hasta;salto=null;}
        normalizar();
      }else if(!hold&&!arrastre&&!quieto&&!document.hidden&&t>pausaHasta){
        x+=velocidad*dt;normalizar();
      }
      pintar();
    }
    requestAnimationFrame(cuadro);
  }

  // Flechas: avanzan o retroceden una columna con un movimiento suave
  function ir(d){
    if(N<=pv||!paso)return;
    const base=salto?salto.hasta:x;
    let destino=(d>0?Math.floor(base/paso+.2)+1:Math.ceil(base/paso-.2)-1)*paso;
    let desde=x;
    if(destino<0){desde+=vuelta;destino+=vuelta;}
    salto={desde,hasta:destino,t0:performance.now(),dur:550};
    pausaHasta=performance.now()+2500; // una pausa breve para alcanzar a leer
  }
  document.getElementById('prev').onclick=()=>ir(-1);
  document.getElementById('next').onclick=()=>ir(1);

  carousel.addEventListener('mouseenter',()=>hold=true);
  carousel.addEventListener('mouseleave',()=>hold=false);
  carousel.addEventListener('focusin',()=>hold=true);
  carousel.addEventListener('focusout',()=>hold=false);
  carousel.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')ir(-1);if(e.key==='ArrowRight')ir(1);});

  // Arrastrar con el dedo o el mouse
  viewport.addEventListener('pointerdown',e=>{if(N<=pv)return;salto=null;arrastre={x0:e.clientX,base:x,movio:false};});
  window.addEventListener('pointermove',e=>{if(!arrastre)return;const dx=e.clientX-arrastre.x0;if(Math.abs(dx)>4)arrastre.movio=true;x=arrastre.base-dx;normalizar();});
  window.addEventListener('pointerup',()=>{if(!arrastre)return;const m=arrastre.movio;arrastre=null;if(m){viewport.dataset.arrastrado='1';setTimeout(()=>delete viewport.dataset.arrastrado,0);}});
  viewport.addEventListener('click',e=>{if(viewport.dataset.arrastrado){e.preventDefault();e.stopPropagation();}},true);
  window.addEventListener('pointercancel',()=>{arrastre=null;});

  new ResizeObserver(medir).observe(carousel);
  medir();
  requestAnimationFrame(cuadro);
})();
