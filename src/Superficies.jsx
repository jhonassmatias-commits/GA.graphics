import { useState, useEffect, useRef } from "react";
import * as THREE from "three";

const PI = Math.PI;

function ev(expr, u, v, t = 0) {
  try {
    const e = String(expr).trim()
      .replace(/\bpi\b/gi, String(PI)).replace(/\be\b/g, String(Math.E))
      .replace(/\^/g, "**")
      .replace(/\bsin\b/g,"Math.sin").replace(/\bcos\b/g,"Math.cos")
      .replace(/\btan\b/g,"Math.tan").replace(/\bsqrt\b/g,"Math.sqrt")
      .replace(/\babs\b/g,"Math.abs").replace(/\bexp\b/g,"Math.exp")
      .replace(/\blog\b/g,"Math.log").replace(/\bcosh\b/g,"Math.cosh")
      .replace(/\bsinh\b/g,"Math.sinh").replace(/\btanh\b/g,"Math.tanh");
    const r = new Function("u","v","t",`"use strict";return +(${e})`)(u,v,t);
    return isFinite(r) ? r : NaN;
  } catch { return NaN; }
}

function compile(expr) {
  try {
    const e = String(expr).trim()
      .replace(/\bpi\b/gi, String(PI)).replace(/\be\b/g, String(Math.E))
      .replace(/\^/g,"**")
      .replace(/\bsin\b/g,"Math.sin").replace(/\bcos\b/g,"Math.cos")
      .replace(/\btan\b/g,"Math.tan").replace(/\bsqrt\b/g,"Math.sqrt")
      .replace(/\babs\b/g,"Math.abs").replace(/\bexp\b/g,"Math.exp")
      .replace(/\blog\b/g,"Math.log").replace(/\bcosh\b/g,"Math.cosh")
      .replace(/\bsinh\b/g,"Math.sinh").replace(/\btanh\b/g,"Math.tanh");
    return new Function("u","v","t",`"use strict";return +(${e})`);
  } catch { return ()=>NaN; }
}

function axTr(x,y,z,ax){ if(ax==="x")return[z,y,x];if(ax==="y")return[x,z,y];return[x,y,z]; }
function cmap(t){ const c=new THREE.Color(); c.setHSL(0.67*(1-Math.max(0,Math.min(1,t))),0.92,0.52); return c; }

function updateGeomAnim(geom, xFn, yFn, zFn, uR, vR, res, ax, vc, t) {
  const [u0,u1]=uR,[v0,v1]=vR,uS=res,vS=res;
  const pos=geom.attributes.position.array;
  const safe=v=>isFinite(v)?v:0;
  let zMin=Infinity,zMax=-Infinity;
  for(let i=0;i<=uS;i++) for(let j=0;j<=vS;j++){
    const u=u0+(u1-u0)*i/uS,v_=v0+(v1-v0)*j/vS;
    const [px,py,pz]=axTr(safe(xFn(u,v_,t)),safe(yFn(u,v_,t)),safe(zFn(u,v_,t)),ax);
    const k=(i*(vS+1)+j)*3; pos[k]=px;pos[k+1]=py;pos[k+2]=pz;
    if(isFinite(pz)){zMin=Math.min(zMin,pz);zMax=Math.max(zMax,pz);}
  }
  geom.attributes.position.needsUpdate=true;
  if(vc&&geom.attributes.color){
    const col=geom.attributes.color.array,n=(uS+1)*(vS+1);
    for(let i=0;i<n;i++){
      const pz=pos[i*3+2],tc=zMax>zMin?(pz-zMin)/(zMax-zMin):0.5;
      const c=cmap(isFinite(tc)?tc:0.5);
      col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;
    }
    geom.attributes.color.needsUpdate=true;
  }
  geom.computeVertexNormals();
}

function buildMesh(xF,yF,zF,uR,vR,res=48,ax="z",vc=true,t=0){
  const[u0,u1]=uR,[v0,v1]=vR,uS=res,vS=res;
  const pos=[],nor=[],col=[],idx=[],eps=1e-4,safe=v=>isFinite(v)?v:0;
  const pts=[];
  for(let i=0;i<=uS;i++) for(let j=0;j<=vS;j++){
    const u=u0+(u1-u0)*i/uS,v_=v0+(v1-v0)*j/vS;
    pts.push(axTr(safe(xF(u,v_,t)),safe(yF(u,v_,t)),safe(zF(u,v_,t)),ax));
  }
  let zMin=Infinity,zMax=-Infinity;
  pts.forEach(([,,z])=>{if(isFinite(z)){zMin=Math.min(zMin,z);zMax=Math.max(zMax,z);}});
  for(let i=0;i<=uS;i++) for(let j=0;j<=vS;j++){
    const[px,py,pz]=pts[i*(vS+1)+j]; pos.push(px,py,pz);
    const u=u0+(u1-u0)*i/uS,v_=v0+(v1-v0)*j/vS;
    const tp=(uu,vv)=>axTr(safe(xF(uu,vv,t)),safe(yF(uu,vv,t)),safe(zF(uu,vv,t)),ax);
    const[xa,ya,za]=tp(u+eps,v_),[xb,yb,zb]=tp(u-eps,v_);
    const[xc,yc,zc]=tp(u,v_+eps),[xd,yd,zd]=tp(u,v_-eps);
    const du=[xa-xb,ya-yb,za-zb],dv_=[xc-xd,yc-yd,zc-zd];
    let nx=du[1]*dv_[2]-du[2]*dv_[1],ny=du[2]*dv_[0]-du[0]*dv_[2],nz=du[0]*dv_[1]-du[1]*dv_[0];
    const nl=Math.sqrt(nx*nx+ny*ny+nz*nz)||1; nor.push(nx/nl,ny/nl,nz/nl);
    if(vc){const tc=zMax>zMin?(pz-zMin)/(zMax-zMin):0.5;const c=cmap(isFinite(tc)?tc:0.5);col.push(c.r,c.g,c.b);}
  }
  for(let i=0;i<uS;i++) for(let j=0;j<vS;j++){const a=i*(vS+1)+j,b=a+vS+1;idx.push(a,b,a+1,b,b+1,a+1);}
  const g=new THREE.BufferGeometry();
  g.setIndex(idx);
  g.setAttribute("position",new THREE.BufferAttribute(new Float32Array(pos),3));
  g.setAttribute("normal",  new THREE.BufferAttribute(new Float32Array(nor),3));
  if(vc)g.setAttribute("color",new THREE.BufferAttribute(new Float32Array(col),3));
  return g;
}

function buildGrid(xF,yF,zF,uR,vR,nU=10,nV=8,seg=80,ax="z",t=0){
  const[u0,u1]=uR,[v0,v1]=vR,geoms=[];
  const flush=pts=>{if(pts.length>1)geoms.push(new THREE.BufferGeometry().setFromPoints(pts));};
  for(let i=0;i<=nU;i++){const u=u0+(u1-u0)*i/nU,pts=[];
    for(let j=0;j<=seg;j++){const v_=v0+(v1-v0)*j/seg;const[x,y,z]=axTr(xF(u,v_,t),yF(u,v_,t),zF(u,v_,t),ax);if(isFinite(x)&&isFinite(y)&&isFinite(z))pts.push(new THREE.Vector3(x,y,z));else{flush(pts);pts.length=0;}}flush(pts);}
  for(let j=0;j<=nV;j++){const v_=v0+(v1-v0)*j/nV,pts=[];
    for(let i=0;i<=seg;i++){const u=u0+(u1-u0)*i/seg;const[x,y,z]=axTr(xF(u,v_,t),yF(u,v_,t),zF(u,v_,t),ax);if(isFinite(x)&&isFinite(y)&&isFinite(z))pts.push(new THREE.Vector3(x,y,z));else{flush(pts);pts.length=0;}}flush(pts);}
  return geoms;
}

function buildUCurves(xF,yF,zF,uR,vR,nU,seg=96,ax="z",t=0){
  const[u0,u1]=uR,[v0,v1]=vR,geoms=[];
  const flush=pts=>{if(pts.length>1)geoms.push(new THREE.BufferGeometry().setFromPoints(pts));};
  for(let i=0;i<=nU;i++){
    const u=u0+(u1-u0)*i/nU,pts=[];
    for(let j=0;j<=seg;j++){const v_=v0+(v1-v0)*j/seg;const[x,y,z]=axTr(xF(u,v_,t),yF(u,v_,t),zF(u,v_,t),ax);if(isFinite(x)&&isFinite(y)&&isFinite(z))pts.push(new THREE.Vector3(x,y,z));else{flush(pts);pts.length=0;}}
    flush(pts);
  }
  return geoms;
}

function buildVCurves(xF,yF,zF,uR,vR,nV,seg=96,ax="z",t=0){
  const[u0,u1]=uR,[v0,v1]=vR,geoms=[];
  const flush=pts=>{if(pts.length>1)geoms.push(new THREE.BufferGeometry().setFromPoints(pts));};
  for(let j=0;j<=nV;j++){
    const v_=v0+(v1-v0)*j/nV,pts=[];
    for(let i=0;i<=seg;i++){const u=u0+(u1-u0)*i/seg;const[x,y,z]=axTr(xF(u,v_,t),yF(u,v_,t),zF(u,v_,t),ax);if(isFinite(x)&&isFinite(y)&&isFinite(z))pts.push(new THREE.Vector3(x,y,z));else{flush(pts);pts.length=0;}}
    flush(pts);
  }
  return geoms;
}

