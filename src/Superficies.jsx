import { useState, useEffect, useRef } from "react";
import * as THREE from "three";

const PI = Math.PI;

// ─── Safe evaluator ───────────────────────────────────────────────────────────
function ev(expr, u, v) {
  try {
    const e = String(expr).trim()
      .replace(/\bpi\b/gi, String(PI)).replace(/\be\b/g, String(Math.E))
      .replace(/\^/g, "**")
      .replace(/\bsin\b/g, "Math.sin").replace(/\bcos\b/g, "Math.cos")
      .replace(/\btan\b/g, "Math.tan").replace(/\bsqrt\b/g, "Math.sqrt")
      .replace(/\babs\b/g, "Math.abs").replace(/\bexp\b/g, "Math.exp")
      .replace(/\blog\b/g, "Math.log").replace(/\bcosh\b/g, "Math.cosh")
      .replace(/\bsinh\b/g, "Math.sinh").replace(/\btanh\b/g, "Math.tanh");
    const r = new Function("u", "v", `"use strict";return +(${e})`)(u, v);
    return isFinite(r) ? r : NaN;
  } catch { return NaN; }
}

// ─── Axis permutation: z→default, y→swap y/z, x→swap x/z ────────────────────
function axTr(x, y, z, ax) {
  if (ax === "x") return [z, y, x];
  if (ax === "y") return [x, z, y];
  return [x, y, z];
}

// ─── Colormap blue→cyan→green→yellow→red ────────────────────────────────────
function cmap(t) {
  const c = new THREE.Color();
  c.setHSL(0.67 * (1 - Math.max(0, Math.min(1, t))), 0.92, 0.52);
  return c;
}

// ─── Build parametric mesh ────────────────────────────────────────────────────
function buildMesh(xF, yF, zF, uR, vR, res = 48, ax = "z", vc = true) {
  const [u0, u1] = uR, [v0, v1] = vR;
  const uS = res, vS = res;
  const pos = [], nor = [], col = [], idx = [];
  const eps = 1e-4;
  const safe = v => (isFinite(v) ? v : 0);

  // Pre-compute all positions + find z range for colormap
  const pts = [];
  for (let i = 0; i <= uS; i++) for (let j = 0; j <= vS; j++) {
    const u = u0 + (u1-u0)*i/uS, v = v0 + (v1-v0)*j/vS;
    pts.push(axTr(safe(xF(u,v)), safe(yF(u,v)), safe(zF(u,v)), ax));
  }
  let zMin = Infinity, zMax = -Infinity;
  pts.forEach(([,,z]) => { if (isFinite(z)) { zMin=Math.min(zMin,z); zMax=Math.max(zMax,z); } });

  for (let i = 0; i <= uS; i++) {
    for (let j = 0; j <= vS; j++) {
      const [px,py,pz] = pts[i*(vS+1)+j];
      pos.push(px, py, pz);
      // Normals via central differences
      const u = u0+(u1-u0)*i/uS, v = v0+(v1-v0)*j/vS;
      const tp = (uu,vv) => axTr(safe(xF(uu,vv)),safe(yF(uu,vv)),safe(zF(uu,vv)),ax);
      const [xa,ya,za]=tp(u+eps,v), [xb,yb,zb]=tp(u-eps,v);
      const [xc,yc,zc]=tp(u,v+eps), [xd,yd,zd]=tp(u,v-eps);
      const du=[xa-xb,ya-yb,za-zb], dv=[xc-xd,yc-yd,zc-zd];
      let nx=du[1]*dv[2]-du[2]*dv[1], ny=du[2]*dv[0]-du[0]*dv[2], nz=du[0]*dv[1]-du[1]*dv[0];
      const nl=Math.sqrt(nx*nx+ny*ny+nz*nz)||1;
      nor.push(nx/nl, ny/nl, nz/nl);
      if (vc) {
        const t = zMax>zMin ? (pz-zMin)/(zMax-zMin) : 0.5;
        const c = cmap(isFinite(t)?t:0.5);
        col.push(c.r, c.g, c.b);
      }
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
  if (vc) g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));
  return g;
}

