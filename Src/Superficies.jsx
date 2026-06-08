import { useState, useEffect, useRef } from "react";
import * as THREE from "three";

const PI = Math.PI;

// ─── Safe evaluator ───────────────────────────────────────────────────────────
function ev(expr, u, v) {
  try {
    const e = expr.trim()
      .replace(/\bpi\b/gi, String(PI)).replace(/\be\b/g, String(Math.E))
      .replace(/\^/g, "**")
      .replace(/\bsin\b/g,  "Math.sin").replace(/\bcos\b/g,  "Math.cos")
      .replace(/\btan\b/g,  "Math.tan").replace(/\bsqrt\b/g, "Math.sqrt")
      .replace(/\babs\b/g,  "Math.abs").replace(/\bexp\b/g,  "Math.exp")
      .replace(/\blog\b/g,  "Math.log").replace(/\bcosh\b/g, "Math.cosh")
      .replace(/\bsinh\b/g, "Math.sinh").replace(/\btanh\b/g,"Math.tanh");
    const r = new Function("u","v",`"use strict";return +(${e})`)(u, v);
    return isFinite(r) ? r : NaN;
  } catch { return NaN; }
}

// ─── Parametric mesh ─────────────────────────────────────────────────────────
function buildMesh(xF, yF, zF, uR, vR, uS = 64, vS = 64) {
  const [u0,u1] = uR, [v0,v1] = vR;
  const pos=[], nor=[], idx=[];
  const eps = 1e-4;
  for (let i = 0; i <= uS; i++) {
    for (let j = 0; j <= vS; j++) {
      const u = u0+(u1-u0)*i/uS, v = v0+(v1-v0)*j/vS;
      const x=xF(u,v), y=yF(u,v), z=zF(u,v);
      pos.push(isFinite(x)?x:0, isFinite(y)?y:0, isFinite(z)?z:0);
      const dx=xF(u+eps,v)-x, dy=yF(u+eps,v)-y, dz=zF(u+eps,v)-z;
      const ex=xF(u,v+eps)-x, ey=yF(u,v+eps)-y, ez=zF(u,v+eps)-z;
      let nx=dy*ez-dz*ey, ny=dz*ex-dx*ez, nz=dx*ey-dy*ex;
      const nl=Math.sqrt(nx*nx+ny*ny+nz*nz)||1;
      nor.push(nx/nl, ny/nl, nz/nl);
    }
  }
  for (let i = 0; i < uS; i++) for (let j = 0; j < vS; j++) {
    const a=i*(vS+1)+j, b=a+vS+1;
    idx.push(a,b,a+1, b,b+1,a+1);
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(idx);
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("normal",   new THREE.BufferAttribute(new Float32Array(nor), 3));
  return g;
}

// ─── Grid curves on surface ───────────────────────────────────────────────────
function buildGrid(xF, yF, zF, uR, vR, nU = 12, nV = 8, seg = 96) {
  const [u0,u1]=uR, [v0,v1]=vR;
  const geoms = [];
  const addCurve = pts => { if (pts.length > 1) geoms.push(new THREE.BufferGeometry().setFromPoints(pts)); };
  // u-curves (vary v, fix u)
  for (let i = 0; i <= nU; i++) {
    const u = u0+(u1-u0)*i/nU; const pts = [];
    for (let j = 0; j <= seg; j++) {
      const v=v0+(v1-v0)*j/seg, x=xF(u,v), y=yF(u,v), z=zF(u,v);
      if (isFinite(x)&&isFinite(y)&&isFinite(z)) pts.push(new THREE.Vector3(x,y,z));
      else { addCurve(pts); pts.length=0; }
    }
    addCurve(pts);
  }
  // v-curves (vary u, fix v)
  for (let j = 0; j <= nV; j++) {
    const v = v0+(v1-v0)*j/nV; const pts = [];
    for (let i = 0; i <= seg; i++) {
      const u=u0+(u1-u0)*i/seg, x=xF(u,v), y=yF(u,v), z=zF(u,v);
      if (isFinite(x)&&isFinite(y)&&isFinite(z)) pts.push(new THREE.Vector3(x,y,z));
      else { addCurve(pts); pts.length=0; }
    }
    addCurve(pts);
  }
  return geoms;
}

// ─── Preset surfaces (all mathematically verified) ────────────────────────────
// Esfera:      x=r·sinφ·cosθ, y=r·sinφ·sinθ, z=r·cosφ  → x²+y²+z²=r²   ✓
// Elipsóide:   x=a·sinφ·cosθ, y=b·sinφ·sinθ, z=c·cosφ  → x²/a²+y²/b²+z²/c²=1 ✓
// Cilindro:    x=a·cosθ, y=b·sinθ, z=t                 → x²/a²+y²/b²=1  ✓
// Parabolóide: x=u, y=v, z=u²/a²+v²/b²                → z=x²/a²+y²/b² ✓
// Cone:        x=a·t·cosθ, y=b·t·sinθ, z=t            → z²=x²/a²+y²/b² ✓
// Hiperbolóide:x=a·cosh(t)·cosθ, y=b·cosh(t)·sinθ, z=c·sinh(t) → x²/a²+y²/b²-z²/c²=1 ✓
const PRESETS = [
  {
    id:"esfera", label:"Esfera", color:0xf59e0b, lcol:"#f59e0b",
    eq:(p)=>`x² + y² + z² = ${(p.r**2).toFixed(2)}`,
    params:[{id:"r",label:"r (raio)",min:0.3,max:4,def:2,col:"#f59e0b"}],
    xF:(u,v,p)=>p.r*Math.sin(v)*Math.cos(u),
    yF:(u,v,p)=>p.r*Math.sin(v)*Math.sin(u),
    zF:(u,v,p)=>p.r*Math.cos(v),
    uR:[0,2*PI], vR:[0,PI], nU:12, nV:8,
  },
  {
    id:"elipsoide", label:"Elipsóide", color:0xa78bfa, lcol:"#a78bfa",
    eq:(p)=>`x²/${(p.a**2).toFixed(1)} + y²/${(p.b**2).toFixed(1)} + z²/${(p.c**2).toFixed(1)} = 1`,
    params:[
      {id:"a",label:"a (x)",min:0.3,max:4,def:2.5,col:"#ff4455"},
      {id:"b",label:"b (y)",min:0.3,max:4,def:1.5,col:"#44dd88"},
      {id:"c",label:"c (z)",min:0.3,max:4,def:1.2,col:"#4499ff"},
    ],
    xF:(u,v,p)=>p.a*Math.sin(v)*Math.cos(u),
    yF:(u,v,p)=>p.b*Math.sin(v)*Math.sin(u),
    zF:(u,v,p)=>p.c*Math.cos(v),
    uR:[0,2*PI], vR:[0,PI], nU:12, nV:8,
  },
  {
    id:"cilindro", label:"Cilindro", color:0x34d399, lcol:"#34d399",
    eq:(p)=>`x²/${(p.a**2).toFixed(1)} + y²/${(p.b**2).toFixed(1)} = 1`,
    params:[
      {id:"a",label:"a (x)",min:0.3,max:3.5,def:2,col:"#ff4455"},
      {id:"b",label:"b (y)",min:0.3,max:3.5,def:1.5,col:"#44dd88"},
    ],
    xF:(u,v,p)=>p.a*Math.cos(u),
    yF:(u,v,p)=>p.b*Math.sin(u),
    zF:(u,v,p)=>v,
    uR:[0,2*PI], vR:[-2.5,2.5], nU:12, nV:8,
  },
  {
    id:"paraboloide", label:"Parabolóide", color:0x60a5fa, lcol:"#60a5fa",
    eq:(p)=>`z = x²/${(p.a**2).toFixed(1)} + y²/${(p.b**2).toFixed(1)}`,
    params:[
      {id:"a",label:"a",min:0.3,max:4,def:1.5,col:"#ff4455"},
      {id:"b",label:"b",min:0.3,max:4,def:1.5,col:"#44dd88"},
    ],
    xF:(u,v,p)=>u,
    yF:(u,v,p)=>v,
    zF:(u,v,p)=>u*u/(p.a*p.a)+v*v/(p.b*p.b),
    uR:[-2.2,2.2], vR:[-2.2,2.2], nU:10, nV:10,
  },
  {
    id:"cone", label:"Cone", color:0xfb7185, lcol:"#fb7185",
    eq:(p)=>`z² = x²/${(p.a**2).toFixed(1)} + y²/${(p.b**2).toFixed(1)}`,
    params:[
      {id:"a",label:"a",min:0.3,max:3,def:1,col:"#ff4455"},
      {id:"b",label:"b",min:0.3,max:3,def:1,col:"#44dd88"},
    ],
    xF:(u,v,p)=>p.a*v*Math.cos(u),
    yF:(u,v,p)=>p.b*v*Math.sin(u),
    zF:(u,v,p)=>v,
    uR:[0,2*PI], vR:[-2.5,2.5], nU:12, nV:10,
  },
  {
    id:"hiperboloide", label:"Hiperbolóide", color:0xfbbf24, lcol:"#fbbf24",
    eq:(p)=>`x²/${(p.a**2).toFixed(1)} + y²/${(p.b**2).toFixed(1)} − z²/${(p.c**2).toFixed(1)} = 1`,
    params:[
      {id:"a",label:"a",min:0.3,max:3,def:1,col:"#ff4455"},
      {id:"b",label:"b",min:0.3,max:3,def:1,col:"#44dd88"},
      {id:"c",label:"c",min:0.3,max:3,def:1,col:"#4499ff"},
    ],
    xF:(u,v,p)=>p.a*Math.cosh(v)*Math.cos(u),
    yF:(u,v,p)=>p.b*Math.cosh(v)*Math.sin(u),
    zF:(u,v,p)=>p.c*Math.sinh(v),
    uR:[0,2*PI], vR:[-1.5,1.5], nU:12, nV:8,
  },
];

const DEFAULT_PARAMS = {r:2, a:2.5, b:1.5, c:1.2};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [presetId, setPresetId] = useState("esfera");
  const [params,   setParams]   = useState(DEFAULT_PARAMS);
  const [custom,   setCustom]   = useState(false);
  const [xExpr,    setXExpr]    = useState("cos(u)*sin(v)");
  const [yExpr,    setYExpr]    = useState("sin(u)*sin(v)");
  const [zExpr,    setZExpr]    = useState("cos(v)");
  const [uMin,     setUMin]     = useState("0");
  const [uMax,     setUMax]     = useState("2*pi");
  const [vMin,     setVMin]     = useState("0");
  const [vMax,     setVMax]     = useState("pi");
  const [plotKey,  setPlotKey]  = useState(0);
  const [customErr,setCustomErr]= useState(null);

  const containerRef = useRef();
  const sceneRef     = useRef();
  const frameRef     = useRef();

  // Fonts
  useEffect(()=>{
    const l=document.createElement("link"); l.rel="stylesheet";
    l.href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap";
    document.head.appendChild(l);
  },[]);

  // ── Three.js init (once) ──────────────────────────────────────────────
  useEffect(()=>{
    const container = containerRef.current;
    const W=container.clientWidth, H=container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060810);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, W/H, 0.1, 200);
    camera.up.set(0,0,1);

    const renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.setSize(W,H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    container.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dl1=new THREE.DirectionalLight(0xffffff,1.0); dl1.position.set(8,5,10); scene.add(dl1);
    const dl2=new THREE.DirectionalLight(0x6688ff,0.4); dl2.position.set(-6,-4,-8); scene.add(dl2);

    // Orbit — ALL logic in closure, events on renderer.domElement
    let theta=0.65, phi=1.1, radius=11;
    let dragging=false, lx=0, ly=0;
    const updateCam=()=>{
      camera.position.set(
        radius*Math.sin(phi)*Math.cos(theta),
        radius*Math.sin(phi)*Math.sin(theta),
        radius*Math.cos(phi)
      );
      camera.lookAt(0,0,0);
    };
    updateCam();

    const cvs = renderer.domElement;
    cvs.style.display="block"; cvs.style.cursor="grab";

    const onDown=e=>{ dragging=true; lx=e.clientX; ly=e.clientY; cvs.style.cursor="grabbing"; };
    const onMove=e=>{
      if(!dragging) return;
      theta -= (e.clientX-lx)*0.007;
      phi    = Math.max(0.04, Math.min(PI-0.04, phi+(e.clientY-ly)*0.007));
      lx=e.clientX; ly=e.clientY;
      updateCam();
    };
    const onUp   = ()=>{ dragging=false; cvs.style.cursor="grab"; };
    const onWheel= e=>{ e.preventDefault(); radius=Math.max(3,Math.min(22,radius+e.deltaY*0.015)); updateCam(); };

    cvs.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    cvs.addEventListener("wheel", onWheel, { passive:false });

    const onResize=()=>{
      const w=container.clientWidth, h=container.clientHeight;
      renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    const animate=()=>{ frameRef.current=requestAnimationFrame(animate); renderer.render(scene,camera); };
    animate();

    return()=>{
      cancelAnimationFrame(frameRef.current);
      cvs.removeEventListener("mousedown",onDown);
      window.removeEventListener("mousemove",onMove);
      window.removeEventListener("mouseup",  onUp);
      cvs.removeEventListener("wheel",onWheel);
      window.removeEventListener("resize",onResize);
      renderer.dispose();
      if(container.contains(cvs)) container.removeChild(cvs);
    };
  },[]);

  // ── Rebuild scene ─────────────────────────────────────────────────────
  useEffect(()=>{
    const scene = sceneRef.current;
    if(!scene) return;

    // Dispose and remove removable objects
    [...scene.children].filter(o=>o.userData.rm).forEach(o=>{
      scene.remove(o);
      const disp=x=>{x?.children?.forEach(disp);x?.geometry?.dispose();
        Array.isArray(x?.material)?x.material.forEach(m=>m.dispose()):x?.material?.dispose();};
      disp(o);
    });

    const add  = o=>{o.userData.rm=true;scene.add(o);return o;};
    const mLn  = (g,c,op=1)=>add(new THREE.Line(g,new THREE.LineBasicMaterial({color:c,transparent:op<1,opacity:op})));
    const mMsh = (g,c,op=0.14)=>add(new THREE.Mesh(g,new THREE.MeshPhongMaterial({color:c,transparent:true,opacity:op,side:THREE.DoubleSide,shininess:55})));
    const mDot = (p,c,s=0.09)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(s,10,10),new THREE.MeshBasicMaterial({color:c}));m.position.copy(p);return add(m);};
    const seg2 = (a,b)=>new THREE.BufferGeometry().setFromPoints([a,b]);

    // Axes
    const AL=5.5;
    [{d:[AL,0,0],c:0xff4455},{d:[0,AL,0],c:0x44dd88},{d:[0,0,AL],c:0x4499ff}].forEach(({d,c})=>{
      mLn(seg2(new THREE.Vector3(0,0,0),new THREE.Vector3(...d)),c);
      mLn(seg2(new THREE.Vector3(0,0,0),new THREE.Vector3(-d[0]*.3,-d[1]*.3,-d[2]*.3)),c,0.2);
      mDot(new THREE.Vector3(...d),c,0.07);
    });
    // Grid xy
    for(let i=-5;i<=5;i++){
      mLn(seg2(new THREE.Vector3(i,-5,0),new THREE.Vector3(i,5,0)),0x090e1d);
      mLn(seg2(new THREE.Vector3(-5,i,0),new THREE.Vector3(5,i,0)),0x090e1d);
    }

    // ── Resolve surface functions ──────────────────────────────────────
    let xF, yF, zF, uR, vR, nU, nV, surfColor;

    if(custom){
      setCustomErr(null);
      const u0c=ev(uMin,0,0), u1c=ev(uMax,0,0), v0c=ev(vMin,0,0), v1c=ev(vMax,0,0);
      if(isNaN(u0c)||isNaN(u1c)||isNaN(v0c)||isNaN(v1c)){setCustomErr("Intervalo inválido");return;}
      const xFt=(u,v)=>ev(xExpr,u,v), yFt=(u,v)=>ev(yExpr,u,v), zFt=(u,v)=>ev(zExpr,u,v);
      const test=[xFt(1,1),yFt(1,1),zFt(1,1)];
      if(test.some(isNaN)){setCustomErr("Expressão inválida (use u, v, sin, cos, sqrt, pi…)");return;}
      xF=xFt; yF=yFt; zF=zFt;
      uR=[u0c,u1c]; vR=[v0c,v1c]; nU=10; nV=8; surfColor=0x38bdf8;
    } else {
      const preset=PRESETS.find(p=>p.id===presetId);
      const P=params;
      xF=(u,v)=>preset.xF(u,v,P); yF=(u,v)=>preset.yF(u,v,P); zF=(u,v)=>preset.zF(u,v,P);
      uR=preset.uR; vR=preset.vR; nU=preset.nU; nV=preset.nV; surfColor=preset.color;
    }

    // Build mesh + grid
    const geom = buildMesh(xF,yF,zF,uR,vR);
    mMsh(geom, surfColor, 0.14);
    buildGrid(xF,yF,zF,uR,vR,nU,nV).forEach(g=>mLn(g,surfColor,0.55));

  },[presetId,params,custom,plotKey]);

  // ── Helpers ───────────────────────────────────────────────────────────
  const preset     = PRESETS.find(p=>p.id===presetId);
  const lcolor     = custom ? "#38bdf8" : preset.lcol;
  const eqDisplay  = custom
    ? `x=${xExpr}  y=${yExpr}  z=${zExpr}`
    : preset.eq(params);

  const setPreset = (id)=>{
    const p=PRESETS.find(x=>x.id===id);
    const np={...DEFAULT_PARAMS};
    p.params.forEach(pm=>np[pm.id]=pm.def);
    setPresetId(id); setParams(np); setCustom(false);
  };

  const setParam = (id,val)=>setParams(p=>({...p,[id]:val}));

  const plotCustom = ()=>{
    setCustomErr(null);
    setCustom(true);
    setPlotKey(k=>k+1);
  };

  const mono = {fontFamily:"'DM Mono',monospace"};
  const card = {background:"#050710",border:"1px solid rgba(255,255,255,0.05)",borderRadius:14,padding:"18px 20px"};
  const lbl  = {fontSize:9,letterSpacing:3,color:"#334155",textTransform:"uppercase"};

  const Slider=({label,val,set,min,max,s=0.1,col="#f59e0b"})=>(
    <div style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
        <span style={{fontSize:12,color:"#64748b",...mono}}>{label}</span>
        <input type="number" min={min} max={max} step={s} value={val}
          onChange={e=>{const v=parseFloat(e.target.value);if(!isNaN(v)&&v>=min&&v<=max)set(v);}}
          style={{width:62,padding:"3px 7px",borderRadius:6,border:"1px solid rgba(255,255,255,0.09)",
            background:"rgba(255,255,255,0.04)",color:col,fontSize:13,...mono,fontWeight:500,textAlign:"center",outline:"none"}}/>
      </div>
      <input type="range" min={min} max={max} step={s} value={val}
        onChange={e=>set(parseFloat(e.target.value))}
        style={{width:"100%",accentColor:col,cursor:"pointer"}}/>
    </div>
  );

  const ExprInput=({label,val,set})=>(
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
      <span style={{fontSize:12,color:"#64748b",...mono,flexShrink:0,width:40}}>{label} =</span>
      <input type="text" value={val} onChange={e=>set(e.target.value)}
        style={{flex:1,padding:"5px 9px",borderRadius:7,border:"1px solid rgba(255,255,255,0.09)",
          background:"rgba(255,255,255,0.04)",color:"#38bdf8",fontSize:12,...mono,outline:"none"}}/>
    </div>
  );

  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",background:"#07090f",height:"100vh",color:"#e2e8f0",display:"flex",flexDirection:"column",overflow:"hidden"}}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div style={{background:"#050710",borderBottom:"1px solid rgba(255,255,255,0.05)",padding:"0 26px",display:"flex",alignItems:"center",height:52,flexShrink:0}}>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,color:"#f59e0b",marginRight:14}}>
          Geometria Analítica
        </span>
        <span style={{fontSize:9,letterSpacing:2.5,color:"#1e293b",flex:1}}>WINTERLE — CAP. 9</span>
        <div style={{display:"flex",gap:10}}>
          {[["x","#ff4455"],["y","#44dd88"],["z","#4499ff"]].map(([ax,ac])=>(
            <div key={ax} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:ac,...mono}}>
              <div style={{width:12,height:2,background:ac,borderRadius:1}}/>{ax}
            </div>
          ))}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>

        {/* ── 3D Canvas 60% ───────────────────────────────────────────── */}
        <div ref={containerRef} style={{flex:"0 0 60%",position:"relative",background:"#060810",borderRight:"1px solid rgba(255,255,255,0.04)"}}>
          {/* Equation badge */}
          <div style={{
            position:"absolute",top:13,left:13,zIndex:10,maxWidth:"90%",
            background:"rgba(0,0,0,0.55)",border:`1px solid ${lcolor}44`,
            borderRadius:8,padding:"6px 14px",fontSize:12,color:lcolor,...mono,
            letterSpacing:0.3,pointerEvents:"none",wordBreak:"break-all",
          }}>{eqDisplay}</div>
          {/* Hint */}
          <div style={{position:"absolute",bottom:13,right:13,zIndex:10,fontSize:10,color:"#111e33",...mono,pointerEvents:"none"}}>
            arrastar · rotacionar  ·  scroll · zoom
          </div>
        </div>

        {/* ── Right panel 40% ─────────────────────────────────────────── */}
        <div style={{flex:"0 0 40%",display:"flex",flexDirection:"column",padding:"18px 22px",gap:13,overflowY:"auto"}}>

          {/* Funções prontas */}
          <div style={card}>
            <div style={{...lbl,marginBottom:13}}>Funções Prontas</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {PRESETS.map(p=>(
                <button key={p.id} onClick={()=>setPreset(p.id)} style={{
                  padding:"9px 6px",borderRadius:9,border:`1px solid ${!custom&&presetId===p.id?p.lcol:"rgba(255,255,255,0.06)"}`,
                  background: !custom&&presetId===p.id?`${p.lcol}18`:"rgba(255,255,255,0.02)",
                  color: !custom&&presetId===p.id?p.lcol:"#475569",
                  cursor:"pointer",fontSize:12,...mono,fontWeight:!custom&&presetId===p.id?600:400,
                  transition:"all 0.18s",
                }}>{p.label}</button>
              ))}
            </div>
          </div>

          {/* Parameters for current preset */}
          {!custom && (
            <div style={card}>
              <div style={{...lbl,marginBottom:14}}>Parâmetros</div>
              {preset.params.map(pm=>(
                <Slider key={pm.id} label={pm.label} val={params[pm.id]||pm.def}
                  set={v=>setParam(pm.id,v)} min={pm.min} max={pm.max} col={pm.col}/>
              ))}
            </div>
          )}

          {/* Custom function */}
          <div style={card}>
            <div style={{...lbl,marginBottom:13}}>Função Personalizada</div>
            <div style={{fontSize:11,color:"#334155",marginBottom:12,...mono}}>
              Paramétrica: x(u,v), y(u,v), z(u,v)
            </div>
            <ExprInput label="x(u,v)" val={xExpr} set={setXExpr}/>
            <ExprInput label="y(u,v)" val={yExpr} set={setYExpr}/>
            <ExprInput label="z(u,v)" val={zExpr} set={setZExpr}/>
            {/* Ranges */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,margin:"10px 0 4px"}}>
              {[["u min",uMin,setUMin],["u max",uMax,setUMax],["v min",vMin,setVMin],["v max",vMax,setVMax]].map(([lb,vl,sv])=>(
                <div key={lb}>
                  <div style={{fontSize:10,color:"#334155",...mono,marginBottom:3}}>{lb}</div>
                  <input type="text" value={vl} onChange={e=>sv(e.target.value)}
                    style={{width:"100%",padding:"4px 8px",borderRadius:6,border:"1px solid rgba(255,255,255,0.08)",
                      background:"rgba(255,255,255,0.03)",color:"#94a3b8",fontSize:12,...mono,outline:"none",boxSizing:"border-box"}}/>
                </div>
              ))}
            </div>
            {customErr && <div style={{fontSize:11,color:"#ef4444",...mono,marginBottom:8}}>{customErr}</div>}
            <div style={{fontSize:10,color:"#1e293b",...mono,marginBottom:10}}>
              sin cos tan sqrt abs log cosh sinh exp pi
            </div>
            <button onClick={plotCustom} style={{
              width:"100%",padding:"10px 0",borderRadius:9,border:"none",
              background:"#38bdf8",color:"#07090f",fontSize:13,fontWeight:700,
              fontFamily:"'DM Sans',sans-serif",cursor:"pointer",
            }}>▶  Plotar</button>
            {custom && (
              <button onClick={()=>setCustom(false)} style={{
                width:"100%",marginTop:7,padding:"7px 0",borderRadius:9,
                border:"1px solid rgba(255,255,255,0.07)",background:"transparent",
                color:"#475569",fontSize:12,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",
              }}>Voltar para presets</button>
            )}
          </div>

          {/* Examples hint */}
          <div style={{...card,padding:"14px 18px"}}>
            <div style={{...lbl,marginBottom:10}}>Exemplos</div>
            {[
              {name:"Toro",   x:"(2+cos(v))*cos(u)", y:"(2+cos(v))*sin(u)", z:"sin(v)", ur:"0", um:"2*pi", vr:"0", vm:"2*pi"},
              {name:"Hélice", x:"cos(u)",             y:"sin(u)",             z:"u/3",    ur:"0", um:"6*pi", vr:"0", vm:"1"},
              {name:"Klein",  x:"(2+cos(v/2)*sin(u)-sin(v/2)*sin(2*u))*cos(v)",
                              y:"(2+cos(v/2)*sin(u)-sin(v/2)*sin(2*u))*sin(v)",
                              z:"sin(v/2)*sin(u)+cos(v/2)*sin(2*u)", ur:"0",um:"2*pi",vr:"0",vm:"2*pi"},
            ].map(ex=>(
              <button key={ex.name} onClick={()=>{
                setXExpr(ex.x);setYExpr(ex.y);setZExpr(ex.z);
                setUMin(ex.ur);setUMax(ex.um);setVMin(ex.vr);setVMax(ex.vm);
                setTimeout(()=>{setCustom(true);setPlotKey(k=>k+1);},50);
              }} style={{
                display:"block",width:"100%",marginBottom:6,padding:"7px 12px",
                borderRadius:7,border:"1px solid rgba(255,255,255,0.06)",
                background:"transparent",color:"#334155",fontSize:12,...mono,
                cursor:"pointer",textAlign:"left",transition:"all 0.15s",
              }}
              onMouseEnter={e=>{e.target.style.color="#38bdf8";e.target.style.borderColor="rgba(56,189,248,0.3)";}}
              onMouseLeave={e=>{e.target.style.color="#334155";e.target.style.borderColor="rgba(255,255,255,0.06)";}}
              >{ex.name}</button>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