const PRESETS=[
  {id:"esfera",    label:"Esfera",           color:0xf59e0b,lcol:"#f59e0b",
   anim:"Raio pulsa: r·(1+0.2·sin t)",
   tex:p=>`x^2+y^2+z^2=${(p.r**2).toFixed(2)}`,
   plain:p=>`x²+y²+z²=${(p.r**2).toFixed(2)}`,
   params:[{id:"r",label:"r",min:0.3,max:4,def:2,col:"#f59e0b"}],
   xF:(u,v,p,t)=>p.r*(1+0.2*Math.sin(t))*Math.sin(v)*Math.cos(u),
   yF:(u,v,p,t)=>p.r*(1+0.2*Math.sin(t))*Math.sin(v)*Math.sin(u),
   zF:(u,v,p,t)=>p.r*(1+0.2*Math.sin(t))*Math.cos(v),
   uR:[0,2*PI],vR:[0,PI],nU:12,nV:8},
  {id:"elipsoide", label:"Elipsóide",        color:0xa78bfa,lcol:"#a78bfa",
   anim:"Eixos a e b alternam: a·sin(t), b·cos(t)",
   tex:p=>`\\dfrac{x^2}{${(p.a**2).toFixed(1)}}+\\dfrac{y^2}{${(p.b**2).toFixed(1)}}+\\dfrac{z^2}{${(p.c**2).toFixed(1)}}=1`,
   plain:p=>`x²/${(p.a**2).toFixed(1)}+y²/${(p.b**2).toFixed(1)}+z²/${(p.c**2).toFixed(1)}=1`,
   params:[{id:"a",label:"a",min:0.3,max:4,def:2.5,col:"#ff4455"},{id:"b",label:"b",min:0.3,max:4,def:1.5,col:"#44dd88"},{id:"c",label:"c",min:0.3,max:4,def:1.2,col:"#4499ff"}],
   xF:(u,v,p,t)=>p.a*(1+0.15*Math.sin(t))*Math.sin(v)*Math.cos(u),
   yF:(u,v,p,t)=>p.b*(1+0.15*Math.cos(t))*Math.sin(v)*Math.sin(u),
   zF:(u,v,p,t)=>p.c*Math.cos(v),
   uR:[0,2*PI],vR:[0,PI],nU:12,nV:8},
  {id:"cilindro",  label:"Cilindro",         color:0x34d399,lcol:"#34d399",
   anim:"Ondas radiais: r(u,t) = 1 + 0.18·sin(5u+t)",
   tex:p=>`\\dfrac{x^2}{${(p.a**2).toFixed(1)}}+\\dfrac{y^2}{${(p.b**2).toFixed(1)}}=1`,
   plain:p=>`x²/${(p.a**2).toFixed(1)}+y²/${(p.b**2).toFixed(1)}=1`,
   params:[{id:"a",label:"a",min:0.3,max:3.5,def:2,col:"#ff4455"},{id:"b",label:"b",min:0.3,max:3.5,def:1.5,col:"#44dd88"}],
   xF:(u,v,p,t)=>p.a*(1+0.18*Math.sin(5*u+t))*Math.cos(u),
   yF:(u,v,p,t)=>p.b*(1+0.18*Math.sin(5*u+t))*Math.sin(u),
   zF:(u,v,p,t)=>v,
   uR:[0,2*PI],vR:[-2.5,2.5],nU:12,nV:8},
  {id:"parabElip", label:"Parabolóide Elíp.",color:0x60a5fa,lcol:"#60a5fa",
   anim:"Translação vertical: z + 0.5·sin t",
   tex:p=>`z=\\dfrac{x^2}{${(p.a**2).toFixed(1)}}+\\dfrac{y^2}{${(p.b**2).toFixed(1)}}`,
   plain:p=>`z=x²/${(p.a**2).toFixed(1)}+y²/${(p.b**2).toFixed(1)}`,
   params:[{id:"a",label:"a",min:0.3,max:4,def:1.5,col:"#ff4455"},{id:"b",label:"b",min:0.3,max:4,def:1.5,col:"#44dd88"}],
   xF:(u,v,p,t)=>u,yF:(u,v,p,t)=>v,
   zF:(u,v,p,t)=>u*u/(p.a*p.a)+v*v/(p.b*p.b)+0.5*Math.sin(t),
   uR:[-2.2,2.2],vR:[-2.2,2.2],nU:10,nV:10},
  {id:"cone",      label:"Cone",             color:0xfb7185,lcol:"#fb7185",
   anim:"Rotação contínua: u → u + 0.4t",
   tex:p=>`z^2=\\dfrac{x^2}{${(p.a**2).toFixed(1)}}+\\dfrac{y^2}{${(p.b**2).toFixed(1)}}`,
   plain:p=>`z²=x²/${(p.a**2).toFixed(1)}+y²/${(p.b**2).toFixed(1)}`,
   params:[{id:"a",label:"a",min:0.3,max:3,def:1,col:"#ff4455"},{id:"b",label:"b",min:0.3,max:3,def:1,col:"#44dd88"}],
   xF:(u,v,p,t)=>p.a*v*Math.cos(u+0.4*t),
   yF:(u,v,p,t)=>p.b*v*Math.sin(u+0.4*t),
   zF:(u,v,p,t)=>v,
   uR:[0,2*PI],vR:[-2.5,2.5],nU:12,nV:10},
  {id:"hiper1",    label:"Hiperbolóide 1F",  color:0xfbbf24,lcol:"#fbbf24",
   anim:"Cintura pulsa: cosh(v)·(1+0.18·sin t)",
   tex:p=>`\\dfrac{x^2}{${(p.a**2).toFixed(1)}}+\\dfrac{y^2}{${(p.b**2).toFixed(1)}}-\\dfrac{z^2}{${(p.c**2).toFixed(1)}}=1`,
   plain:p=>`x²/${(p.a**2).toFixed(1)}+y²/${(p.b**2).toFixed(1)}-z²/${(p.c**2).toFixed(1)}=1`,
   params:[{id:"a",label:"a",min:0.3,max:3,def:1,col:"#ff4455"},{id:"b",label:"b",min:0.3,max:3,def:1,col:"#44dd88"},{id:"c",label:"c",min:0.3,max:3,def:1,col:"#4499ff"}],
   xF:(u,v,p,t)=>p.a*Math.cosh(v)*(1+0.18*Math.sin(t))*Math.cos(u),
   yF:(u,v,p,t)=>p.b*Math.cosh(v)*(1+0.18*Math.sin(t))*Math.sin(u),
   zF:(u,v,p,t)=>p.c*Math.sinh(v),
   uR:[0,2*PI],vR:[-1.5,1.5],nU:12,nV:8},
  {id:"hiper2",    label:"Hiperbolóide 2F",  color:0xf97316,lcol:"#f97316",
   anim:"Folhas pulsam: cosh(v)·(1+0.18·sin t)",
   tex:p=>`-\\dfrac{x^2}{${(p.a**2).toFixed(1)}}-\\dfrac{y^2}{${(p.b**2).toFixed(1)}}+\\dfrac{z^2}{${(p.c**2).toFixed(1)}}=1`,
   plain:p=>`-x²/${(p.a**2).toFixed(1)}-y²/${(p.b**2).toFixed(1)}+z²/${(p.c**2).toFixed(1)}=1`,
   params:[{id:"a",label:"a",min:0.3,max:3,def:1,col:"#ff4455"},{id:"b",label:"b",min:0.3,max:3,def:1,col:"#44dd88"},{id:"c",label:"c",min:0.3,max:3,def:1,col:"#4499ff"}],
   xF:(u,v,p,t)=>p.a*Math.sinh(v)*Math.cos(u),
   yF:(u,v,p,t)=>p.b*Math.sinh(v)*Math.sin(u),
   zF:(u,v,p,t)=>p.c*Math.cosh(v)*(1+0.18*Math.sin(t)),
   uR:[0,2*PI],vR:[-1.8,1.8],nU:12,nV:8,mirror:"z"},
  {id:"parabHiper",label:"Parabolóide Hiper.",color:0x06b6d4,lcol:"#06b6d4",
   anim:"Sela oscila: z + 0.5·sin t",
   tex:p=>`z=\\dfrac{y^2}{${(p.b**2).toFixed(1)}}-\\dfrac{x^2}{${(p.a**2).toFixed(1)}}`,
   plain:p=>`z=y²/${(p.b**2).toFixed(1)}-x²/${(p.a**2).toFixed(1)}`,
   params:[{id:"a",label:"a",min:0.3,max:4,def:1.5,col:"#ff4455"},{id:"b",label:"b",min:0.3,max:4,def:1.5,col:"#44dd88"}],
   xF:(u,v,p,t)=>u,yF:(u,v,p,t)=>v,
   zF:(u,v,p,t)=>v*v/(p.b*p.b)-u*u/(p.a*p.a)+0.5*Math.sin(t),
   uR:[-2.5,2.5],vR:[-2.5,2.5],nU:10,nV:10},
  {id:"cilParab",  label:"Cil. Parabólica",  color:0xec4899,lcol:"#ec4899",
   anim:"Ondas ao longo do eixo: y + 0.2·sin(2u+t)",
   tex:p=>`x^2=${p.a.toFixed(1)}y`,
   plain:p=>`x²=${p.a.toFixed(1)}y`,
   params:[{id:"a",label:"a",min:0.2,max:4,def:1.5,col:"#f59e0b"}],
   xF:(u,v,p,t)=>u,
   yF:(u,v,p,t)=>u*u/p.a+0.2*Math.sin(2*u+t),
   zF:(u,v,p,t)=>v,
   uR:[-2.5,2.5],vR:[-2.5,2.5],nU:10,nV:8},
  {id:"cilHiper",  label:"Cil. Hiperbólica", color:0x84cc16,lcol:"#84cc16",
   anim:"Ondas ao longo da altura: z + 0.25·sin(3v+t)",
   tex:p=>`\\dfrac{x^2}{${(p.a**2).toFixed(1)}}-\\dfrac{y^2}{${(p.b**2).toFixed(1)}}=1`,
   plain:p=>`x²/${(p.a**2).toFixed(1)}-y²/${(p.b**2).toFixed(1)}=1`,
   params:[{id:"a",label:"a",min:0.3,max:3,def:1.5,col:"#ff4455"},{id:"b",label:"b",min:0.3,max:3,def:1.5,col:"#44dd88"}],
   xF:(u,v,p,t)=>p.a*Math.cosh(u),
   yF:(u,v,p,t)=>p.b*Math.sinh(u),
   zF:(u,v,p,t)=>v+0.25*Math.sin(3*v+t),
   uR:[-2,2],vR:[-2.5,2.5],nU:12,nV:8,mirror:"x"},
];
const DEFS={r:2,a:2.5,b:1.5,c:1.2};

