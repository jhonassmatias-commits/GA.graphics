import React from 'react';
import Plot from 'react-plotly.js';

export default function CilindroParabolico({ onBack }) {
  const x_vals = [];
  const y_vals = [];
  const z_vals = [];

  // Malha de coordenadas
  for (let i = -3; i <= 3; i += 0.1) x_vals.push(i);
  for (let j = -5; j <= 5; j += 0.5) y_vals.push(j);

  // Calculando z = 4 - x^2
  for (let j = 0; j < y_vals.length; j++) {
    let z_row = [];
    for (let i = 0; i < x_vals.length; i++) {
      z_row.push(4 - Math.pow(x_vals[i], 2));
    }
    z_vals.push(z_row);
  }

  return (
    <div style={{
      background: "#07090f", 
      minHeight: "100vh",
      fontFamily: "'DM Sans', sans-serif", 
      color: "#e2e8f0",
      padding: "32px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      
      {/* Botão de Voltar */}
      <div style={{ width: "100%", maxWidth: 800, marginBottom: 20 }}>
        <button 
          onClick={onBack}
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "#f1f5f9",
            padding: "8px 16px",
            borderRadius: "8px",
            cursor: "pointer",
            fontFamily: "'DM Mono', monospace",
            fontSize: "12px",
            transition: "all 0.2s"
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          ← VOLTAR
        </button>
      </div>

      {/* Título do Módulo */}
      <div style={{ textAlign: "center", marginBottom: 30 }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, color: "#10b981" }}>
          Cilindro Parabólico
        </h2>
        <p style={{ color: "#475569", marginTop: 8 }}>Equação: z = 4 - x²</p>
      </div>

      {/* Gráfico 3D */}
      <div style={{
        background: "#050710",
        border: "1px solid rgba(16,185,129,0.18)",
        borderRadius: "18px",
        padding: "16px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
      }}>
        <Plot
          data={[
            {
              x: x_vals,
              y: y_vals,
              z: z_vals,
              type: 'surface',
              colorscale: 'Greens',
              showscale: false,
            }
          ]}
          layout={{
            width: 700,
            height: 500,
            paper_bgcolor: 'rgba(0,0,0,0)', // Fundo do papel transparente
            plot_bgcolor: 'rgba(0,0,0,0)',  // Fundo do plot transparente
            margin: { l: 0, r: 0, t: 0, b: 0 },
            scene: {
              xaxis: { title: 'Eixo X', color: '#64748b', gridcolor: '#1e293b' },
              yaxis: { title: 'Eixo Y', color: '#64748b', gridcolor: '#1e293b' },
              zaxis: { title: 'Eixo Z', color: '#64748b', gridcolor: '#1e293b', range: [0, 5] },
              camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } }
            }
          }}
        />
      </div>
    </div>
  );
}