// ─── Build grid curves ────────────────────────────────────────────────────────
function buildGrid(xF, yF, zF, uR, vR, nU=10, nV=8, seg=80, ax="z") {
  const [u0,u1]=uR, [v0,v1]=vR;
  const geoms=[];
  const flush=pts=>{ if(pts.length>1) geoms.push(new THREE.BufferGeometry().setFromPoints(pts)); };
  for (let i=0;i<=nU;i++) {
    const u=u0+(u1-u0)*i/nU; const pts=[];
    for (let j=0;j<=seg;j++) {
      const v=v0+(v1-v0)*j/seg;
      const [x,y,z]=axTr(xF(u,v),yF(u,v),zF(u,v),ax);
      if(isFinite(x)&&isFinite(y)&&isFinite(z)) pts.push(new THREE.Vector3(x,y,z));
      else { flush(pts); pts.length=0; }
    }
    flush(pts);
  }
  for (let j=0;j<=nV;j++) {
    const v=v0+(v1-v0)*j/nV; const pts=[];
    for (let i=0;i<=seg;i++) {
      const u=u0+(u1-u0)*i/seg;
      const [x,y,z]=axTr(xF(u,v),yF(u,v),zF(u,v),ax);
      if(isFinite(x)&&isFinite(y)&&isFinite(z)) pts.push(new THREE.Vector3(x,y,z));
      else { flush(pts); pts.length=0; }
    }
    flush(pts);
  }
  return geoms;
}

