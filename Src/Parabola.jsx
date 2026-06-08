import { useState, useEffect, useRef } from "react";

// ─── Canvas ──────────────────────────────────────────────────────────────────
const W = 640, H = 500, CX = 320, CY = 250, SC = 52;
const toSVG = (x, y) => [CX + x * SC, CY - y * SC];
const TICKS = [-5,-4,-3,-2,-1,1,2,3,4,5];
const GRID  = [-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6];

// ─── Safe expression evaluator ───────────────────────────────────────────────
// Supports: t, p, +, -, *, /, ^, **, sin, cos, tan, sqrt, abs, log, exp, pi, e
function safeEval(expr, t, p) {
  try {
    const e = expr
      .replace(/²/g, "**2").replace(/³/g, "**3").replace(/\^/g, "**")
      .replace(/\bsin\b/g,  "Math.sin").replace(/\bcos\b/g,  "Math.cos")
      .replace(/\btan\b/g,  "Math.tan").replace(/\bsqrt\b/g, "Math.sqrt")
      .replace(/\babs\b/g,  "Math.abs").replace(/\bexp\b/g,  "Math.exp")
      .replace(/\blog\b/g,  "Math.log").replace(/\bpi\b/gi,  "Math.PI")
      .replace(/\be\b/g,    "Math.E");
    // eslint-disable-next-line no-new-func
    const v = new Function("t", "p", `"use strict"; return (${e});`)(t, p);
    return typeof v === "number" && isFinite(v) ? v : NaN;
  } catch { return NaN; }
}

// ─── Parabola equation parser ─────────────────────────────────────────────────
// Accepts: "y² = 6x", "y^2 = -4x", "x² = 8y", "x^2 = -2y"
// Returns { orientation, p } or null
function parseEq(raw) {
  const s = raw.trim().replace(/²/g, "^2").replace(/\s+/g, "").toLowerCase();
  let m = s.match(/^y\^2=([+-]?\d*\.?\d+)x$/);
  if (m) { const N = parseFloat(m[1]); if (N !== 0) return { orientation: "horizontal", p: N / 4 }; }
  m = s.match(/^x\^2=([+-]?\d*\.?\d+)y$/);
  if (m) { const N = parseFloat(m[1]); if (N !== 0) return { orientation: "vertical",   p: N / 4 }; }
  return null;
}

// ─── Path builders ────────────────────────────────────────────────────────────
function buildStdPath(orientation, p) {
  if (!p) return "";
  const pts = [];
  if (orientation === "horizontal") {
    for (let yi = -5.5; yi <= 5.5; yi += 0.03) {
      const x = (yi * yi) / (4 * p);
      if (Math.abs(x) > 6.5) continue;
      pts.push(toSVG(x, yi));
    }
  } else {
    for (let xi = -5.5; xi <= 5.5; xi += 0.03) {
      const y = (xi * xi) / (4 * p);
      if (Math.abs(y) > 5.5) continue;
      pts.push(toSVG(xi, y));
    }
  }
  return pts.length < 2 ? "" : "M " + pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" L ");
}

// Breaks into segments at discontinuities to avoid ugly jump lines
function buildCustomPath(xExpr, yExpr, p) {
  const segs = [];
  let cur = [];
  let prevX = null, prevY = null;
  for (let ti = -4; ti <= 4; ti += 0.04) {
    const rx = safeEval(xExpr, ti, p);
    const ry = safeEval(yExpr, ti, p);
    const outOfBounds = Math.abs(rx) > 7 || Math.abs(ry) > 6.5;
    const jump = prevX !== null && (Math.abs(rx - prevX) > 2 || Math.abs(ry - prevY) > 2);
    if (isNaN(rx) || isNaN(ry) || outOfBounds || jump) {
      if (cur.length > 1) segs.push(cur);
      cur = [];
    } else {
      cur.push(toSVG(rx, ry));
      prevX = rx; prevY = ry;
    }
  }
  if (cur.length > 1) segs.push(cur);
  return segs.map(seg => "M " + seg.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" L ")).join(" ");
}

