import { useState } from "react";
import Parabola     from "./Parabola";
import Superficies  from "./Superficies";
import CilindroParabolico from "./CilindroParabolico"; // <-- Nova importação

export default function App() {
  const [modulo, setModulo] = useState(null);

  if (modulo === "parabola")   return <Parabola    onBack={() => setModulo(null)} />;
  if (modulo === "superficies") return <Superficies onBack={() => setModulo(null)} />;
  if (modulo === "cilindro_parabolico") return <CilindroParabolico onBack={() => setModulo(null)} />; // <-- Nova rota

  return (
    <div style={{
      background: "#07090f", minHeight: "100vh",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif", color: "#e2e8f0",
      padding: 32,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07090f; }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 56 }}>
        <div style={{
          fontSize: 11, letterSpacing: 4, color: "#1e293b",
          fontFamily: "'DM Mono', monospace", marginBottom: 14,
        }}>WINTERLE</div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 42, color: "#f1f5f9", lineHeight: 1.15, marginBottom: 12,
        }}>
          Geometria Analítica
        </h1>
        <p style={{ fontSize: 15, color: "#334155", fontWeight: 300 }}>
          Módulos interativos — visualização passo a passo
        </p>
      </div>

      {/* Cards */}
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center", maxWidth: 1000, width: "100%" }}>

        {/* Cap 8 */}
        <div
          onClick={() => setModulo("parabola")}
          style={{
            flex: "1 1 280px", maxWidth: 320,
            background: "#050710",
            border: "1px solid rgba(245,158,11,0.18)",
            borderRadius: 18, padding: "32px 28px",
            cursor: "pointer", transition: "all 0.25s",
            position: "relative", overflow: "hidden",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(245,158,11,0.5)"; e.currentTarget.style.transform = "translateY(-3px)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(245,158,11,0.18)"; e.currentTarget.style.transform = "translateY(0)"; }}
        >
          <div style={{
            position: "absolute", top: -40, right: -40,
            width: 140, height: 140, borderRadius: "50%",
            background: "rgba(245,158,11,0.06)", pointerEvents: "none",
          }}/>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#334155", fontFamily: "'DM Mono',monospace", marginBottom: 10 }}>
            CAP. 8 — CÔNICAS
          </div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: "#f59e0b", marginBottom: 12 }}>
            Parábola
          </div>
          <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.75, fontWeight: 300, marginBottom: 20 }}>
            Construção passo a passo, equação reduzida e paramétrica, sliders interativos e função personalizada.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["Equação Reduzida","Paramétrica","Foco & Diretriz","Gráfico Livre"].map(t => (
              <span key={t} style={{
                fontSize: 10, padding: "3px 9px", borderRadius: 20,
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.15)",
                color: "#92400e", fontFamily: "'DM Mono',monospace",
              }}>{t}</span>
            ))}
          </div>
        </div>

        {/* Cap 9 - Superfícies */}
        <div
          onClick={() => setModulo("superficies")}
          style={{
            flex: "1 1 280px", maxWidth: 320,
            background: "#050710",
            border: "1px solid rgba(167,139,250,0.18)",
            borderRadius: 18, padding: "32px 28px",
            cursor: "pointer", transition: "all 0.25s",
            position: "relative", overflow: "hidden",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(167,139,250,0.5)"; e.currentTarget.style.transform = "translateY(-3px)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(167,139,250,0.18)"; e.currentTarget.style.transform = "translateY(0)"; }}
        >
          <div style={{
            position: "absolute", top: -40, right: -40,
            width: 140, height: 140, borderRadius: "50%",
            background: "rgba(167,139,250,0.05)", pointerEvents: "none",
          }}/>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#334155", fontFamily: "'DM Mono',monospace", marginBottom: 10 }}>
            CAP. 9 — SUPERFÍCIES
          </div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: "#a78bfa", marginBottom: 12 }}>
            Quádricas 3D
          </div>
          <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.75, fontWeight: 300, marginBottom: 20 }}>
            Esfera, Elipsóide, Cilindro, Parabolóide, Cone e Hiperbolóide com rotação 360° e função paramétrica livre.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["Rotação 3D","6 Presets","Toro & Hélice","Gráfico Livre"].map(t => (
              <span key={t} style={{
                fontSize: 10, padding: "3px 9px", borderRadius: 20,
                background: "rgba(167,139,250,0.08)",
                border: "1px solid rgba(167,139,250,0.15)",
                color: "#5b21b6", fontFamily: "'DM Mono',monospace",
              }}>{t}</span>
            ))}
          </div>
        </div>

        {/* NOVO: Cap 9 - Cilindro Parabólico */}
        <div
          onClick={() => setModulo("cilindro_parabolico")}
          style={{
            flex: "1 1 280px", maxWidth: 320,
            background: "#050710",
            border: "1px solid rgba(16,185,129,0.18)", // Borda verde esmeralda
            borderRadius: 18, padding: "32px 28px",
            cursor: "pointer", transition: "all 0.25s",
            position: "relative", overflow: "hidden",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; e.currentTarget.style.transform = "translateY(-3px)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(16,185,129,0.18)"; e.currentTarget.style.transform = "translateY(0)"; }}
        >
          <div style={{
            position: "absolute", top: -40, right: -40,
            width: 140, height: 140, borderRadius: "50%",
            background: "rgba(16,185,129,0.05)", pointerEvents: "none",
          }}/>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#334155", fontFamily: "'DM Mono',monospace", marginBottom: 10 }}>
            CAP. 9 — SUPERFÍCIES
          </div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: "#10b981", marginBottom: 12 }}>
            Cilindro Parabólico
          </div>
          <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.75, fontWeight: 300, marginBottom: 20 }}>
            Visualização 3D da superfície gerada por uma parábola diretriz no plano XZ.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["Variável Livre","Retas Geratrizes","Plotly 3D"].map(t => (
              <span key={t} style={{
                fontSize: 10, padding: "3px 9px", borderRadius: 20,
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.15)",
                color: "#047857", fontFamily: "'DM Mono',monospace",
              }}>{t}</span>
            ))}
          </div>
        </div>

      </div>

      {/* Footer */}
      <div style={{ marginTop: 56, fontSize: 11, color: "#0f172a", fontFamily: "'DM Mono',monospace", letterSpacing: 2 }}>
        UACSA · UFRPE · Geometria Analítica
      </div>
    </div>
  );
}