// ─── Presets (10 surfaces — all equations verified) ──────────────────────────
// Esfera: x²+y²+z²=r²  | param: x=r·sinφ·cosθ, y=r·sinφ·sinθ, z=r·cosφ  ✓
// Elipsóide: x²/a²+y²/b²+z²/c²=1  | scaled sphere  ✓
// Cilindro: x²/a²+y²/b²=1  | x=a·cosθ, y=b·sinθ, z=t  ✓
// Parabolóide Elíp: z=x²/a²+y²/b²  | x=u,y=v,z=u²/a²+v²/b²  ✓
// Cone: z²=x²/a²+y²/b²  | x=a·t·cosθ, y=b·t·sinθ, z=t  ✓
// Hiperbolóide 1F: x²/a²+y²/b²-z²/c²=1  | cosh²v-sinh²v=1  ✓
// Hiperbolóide 2F: -x²/a²-y²/b²+z²/c²=1  | upper: z=c·coshv; mirror z  ✓
// Parabolóide Hiper: z=y²/b²-x²/a²  | x=u,y=v,z=v²/b²-u²/a²  ✓
// Cil. Parabólica: x²=ay  | x=u,y=u²/a,z=v  ✓
// Cil. Hiperbólica: x²/a²-y²/b²=1  | x=a·coshu,y=b·sinhu; mirror x  ✓
const PRESETS = [
  { id:"esfera",     label:"Esfera",           color:0xf59e0b, lcol:"#f59e0b",
    eq:p=>`x² + y² + z² = ${(p.r**2).toFixed(2)}`,
    params:[{id:"r",label:"r (raio)",min:0.3,max:4,def:2,col:"#f59e0b"}],
    xF:(u,v,p)=>p.r*Math.sin(v)*Math.cos(u), yF:(u,v,p)=>p.r*Math.sin(v)*Math.sin(u), zF:(u,v,p)=>p.r*Math.cos(v),
    uR:[0,2*PI], vR:[0,PI], nU:12, nV:8 },
  { id:"elipsoide",  label:"Elipsóide",        color:0xa78bfa, lcol:"#a78bfa",
    eq:p=>`x²/${(p.a**2).toFixed(1)}+y²/${(p.b**2).toFixed(1)}+z²/${(p.c**2).toFixed(1)}=1`,
    params:[{id:"a",label:"a",min:0.3,max:4,def:2.5,col:"#ff4455"},{id:"b",label:"b",min:0.3,max:4,def:1.5,col:"#44dd88"},{id:"c",label:"c",min:0.3,max:4,def:1.2,col:"#4499ff"}],
    xF:(u,v,p)=>p.a*Math.sin(v)*Math.cos(u), yF:(u,v,p)=>p.b*Math.sin(v)*Math.sin(u), zF:(u,v,p)=>p.c*Math.cos(v),
    uR:[0,2*PI], vR:[0,PI], nU:12, nV:8 },
  { id:"cilindro",   label:"Cilindro Elíp.",   color:0x34d399, lcol:"#34d399",
    eq:p=>`x²/${(p.a**2).toFixed(1)}+y²/${(p.b**2).toFixed(1)}=1`,
    params:[{id:"a",label:"a",min:0.3,max:3.5,def:2,col:"#ff4455"},{id:"b",label:"b",min:0.3,max:3.5,def:1.5,col:"#44dd88"}],
    xF:(u,v,p)=>p.a*Math.cos(u), yF:(u,v,p)=>p.b*Math.sin(u), zF:(u,v,p)=>v,
    uR:[0,2*PI], vR:[-2.5,2.5], nU:12, nV:8 },
  { id:"parabElip",  label:"Parabolóide Elíp.",color:0x60a5fa, lcol:"#60a5fa",
    eq:p=>`z = x²/${(p.a**2).toFixed(1)}+y²/${(p.b**2).toFixed(1)}`,
    params:[{id:"a",label:"a",min:0.3,max:4,def:1.5,col:"#ff4455"},{id:"b",label:"b",min:0.3,max:4,def:1.5,col:"#44dd88"}],
    xF:(u,v,p)=>u, yF:(u,v,p)=>v, zF:(u,v,p)=>u*u/(p.a*p.a)+v*v/(p.b*p.b),
    uR:[-2.2,2.2], vR:[-2.2,2.2], nU:10, nV:10 },
  { id:"cone",       label:"Cone",             color:0xfb7185, lcol:"#fb7185",
    eq:p=>`z² = x²/${(p.a**2).toFixed(1)}+y²/${(p.b**2).toFixed(1)}`,
    params:[{id:"a",label:"a",min:0.3,max:3,def:1,col:"#ff4455"},{id:"b",label:"b",min:0.3,max:3,def:1,col:"#44dd88"}],
    xF:(u,v,p)=>p.a*v*Math.cos(u), yF:(u,v,p)=>p.b*v*Math.sin(u), zF:(u,v,p)=>v,
    uR:[0,2*PI], vR:[-2.5,2.5], nU:12, nV:10 },
  { id:"hiper1",     label:"Hiperbolóide 1F",  color:0xfbbf24, lcol:"#fbbf24",
    eq:p=>`x²/${(p.a**2).toFixed(1)}+y²/${(p.b**2).toFixed(1)}−z²/${(p.c**2).toFixed(1)}=1`,
    params:[{id:"a",label:"a",min:0.3,max:3,def:1,col:"#ff4455"},{id:"b",label:"b",min:0.3,max:3,def:1,col:"#44dd88"},{id:"c",label:"c",min:0.3,max:3,def:1,col:"#4499ff"}],
    xF:(u,v,p)=>p.a*Math.cosh(v)*Math.cos(u), yF:(u,v,p)=>p.b*Math.cosh(v)*Math.sin(u), zF:(u,v,p)=>p.c*Math.sinh(v),
    uR:[0,2*PI], vR:[-1.5,1.5], nU:12, nV:8 },
  { id:"hiper2",     label:"Hiperbolóide 2F",  color:0xf97316, lcol:"#f97316",
    eq:p=>`−x²/${(p.a**2).toFixed(1)}−y²/${(p.b**2).toFixed(1)}+z²/${(p.c**2).toFixed(1)}=1`,
    params:[{id:"a",label:"a",min:0.3,max:3,def:1,col:"#ff4455"},{id:"b",label:"b",min:0.3,max:3,def:1,col:"#44dd88"},{id:"c",label:"c",min:0.3,max:3,def:1,col:"#4499ff"}],
    xF:(u,v,p)=>p.a*Math.sinh(v)*Math.cos(u), yF:(u,v,p)=>p.b*Math.sinh(v)*Math.sin(u), zF:(u,v,p)=>p.c*Math.cosh(v),
    uR:[0,2*PI], vR:[-1.8,1.8], nU:12, nV:8, mirror:"z" },
  { id:"parabHiper", label:"Parabolóide Hiper.",color:0x06b6d4, lcol:"#06b6d4",
    eq:p=>`z = y²/${(p.b**2).toFixed(1)}−x²/${(p.a**2).toFixed(1)}`,
    params:[{id:"a",label:"a",min:0.3,max:4,def:1.5,col:"#ff4455"},{id:"b",label:"b",min:0.3,max:4,def:1.5,col:"#44dd88"}],
    xF:(u,v,p)=>u, yF:(u,v,p)=>v, zF:(u,v,p)=>v*v/(p.b*p.b)-u*u/(p.a*p.a),
    uR:[-2.5,2.5], vR:[-2.5,2.5], nU:10, nV:10 },
  { id:"cilParab",   label:"Cil. Parabólica",  color:0xec4899, lcol:"#ec4899",
    eq:p=>`x² = ${p.a.toFixed(1)}y`,
    params:[{id:"a",label:"a",min:0.2,max:4,def:1.5,col:"#f59e0b"}],
    xF:(u,v,p)=>u, yF:(u,v,p)=>u*u/p.a, zF:(u,v,p)=>v,
    uR:[-2.5,2.5], vR:[-2.5,2.5], nU:10, nV:8 },
  { id:"cilHiper",   label:"Cil. Hiperbólica", color:0x84cc16, lcol:"#84cc16",
    eq:p=>`x²/${(p.a**2).toFixed(1)}−y²/${(p.b**2).toFixed(1)}=1`,
    params:[{id:"a",label:"a",min:0.3,max:3,def:1.5,col:"#ff4455"},{id:"b",label:"b",min:0.3,max:3,def:1.5,col:"#44dd88"}],
    xF:(u,v,p)=>p.a*Math.cosh(u), yF:(u,v,p)=>p.b*Math.sinh(u), zF:(u,v,p)=>v,
    uR:[-2,2], vR:[-2.5,2.5], nU:12, nV:8, mirror:"x" },
];