// ─── Definition geometry helpers ─────────────────────────────────────────────
// Horizontal: P=(1/p, 2), D=(-p, 2)  → |PF|=|Pd|=(1+p²)/p ✓
// Vertical:   P=(2, 1/p), D=(2, -p)  → |PF|=|Pd|=(1+p²)/p ✓
const defP     = (o, p) => o === "horizontal" ? toSVG(1/p, 2)  : toSVG(2, 1/p);
const defD     = (o, p) => o === "horizontal" ? toSVG(-p,  2)  : toSVG(2, -p);
const getFocus = (o, p) => o === "horizontal" ? toSVG(p,   0)  : toSVG(0,  p);

// ─── Step content ─────────────────────────────────────────────────────────────
const STEPS_RED = [
  { title:"O Plano",     desc:"O plano cartesiano é o espaço onde a parábola existe. Cada ponto é determinado por um par ordenado (x, y)." },
  { title:"O Vértice",   desc:"O vértice V(0, 0) é o ponto da parábola mais próximo simultaneamente do foco e da diretriz." },
  { title:"O Foco",      desc:"O foco F é um ponto fixo interior à curva, sobre o eixo de simetria. Use o slider de p para observar seu deslocamento." },
  { title:"A Diretriz",  desc:"A diretriz é uma reta fixa perpendicular ao eixo de simetria, simétrica ao foco em relação ao vértice." },
  { title:"A Definição", desc:"Todo ponto P da parábola satisfaz:\n\n|PF| = |Pd|\n\nEle é equidistante do foco e da diretriz. Essa é a definição geométrica." },
  { title:"A Curva",     desc:"A parábola é o lugar geométrico de todos os pontos que satisfazem |PF| = |Pd|. Explore agora editando a equação livremente." },
];
const STEPS_PAR = [
  { title:"O Plano",          desc:"Preparamos o plano para a representação paramétrica. Cada ponto da curva será descrito em função de um parâmetro real t ∈ ℝ." },
  { title:"As Equações",      desc:"x(t) = p·t²\ny(t) = 2p·t\n\nVerificação:\ny² = (2pt)² = 4p²t²\n4px = 4p(pt²) = 4p²t²  ✓\n\nEdite as expressões livremente." },
  { title:"O Ponto P(t)",     desc:"O ponto P(t) percorre a curva conforme t varia. Use o slider ou a animação. Experimente sin(t), cos(t) nas expressões!" },
  { title:"A Curva Completa", desc:"O conjunto de todos os pontos P(t) forma a curva. Cada t corresponde a um único ponto. Com expressões livres, qualquer curva é possível." },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep]               = useState(1);
  const [p, setP]                     = useState(1.5);
  const [t, setT]                     = useState(0);
  const [mode, setMode]               = useState("reduzida");
  const [orientation, setOrientation] = useState("horizontal");
  const [animating, setAnimating]     = useState(false);

  // Editable equation (reduzida)
  const [eqInput, setEqInput]         = useState("y^2 = 6x");
  const [eqError, setEqError]         = useState(false);

  // Editable expressions (parametrica)
  const [xExpr, setXExpr]             = useState("p*t*t");
  const [yExpr, setYExpr]             = useState("2*p*t");
  const [exprError, setExprError]     = useState(false);

  const animRef = useRef(null);

  // Fonts
  useEffect(() => {
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Mono:wght@400;500&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap";
    document.head.appendChild(link);
  }, []);

  // Animation
  useEffect(() => {
    if (animating) {
      let tv = -3;
      animRef.current = setInterval(() => {
        tv = parseFloat((tv + 0.05).toFixed(2));
        if (tv > 3) tv = -3;
        setT(tv);
      }, 48);
    } else {
      clearInterval(animRef.current);
    }
    return () => clearInterval(animRef.current);
  }, [animating]);

  // ── Sync: slider/number → eqInput ────────────────────────────────────────
  const syncEqFromP = (newP, newOrientation) => {
    const o = newOrientation ?? orientation;
    const coeff = (4 * newP).toFixed(1);
    setEqInput(o === "horizontal" ? `y^2 = ${coeff}x` : `x^2 = ${coeff}y`);
    setEqError(false);
  };

  const handlePChange = (newP) => { setP(newP); syncEqFromP(newP); };
  const handleOrientationChange = (newO) => { setOrientation(newO); syncEqFromP(p, newO); setStep(1); setAnimating(false); };

  // ── Sync: eqInput → p, orientation ──────────────────────────────────────
  const handleEqInput = (val) => {
    setEqInput(val);
    const parsed = parseEq(val);
    if (parsed) {
      setP(parsed.p);
      setOrientation(parsed.orientation);
      setEqError(false);
    } else {
      setEqError(true);
    }
  };

  // ── Validate parametric expressions ──────────────────────────────────────
  const handleExprChange = (field, val) => {
    if (field === "x") setXExpr(val);
    else setYExpr(val);
    const testX = field === "x" ? val : xExpr;
    const testY = field === "y" ? val : yExpr;
    const ok = !isNaN(safeEval(testX, 0, p)) && !isNaN(safeEval(testY, 0, p));
    setExprError(!ok);
  };

  // ── Geometry ──────────────────────────────────────────────────────────────
  const totalSteps = mode === "reduzida" ? 6 : 4;
  const steps      = mode === "reduzida" ? STEPS_RED : STEPS_PAR;
  const F          = getFocus(orientation, p);
  const PP         = defP(orientation, p);
  const PD         = defD(orientation, p);
  const stdPath    = buildStdPath(orientation, p);
  const customPath = buildCustomPath(xExpr, yExpr, p);

  // Parametric point using the current expressions
  const paramPtSVG = (() => {
    const rx = safeEval(xExpr, t, p);
    const ry = safeEval(yExpr, t, p);
    return isNaN(rx) || isNaN(ry) ? null : toSVG(rx, ry);
  })();

  const directrix = orientation === "horizontal"
    ? { axis:"v", pos:toSVG(-p,0)[0], label:`x = ${(-p).toFixed(2)}`, lx:toSVG(-p,0)[0]+7, ly:22 }
    : { axis:"h", pos:toSVG(0,-p)[1], label:`y = ${(-p).toFixed(2)}`, lx:CX+7,              ly:toSVG(0,-p)[1]-9 };

  const badgeText = mode === "reduzida"
    ? eqInput
    : `x(t) = ${xExpr}   |   y(t) = ${yExpr}`;

  const vis = {
    vertex:     step >= 2,
    focus:      step >= 3,
    directrix:  step >= 4 && mode === "reduzida",
    definition: step >= 5 && mode === "reduzida",
    curve:      step >= 6 && mode === "reduzida",
    eqBadge:   (step >= 3 && mode === "reduzida") || (step >= 2 && mode === "parametrica"),
    paramPt:    step >= 3 && mode === "parametrica",
    paramCurve: step >= 4 && mode === "parametrica",
    controls:   step >= 3,
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const lbl  = { fontSize:9, letterSpacing:3, color:"#334155", textTransform:"uppercase" };
  const card = { background:"#050710", border:"1px solid rgba(255,255,255,0.05)", borderRadius:14, padding:"20px 22px" };
  const inputBase = {
    padding:"7px 11px", borderRadius:8, fontSize:13,
    fontFamily:"'DM Mono', monospace", outline:"none",
    color:"#f59e0b", fontWeight:500,
    background:"rgba(245,158,11,0.05)",
    transition:"border 0.2s",
  };
  const sliderLabel = { fontSize:12, color:"#64748b", fontFamily:"'DM Mono', monospace" };

  return (
    <div style={{ fontFamily:"'DM Sans', sans-serif", background:"#07090f", height:"100vh", color:"#e2e8f0", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div style={{ background:"#050710", borderBottom:"1px solid rgba(255,255,255,0.05)", padding:"0 28px", display:"flex", alignItems:"center", gap:28, height:54, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:10, flexShrink:0 }}>
          <span style={{ fontFamily:"'Playfair Display', serif", fontSize:17, color:"#f59e0b" }}>Geometria Analítica</span>
          <span style={{ fontSize:9, letterSpacing:2.5, color:"#1e293b" }}>WINTERLE</span>
        </div>

        <div style={{ display:"flex", flex:1 }}>
          {[["Parábola",true],["Elipse",false],["Hipérbole",false],["Elipsóide",false]].map(([label,active]) => (
            <div key={label} style={{
              padding:"0 18px", height:54, display:"flex", alignItems:"center",
              cursor: active ? "default" : "not-allowed",
              borderBottom:`2px solid ${active ? "#f59e0b" : "transparent"}`,
              color: active ? "#f59e0b" : "#1e293b", fontSize:13,
            }}>{label}</div>
          ))}
        </div>

        <div style={{ display:"flex", gap:10, alignItems:"center", flexShrink:0 }}>
          {/* Mode toggle */}
          <div style={{ display:"flex", background:"#07090f", border:"1px solid rgba(255,255,255,0.06)", borderRadius:8, overflow:"hidden" }}>
            {[["reduzida","Reduzida"],["parametrica","Paramétrica"]].map(([m,label]) => (
              <button key={m} onClick={() => { setMode(m); setStep(1); setAnimating(false); setT(0); }} style={{
                padding:"6px 14px", border:"none", cursor:"pointer", fontSize:12,
                fontFamily:"'DM Sans', sans-serif",
                background: mode===m ? "#f59e0b" : "transparent",
                color:      mode===m ? "#07090f" : "#334155",
                fontWeight: mode===m ? 600 : 400, transition:"all 0.2s",
              }}>{label}</button>
            ))}
          </div>
          {/* Orientation toggle (reduzida only) */}
          {mode === "reduzida" && (
            <div style={{ display:"flex", background:"#07090f", border:"1px solid rgba(255,255,255,0.06)", borderRadius:8, overflow:"hidden" }}>
              {[["horizontal","y²=4px"],["vertical","x²=4py"]].map(([o,label]) => (
                <button key={o} onClick={() => handleOrientationChange(o)} style={{
                  padding:"6px 12px", border:"none", cursor:"pointer",
                  fontSize:11, fontFamily:"'DM Mono', monospace",
                  background: orientation===o ? "rgba(245,158,11,0.1)" : "transparent",
                  color:      orientation===o ? "#f59e0b" : "#334155",
                  transition:"all 0.2s",
                }}>{label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

        {/* ── Graph 60% ───────────────────────────────────────────────────── */}
        <div style={{ flex:"0 0 60%", position:"relative", background:"#060810", borderRight:"1px solid rgba(255,255,255,0.04)" }}>

          {/* Equation badge */}
          {vis.eqBadge && (
            <div style={{
              position:"absolute", top:14, left:14, zIndex:10, maxWidth:"55%",
              background:"rgba(245,158,11,0.07)", border:"1px solid rgba(245,158,11,0.18)",
              borderRadius:9, padding:"7px 14px",
              fontSize:13, color:"#f59e0b", fontFamily:"'DM Mono', monospace",
              letterSpacing:0.3, wordBreak:"break-all",
            }}>
              {badgeText}
            </div>
          )}

          <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
            <defs><clipPath id="pc"><rect x={0} y={0} width={W} height={H}/></clipPath></defs>

            {/* Grid */}
            {GRID.map(i => {
              const [gx] = toSVG(i,0), [,gy] = toSVG(0,i);
              return <g key={i}>
                <line x1={gx} y1={0}  x2={gx} y2={H} stroke="rgba(255,255,255,0.028)" strokeWidth={1}/>
                <line x1={0}  y1={gy} x2={W}  y2={gy} stroke="rgba(255,255,255,0.028)" strokeWidth={1}/>
              </g>;
            })}

            {/* Axes */}
            <line x1={0} y1={CY} x2={W} y2={CY} stroke="rgba(255,255,255,0.18)" strokeWidth={1.5}/>
            <line x1={CX} y1={0} x2={CX} y2={H} stroke="rgba(255,255,255,0.18)" strokeWidth={1.5}/>
            <text x={W-16} y={CY-10} fill="rgba(255,255,255,0.25)" fontSize={14} fontFamily="monospace">x</text>
            <text x={CX+10} y={16}   fill="rgba(255,255,255,0.25)" fontSize={14} fontFamily="monospace">y</text>

            {TICKS.map(i => {
              const [gx] = toSVG(i,0), [,gy] = toSVG(0,i);
              return <g key={i}>
                <line x1={gx} y1={CY-4} x2={gx} y2={CY+4} stroke="rgba(255,255,255,0.15)" strokeWidth={1}/>
                <line x1={CX-4} y1={gy} x2={CX+4} y2={gy} stroke="rgba(255,255,255,0.15)" strokeWidth={1}/>
                <text x={gx}    y={CY+16} fill="rgba(255,255,255,0.12)" fontSize={10} textAnchor="middle" fontFamily="monospace">{i}</text>
                <text x={CX-17} y={gy+4}  fill="rgba(255,255,255,0.12)" fontSize={10} textAnchor="middle" fontFamily="monospace">{i!==0?i:""}</text>
              </g>;
            })}

            <g clipPath="url(#pc)">
              {/* Directrix */}
              {vis.directrix && (
                <>
                  {directrix.axis==="v"
                    ? <line x1={directrix.pos} y1={0} x2={directrix.pos} y2={H} stroke="#60a5fa" strokeWidth={1.8} strokeDasharray="9,6" opacity={0.65}/>
                    : <line x1={0} y1={directrix.pos} x2={W} y2={directrix.pos} stroke="#60a5fa" strokeWidth={1.8} strokeDasharray="9,6" opacity={0.65}/>
                  }
                  <text x={directrix.lx} y={directrix.ly} fill="#60a5fa" fontSize={12} fontFamily="'DM Mono', monospace" opacity={0.85}>{directrix.label}</text>
                </>
              )}

              {/* Standard curve (reduzida) */}
              {vis.curve && <path d={stdPath} fill="none" stroke="#f59e0b" strokeWidth={2.8} strokeLinecap="round"/>}

              {/* Custom parametric curve */}
              {vis.paramCurve && customPath && (
                <path d={customPath} fill="none" stroke="#f59e0b" strokeWidth={2.8} strokeLinecap="round"
                      opacity={exprError ? 0.2 : 1}/>
              )}

              {/* Definition geometry */}
              {vis.definition && (
                <>
                  <line x1={PP[0]} y1={PP[1]} x2={F[0]}  y2={F[1]}  stroke="#34d399" strokeWidth={2} strokeDasharray="7,5"/>
                  <line x1={PP[0]} y1={PP[1]} x2={PD[0]} y2={PD[1]} stroke="#f472b6" strokeWidth={2} strokeDasharray="7,5"/>
                  <circle cx={PD[0]} cy={PD[1]} r={4} fill="#f472b6"/>
                  <text x={PD[0]+(orientation==="horizontal"?-20:8)} y={PD[1]+(orientation==="horizontal"?5:-12)}
                    fill="#f472b6" fontSize={13} fontFamily="'DM Mono', monospace">d</text>
                  <circle cx={PP[0]} cy={PP[1]} r={6} fill="#e2e8f0" stroke="#07090f" strokeWidth={2}/>
                  <text x={PP[0]+10} y={PP[1]-12} fill="#e2e8f0" fontSize={13} fontFamily="'DM Mono', monospace">P</text>
                  <text x={(PP[0]+F[0])/2+8}  y={(PP[1]+F[1])/2}
                    fill="#34d399" fontSize={12} fontFamily="'DM Mono', monospace">|PF|</text>
                  <text x={(PP[0]+PD[0])/2+(orientation==="horizontal"?0:9)} y={(PP[1]+PD[1])/2+(orientation==="horizontal"?-13:0)}
                    fill="#f472b6" fontSize={12} fontFamily="'DM Mono', monospace">|Pd|</text>
                </>
              )}

              {/* Parametric point */}
              {vis.paramPt && paramPtSVG && (
                <>
                  <circle cx={paramPtSVG[0]} cy={paramPtSVG[1]} r={7} fill="#f59e0b" stroke="#07090f" strokeWidth={2.5}/>
                  <text x={paramPtSVG[0]+12} y={paramPtSVG[1]-12} fill="#f59e0b" fontSize={12} fontFamily="'DM Mono', monospace">t={t.toFixed(2)}</text>
                </>
              )}
            </g>

            {/* Focus */}
            {vis.focus && (
              <>
                <circle cx={F[0]} cy={F[1]} r={6} fill="#f59e0b" stroke="#07090f" strokeWidth={2}/>
                <text x={F[0]+11} y={F[1]-13} fill="#f59e0b" fontSize={13} fontFamily="'DM Mono', monospace">
                  {orientation==="horizontal" ? `F(${p.toFixed(2)}, 0)` : `F(0, ${p.toFixed(2)})`}
                </text>
              </>
            )}

            {/* Vertex */}
            {vis.vertex && (
              <>
                <circle cx={CX} cy={CY} r={5.5} fill="#f1f5f9" stroke="#07090f" strokeWidth={2}/>
                <text x={CX+10} y={CY-13} fill="#f1f5f9" fontSize={13} fontFamily="'DM Mono', monospace">V(0, 0)</text>
              </>
            )}
          </svg>
        </div>

        {/* ── Info panel 40% ──────────────────────────────────────────────── */}
        <div style={{ flex:"0 0 40%", display:"flex", flexDirection:"column", padding:"22px 24px", gap:14, overflowY:"auto" }}>

          {/* Step card */}
          <div style={card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <span style={lbl}>Passo {step} / {totalSteps}</span>
              <span style={{ fontFamily:"'Playfair Display', serif", fontSize:14, color:"#f59e0b" }}>{steps[step-1]?.title}</span>
            </div>
            <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:4, height:3, marginBottom:18 }}>
              <div style={{ background:"#f59e0b", height:3, borderRadius:4, width:`${(step/totalSteps)*100}%`, transition:"width 0.4s" }}/>
            </div>
            <p style={{ fontSize:14, lineHeight:1.85, color:"#94a3b8", margin:0, whiteSpace:"pre-line", fontWeight:300 }}>
              {steps[step-1]?.desc}
            </p>
          </div>

          {/* Controls */}
          {vis.controls && (
            <div style={card}>
              <div style={{ ...lbl, marginBottom:16 }}>Controles</div>

              {/* ── Equação editável (reduzida) ── */}
              {mode === "reduzida" && (
                <div style={{ marginBottom:20 }}>
                  <div style={{ ...sliderLabel, marginBottom:7 }}>Equação</div>
                  <input
                    type="text"
                    value={eqInput}
                    onChange={e => handleEqInput(e.target.value)}
                    placeholder="ex: y^2 = 6x"
                    style={{
                      ...inputBase,
                      width:"100%", boxSizing:"border-box",
                      border: eqError
                        ? "1px solid rgba(239,68,68,0.5)"
                        : "1px solid rgba(245,158,11,0.3)",
                    }}
                  />
                  {eqError && (
                    <div style={{ fontSize:11, color:"#ef4444", marginTop:5, fontFamily:"'DM Mono', monospace" }}>
                      Use: y^2 = Nx  ou  x^2 = Ny  (N ≠ 0)
                    </div>
                  )}
                </div>
              )}

              {/* ── Expressões paramétricas editáveis ── */}
              {mode === "parametrica" && (
                <div style={{ marginBottom:20 }}>
                  <div style={{ ...sliderLabel, marginBottom:7 }}>Expressões  <span style={{ color:"#1e293b", fontSize:10 }}>(use t, p, sin, cos, sqrt…)</span></div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                    <span style={{ ...sliderLabel, flexShrink:0 }}>x(t) =</span>
                    <input type="text" value={xExpr} onChange={e => handleExprChange("x", e.target.value)}
                      style={{ ...inputBase, flex:1, border: exprError ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(245,158,11,0.3)" }}/>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ ...sliderLabel, flexShrink:0 }}>y(t) =</span>
                    <input type="text" value={yExpr} onChange={e => handleExprChange("y", e.target.value)}
                      style={{ ...inputBase, flex:1, border: exprError ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(245,158,11,0.3)" }}/>
                  </div>
                  {exprError && (
                    <div style={{ fontSize:11, color:"#ef4444", marginTop:6, fontFamily:"'DM Mono', monospace" }}>
                      Expressão inválida
                    </div>
                  )}
                  {/* Examples */}
                  <div style={{ marginTop:10, display:"flex", flexWrap:"wrap", gap:6 }}>
                    {[
                      { label:"Parábola",   x:"p*t*t",         y:"2*p*t"       },
                      { label:"Círculo",    x:"2*cos(t)",      y:"2*sin(t)"    },
                      { label:"Espiral",    x:"t*cos(t)",      y:"t*sin(t)"    },
                      { label:"Lemniscata", x:"2*cos(t)/(1+sin(t)**2)", y:"2*sin(t)*cos(t)/(1+sin(t)**2)" },
                    ].map(ex => (
                      <button key={ex.label} onClick={() => { setXExpr(ex.x); setYExpr(ex.y); setExprError(false); }}
                        style={{
                          padding:"4px 10px", borderRadius:6, border:"1px solid rgba(255,255,255,0.07)",
                          background:"transparent", color:"#475569", fontSize:11,
                          fontFamily:"'DM Mono', monospace", cursor:"pointer", transition:"all 0.15s",
                        }}
                        onMouseEnter={e => { e.target.style.color="#f59e0b"; e.target.style.borderColor="rgba(245,158,11,0.3)"; }}
                        onMouseLeave={e => { e.target.style.color="#475569"; e.target.style.borderColor="rgba(255,255,255,0.07)"; }}
                      >{ex.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── p slider ── */}
              <div style={{ marginBottom: mode==="parametrica" ? 20 : 0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <span style={sliderLabel}>p  (parâmetro focal)</span>
                  <input type="number" min={-6} max={6} step={0.1} value={p}
                    onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v !== 0) handlePChange(Math.min(6,Math.max(-6,v))); }}
                    style={{ ...inputBase, width:66, textAlign:"center", border:"1px solid rgba(245,158,11,0.3)" }}/>
                </div>
                <input type="range" min={-6} max={6} step={0.1} value={p}
                  onChange={e => handlePChange(parseFloat(e.target.value))}
                  style={{ width:"100%", accentColor:"#f59e0b", cursor:"pointer" }}/>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                  <span style={{ fontSize:10, color:"#1e293b", fontFamily:"monospace" }}>−6</span>
                  <span style={{ fontSize:10, color:"#1e293b", fontFamily:"monospace" }}>+6</span>
                </div>
              </div>

              {/* ── t slider + animate (parametric) ── */}
              {mode === "parametrica" && (
                <>
                  <div style={{ marginBottom:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                      <span style={sliderLabel}>t  (parâmetro)</span>
                      <input type="number" min={-4} max={4} step={0.05} value={t}
                        onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) { setT(Math.min(4,Math.max(-4,v))); setAnimating(false); } }}
                        style={{ ...inputBase, width:66, textAlign:"center", border:"1px solid rgba(245,158,11,0.3)" }}/>
                    </div>
                    <input type="range" min={-4} max={4} step={0.05} value={t}
                      onChange={e => { setT(parseFloat(e.target.value)); setAnimating(false); }}
                      style={{ width:"100%", accentColor:"#f59e0b", cursor:"pointer" }}/>
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                      <span style={{ fontSize:10, color:"#1e293b", fontFamily:"monospace" }}>−4</span>
                      <span style={{ fontSize:10, color:"#1e293b", fontFamily:"monospace" }}>+4</span>
                    </div>
                  </div>
                  <button onClick={() => setAnimating(a => !a)} style={{
                    width:"100%", padding:"10px 0",
                    border:"1px solid rgba(245,158,11,0.25)", borderRadius:9,
                    background: animating ? "rgba(245,158,11,0.1)" : "transparent",
                    color:"#f59e0b", cursor:"pointer", fontSize:13,
                    fontFamily:"'DM Sans', sans-serif", transition:"all 0.2s",
                  }}>
                    {animating ? "⏸  Pausar animação" : "▶  Animar t"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Legend */}
          {vis.definition && (
            <div style={card}>
              <div style={{ ...lbl, marginBottom:14 }}>Legenda</div>
              {[
                { color:"#34d399", label:"Distância |PF| — ponto ao foco"    },
                { color:"#f472b6", label:"Distância |Pd| — ponto à diretriz" },
                { color:"#60a5fa", label:"Diretriz"                           },
                { color:"#f59e0b", label:"Foco F e curva"                     },
              ].map(item => (
                <div key={item.label} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
                  <div style={{ width:22, height:2.5, background:item.color, borderRadius:2, flexShrink:0 }}/>
                  <span style={{ fontSize:13, color:"#64748b", fontWeight:300 }}>{item.label}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ flex:1 }}/>

          {/* Navigation */}
          <div style={{ display:"flex", gap:12 }}>
            <button onClick={() => setStep(s => Math.max(1,s-1))} disabled={step===1} style={{
              flex:1, padding:"13px 0",
              border:"1px solid rgba(255,255,255,0.07)", borderRadius:11,
              background:"transparent",
              color:  step===1 ? "#1a2235" : "#64748b",
              cursor: step===1 ? "not-allowed" : "pointer",
              fontSize:13, fontFamily:"'DM Sans', sans-serif", transition:"all 0.2s",
            }}>← Anterior</button>
            <button onClick={() => setStep(s => Math.min(totalSteps,s+1))} disabled={step===totalSteps} style={{
              flex:2, padding:"13px 0", border:"none", borderRadius:11,
              background: step===totalSteps ? "#0e1525" : "#f59e0b",
              color:      step===totalSteps ? "#334155"  : "#07090f",
              cursor:     step===totalSteps ? "not-allowed" : "pointer",
              fontSize:13, fontWeight:600, fontFamily:"'DM Sans', sans-serif", transition:"all 0.2s",
            }}>Próximo →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