// ─── Cylindrical Didactic Presets (clean, no animation factors) ───────────────
const CYL_PRESETS=[
  {id:"cyl-circ",  label:"Cilindro Circular",  lcol:"#ef4444", color:0xef4444,
   tex:p=>`x^2+y^2=${(p.r**2).toFixed(1)}`,
   plain:p=>`x²+y²=${(p.r**2).toFixed(1)}`,
   params:[{id:"r",label:"r",min:0.5,max:3.5,def:2}],
   xF:(u,v,p)=>p.r*Math.cos(u),
   yF:(u,v,p)=>p.r*Math.sin(u),
   zF:(u,v,p)=>v,
   uR:[0,2*PI], vR:[-2.5,2.5], nLines:28},
  {id:"cyl-parab", label:"Cil. Parabólico",    lcol:"#60a5fa", color:0x60a5fa,
   tex:p=>`y=\\dfrac{x^2}{${p.a.toFixed(1)}}`,
   plain:p=>`y=x²/${p.a.toFixed(1)}`,
   params:[{id:"a",label:"a",min:0.5,max:3.5,def:1.5}],
   xF:(u,v,p)=>u,
   yF:(u,v,p)=>u*u/p.a,
   zF:(u,v,p)=>v,
   uR:[-2.5,2.5], vR:[-2.5,2.5], nLines:22},
  {id:"cyl-hiper", label:"Cil. Hiperbólico",   lcol:"#34d399", color:0x34d399,
   tex:p=>`\\dfrac{x^2}{${(p.a**2).toFixed(1)}}-\\dfrac{y^2}{${(p.b**2).toFixed(1)}}=1`,
   plain:p=>`x²/${(p.a**2).toFixed(1)}-y²/${(p.b**2).toFixed(1)}=1`,
   params:[{id:"a",label:"a",min:0.3,max:2.5,def:1},{id:"b",label:"b",min:0.3,max:2.5,def:1}],
   xF:(u,v,p)=>p.a*Math.cosh(u),
   yF:(u,v,p)=>p.b*Math.sinh(u),
   zF:(u,v,p)=>v,
   uR:[-2,2], vR:[-2.5,2.5], nLines:18, mirror:"x"},
];
const CYL_DEFS={r:2,a:1.5,b:1};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App(){
  const[pid,  setPid]  =useState("esfera");
  const[P,    setP]    =useState(DEFS);
  const[custom,setCust]=useState(false);
  const[xE,setXE]=useState("cos(u)*sin(v)");
  const[yE,setYE]=useState("sin(u)*sin(v)");
  const[zE,setZE]=useState("cos(v)");
  const[u0s,setU0]=useState("0");const[u1s,setU1]=useState("2*pi");
  const[v0s,setV0]=useState("0");const[v1s,setV1]=useState("pi");
  const[pKey,setPKey]=useState(0);
  const[cErr,setCErr]=useState(null);
  const[res,  setRes] =useState(40);
  const[view, setView]=useState("solid");
  const[vcol, setVcol]=useState(true);
  const[ax,   setAx]  =useState("z");
  const[cut,  setCut] =useState(false);
  const[cutZ, setCutZ]=useState(0);
  const[cMin, setCMin]=useState(-5);
  const[cMax, setCMax]=useState(5);
  const[katex,setKatex]=useState(false);
  const[anim,  setAnim] =useState(false);
  const[tVal,  setTVal] =useState(0);
  const[speed, setSpeed]=useState(1);
  const[tMin,  setTMin] =useState(0);
  const[tMax,  setTMax] =useState(6.28);
  const[formMode,    setFormMode]    =useState(false);
  const[formPhase,   setFormPhase]   =useState(0);
  const[formPlaying, setFormPlaying] =useState(false);
  const[formSpeed,   setFormSpeed]   =useState(1);

  // ─── NEW: Cylindrical Didactic Mode states ──────────────────────────────────
  const[cylDid,  setCylDid]  =useState(false);
  const[cylPid,  setCylPid]  =useState("cyl-circ");
  const[cylP,    setCylP]    =useState(CYL_DEFS);
  const[cylProg, setCylProg] =useState(0);   // 0→3  (phase 1: 0-1, phase 2: 1-2, phase 3: 2-3)
  const[cylPlay, setCylPlay] =useState(false);
  const[cylSpd,  setCylSpd]  =useState(1);

  const contRef=useRef();const sceneRef=useRef();const frameRef=useRef();
  const animGeomRef=useRef(null);const animGeom2Ref=useRef(null);
  const compiledRef=useRef({xFn:()=>0,yFn:()=>0,zFn:()=>0,uR:[0,2*PI],vR:[0,PI],mirror:null});
  const formLinesRef=useRef([]);
  const formMeshRef =useRef(null);

  // ─── NEW: Cyl mode refs ────────────────────────────────────────────────────
  const cylObjRef =useRef({lines:[],mesh:null,dirCurve:null,mirLines:[]});
  const cylLblPos =useRef({
    dir:new THREE.Vector3(2,-1,0),
    gen:new THREE.Vector3(0,0,3),
    ax: new THREE.Vector3(-4,0,3)
  });
  const cylDomRef =useRef({dir:null,gen:null,ax:null});
  const cylDidRef =useRef(false);
  useEffect(()=>{cylDidRef.current=cylDid;},[cylDid]);

  // Load fonts + KaTeX
  useEffect(()=>{
    const lf=document.createElement("link");lf.rel="stylesheet";
    lf.href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap";
    document.head.appendChild(lf);
    const lk=document.createElement("link");lk.rel="stylesheet";
    lk.href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css";
    document.head.appendChild(lk);
    const sk=document.createElement("script");
    sk.src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js";
    sk.onload=()=>setKatex(true);
    document.head.appendChild(sk);
  },[]);

  const kRender=tex=>{
    if(!katex||!window.katex) return null;
    try{ return{__html:window.katex.renderToString(tex,{throwOnError:false,displayMode:false})}; }
    catch{ return null; }
  };

  // ── Three.js init ────────────────────────────────────────────────────────────
  useEffect(()=>{
    const cont=contRef.current;
    const W=cont.clientWidth,H=cont.clientHeight;
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x060810);
    sceneRef.current=scene;
    const camera=new THREE.PerspectiveCamera(50,W/H,0.1,200);camera.up.set(0,0,1);
    const renderer=new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(W,H);renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.localClippingEnabled=true;
    cont.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff,0.45));
    const d1=new THREE.DirectionalLight(0xffffff,1.0);d1.position.set(8,5,10);scene.add(d1);
    const d2=new THREE.DirectionalLight(0x6688ff,0.4);d2.position.set(-6,-4,-8);scene.add(d2);
    let theta=0.65,phi=1.1,radius=11,drag=false,lx=0,ly=0;
    const upCam=()=>{camera.position.set(radius*Math.sin(phi)*Math.cos(theta),radius*Math.sin(phi)*Math.sin(theta),radius*Math.cos(phi));camera.lookAt(0,0,0);};
    upCam();
    // Axis labels
    const axColors=["#ff4455","#44dd88","#4499ff"];
    const axEnds=[new THREE.Vector3(6,0,0),new THREE.Vector3(0,6,0),new THREE.Vector3(0,0,6)];
    const labels=["x","y","z"].map((l,i)=>{
      const el=document.createElement("div");
      el.textContent=l;
      el.style.cssText=`position:absolute;pointer-events:none;font-family:'DM Mono',monospace;font-size:14px;font-weight:700;color:${axColors[i]};text-shadow:0 0 6px ${axColors[i]}66;`;
      cont.appendChild(el);return el;
    });
    // ─── NEW: Cylindrical didactic DOM labels ──────────────────────────────
    const cylLabelConf=[
      {key:"dir", text:"Curva Diretriz", color:"#60a5fa"},
      {key:"gen", text:"Reta Geratriz",  color:"#ef4444"},
      {key:"ax",  text:"eixo",           color:"#ef4444"},
    ];
    cylLabelConf.forEach(({key,text,color})=>{
      const el=document.createElement("div");
      el.textContent=text;
      el.style.cssText=`position:absolute;pointer-events:none;font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:${color};text-shadow:0 0 10px ${color}99;display:none;white-space:nowrap;letter-spacing:0.5px;`;
      cont.appendChild(el);
      cylDomRef.current[key]=el;
    });
    // Controls
    const cvs=renderer.domElement;cvs.style.display="block";cvs.style.cursor="grab";
    let pinch=null;
    const dn=e=>{drag=true;lx=e.clientX;ly=e.clientY;cvs.style.cursor="grabbing";};
    const mv=e=>{if(!drag)return;theta-=(e.clientX-lx)*0.007;phi=Math.max(0.04,Math.min(PI-0.04,phi+(e.clientY-ly)*0.007));lx=e.clientX;ly=e.clientY;upCam();};
    const up=()=>{drag=false;cvs.style.cursor="grab";};
    const wh=e=>{e.preventDefault();radius=Math.max(3,Math.min(22,radius+e.deltaY*0.015));upCam();};
    const ts=e=>{e.preventDefault();if(e.touches.length===1){drag=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;}};
    const tm=e=>{e.preventDefault();if(e.touches.length===1&&drag){theta-=(e.touches[0].clientX-lx)*0.007;phi=Math.max(0.04,Math.min(PI-0.04,phi+(e.touches[0].clientY-ly)*0.007));lx=e.touches[0].clientX;ly=e.touches[0].clientY;upCam();}else if(e.touches.length===2){const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY,d=Math.sqrt(dx*dx+dy*dy);if(pinch){radius=Math.max(3,Math.min(22,radius-(d-pinch)*0.05));upCam();}pinch=d;}};
    const te=e=>{drag=false;if(e.touches.length<2)pinch=null;};
    cvs.addEventListener("mousedown",dn);window.addEventListener("mousemove",mv);window.addEventListener("mouseup",up);cvs.addEventListener("wheel",wh,{passive:false});
    cvs.addEventListener("touchstart",ts,{passive:false});cvs.addEventListener("touchmove",tm,{passive:false});cvs.addEventListener("touchend",te);
    const rz=()=>{const w=cont.clientWidth,h=cont.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};
    window.addEventListener("resize",rz);
    // Render loop
    const loop=()=>{
      frameRef.current=requestAnimationFrame(loop);
      const cw=cont.clientWidth,ch=cont.clientHeight;
      // Axis labels
      axEnds.forEach((p3,i)=>{
        const v=p3.clone().project(camera);
        if(v.z<1){labels[i].style.display="";labels[i].style.left=((v.x+1)/2*cw-6)+"px";labels[i].style.top=(-(v.y-1)/2*ch-8)+"px";}
        else labels[i].style.display="none";
      });
      // ─── Cylindrical didactic labels ───────────────────────────────────────
      if(cylDidRef.current){
        const lp=cylLblPos.current;
        [["dir",lp.dir],["gen",lp.gen],["ax",lp.ax]].forEach(([key,pos])=>{
          const el=cylDomRef.current[key]; if(!el)return;
          const v2=pos.clone().project(camera);
          if(v2.z<1){
            el.style.display="";
            el.style.left=((v2.x+1)/2*cw)+"px";
            el.style.top=(-(v2.y-1)/2*ch)+"px";
          }else el.style.display="none";
        });
      }else{
        Object.values(cylDomRef.current).forEach(el=>{if(el)el.style.display="none";});
      }
      renderer.render(scene,camera);
    };
    loop();
    return()=>{
      cancelAnimationFrame(frameRef.current);
      labels.forEach(el=>{if(cont.contains(el))cont.removeChild(el);});
      // Remove cyl labels
      Object.values(cylDomRef.current).forEach(el=>{if(el&&cont.contains(el))cont.removeChild(el);});
      cvs.removeEventListener("mousedown",dn);window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up);cvs.removeEventListener("wheel",wh);
      cvs.removeEventListener("touchstart",ts);cvs.removeEventListener("touchmove",tm);cvs.removeEventListener("touchend",te);
      window.removeEventListener("resize",rz);renderer.dispose();if(cont.contains(cvs))cont.removeChild(cvs);
    };
  },[]);

  // ── Scene rebuild ─────────────────────────────────────────────────────────────
  useEffect(()=>{
    const scene=sceneRef.current;if(!scene)return;
    [...scene.children].filter(o=>o.userData.rm).forEach(o=>{scene.remove(o);const D=x=>{x?.children?.forEach(D);x?.geometry?.dispose();Array.isArray(x?.material)?x.material.forEach(m=>m.dispose()):x?.material?.dispose();};D(o);});
    const add=o=>{o.userData.rm=true;scene.add(o);return o;};
    const clips=[];
    if(cMin>-5)clips.push(new THREE.Plane(new THREE.Vector3(0,0,1),-cMin));
    if(cMax<5) clips.push(new THREE.Plane(new THREE.Vector3(0,0,-1),cMax));
    const mLn=(g,c,op=1)=>add(new THREE.Line(g,new THREE.LineBasicMaterial({color:c,transparent:op<1,opacity:op,clippingPlanes:clips})));
    const mDot=(p,c,s=0.09)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(s,10,10),new THREE.MeshBasicMaterial({color:c}));m.position.copy(p);return add(m);};
    const s2=(a,b)=>new THREE.BufferGeometry().setFromPoints([a,b]);
    [{d:[5.5,0,0],c:0xff4455},{d:[0,5.5,0],c:0x44dd88},{d:[0,0,5.5],c:0x4499ff}].forEach(({d,c})=>{
      mLn(s2(new THREE.Vector3(0,0,0),new THREE.Vector3(...d)),c);
      mLn(s2(new THREE.Vector3(0,0,0),new THREE.Vector3(-d[0]*.3,-d[1]*.3,-d[2]*.3)),c,0.2);
      mDot(new THREE.Vector3(...d),c,0.07);
    });
    for(let i=-5;i<=5;i++){mLn(s2(new THREE.Vector3(i,-5,0),new THREE.Vector3(i,5,0)),0x080d1c);mLn(s2(new THREE.Vector3(-5,i,0),new THREE.Vector3(5,i,0)),0x080d1c);}
    if(cut){
      const pm=new THREE.Mesh(new THREE.PlaneGeometry(14,14),new THREE.MeshBasicMaterial({color:0x60a5fa,transparent:true,opacity:0.08,side:THREE.DoubleSide}));
      pm.position.z=cutZ;pm.userData.rm=true;scene.add(pm);
      mLn(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-7,-7,cutZ),new THREE.Vector3(7,-7,cutZ),new THREE.Vector3(7,7,cutZ),new THREE.Vector3(-7,7,cutZ),new THREE.Vector3(-7,-7,cutZ)]),0x60a5fa,0.6);
    }

    // ─── CYLINDRICAL DIDACTIC MODE ────────────────────────────────────────────
    if(cylDid){
      cylObjRef.current={lines:[],mesh:null,dirCurve:null,mirLines:[]};
      setCylProg(0); setCylPlay(false);

      const cp=CYL_PRESETS.find(p=>p.id===cylPid)||CYL_PRESETS[0];
      const Cp=cylP;
      const cuR=cp.uR, cvR=cp.vR, cNL=cp.nLines, cCol=cp.color;
      const cxF=(u,v)=>cp.xF(u,v,Cp);
      const cyF=(u,v)=>cp.yF(u,v,Cp);
      const czF=(u,v)=>v; // always zF=v for these presets

      // 1. Directrix curve (blue, in z=0 plane)
      const vBase=0;
      const dirPts=[];
      for(let i=0;i<=200;i++){
        const u=cuR[0]+(cuR[1]-cuR[0])*i/200;
        const px=cxF(u,vBase), py=cyF(u,vBase);
        if(isFinite(px)&&isFinite(py)) dirPts.push(new THREE.Vector3(px,py,0));
      }
      if(dirPts.length>1){
        const dG=new THREE.BufferGeometry().setFromPoints(dirPts);
        const dL=new THREE.Line(dG,new THREE.LineBasicMaterial({color:0x60a5fa,transparent:true,opacity:0,linewidth:2}));
        dL.userData.rm=true; scene.add(dL);
        cylObjRef.current.dirCurve=dL;
        // Label position: slightly above and forward of midpoint
        const mp=dirPts[Math.floor(dirPts.length/2)];
        cylLblPos.current.dir.set(mp.x+0.5, mp.y-0.9, 0.1);
      }

      // Mirror directrix for hyperbolic case
      if(cp.mirror==="x"){
        const mirDirPts=[];
        for(let i=0;i<=200;i++){
          const u=cuR[0]+(cuR[1]-cuR[0])*i/200;
          const px=-cxF(u,vBase), py=cyF(u,vBase);
          if(isFinite(px)&&isFinite(py)) mirDirPts.push(new THREE.Vector3(px,py,0));
        }
        if(mirDirPts.length>1){
          const mdG=new THREE.BufferGeometry().setFromPoints(mirDirPts);
          const mdL=new THREE.Line(mdG,new THREE.LineBasicMaterial({color:0x60a5fa,transparent:true,opacity:0}));
          mdL.userData.rm=true; scene.add(mdL);
          // Store as secondary dir curve (reuse mirLines array for this)
          cylObjRef.current.mirDirCurve=mdL;
        }
      }

      // 2. Eixo reference line (red, fixed to left of scene, parallel to z)
      const eixoX=-4.2, eixoY=0;
      const eixoPts=[new THREE.Vector3(eixoX,eixoY,cvR[0]),new THREE.Vector3(eixoX,eixoY,cvR[1])];
      const eixoG=new THREE.BufferGeometry().setFromPoints(eixoPts);
      const eixoL=new THREE.Line(eixoG,new THREE.LineBasicMaterial({color:0xef4444,transparent:true,opacity:0.85,linewidth:2}));
      eixoL.userData.rm=true; scene.add(eixoL);
      // Dashed lower portion (cosmetic)
      const eixoDashPts=[new THREE.Vector3(eixoX,eixoY,cvR[0]-0.5),new THREE.Vector3(eixoX,eixoY,cvR[0])];
      const eixoDG=new THREE.BufferGeometry().setFromPoints(eixoDashPts);
      add(new THREE.Line(eixoDG,new THREE.LineBasicMaterial({color:0xef4444,transparent:true,opacity:0.3})));
      // Label above eixo
      cylLblPos.current.ax.set(eixoX+0.15, eixoY, cvR[1]+0.55);

      // 3. Geratriz lines (red vertical, initially hidden)
      let genLabelDone=false;
      const midLineIdx=Math.floor(cNL/2);
      for(let i=0;i<=cNL;i++){
        const u=cuR[0]+(cuR[1]-cuR[0])*i/cNL;
        const bx=cxF(u,vBase), by=cyF(u,vBase);
        if(!isFinite(bx)||!isFinite(by)) continue;
        const gPts=[new THREE.Vector3(bx,by,cvR[0]),new THREE.Vector3(bx,by,cvR[1])];
        const gG=new THREE.BufferGeometry().setFromPoints(gPts);
        const gL=new THREE.Line(gG,new THREE.LineBasicMaterial({color:0xef4444,transparent:true,opacity:0}));
        gL.visible=false; gL.userData.rm=true; scene.add(gL);
        cylObjRef.current.lines.push(gL);
        if(!genLabelDone&&i===midLineIdx){
          cylLblPos.current.gen.set(bx+0.35, by, cvR[1]+0.55);
          genLabelDone=true;
        }
        // Mirror geratriz for hyperbolic
        if(cp.mirror==="x"){
          const mgPts=[new THREE.Vector3(-bx,by,cvR[0]),new THREE.Vector3(-bx,by,cvR[1])];
          const mgG=new THREE.BufferGeometry().setFromPoints(mgPts);
          const mgL=new THREE.Line(mgG,new THREE.LineBasicMaterial({color:0xef4444,transparent:true,opacity:0}));
          mgL.visible=false; mgL.userData.rm=true; scene.add(mgL);
          cylObjRef.current.mirLines.push(mgL);
        }
      }

      // 4. Surface mesh (initially invisible, revealed in phase 3)
      const mg=buildMesh(cxF,cyF,czF,cuR,cvR,Math.min(res,36),"z",vcol,0);
      animGeomRef.current=mg;
      const mm=new THREE.Mesh(mg,new THREE.MeshPhongMaterial({
        vertexColors:vcol, color:vcol?0xffffff:cCol,
        transparent:true, opacity:0, side:THREE.DoubleSide, shininess:60,
        clippingPlanes:clips
      }));
      mm.visible=false; mm.userData.rm=true; scene.add(mm);
      cylObjRef.current.mesh=mm;

      // Mirror mesh for hyperbolic
      if(cp.mirror==="x"){
        const mg2=buildMesh((u,v)=>-cxF(u,v),cyF,czF,cuR,cvR,Math.min(res,36),"z",vcol,0);
        animGeom2Ref.current=mg2;
        const mm2=new THREE.Mesh(mg2,new THREE.MeshPhongMaterial({
          vertexColors:vcol, color:vcol?0xffffff:cCol,
          transparent:true, opacity:0, side:THREE.DoubleSide, shininess:60,
          clippingPlanes:clips
        }));
        mm2.visible=false; mm2.userData.rm=true; scene.add(mm2);
        cylObjRef.current.mesh2=mm2;
      }

      return; // ← skip normal drawSurf
    }

    // ─── Normal / formation mode ──────────────────────────────────────────────
    let xF,yF,zF,uR,vR,nU,nV,sCol,mirror;
    if(custom){
      setCErr(null);
      const[u0c,u1c,v0c,v1c]=[ev(u0s,0,0),ev(u1s,0,0),ev(v0s,0,0),ev(v1s,0,0)];
      if([u0c,u1c,v0c,v1c].some(isNaN)){setCErr("Intervalo inválido");return;}
      xF=(u,v,t)=>ev(xE,u,v,t);yF=(u,v,t)=>ev(yE,u,v,t);zF=(u,v,t)=>ev(zE,u,v,t);
      if([xF(1,1,0),yF(1,1,0),zF(1,1,0)].some(isNaN)){setCErr("Expressão inválida — use u, v, t, sin, cos, sqrt, pi…");return;}
      uR=[u0c,u1c];vR=[v0c,v1c];nU=10;nV=8;sCol=0x38bdf8;
    } else {
      const pr=PRESETS.find(p=>p.id===pid);
      const Pp=P;
      xF=(u,v,t)=>pr.xF(u,v,Pp,t);yF=(u,v,t)=>pr.yF(u,v,Pp,t);zF=(u,v,t)=>pr.zF(u,v,Pp,t);
      uR=pr.uR;vR=pr.vR;nU=pr.nU;nV=pr.nV;sCol=pr.color;mirror=pr.mirror;
    }
    compiledRef.current={xFn:compile(custom?xE:"("+xE+")"),yFn:compile(custom?yE:"("+yE+")"),zFn:compile(custom?zE:"("+zE+")"),xF,yF,zF,uR,vR,mirror};
    const op=view==="xray"?0.07:view==="wire"?0:0.15;

    if(formMode){
      formLinesRef.current=[];
      formMeshRef.current=null;
      const allGeoms=[
        ...buildUCurves(xF,yF,zF,uR,vR,nU,96,ax,0),
        ...buildVCurves(xF,yF,zF,uR,vR,nV,96,ax,0),
      ];
      allGeoms.forEach(g=>{
        const ln=new THREE.Line(g,new THREE.LineBasicMaterial({color:sCol,transparent:true,opacity:0,clippingPlanes:clips}));
        ln.visible=false; ln.userData.rm=true; ln.userData.baseColor=sCol;
        scene.add(ln); formLinesRef.current.push(ln);
      });
      const mg=buildMesh(xF,yF,zF,uR,vR,Math.min(res,32),ax,vcol,0);
      animGeomRef.current=mg;
      const mm=new THREE.Mesh(mg,new THREE.MeshPhongMaterial({vertexColors:vcol,color:vcol?0xffffff:sCol,transparent:true,opacity:0,side:THREE.DoubleSide,shininess:55,clippingPlanes:clips}));
      mm.visible=false; mm.userData.rm=true; scene.add(mm); formMeshRef.current=mm;
      setFormPhase(0); setFormPlaying(false);
      return;
    }

    const drawS=(xFn,yFn,zFn,ref)=>{
      const g=buildMesh(xFn,yFn,zFn,uR,vR,res,ax,vcol,0);
      if(ref==="main")animGeomRef.current=g;else animGeom2Ref.current=g;
      if(op>0)add(new THREE.Mesh(g,new THREE.MeshPhongMaterial({vertexColors:vcol,color:vcol?0xffffff:sCol,transparent:true,opacity:op,side:THREE.DoubleSide,shininess:55,clippingPlanes:clips})));
      buildGrid(xFn,yFn,zFn,uR,vR,nU,nV,80,ax,0).forEach(g=>mLn(g,sCol,view==="wire"?0.8:0.5));
    };
    drawS(xF,yF,zF,"main");
    if(mirror==="z")drawS(xF,yF,(u,v,t)=>-zF(u,v,t),"mirror");
    if(mirror==="x")drawS((u,v,t)=>-xF(u,v,t),yF,zF,"mirror");
  },[pid,P,custom,pKey,res,view,vcol,ax,cut,cutZ,cMin,cMax,formMode,cylDid,cylPid,cylP]);

  // ── Animation timer ───────────────────────────────────────────────────────
  useEffect(()=>{
    if(!anim)return;
    const id=setInterval(()=>setTVal(prev=>{const n=prev+speed*0.05;return n>tMax?tMin:n;}),50);
    return()=>clearInterval(id);
  },[anim,speed,tMin,tMax]);

  // ── Geometry update on tVal (skip if cyl mode active) ────────────────────
  useEffect(()=>{
    if(cylDidRef.current)return;
    const{xF,yF,zF,uR,vR,mirror}=compiledRef.current;
    if(!animGeomRef.current||!xF)return;
    updateGeomAnim(animGeomRef.current,xF,yF,zF,uR,vR,res,ax,vcol,tVal);
    if(mirror==="z"&&animGeom2Ref.current)updateGeomAnim(animGeom2Ref.current,xF,yF,(u,v,t)=>-zF(u,v,t),uR,vR,res,ax,vcol,tVal);
    if(mirror==="x"&&animGeom2Ref.current)updateGeomAnim(animGeom2Ref.current,(u,v,t)=>-xF(u,v,t),yF,zF,uR,vR,res,ax,vcol,tVal);
  },[tVal]);

  // ── Formation timer ───────────────────────────────────────────────────────
  useEffect(()=>{
    if(!formMode||!formPlaying)return;
    const id=setInterval(()=>{
      setFormPhase(prev=>{
        const next=prev+formSpeed*0.018;
        if(next>=1){setFormPlaying(false);return 1;}
        return next;
      });
    },50);
    return()=>clearInterval(id);
  },[formMode,formPlaying,formSpeed]);

  // ── Formation phase: update line visibility ───────────────────────────────
  useEffect(()=>{
    if(!formMode)return;
    const lines=formLinesRef.current;
    if(!lines.length)return;
    const total=lines.length;
    const cursor=Math.floor(formPhase*total);
    lines.forEach((ln,i)=>{
      if(i<cursor){ln.visible=true;ln.material.color.setHex(ln.userData.baseColor);ln.material.opacity=0.55;ln.material.needsUpdate=true;}
      else if(i===cursor&&formPhase<1){ln.visible=true;ln.material.color.setHex(0xffffff);ln.material.opacity=1.0;ln.material.needsUpdate=true;}
      else{ln.visible=false;}
    });
    if(formMeshRef.current){
      if(formPhase>=1){formMeshRef.current.visible=true;formMeshRef.current.material.opacity=0.14;formMeshRef.current.material.needsUpdate=true;}
      else{formMeshRef.current.visible=false;}
    }
  },[formPhase,formMode]);

  // ─── NEW: Cylindrical progress → update material opacity/visibility ────────
  useEffect(()=>{
    if(!cylDid)return;
    const{lines,mesh,mesh2,dirCurve,mirDirCurve,mirLines}=cylObjRef.current;

    // Phase 0→1: directrix curve fades in
    if(dirCurve){
      dirCurve.material.opacity=Math.max(0,Math.min(1,cylProg*2));
      dirCurve.material.needsUpdate=true;
    }
    if(mirDirCurve){
      mirDirCurve.material.opacity=Math.max(0,Math.min(1,cylProg*2));
      mirDirCurve.material.needsUpdate=true;
    }

    // Phase 1→2: geratriz lines appear progressively
    const nL=lines.length;
    const lp=Math.max(0,Math.min(1,cylProg-1));
    const nV=cylProg>=2?nL:Math.floor(lp*nL);

    const applyLines=(arr)=>{
      arr.forEach((ln,i)=>{
        if(i<nV){
          ln.visible=true;
          ln.material.color.setHex(0xef4444);
          ln.material.opacity=0.55;
        }else if(i===nV&&cylProg>=1&&cylProg<2){
          ln.visible=true;
          ln.material.color.setHex(0xffffff);
          ln.material.opacity=1.0;
        }else{
          ln.visible=false;
        }
        ln.material.needsUpdate=true;
      });
    };
    applyLines(lines);
    applyLines(mirLines);

    // Phase 2→3: surface fades in
    const sp=Math.max(0,Math.min(1,cylProg-2));
    if(mesh){
      mesh.visible=sp>0;
      mesh.material.opacity=sp*0.42;
      mesh.material.needsUpdate=true;
    }
    if(mesh2){
      mesh2.visible=sp>0;
      mesh2.material.opacity=sp*0.42;
      mesh2.material.needsUpdate=true;
    }
  },[cylProg,cylDid]);

  // ─── NEW: Cylindrical play timer ──────────────────────────────────────────
  useEffect(()=>{
    if(!cylDid||!cylPlay)return;
    const id=setInterval(()=>{
      setCylProg(p=>{
        const n=p+cylSpd*0.022;
        if(n>=3){setCylPlay(false);return 3;}
        return n;
      });
    },50);
    return()=>clearInterval(id);
  },[cylDid,cylPlay,cylSpd]);

  // ── UI helpers ───────────────────────────────────────────────────────────
  const pr=PRESETS.find(p=>p.id===pid);
  const cylPr=CYL_PRESETS.find(p=>p.id===cylPid)||CYL_PRESETS[0];
  const lcolor=cylDid?cylPr.lcol:(custom?"#38bdf8":pr.lcol);
  const currentTex=cylDid?cylPr.tex(cylP):(custom?`x(u,v)=${xE}`:pr.tex(P));
  const currentPlain=cylDid?cylPr.plain(cylP):(custom?`x=${xE} y=${yE} z=${zE}`:pr.plain(P));
  const eqHtml=kRender(currentTex);

  const setPreset=id=>{
    const p=PRESETS.find(x=>x.id===id);
    const np={...DEFS};p.params.forEach(pm=>np[pm.id]=pm.def);
    setPid(id);setP(np);setCust(false);setAnim(false);setTVal(0);
  };
  const setParam=(id,v)=>setP(pp=>({...pp,[id]:v}));
  const setCylParam=(id,v)=>setCylP(pp=>({...pp,[id]:v}));
  const setCylPreset=id=>{
    const p=CYL_PRESETS.find(x=>x.id===id);
    const np={...CYL_DEFS};p.params.forEach(pm=>np[pm.id]=pm.def);
    setCylPid(id);setCylP(np);
  };
  const safeCMin=v=>{const vv=Math.min(v,cMax-0.1);setCMin(vv);};
  const safeCMax=v=>{const vv=Math.max(v,cMin+0.1);setCMax(vv);};

  // Mutual exclusion toggles
  const toggleCylDid=()=>{
    setCylDid(d=>{
      if(!d){setFormMode(false);setAnim(false);}
      return !d;
    });
    setCylProg(0);setCylPlay(false);
  };
  const toggleFormMode=()=>{
    setFormMode(m=>{
      if(!m)setCylDid(false);
      return !m;
    });
    setFormPhase(0);setFormPlaying(false);
  };

  // Phase label for cyl mode
  const cylPhaseLabel=cylProg<1?"① Curva Diretriz":cylProg<2?"② Retas Geratrizes":"③ Superfície";
  const cylPhaseColor=cylProg<1?"#60a5fa":cylProg<2?"#ef4444":"#f59e0b";

  const mo={fontFamily:"'DM Mono',monospace"};
  const card={background:"#050710",border:"1px solid rgba(255,255,255,0.05)",borderRadius:14,padding:"16px 18px"};
  const lbl={fontSize:9,letterSpacing:3,color:"#334155",textTransform:"uppercase"};

  const Sl=({lbl:lb,val,set,min,max,s=0.1,col="#f59e0b"})=>{
    const clampedMax=typeof max==="function"?max():max;
    const clampedMin=typeof min==="function"?min():min;
    return(
      <div style={{marginBottom:11}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
          <span style={{fontSize:12,color:"#64748b",...mo}}>{lb}</span>
          <input type="number" min={clampedMin} max={clampedMax} step={s} value={val}
            onChange={e=>{const v=parseFloat(e.target.value);if(!isNaN(v))set(Math.max(clampedMin,Math.min(clampedMax,v)));}}
            style={{width:62,padding:"3px 7px",borderRadius:6,border:"1px solid rgba(255,255,255,0.09)",background:"rgba(255,255,255,0.04)",color:col,fontSize:12,...mo,fontWeight:500,textAlign:"center",outline:"none"}}/>
        </div>
        <input type="range" min={clampedMin} max={clampedMax} step={s} value={Math.max(clampedMin,Math.min(clampedMax,val))} onChange={e=>set(parseFloat(e.target.value))} style={{width:"100%",accentColor:col,cursor:"pointer"}}/>
      </div>
    );
  };

  const TB=({label,active,onClick,col="#f59e0b"})=>(
    <button onClick={onClick} style={{flex:1,padding:"7px 4px",borderRadius:8,border:`1px solid ${active?col:"rgba(255,255,255,0.06)"}`,background:active?`${col}18`:"transparent",color:active?col:"#475569",fontSize:11,cursor:"pointer",...mo,transition:"all 0.15s"}}>{label}</button>
  );

  const EIn=({lb,val,set})=>(
    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
      <span style={{fontSize:12,color:"#64748b",...mo,flexShrink:0,width:52}}>{lb} =</span>
      <input type="text" value={val} onChange={e=>set(e.target.value)} style={{flex:1,padding:"5px 8px",borderRadius:7,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)",color:"#38bdf8",fontSize:12,...mo,outline:"none"}}/>
    </div>
  );

  // Phase progress bar segments for cyl mode
  const CylPhaseBar=()=>{
    const p1=Math.min(1,cylProg)*33.33;
    const p2=Math.min(1,Math.max(0,cylProg-1))*33.33;
    const p3=Math.min(1,Math.max(0,cylProg-2))*33.33;
    return(
      <div style={{display:"flex",gap:3,marginBottom:12,height:5,borderRadius:3,overflow:"hidden"}}>
        <div style={{flex:1,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${p1*3}%`,background:"#60a5fa",borderRadius:2,transition:"width 0.05s"}}/>
        </div>
        <div style={{flex:1,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${p2*3}%`,background:"#ef4444",borderRadius:2,transition:"width 0.05s"}}/>
        </div>
        <div style={{flex:1,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${p3*3}%`,background:"#f59e0b",borderRadius:2,transition:"width 0.05s"}}/>
        </div>
      </div>
    );
  };

  return(
    <div style={{fontFamily:"'DM Sans',sans-serif",background:"#07090f",height:"100vh",color:"#e2e8f0",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Top bar */}
      <div style={{background:"#050710",borderBottom:"1px solid rgba(255,255,255,0.05)",padding:"0 22px",display:"flex",alignItems:"center",height:50,flexShrink:0}}>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:"#f59e0b",marginRight:12}}>Geometria Analítica</span>
        <span style={{fontSize:9,letterSpacing:2.5,color:"#1e293b",flex:1}}>WINTERLE — CAP. 9</span>
        {cylDid&&<span style={{fontSize:10,color:cylPr.lcol,letterSpacing:1,...mo,background:`${cylPr.lcol}18`,border:`1px solid ${cylPr.lcol}44`,borderRadius:6,padding:"3px 10px"}}>MODO CILÍNDRICO</span>}
      </div>

      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        {/* Canvas */}
        <div ref={contRef} style={{flex:"0 0 60%",position:"relative",background:"#060810",borderRight:"1px solid rgba(255,255,255,0.04)"}}>
          {/* Equation badge */}
          <div style={{position:"absolute",top:12,left:12,zIndex:10,maxWidth:"90%",background:"rgba(0,0,0,0.65)",border:`1px solid ${lcolor}44`,borderRadius:9,padding:"7px 14px",color:lcolor,pointerEvents:"none"}}>
            {eqHtml
              ? <span dangerouslySetInnerHTML={eqHtml} style={{fontSize:14}}/>
              : <span style={{fontSize:13,...mo,letterSpacing:0.3}}>{currentPlain}</span>
            }
            {cylDid&&<span style={{fontSize:10,color:"#475569",...mo,marginLeft:8}}>no espaço é um cilindro</span>}
          </div>
          {/* Cyl phase badge */}
          {cylDid&&<div style={{position:"absolute",top:12,right:12,zIndex:10,background:"rgba(0,0,0,0.65)",border:`1px solid ${cylPhaseColor}55`,borderRadius:8,padding:"5px 12px",fontSize:11,color:cylPhaseColor,...mo,pointerEvents:"none"}}>{cylPhaseLabel}</div>}
          {/* Anim t badge */}
          {anim&&!cylDid&&<div style={{position:"absolute",top:12,right:12,zIndex:10,background:"rgba(0,0,0,0.6)",border:"1px solid rgba(56,189,248,0.3)",borderRadius:8,padding:"5px 12px",fontSize:12,color:"#38bdf8",...mo,pointerEvents:"none"}}>t = {tVal.toFixed(2)}</div>}
          <div style={{position:"absolute",bottom:12,right:12,zIndex:10,fontSize:10,color:"#0e1828",...mo,pointerEvents:"none"}}>1 dedo: rotacionar  ·  2 dedos: zoom</div>
        </div>

        {/* Right panel */}
        <div style={{flex:"0 0 40%",display:"flex",flexDirection:"column",padding:"14px 18px",gap:11,overflowY:"auto"}}>

          {/* Presets */}
          <div style={{...card,opacity:cylDid?0.45:1,pointerEvents:cylDid?"none":"auto",transition:"opacity 0.2s"}}>
            <div style={{...lbl,marginBottom:11}}>Funções Prontas{cylDid&&<span style={{color:"#ef4444",marginLeft:6}}>— desativado em modo cilíndrico</span>}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {PRESETS.map(p=>(
                <button key={p.id} onClick={()=>setPreset(p.id)} style={{padding:"8px 4px",borderRadius:8,border:`1px solid ${!custom&&pid===p.id?p.lcol:"rgba(255,255,255,0.05)"}`,background:!custom&&pid===p.id?`${p.lcol}15`:"rgba(255,255,255,0.02)",color:!custom&&pid===p.id?p.lcol:"#475569",cursor:"pointer",fontSize:11,...mo,fontWeight:!custom&&pid===p.id?600:400,transition:"all 0.15s"}}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Parameters — normal mode */}
          {!custom&&!cylDid&&<div style={card}>
            <div style={{...lbl,marginBottom:12}}>Parâmetros</div>
            {pr.params.map(pm=><Sl key={pm.id} lbl={pm.label} val={P[pm.id]||pm.def} set={v=>setParam(pm.id,v)} min={pm.min} max={pm.max} col={pm.col}/>)}
          </div>}

          {/* ─── CYLINDRICAL DIDACTIC MODE CARD ─────────────────────────────── */}
          <div style={{...card,border:cylDid?"1px solid rgba(239,68,68,0.25)":"1px solid rgba(255,255,255,0.05)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:cylDid?14:0}}>
              <div>
                <div style={{...lbl,color:cylDid?"#ef4444":"#334155"}}>Superfície Cilíndrica</div>
                {!cylDid&&<div style={{fontSize:11,color:"#1e293b",...mo,marginTop:4}}>Curva Diretriz · Reta Geratriz · Eixo</div>}
              </div>
              <button onClick={toggleCylDid} style={{
                padding:"6px 14px",borderRadius:8,
                border:`1px solid ${cylDid?"#ef4444":"rgba(255,255,255,0.08)"}`,
                background:cylDid?"rgba(239,68,68,0.12)":"transparent",
                color:cylDid?"#ef4444":"#475569",
                fontSize:11,cursor:"pointer",...mo,transition:"all 0.2s",
              }}>{cylDid?"ON":"OFF"}</button>
            </div>

            {cylDid&&(<>
              {/* Preset selector */}
              <div style={{display:"flex",gap:6,marginBottom:14}}>
                {CYL_PRESETS.map(cp=>(
                  <button key={cp.id} onClick={()=>setCylPreset(cp.id)} style={{
                    flex:1,padding:"8px 4px",borderRadius:8,fontSize:10,cursor:"pointer",...mo,
                    border:`1px solid ${cylPid===cp.id?cp.lcol:"rgba(255,255,255,0.06)"}`,
                    background:cylPid===cp.id?`${cp.lcol}18`:"transparent",
                    color:cylPid===cp.id?cp.lcol:"#475569",
                    transition:"all 0.15s",fontWeight:cylPid===cp.id?700:400,
                  }}>{cp.label}</button>
                ))}
              </div>

              {/* Parameters for selected cyl preset */}
              <div style={{marginBottom:14}}>
                {cylPr.params.map(pm=>(
                  <Sl key={pm.id} lbl={pm.label} val={cylP[pm.id]??pm.def} set={v=>setCylParam(pm.id,v)} min={pm.min} max={pm.max} s={0.05} col={cylPr.lcol}/>
                ))}
              </div>

              {/* 3-phase indicator */}
              <div style={{display:"flex",gap:6,marginBottom:10}}>
                {[
                  {label:"① Curva Diretriz",  range:[0,1],  color:"#60a5fa"},
                  {label:"② Retas Geratrizes",range:[1,2],  color:"#ef4444"},
                  {label:"③ Superfície",       range:[2,3],  color:"#f59e0b"},
                ].map(({label,range,color})=>{
                  const active=cylProg>=range[0]&&cylProg<range[1];
                  const done=cylProg>=range[1];
                  return(
                    <div key={label} style={{
                      flex:1,padding:"6px 4px",borderRadius:7,textAlign:"center",
                      border:`1px solid ${done||active?color+"44":"rgba(255,255,255,0.05)"}`,
                      background:done?`${color}18`:active?`${color}0d`:"transparent",
                      color:done||active?color:"#1e293b",fontSize:9,...mo,letterSpacing:0.3,
                      transition:"all 0.3s",
                    }}>{label}</div>
                  );
                })}
              </div>

              {/* 3-segment progress bar */}
              <CylPhaseBar/>

              {/* Controls */}
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                <button onClick={()=>{setCylPlay(false);setCylProg(0);}} style={{flex:1,padding:"10px 0",borderRadius:9,border:"1px solid rgba(255,255,255,0.07)",background:"transparent",color:"#64748b",cursor:"pointer",fontSize:16}}>⏮</button>
                <button onClick={()=>setCylPlay(p=>!p)} style={{
                  flex:2,padding:"10px 0",borderRadius:9,border:"none",
                  background:cylPlay?"#ef4444":"rgba(239,68,68,0.15)",
                  color:cylPlay?"#07090f":"#ef4444",
                  fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all 0.2s",
                }}>{cylPlay?"⏸  Pausar":"▶  Construir"}</button>
                <button onClick={()=>{setCylPlay(false);setCylProg(3);}} style={{flex:1,padding:"10px 0",borderRadius:9,border:"1px solid rgba(255,255,255,0.07)",background:"transparent",color:"#64748b",cursor:"pointer",fontSize:16}}>⏭</button>
              </div>

              {/* Manual scrub */}
              <div style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:11,color:"#64748b",...mo}}>progresso</span>
                  <span style={{fontSize:11,color:cylPhaseColor,...mo}}>{(cylProg/3*100).toFixed(0)}%</span>
                </div>
                <input type="range" min={0} max={3} step={0.01} value={cylProg}
                  onChange={e=>{setCylPlay(false);setCylProg(parseFloat(e.target.value));}}
                  style={{width:"100%",accentColor:"#ef4444",cursor:"pointer"}}/>
              </div>

              {/* Speed */}
              <div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:11,color:"#64748b",...mo}}>velocidade</span>
                  <span style={{fontSize:11,color:"#ef4444",...mo}}>{cylSpd.toFixed(1)}×</span>
                </div>
                <input type="range" min={0.2} max={4} step={0.1} value={cylSpd}
                  onChange={e=>setCylSpd(parseFloat(e.target.value))}
                  style={{width:"100%",accentColor:"#ef4444",cursor:"pointer"}}/>
              </div>

              {/* Legend */}
              <div style={{marginTop:12,padding:"10px 12px",background:"rgba(0,0,0,0.3)",borderRadius:8,border:"1px solid rgba(255,255,255,0.04)"}}>
                {[
                  {dot:"#60a5fa", text:"Curva Diretriz — gera o cilindro"},
                  {dot:"#ef4444", text:"Reta Geratriz — paralela ao eixo"},
                  {dot:"#ffffff", text:"Reta ativa — varrendo a diretriz"},
                ].map(({dot,text})=>(
                  <div key={text} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:dot,flexShrink:0}}/>
                    <span style={{fontSize:10,color:"#334155",...mo}}>{text}</span>
                  </div>
                ))}
              </div>
            </>)}
          </div>

          {/* Modo Formação */}
          <div style={card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:formMode?12:0}}>
              <div>
                <div style={{...lbl}}>Modo Formação</div>
                {!formMode&&<div style={{fontSize:11,color:"#1e293b",...mo,marginTop:4}}>Constrói a superfície curva por curva</div>}
              </div>
              <button onClick={toggleFormMode} style={{
                padding:"6px 14px",borderRadius:8,border:`1px solid ${formMode?"#f59e0b":"rgba(255,255,255,0.08)"}`,
                background:formMode?"rgba(245,158,11,0.12)":"transparent",
                color:formMode?"#f59e0b":"#475569",fontSize:11,cursor:"pointer",...mo,transition:"all 0.2s",
              }}>{formMode?"ON":"OFF"}</button>
            </div>
            {formMode&&(<>
              <div style={{background:"rgba(255,255,255,0.05)",borderRadius:4,height:4,marginBottom:14,overflow:"hidden"}}>
                <div style={{background:"#f59e0b",height:4,borderRadius:4,width:`${formPhase*100}%`,transition:"width 0.05s linear"}}/>
              </div>
              <div style={{display:"flex",gap:8,marginBottom:14}}>
                <button onClick={()=>{setFormPlaying(false);setFormPhase(0);}} style={{flex:1,padding:"10px 0",borderRadius:9,border:"1px solid rgba(255,255,255,0.07)",background:"transparent",color:"#64748b",cursor:"pointer",fontSize:16}}>⏮</button>
                <button onClick={()=>setFormPlaying(p=>!p)} style={{flex:2,padding:"10px 0",borderRadius:9,border:"none",background:formPlaying?"#f59e0b":"rgba(245,158,11,0.15)",color:formPlaying?"#07090f":"#f59e0b",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all 0.2s"}}>{formPlaying?"⏸  Pausar":"▶  Construir"}</button>
                <button onClick={()=>{setFormPlaying(false);setFormPhase(1);}} style={{flex:1,padding:"10px 0",borderRadius:9,border:"1px solid rgba(255,255,255,0.07)",background:"transparent",color:"#64748b",cursor:"pointer",fontSize:16}}>⏭</button>
              </div>
              <div style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:11,color:"#64748b",...mo}}>progresso</span>
                  <span style={{fontSize:11,color:"#f59e0b",...mo}}>{Math.round(formPhase*100)}%</span>
                </div>
                <input type="range" min={0} max={1} step={0.005} value={formPhase}
                  onChange={e=>{setFormPlaying(false);setFormPhase(parseFloat(e.target.value));}}
                  style={{width:"100%",accentColor:"#f59e0b",cursor:"pointer"}}/>
              </div>
              <div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:11,color:"#64748b",...mo}}>velocidade</span>
                  <span style={{fontSize:11,color:"#f59e0b",...mo}}>{formSpeed.toFixed(1)}×</span>
                </div>
                <input type="range" min={0.2} max={4} step={0.1} value={formSpeed}
                  onChange={e=>setFormSpeed(parseFloat(e.target.value))}
                  style={{width:"100%",accentColor:"#f59e0b",cursor:"pointer"}}/>
              </div>
              <div style={{fontSize:10,color:"#1e293b",...mo,marginTop:10,lineHeight:1.6}}>Meridianos → Paralelos → Superfície</div>
            </>)}
          </div>

          {/* Animação */}
          <div style={{...card,opacity:cylDid?0.45:1,pointerEvents:cylDid?"none":"auto",transition:"opacity 0.2s"}}>
            <div style={{...lbl,marginBottom:8}}>Animação  <span style={{color:"#38bdf8",fontSize:9}}>— use t nas expressões</span></div>
            {!custom&&pr.anim&&(
              <div style={{fontSize:11,color:"#334155",...mo,marginBottom:12,padding:"7px 11px",background:"rgba(56,189,248,0.05)",border:"1px solid rgba(56,189,248,0.12)",borderRadius:8}}>
                ↻ {pr.anim}
              </div>
            )}
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <button onClick={()=>setAnim(a=>!a)} style={{flex:2,padding:"10px 0",borderRadius:9,border:"none",background:anim?"#38bdf8":"rgba(56,189,248,0.15)",color:anim?"#07090f":"#38bdf8",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all 0.2s"}}>
                {anim?"⏸  Pausar":"▶  Play"}
              </button>
              <button onClick={()=>{setAnim(false);setTVal(tMin);}} style={{flex:1,padding:"10px 0",borderRadius:9,border:"1px solid rgba(255,255,255,0.06)",background:"transparent",color:"#475569",fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>↺</button>
            </div>
            <Sl lbl={`t = ${tVal.toFixed(2)}`} val={tVal} set={v=>{setTVal(v);if(anim)setAnim(false);}} min={tMin} max={tMax} s={0.05} col="#38bdf8"/>
            <Sl lbl="velocidade" val={speed} set={setSpeed} min={0.1} max={5} s={0.1} col="#60a5fa"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Sl lbl="t mín" val={tMin} set={setTMin} min={-20} max={tMax-0.1} s={0.1} col="#94a3b8"/>
              <Sl lbl="t máx" val={tMax} set={setTMax} min={tMin+0.1} max={20} s={0.1} col="#94a3b8"/>
            </div>
            <div style={{...lbl,fontSize:8,marginTop:4,marginBottom:7}}>Exemplos com t</div>
            {[
              {n:"Onda circular",  x:"u",y:"v",z:"sin(sqrt(u*u+v*v)-t)",u0:"-pi",u1:"pi",v0:"-pi",v1:"pi"},
              {n:"Esfera pulsante",x:"(1+0.3*sin(t))*cos(u)*sin(v)",y:"(1+0.3*sin(t))*sin(u)*sin(v)",z:"(1+0.3*sin(t))*cos(v)",u0:"0",u1:"2*pi",v0:"0",v1:"pi"},
              {n:"Sela animada",   x:"u",y:"v",z:"v*v-u*u+0.5*sin(2*t)",u0:"-2",u1:"2",v0:"-2",v1:"2"},
              {n:"Toro dinâmico",  x:"(2+cos(v))*cos(u+t)",y:"(2+cos(v))*sin(u+t)",z:"sin(v)",u0:"0",u1:"2*pi",v0:"0",v1:"2*pi"},
            ].map(ex=>(
              <button key={ex.n} onClick={()=>{setXE(ex.x);setYE(ex.y);setZE(ex.z);setU0(ex.u0);setU1(ex.u1);setV0(ex.v0);setV1(ex.v1);setTVal(0);setTimeout(()=>{setCust(true);setPKey(k=>k+1);setAnim(true);},40);}}
                style={{display:"block",width:"100%",marginBottom:5,padding:"6px 10px",borderRadius:7,border:"1px solid rgba(56,189,248,0.1)",background:"transparent",color:"#334155",fontSize:11,...mo,cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}
                onMouseEnter={e=>{e.target.style.color="#38bdf8";e.target.style.borderColor="rgba(56,189,248,0.3)";}}
                onMouseLeave={e=>{e.target.style.color="#334155";e.target.style.borderColor="rgba(56,189,248,0.1)";}}
              >{ex.n}</button>
            ))}
          </div>

          {/* Controles Visuais */}
          <div style={card}>
            <div style={{...lbl,marginBottom:12}}>Controles Visuais</div>
            <div style={{...lbl,fontSize:8,marginBottom:6}}>Resolução  {res}×{res}</div>
            <Sl lbl="" val={res} set={setRes} min={12} max={80} s={4} col="#60a5fa"/>
            <div style={{...lbl,fontSize:8,marginBottom:6}}>Vista</div>
            <div style={{display:"flex",gap:6,marginBottom:10}}>
              <TB label="Sólido" active={view==="solid"} onClick={()=>setView("solid")}/>
              <TB label="Raio-X" active={view==="xray"}  onClick={()=>setView("xray")} col="#a78bfa"/>
              <TB label="Malha"  active={view==="wire"}  onClick={()=>setView("wire")} col="#34d399"/>
            </div>
            <div style={{...lbl,fontSize:8,marginBottom:6}}>Eixo principal</div>
            <div style={{display:"flex",gap:6,marginBottom:10}}>
              {["z","y","x"].map(a=><TB key={a} label={`Eixo ${a.toUpperCase()}`} active={ax===a} onClick={()=>setAx(a)} col={a==="z"?"#4499ff":a==="y"?"#44dd88":"#ff4455"}/>)}
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:12,color:"#64748b",...mo}}>Colormap por altura</span>
              <button onClick={()=>setVcol(v=>!v)} style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${vcol?"#f59e0b":"rgba(255,255,255,0.06)"}`,background:vcol?"rgba(245,158,11,0.12)":"transparent",color:vcol?"#f59e0b":"#475569",cursor:"pointer",fontSize:11,...mo}}>{vcol?"ON":"OFF"}</button>
            </div>
          </div>

          {/* Domain & cut */}
          <div style={card}>
            <div style={{...lbl,marginBottom:12}}>Domínio & Corte</div>
            <Sl lbl="z mínimo" val={cMin} set={safeCMin} min={-6} max={()=>cMax-0.1} s={0.1} col="#60a5fa"/>
            <Sl lbl="z máximo" val={cMax} set={safeCMax} min={()=>cMin+0.1} max={6} s={0.1} col="#fb7185"/>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:4,marginBottom:cut?10:0}}>
              <span style={{fontSize:12,color:"#64748b",...mo}}>Plano de corte z=k</span>
              <button onClick={()=>setCut(c=>!c)} style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${cut?"#60a5fa":"rgba(255,255,255,0.06)"}`,background:cut?"rgba(96,165,250,0.12)":"transparent",color:cut?"#60a5fa":"#475569",cursor:"pointer",fontSize:11,...mo}}>{cut?"ON":"OFF"}</button>
            </div>
            {cut&&<Sl lbl={`k = ${cutZ.toFixed(2)}`} val={cutZ} set={setCutZ} min={-5} max={5} s={0.05} col="#60a5fa"/>}
          </div>

          {/* Função Personalizada */}
          <div style={{...card,opacity:cylDid?0.45:1,pointerEvents:cylDid?"none":"auto",transition:"opacity 0.2s"}}>
            <div style={{...lbl,marginBottom:10}}>Função Personalizada  <span style={{color:"#38bdf8",fontSize:8}}>t disponível</span></div>
            <EIn lb="x(u,v,t)" val={xE} set={setXE}/>
            <EIn lb="y(u,v,t)" val={yE} set={setYE}/>
            <EIn lb="z(u,v,t)" val={zE} set={setZE}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,margin:"8px 0 4px"}}>
              {[["u min",u0s,setU0],["u max",u1s,setU1],["v min",v0s,setV0],["v max",v1s,setV1]].map(([lb,vl,sv])=>(
                <div key={lb}><div style={{fontSize:9,color:"#334155",...mo,marginBottom:3}}>{lb}</div>
                <input type="text" value={vl} onChange={e=>sv(e.target.value)} style={{width:"100%",padding:"4px 7px",borderRadius:6,border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.03)",color:"#94a3b8",fontSize:11,...mo,outline:"none",boxSizing:"border-box"}}/></div>
              ))}
            </div>
            {cErr&&<div style={{fontSize:11,color:"#ef4444",...mo,marginBottom:7}}>{cErr}</div>}
            <div style={{fontSize:10,color:"#1e293b",...mo,marginBottom:8}}>sin cos tan sqrt cosh sinh exp log pi  ·  t para animação</div>
            <button onClick={()=>{setCErr(null);setCust(true);setPKey(k=>k+1);}} style={{width:"100%",padding:"9px 0",borderRadius:9,border:"none",background:"#38bdf8",color:"#07090f",fontSize:13,fontWeight:700,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"}}>▶  Plotar</button>
            {custom&&<button onClick={()=>setCust(false)} style={{width:"100%",marginTop:7,padding:"7px 0",borderRadius:9,border:"1px solid rgba(255,255,255,0.06)",background:"transparent",color:"#475569",fontSize:12,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"}}>← Presets</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