const DEFS = { r:2, a:2.5, b:1.5, c:1.2 };

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [pid,  setPid]  = useState("esfera");
  const [P,    setP]    = useState(DEFS);
  const [custom, setCust] = useState(false);
  const [xE, setXE] = useState("cos(u)*sin(v)");
  const [yE, setYE] = useState("sin(u)*sin(v)");
  const [zE, setZE] = useState("cos(v)");
  const [u0s,setU0] = useState("0");  const [u1s,setU1] = useState("2*pi");
  const [v0s,setV0] = useState("0");  const [v1s,setV1] = useState("pi");
  const [pKey,setPKey]  = useState(0);
  const [cErr,setCErr]  = useState(null);
  const [res,  setRes]  = useState(48);
  const [view, setView] = useState("solid");
  const [vcol, setVcol] = useState(true);
  const [ax,   setAx]   = useState("z");
  const [cut,  setCut]  = useState(false);
  const [cutZ, setCutZ] = useState(0);
  const [cMin, setCMin] = useState(-5);
  const [cMax, setCMax] = useState(5);

  const contRef = useRef(); const sceneRef = useRef(); const frameRef = useRef();

  // Fonts
  useEffect(() => {
    const l = document.createElement("link"); l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap";
    document.head.appendChild(l);
  }, []);

  // ── Three.js init ────────────────────────────────────────────────────────
  useEffect(() => {
    const cont = contRef.current;
    const W = cont.clientWidth, H = cont.clientHeight;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x060810);
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(50, W/H, 0.1, 200);
    camera.up.set(0, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.setSize(W, H); renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.localClippingEnabled = true;
    cont.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff,0.45));
    const d1=new THREE.DirectionalLight(0xffffff,1.0); d1.position.set(8,5,10); scene.add(d1);
    const d2=new THREE.DirectionalLight(0x6688ff,0.4); d2.position.set(-6,-4,-8); scene.add(d2);
    let theta=0.65,phi=1.1,radius=11,drag=false,lx=0,ly=0;
    const upCam=()=>{ camera.position.set(radius*Math.sin(phi)*Math.cos(theta),radius*Math.sin(phi)*Math.sin(theta),radius*Math.cos(phi)); camera.lookAt(0,0,0); };
    upCam();
    const cvs=renderer.domElement; cvs.style.display="block"; cvs.style.cursor="grab";
    // Mouse
    const dn=e=>{drag=true;lx=e.clientX;ly=e.clientY;cvs.style.cursor="grabbing";};
    const mv=e=>{if(!drag)return;theta-=(e.clientX-lx)*0.007;phi=Math.max(0.04,Math.min(PI-0.04,phi+(e.clientY-ly)*0.007));lx=e.clientX;ly=e.clientY;upCam();};
    const up=()=>{drag=false;cvs.style.cursor="grab";};
    const wh=e=>{e.preventDefault();radius=Math.max(3,Math.min(22,radius+e.deltaY*0.015));upCam();};
    // Touch (tablet/mobile)
    let pinchDist=null;
    const ts=e=>{e.preventDefault();if(e.touches.length===1){drag=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;}};
    const tm=e=>{
      e.preventDefault();
      if(e.touches.length===1&&drag){
        theta-=(e.touches[0].clientX-lx)*0.007;
        phi=Math.max(0.04,Math.min(PI-0.04,phi+(e.touches[0].clientY-ly)*0.007));
        lx=e.touches[0].clientX;ly=e.touches[0].clientY;upCam();
      } else if(e.touches.length===2){
        const dx=e.touches[0].clientX-e.touches[1].clientX;
        const dy=e.touches[0].clientY-e.touches[1].clientY;
        const d=Math.sqrt(dx*dx+dy*dy);
        if(pinchDist){radius=Math.max(3,Math.min(22,radius-(d-pinchDist)*0.05));upCam();}
        pinchDist=d;
      }
    };
    const te=e=>{drag=false;if(e.touches.length<2)pinchDist=null;};
    cvs.addEventListener("mousedown",dn); window.addEventListener("mousemove",mv); window.addEventListener("mouseup",up); cvs.addEventListener("wheel",wh,{passive:false});
    cvs.addEventListener("touchstart",ts,{passive:false}); cvs.addEventListener("touchmove",tm,{passive:false}); cvs.addEventListener("touchend",te);
    const rz=()=>{const w=cont.clientWidth,h=cont.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};
    window.addEventListener("resize",rz);
    const loop=()=>{frameRef.current=requestAnimationFrame(loop);renderer.render(scene,camera);}; loop();
    return ()=>{cancelAnimationFrame(frameRef.current);cvs.removeEventListener("mousedown",dn);window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up);cvs.removeEventListener("wheel",wh);cvs.removeEventListener("touchstart",ts);cvs.removeEventListener("touchmove",tm);cvs.removeEventListener("touchend",te);window.removeEventListener("resize",rz);renderer.dispose();if(cont.contains(cvs))cont.removeChild(cvs);};
  }, []);

  // ── Scene rebuild ────────────────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current; if (!scene) return;
    [...scene.children].filter(o=>o.userData.rm).forEach(o=>{
      scene.remove(o);
      const D=x=>{x?.children?.forEach(D);x?.geometry?.dispose();Array.isArray(x?.material)?x.material.forEach(m=>m.dispose()):x?.material?.dispose();};
      D(o);
    });
    const add=o=>{o.userData.rm=true;scene.add(o);return o;};
    const clips=[];
    if(cMin>-5) clips.push(new THREE.Plane(new THREE.Vector3(0,0,1),-cMin));
    if(cMax<5)  clips.push(new THREE.Plane(new THREE.Vector3(0,0,-1),cMax));
    const mLn=(g,c,op=1)=>add(new THREE.Line(g,new THREE.LineBasicMaterial({color:c,transparent:op<1,opacity:op,clippingPlanes:clips})));
    const mDot=(p,c,s=0.09)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(s,10,10),new THREE.MeshBasicMaterial({color:c}));m.position.copy(p);return add(m);};
    const s2=(a,b)=>new THREE.BufferGeometry().setFromPoints([a,b]);
    // Axes
    [{d:[5.5,0,0],c:0xff4455},{d:[0,5.5,0],c:0x44dd88},{d:[0,0,5.5],c:0x4499ff}].forEach(({d,c})=>{
      mLn(s2(new THREE.Vector3(0,0,0),new THREE.Vector3(...d)),c);
      mLn(s2(new THREE.Vector3(0,0,0),new THREE.Vector3(-d[0]*.3,-d[1]*.3,-d[2]*.3)),c,0.2);
      mDot(new THREE.Vector3(...d),c,0.07);
    });
    // Grid
    for(let i=-5;i<=5;i++){mLn(s2(new THREE.Vector3(i,-5,0),new THREE.Vector3(i,5,0)),0x080d1c);mLn(s2(new THREE.Vector3(-5,i,0),new THREE.Vector3(5,i,0)),0x080d1c);}
    // Cutting plane
    if(cut){
      const pg=new THREE.PlaneGeometry(14,14);
      const pm=new THREE.Mesh(pg,new THREE.MeshBasicMaterial({color:0x60a5fa,transparent:true,opacity:0.09,side:THREE.DoubleSide}));
      pm.position.z=cutZ;pm.userData.rm=true;scene.add(pm);
      mLn(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-7,-7,cutZ),new THREE.Vector3(7,-7,cutZ),new THREE.Vector3(7,7,cutZ),new THREE.Vector3(-7,7,cutZ),new THREE.Vector3(-7,-7,cutZ)]),0x60a5fa,0.6);
    }
    // Surface resolution
    let xF,yF,zF,uR,vR,nU,nV,sCol,mirror;
    if(custom){
      setCErr(null);
      const [u0c,u1c,v0c,v1c]=[ev(u0s,0,0),ev(u1s,0,0),ev(v0s,0,0),ev(v1s,0,0)];
      if([u0c,u1c,v0c,v1c].some(isNaN)){setCErr("Intervalo inválido");return;}
      xF=(u,v)=>ev(xE,u,v);yF=(u,v)=>ev(yE,u,v);zF=(u,v)=>ev(zE,u,v);
      if([xF(1,1),yF(1,1),zF(1,1)].some(isNaN)){setCErr("Expressão inválida — use u, v, sin, cos, sqrt, pi…");return;}
      uR=[u0c,u1c];vR=[v0c,v1c];nU=10;nV=8;sCol=0x38bdf8;
    } else {
      const pr=PRESETS.find(p=>p.id===pid);
      xF=(u,v)=>pr.xF(u,v,P);yF=(u,v)=>pr.yF(u,v,P);zF=(u,v)=>pr.zF(u,v,P);
      uR=pr.uR;vR=pr.vR;nU=pr.nU;nV=pr.nV;sCol=pr.color;mirror=pr.mirror;
    }
    const op=view==="xray"?0.07:view==="wire"?0:0.15;
    const drawSurf=(xFn,yFn,zFn)=>{
      if(op>0){
        const g=buildMesh(xFn,yFn,zFn,uR,vR,res,ax,vcol);
        add(new THREE.Mesh(g,new THREE.MeshPhongMaterial({vertexColors:vcol,color:vcol?0xffffff:sCol,transparent:true,opacity:op,side:THREE.DoubleSide,shininess:55,clippingPlanes:clips})));
      }
      buildGrid(xFn,yFn,zFn,uR,vR,nU,nV,80,ax).forEach(g=>mLn(g,sCol,view==="wire"?0.8:0.5));
    };
    drawSurf(xF,yF,zF);
    if(mirror==="z") drawSurf(xF,yF,(u,v)=>-zF(u,v));
    if(mirror==="x") drawSurf((u,v)=>-xF(u,v),yF,zF);
  },[pid,P,custom,pKey,res,view,vcol,ax,cut,cutZ,cMin,cMax]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const pr     = PRESETS.find(p=>p.id===pid);
  const lcolor = custom?"#38bdf8":pr.lcol;
  const eq     = custom?`x=${xE}  y=${yE}  z=${zE}`:pr.eq(P);
  const setPreset=id=>{const p=PRESETS.find(x=>x.id===id);const np={...DEFS};p.params.forEach(pm=>np[pm.id]=pm.def);setPid(id);setP(np);setCust(false);};
  const setParam=(id,v)=>setP(pp=>({...pp,[id]:v}));

  const mo={fontFamily:"'DM Mono',monospace"};
  const card={background:"#050710",border:"1px solid rgba(255,255,255,0.05)",borderRadius:14,padding:"16px 18px"};
  const lbl={fontSize:9,letterSpacing:3,color:"#334155",textTransform:"uppercase"};
  const btnRow={display:"flex",gap:6,flexWrap:"wrap"};

  const Sl=({lbl:lb,val,set,min,max,s=0.1,col="#f59e0b"})=>(
    <div style={{marginBottom:11}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
        <span style={{fontSize:12,color:"#64748b",...mo}}>{lb}</span>
        <input type="number" min={min} max={max} step={s} value={val}
          onChange={e=>{const v=parseFloat(e.target.value);if(!isNaN(v)&&v>=min&&v<=max)set(v);}}
          style={{width:60,padding:"3px 7px",borderRadius:6,border:"1px solid rgba(255,255,255,0.09)",background:"rgba(255,255,255,0.04)",color:col,fontSize:12,...mo,fontWeight:500,textAlign:"center",outline:"none"}}/>
      </div>
      <input type="range" min={min} max={max} step={s} value={val} onChange={e=>set(parseFloat(e.target.value))} style={{width:"100%",accentColor:col,cursor:"pointer"}}/>
    </div>
  );

  const TogBtn=({label,active,onClick,col="#f59e0b"})=>(
    <button onClick={onClick} style={{flex:1,padding:"7px 4px",borderRadius:8,border:`1px solid ${active?col:"rgba(255,255,255,0.06)"}`,background:active?`${col}18`:"transparent",color:active?col:"#475569",fontSize:11,cursor:"pointer",...mo,transition:"all 0.15s"}}>
      {label}
    </button>
  );

  const EIn=({lb,val,set})=>(
    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
      <span style={{fontSize:12,color:"#64748b",...mo,flexShrink:0,width:44}}>{lb} =</span>
      <input type="text" value={val} onChange={e=>set(e.target.value)} style={{flex:1,padding:"5px 8px",borderRadius:7,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)",color:"#38bdf8",fontSize:12,...mo,outline:"none"}}/>
    </div>
  );

  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",background:"#07090f",height:"100vh",color:"#e2e8f0",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Top bar */}
      <div style={{background:"#050710",borderBottom:"1px solid rgba(255,255,255,0.05)",padding:"0 22px",display:"flex",alignItems:"center",height:50,flexShrink:0}}>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:"#f59e0b",marginRight:12}}>Geometria Analítica</span>
        <span style={{fontSize:9,letterSpacing:2.5,color:"#1e293b",flex:1}}>WINTERLE — CAP. 9</span>
        {[["x","#ff4455"],["y","#44dd88"],["z","#4499ff"]].map(([l,c])=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:c,...mo,marginLeft:12}}>
            <div style={{width:11,height:2,background:c,borderRadius:1}}/>{l}
          </div>
        ))}
      </div>

      {/* Body */}
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        {/* Canvas */}
        <div ref={contRef} style={{flex:"0 0 60%",position:"relative",background:"#060810",borderRight:"1px solid rgba(255,255,255,0.04)"}}>
          <div style={{position:"absolute",top:12,left:12,zIndex:10,maxWidth:"88%",background:"rgba(0,0,0,0.6)",border:`1px solid ${lcolor}44`,borderRadius:8,padding:"6px 13px",fontSize:12,color:lcolor,...mo,letterSpacing:0.3,pointerEvents:"none",wordBreak:"break-all"}}>{eq}</div>
          <div style={{position:"absolute",bottom:12,right:12,zIndex:10,fontSize:10,color:"#0e1828",...mo,pointerEvents:"none"}}>arrastar · rotacionar  ·  scroll · zoom</div>
        </div>

        {/* Right panel */}
        <div style={{flex:"0 0 40%",display:"flex",flexDirection:"column",padding:"14px 18px",gap:11,overflowY:"auto"}}>

          {/* Presets */}
          <div style={card}>
            <div style={{...lbl,marginBottom:11}}>Funções Prontas</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {PRESETS.map(p=>(
                <button key={p.id} onClick={()=>setPreset(p.id)} style={{padding:"8px 4px",borderRadius:8,border:`1px solid ${!custom&&pid===p.id?p.lcol:"rgba(255,255,255,0.05)"}`,background:!custom&&pid===p.id?`${p.lcol}15`:"rgba(255,255,255,0.02)",color:!custom&&pid===p.id?p.lcol:"#475569",cursor:"pointer",fontSize:11,...mo,fontWeight:!custom&&pid===p.id?600:400,transition:"all 0.15s"}}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Parameters */}
          {!custom && (
            <div style={card}>
              <div style={{...lbl,marginBottom:12}}>Parâmetros</div>
              {pr.params.map(pm=>(
                <Sl key={pm.id} lbl={pm.label} val={P[pm.id]||pm.def} set={v=>setParam(pm.id,v)} min={pm.min} max={pm.max} col={pm.col}/>
              ))}
            </div>
          )}

          {/* Visual controls */}
          <div style={card}>
            <div style={{...lbl,marginBottom:12}}>Controles Visuais</div>
            <div style={{...lbl,fontSize:8,marginBottom:6}}>Resolução da malha</div>
            <Sl lbl={`${res}×${res}`} val={res} set={setRes} min={12} max={96} s={4} col="#60a5fa"/>
            <div style={{...lbl,fontSize:8,marginBottom:6,marginTop:4}}>Vista</div>
            <div style={{...btnRow,marginBottom:10}}>
              <TogBtn label="Sólido" active={view==="solid"} onClick={()=>setView("solid")}/>
              <TogBtn label="Raio-X" active={view==="xray"} onClick={()=>setView("xray")} col="#a78bfa"/>
              <TogBtn label="Malha" active={view==="wire"} onClick={()=>setView("wire")} col="#34d399"/>
            </div>
            <div style={{...lbl,fontSize:8,marginBottom:6}}>Eixo principal</div>
            <div style={{...btnRow,marginBottom:10}}>
              {["z","y","x"].map(a=><TogBtn key={a} label={`Eixo ${a.toUpperCase()}`} active={ax===a} onClick={()=>setAx(a)} col={a==="z"?"#4499ff":a==="y"?"#44dd88":"#ff4455"}/>)}
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:12,color:"#64748b",...mo}}>Colormap por altura</span>
              <button onClick={()=>setVcol(v=>!v)} style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${vcol?"#f59e0b":"rgba(255,255,255,0.06)"}`,background:vcol?"rgba(245,158,11,0.12)":"transparent",color:vcol?"#f59e0b":"#475569",cursor:"pointer",fontSize:11,...mo}}>
                {vcol?"ON":"OFF"}
              </button>
            </div>
          </div>

          {/* Domain & cutting plane */}
          <div style={card}>
            <div style={{...lbl,marginBottom:12}}>Domínio & Corte</div>
            <Sl lbl="z mínimo" val={cMin} set={setCMin} min={-6} max={cMax-0.1} s={0.1} col="#60a5fa"/>
            <Sl lbl="z máximo" val={cMax} set={setCMax} min={cMin+0.1} max={6} s={0.1} col="#fb7185"/>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:4,marginBottom:cut?10:0}}>
              <span style={{fontSize:12,color:"#64748b",...mo}}>Plano de corte z=k</span>
              <button onClick={()=>setCut(c=>!c)} style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${cut?"#60a5fa":"rgba(255,255,255,0.06)"}`,background:cut?"rgba(96,165,250,0.12)":"transparent",color:cut?"#60a5fa":"#475569",cursor:"pointer",fontSize:11,...mo}}>
                {cut?"ON":"OFF"}
              </button>
            </div>
            {cut && <Sl lbl={`k = ${cutZ.toFixed(2)}`} val={cutZ} set={setCutZ} min={-5} max={5} s={0.05} col="#60a5fa"/>}
          </div>

          {/* Custom function */}
          <div style={card}>
            <div style={{...lbl,marginBottom:10}}>Função Personalizada</div>
            <div style={{fontSize:11,color:"#334155",marginBottom:10,...mo}}>x(u,v),  y(u,v),  z(u,v)</div>
            <EIn lb="x(u,v)" val={xE} set={setXE}/>
            <EIn lb="y(u,v)" val={yE} set={setYE}/>
            <EIn lb="z(u,v)" val={zE} set={setZE}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,margin:"8px 0 4px"}}>
              {[["u min",u0s,setU0],["u max",u1s,setU1],["v min",v0s,setV0],["v max",v1s,setV1]].map(([lb,vl,sv])=>(
                <div key={lb}>
                  <div style={{fontSize:9,color:"#334155",...mo,marginBottom:3}}>{lb}</div>
                  <input type="text" value={vl} onChange={e=>sv(e.target.value)} style={{width:"100%",padding:"4px 7px",borderRadius:6,border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.03)",color:"#94a3b8",fontSize:11,...mo,outline:"none",boxSizing:"border-box"}}/>
                </div>
              ))}
            </div>
            {cErr && <div style={{fontSize:11,color:"#ef4444",...mo,marginBottom:7}}>{cErr}</div>}
            <div style={{fontSize:10,color:"#1e293b",...mo,marginBottom:8}}>sin cos tan sqrt cosh sinh exp log pi</div>
            <button onClick={()=>{setCErr(null);setCust(true);setPKey(k=>k+1);}} style={{width:"100%",padding:"9px 0",borderRadius:9,border:"none",background:"#38bdf8",color:"#07090f",fontSize:13,fontWeight:700,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"}}>
              ▶  Plotar
            </button>
            {custom && <button onClick={()=>setCust(false)} style={{width:"100%",marginTop:7,padding:"7px 0",borderRadius:9,border:"1px solid rgba(255,255,255,0.06)",background:"transparent",color:"#475569",fontSize:12,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"}}>
              ← Voltar para presets
            </button>}
          </div>

          {/* Quick examples */}
          <div style={{...card,padding:"12px 16px"}}>
            <div style={{...lbl,marginBottom:9}}>Exemplos Rápidos</div>
            {[
              {n:"Toro",       x:"(2+cos(v))*cos(u)",   y:"(2+cos(v))*sin(u)",   z:"sin(v)",      u0:"0",u1:"2*pi",v0:"0",v1:"2*pi"},
              {n:"Hélice",     x:"cos(u)",               y:"sin(u)",               z:"u/3",         u0:"0",u1:"6*pi",v0:"0",v1:"1"},
              {n:"Klein",      x:"(2+cos(v/2)*sin(u)-sin(v/2)*sin(2*u))*cos(v)", y:"(2+cos(v/2)*sin(u)-sin(v/2)*sin(2*u))*sin(v)", z:"sin(v/2)*sin(u)+cos(v/2)*sin(2*u)", u0:"0",u1:"2*pi",v0:"0",v1:"2*pi"},
              {n:"Onda",       x:"u",                    y:"v",                    z:"sin(u)*cos(v)", u0:"-pi",u1:"pi",v0:"-pi",v1:"pi"},
            ].map(ex=>(
              <button key={ex.n} onClick={()=>{setXE(ex.x);setYE(ex.y);setZE(ex.z);setU0(ex.u0);setU1(ex.u1);setV0(ex.v0);setV1(ex.v1);setTimeout(()=>{setCust(true);setPKey(k=>k+1);},40);}}
                style={{display:"block",width:"100%",marginBottom:5,padding:"6px 10px",borderRadius:7,border:"1px solid rgba(255,255,255,0.05)",background:"transparent",color:"#334155",fontSize:11,...mo,cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}
                onMouseEnter={e=>{e.target.style.color="#38bdf8";e.target.style.borderColor="rgba(56,189,248,0.25)";}}
                onMouseLeave={e=>{e.target.style.color="#334155";e.target.style.borderColor="rgba(255,255,255,0.05)";}}
              >{ex.n}</button>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
