'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function LandingPage() {
  useEffect(() => {
    // Generate random star dots
    const container = document.getElementById('stars-bg');
    if (container && container.childElementCount === 0) {
      for (let i = 0; i < 80; i++) {
        const dot = document.createElement('div');
        dot.className = 'star-dot';
        dot.style.left = Math.random() * 100 + '%';
        dot.style.top = Math.random() * 100 + '%';
        dot.style.opacity = String(Math.random() * 0.5 + 0.1);
        dot.style.width = dot.style.height = (Math.random() * 2 + 1) + 'px';
        container.appendChild(dot);
      }
    }

    // Draw astronaut halftone figure
    const astroCanvas = document.getElementById('astronaut-canvas') as HTMLCanvasElement | null;
    if (astroCanvas) {
      const ctx = astroCanvas.getContext('2d');
      if (ctx) {
        const w = astroCanvas.width;
        const h = astroCanvas.height;
        ctx.clearRect(0, 0, w, h);
        const cx = w * 0.5;
        const cy = h * 0.4;

        function inEllipse(px: number, py: number, ex: number, ey: number, rx: number, ry: number, angle: number) {
          const cos = Math.cos(angle), sin = Math.sin(angle);
          const dx = px - ex, dy = py - ey;
          const rdx = cos * dx + sin * dy;
          const rdy = -sin * dx + cos * dy;
          return (rdx * rdx) / (rx * rx) + (rdy * rdy) / (ry * ry);
        }

        const shapes = [
          { x: cx, y: cy - 30, rx: 65, ry: 60, angle: 0, brightness: 0.85, density: 3500 },
          { x: cx + 8, y: cy - 35, rx: 35, ry: 32, angle: 0.1, brightness: 1.0, density: 2000 },
          { x: cx - 5, y: cy + 50, rx: 55, ry: 70, angle: -0.1, brightness: 0.55, density: 4000 },
          { x: cx - 50, y: cy + 20, rx: 30, ry: 50, angle: -0.15, brightness: 0.45, density: 1500 },
          { x: cx + 70, y: cy - 10, rx: 50, ry: 20, angle: -0.5, brightness: 0.65, density: 1500 },
          { x: cx + 110, y: cy - 35, rx: 30, ry: 15, angle: -0.7, brightness: 0.55, density: 800 },
          { x: cx + 135, y: cy - 55, rx: 18, ry: 14, angle: -0.3, brightness: 0.7, density: 600 },
          { x: cx - 65, y: cy + 55, rx: 40, ry: 18, angle: 0.4, brightness: 0.5, density: 1200 },
          { x: cx - 100, y: cy + 70, rx: 25, ry: 14, angle: 0.5, brightness: 0.4, density: 600 },
          { x: cx + 20, y: cy + 130, rx: 22, ry: 55, angle: 0.15, brightness: 0.4, density: 1500 },
          { x: cx + 30, y: cy + 185, rx: 18, ry: 30, angle: 0.2, brightness: 0.35, density: 600 },
          { x: cx - 30, y: cy + 125, rx: 22, ry: 50, angle: -0.2, brightness: 0.38, density: 1400 },
          { x: cx - 40, y: cy + 180, rx: 16, ry: 28, angle: -0.25, brightness: 0.3, density: 500 },
          { x: cx - 2, y: cy + 15, rx: 25, ry: 15, angle: 0, brightness: 0.5, density: 600 },
        ];

        shapes.forEach(s => {
          for (let i = 0; i < s.density; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random();
            const px = s.x + Math.cos(angle) * r * s.rx * 1.2;
            const py = s.y + Math.sin(angle) * r * s.ry * 1.2;
            const dist = inEllipse(px, py, s.x, s.y, s.rx, s.ry, s.angle);
            if (dist <= 1) {
              const edgeFade = 1 - dist * 0.5;
              const b = s.brightness * edgeFade * (0.6 + Math.random() * 0.4);
              const size = Math.random() * 2.2 + 0.4;
              ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(b, 1)})`;
              ctx.fillRect(px, py, size, size);
            }
          }
        });

        // Visor glow
        for (let i = 0; i < 800; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * 28;
          const x = cx + 8 + Math.cos(a) * r;
          const y = cy - 35 + Math.sin(a) * r;
          const b = 1 - (r / 28) * 0.4;
          ctx.fillStyle = `rgba(255, 255, 255, ${b})`;
          const size = Math.random() * 2.5 + 0.8;
          ctx.fillRect(x, y, size, size);
        }

        // Floating debris
        for (let i = 0; i < 300; i++) {
          const a = Math.random() * Math.PI * 2;
          const dist = 130 + Math.random() * 70;
          const x = cx + Math.cos(a) * dist * (0.8 + Math.random() * 0.4);
          const y = cy + 40 + Math.sin(a) * dist * 0.6;
          if (x > 0 && x < w && y > 0 && y < h) {
            const opacity = Math.random() * 0.25 + 0.05;
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.fillRect(x, y, Math.random() * 1.5 + 0.5, Math.random() * 1.5 + 0.5);
          }
        }
      }
    }

    // Draw starburst
    const starCanvas = document.getElementById('starburst-canvas') as HTMLCanvasElement | null;
    if (starCanvas) {
      const ctx = starCanvas.getContext('2d');
      if (ctx) {
        const w = starCanvas.width;
        const h = starCanvas.height;
        const cx = w / 2;
        const cy = h / 2;
        ctx.clearRect(0, 0, w, h);

        const numRays = 80;
        for (let i = 0; i < numRays; i++) {
          const angle = (i / numRays) * Math.PI * 2;
          const length = 40 + Math.random() * 55;
          const innerR = 20;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
          ctx.lineTo(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length);
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + Math.random() * 0.5})`;
          ctx.lineWidth = 1 + Math.random() * 1.5;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.fillStyle = '#111';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        for (let i = 0; i < 300; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 15 + Math.random() * 85;
          const x = cx + Math.cos(angle) * dist;
          const y = cy + Math.sin(angle) * dist;
          const opacity = Math.max(0, 0.4 - (dist / 100) * 0.3);
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }, []);

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
          --black: #0a0a0a; --dark: #111111; --gray-dark: #1a1a1a; --gray-mid: #2a2a2a;
          --gray: #888; --gray-light: #aaa; --white: #f0f0f0; --border: #333;
        }
        html { scroll-behavior: smooth; }
        body { font-family: 'IBM Plex Mono', monospace; background: var(--black); color: var(--white); -webkit-font-smoothing: antialiased; }

        .noise { position: relative; overflow: hidden; }
        .noise::before {
          content: ''; position: absolute; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E");
          background-size: 200px 200px; pointer-events: none; z-index: 1;
        }
        .noise > * { position: relative; z-index: 2; }

        .sparkle { position: absolute; width: 20px; height: 20px; z-index: 3; }
        .sparkle::before, .sparkle::after { content: ''; position: absolute; background: rgba(255,255,255,0.8); }
        .sparkle::before { width: 1px; height: 100%; left: 50%; top: 0; transform: translateX(-50%); }
        .sparkle::after { width: 100%; height: 1px; top: 50%; left: 0; transform: translateY(-50%); }
        .sparkle-sm { width: 12px; height: 12px; }
        .sparkle-lg { width: 28px; height: 28px; }
        @keyframes twinkle { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        .sparkle { animation: twinkle 3s ease-in-out infinite; }
        .sparkle:nth-child(2) { animation-delay: 0.5s; }
        .sparkle:nth-child(3) { animation-delay: 1s; }
        .sparkle:nth-child(4) { animation-delay: 1.5s; }
        .sparkle:nth-child(5) { animation-delay: 2s; }
        .sparkle:nth-child(6) { animation-delay: 0.8s; }
        .sparkle:nth-child(7) { animation-delay: 1.3s; }

        .hero { background: var(--black); border-bottom: 1px solid var(--border); min-height: 680px; position: relative; overflow: hidden; }
        .hero-inner { position: relative; z-index: 2; padding: 40px 60px; min-height: 680px; display: flex; flex-direction: column; }
        .stars-bg { position: absolute; inset: 0; z-index: 1; }
        .star-dot { position: absolute; width: 2px; height: 2px; background: rgba(255,255,255,0.4); border-radius: 50%; }

        .nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 40px; }
        .nav-logo { font-size: 28px; font-weight: 700; color: var(--white); text-decoration: none; letter-spacing: -0.5px; }
        .nav-links { display: flex; gap: 40px; list-style: none; }
        .nav-links a { color: var(--gray-light); text-decoration: none; font-size: 14px; font-weight: 400; transition: color 0.2s; }
        .nav-links a:hover { color: var(--white); }
        .nav-right { display: flex; align-items: center; gap: 24px; }
        .github-icon { color: var(--white); transition: opacity 0.2s; }
        .github-icon:hover { opacity: 0.7; }
        .btn-signup { border: 1px solid var(--white); background: transparent; color: var(--white); padding: 8px 24px; font-family: 'IBM Plex Mono', monospace; font-size: 14px; cursor: pointer; border-radius: 4px; text-decoration: none; transition: background 0.2s, color 0.2s; }
        .btn-signup:hover { background: var(--white); color: var(--black); }

        .hero-content { flex: 1; display: flex; align-items: center; padding-top: 40px; }
        .hero-text { flex: 1; max-width: 540px; }
        .hero-text h1 { font-size: 40px; font-weight: 600; line-height: 1.2; margin-bottom: 20px; letter-spacing: -0.5px; }
        .hero-text p { font-size: 15px; color: var(--gray-light); line-height: 1.6; margin-bottom: 36px; max-width: 420px; font-weight: 300; }
        .hero-buttons { display: flex; gap: 16px; }
        .btn-launch { border: 1px solid var(--white); background: transparent; color: var(--white); padding: 12px 24px; font-family: 'IBM Plex Mono', monospace; font-size: 14px; cursor: pointer; border-radius: 4px; text-decoration: none; transition: background 0.2s, color 0.2s; }
        .btn-launch:hover { background: var(--white); color: var(--black); }

        .hero-visual { flex: 1; display: flex; justify-content: center; align-items: center; position: relative; }
        .astronaut-container { width: 420px; height: 420px; position: relative; }
        .astronaut-canvas { width: 100%; height: 100%; }

        .logos-section { background: var(--dark); border-bottom: 1px solid var(--border); padding: 50px 60px; text-align: center; }
        .logos-section h2 { font-size: 24px; font-weight: 500; margin-bottom: 40px; letter-spacing: -0.3px; }
        .logos-row { display: flex; align-items: center; justify-content: center; gap: 60px; flex-wrap: wrap; }
        .logo-item { font-size: 24px; font-weight: 700; color: var(--gray-light); display: flex; align-items: center; gap: 8px; letter-spacing: 1px; }

        .how-section { background: var(--black); border-bottom: 1px solid var(--border); padding: 60px; display: flex; gap: 60px; position: relative; overflow: hidden; min-height: 560px; }
        .how-left { flex: 1; max-width: 420px; }
        .how-label { font-size: 13px; color: var(--gray); margin-bottom: 16px; font-weight: 400; }
        .how-left h2 { font-size: 32px; font-weight: 600; line-height: 1.25; margin-bottom: 16px; }
        .how-left > p { font-size: 14px; color: var(--gray-light); line-height: 1.5; margin-bottom: 48px; font-weight: 300; }

        .steps { display: flex; flex-direction: column; }
        .step { display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-bottom: 1px solid var(--border); }
        .step:first-child { padding-top: 0; }
        .step-title { font-size: 15px; font-weight: 500; }
        .step-desc { font-size: 12px; color: var(--gray); margin-top: 4px; line-height: 1.4; font-weight: 300; }
        .step-num { font-size: 14px; color: var(--gray); font-weight: 400; }

        .how-right { flex: 1; display: flex; justify-content: center; align-items: center; }
        .dashboard-card { background: linear-gradient(145deg, #888 0%, #555 30%, #333 100%); border-radius: 16px; padding: 4px; width: 100%; max-width: 460px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
        .dashboard-inner { background: var(--gray-dark); border-radius: 14px; padding: 32px; position: relative; overflow: hidden; }
        .dashboard-inner::before { content: ''; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E"); background-size: 200px; pointer-events: none; }
        .dashboard-label { font-size: 13px; color: var(--gray); margin-bottom: 4px; position: relative; }
        .dashboard-amount { font-size: 28px; font-weight: 600; margin-bottom: 28px; position: relative; }
        .starburst-container { width: 100%; height: 200px; display: flex; justify-content: center; align-items: center; margin-bottom: 24px; position: relative; }
        .starburst-canvas { width: 220px; height: 220px; }
        .dashboard-bottom { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; position: relative; }
        .dashboard-bottom-label { font-size: 15px; font-weight: 500; }
        .btn-find-credits { border: 1px solid var(--white); background: transparent; color: var(--white); padding: 6px 16px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; cursor: pointer; border-radius: 3px; }
        .stack-row { display: flex; align-items: center; background: rgba(255,255,255,0.05); border-radius: 6px; padding: 12px 16px; position: relative; }
        .stack-name { flex: 1; font-size: 14px; color: var(--gray-light); }
        .stack-amount { font-size: 14px; font-weight: 500; margin-right: 12px; }
        .stack-dot { width: 10px; height: 10px; background: #22c55e; border-radius: 50%; }

        .cta-section { background: var(--black); border-bottom: 1px solid var(--border); padding: 80px 60px; text-align: center; position: relative; overflow: hidden; }
        .cta-section h2 { font-size: 32px; font-weight: 600; line-height: 1.3; margin-bottom: 32px; max-width: 700px; margin-left: auto; margin-right: auto; }
        .btn-cta { border: 1px solid var(--white); background: transparent; color: var(--white); padding: 14px 32px; font-family: 'IBM Plex Mono', monospace; font-size: 14px; cursor: pointer; border-radius: 4px; text-decoration: none; display: inline-block; transition: background 0.2s, color 0.2s; }
        .btn-cta:hover { background: var(--white); color: var(--black); }

        .footer { overflow: hidden; position: relative; }
        .footer-inner { background: linear-gradient(145deg, #777 0%, #555 40%, #444 100%); padding: 4px; padding-bottom: 0; }
        .footer-content { background: #555; padding: 60px; position: relative; overflow: hidden; text-align: center; }
        .footer-content::before { content: ''; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.15'/%3E%3C/svg%3E"); background-size: 300px; pointer-events: none; }
        .footer-logo { font-size: 64px; font-weight: 700; margin-bottom: 60px; position: relative; }
        .footer-mid { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 60px; position: relative; }
        .footer-location { font-size: 13px; letter-spacing: 2px; text-transform: uppercase; color: var(--white); font-weight: 400; }
        .footer-nav { list-style: none; display: flex; flex-direction: column; gap: 8px; align-items: center; }
        .footer-nav a { color: var(--white); text-decoration: none; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; font-weight: 400; transition: opacity 0.2s; }
        .footer-nav a:hover { opacity: 0.7; }
        .footer-est { font-size: 13px; letter-spacing: 2px; text-transform: uppercase; color: var(--white); font-weight: 400; }
        .footer-bottom { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 24px; position: relative; }
        .footer-bottom a, .footer-bottom span { color: var(--gray-light); text-decoration: none; font-size: 13px; font-weight: 300; }
        .footer-bottom a:hover { color: var(--white); }

        @media (max-width: 900px) {
          .hero-inner { padding: 30px; }
          .hero-content { flex-direction: column; text-align: center; }
          .hero-text { max-width: 100%; }
          .hero-text p { max-width: 100%; }
          .hero-buttons { justify-content: center; }
          .astronaut-container { width: 280px; height: 280px; margin-top: 40px; }
          .how-section { flex-direction: column; padding: 40px; }
          .how-left { max-width: 100%; }
          .nav-links { display: none; }
          .logos-row { gap: 30px; }
          .footer-mid { flex-direction: column; align-items: center; gap: 30px; }
          .footer-bottom { flex-direction: column; gap: 12px; text-align: center; }
        }
      `}</style>

      {/* ===== HERO ===== */}
      <section className="hero noise">
        <div className="stars-bg" id="stars-bg"></div>
        <div className="sparkle sparkle-sm" style={{ top: '15%', left: '20%' }}></div>
        <div className="sparkle" style={{ top: '8%', right: '30%' }}></div>
        <div className="sparkle sparkle-lg" style={{ top: '45%', right: '8%' }}></div>
        <div className="sparkle sparkle-sm" style={{ top: '70%', left: '10%' }}></div>
        <div className="sparkle" style={{ bottom: '15%', left: '40%' }}></div>
        <div className="sparkle sparkle-sm" style={{ top: '25%', right: '15%' }}></div>
        <div className="sparkle" style={{ bottom: '25%', right: '25%' }}></div>

        <div className="hero-inner">
          <nav className="nav">
            <a href="#" className="nav-logo">Hunter</a>
            <ul className="nav-links">
              <li><a href="#product">Product</a></li>
              <li><a href="#credits">Credits</a></li>
              <li><a href="#pricing">Pricing</a></li>
              <li><a href="#customers">Customers</a></li>
            </ul>
            <div className="nav-right">
              <a href="#" className="github-icon" aria-label="GitHub">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
              <Link href="/dashboard" className="btn-signup">Launch App</Link>
            </div>
          </nav>

          <div className="hero-content">
            <div className="hero-text">
              <h1>Hunting credit for subscriptions</h1>
              <p>Hunter tracks your current stack, finds new credits you&apos;re eligible for, and secures them for you, fully autonomously.</p>
              <div className="hero-buttons">
                <Link href="/dashboard" className="btn-launch">Launch App</Link>
                <Link href="/dashboard" className="btn-launch">Try it Free</Link>
              </div>
            </div>
            <div className="hero-visual">
              <div className="astronaut-container">
                <canvas className="astronaut-canvas" id="astronaut-canvas" width="420" height="420"></canvas>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== LOGOS ===== */}
      <section className="logos-section noise">
        <h2>The current credit targets</h2>
        <div className="logos-row">
          <div className="logo-item">
            <span style={{ fontSize: 32, fontWeight: 700, fontStyle: 'italic', letterSpacing: 1 }}>aws</span>
          </div>
          <div className="logo-item" style={{ fontSize: 20, letterSpacing: 3, textTransform: 'uppercase' as const }}>
            <span>ANTHROP\C</span>
          </div>
          <div className="logo-item" style={{ fontSize: 20 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.042 6.042 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
            </svg>
            <span>OpenAI</span>
          </div>
          <div className="logo-item" style={{ fontSize: 22 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L24 22H0L12 1z"/>
            </svg>
            <span>Vercel</span>
          </div>
          <div className="logo-item">
            <span style={{ fontSize: 28, fontWeight: 700 }}>stripe</span>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="how-section noise" id="product">
        <div className="sparkle sparkle-sm" style={{ top: '12%', left: '30%' }}></div>
        <div className="sparkle" style={{ top: '50%', left: '45%' }}></div>
        <div className="sparkle sparkle-sm" style={{ top: '80%', left: '15%' }}></div>

        <div className="how-left">
          <div className="how-label">How Hunter works</div>
          <h2>Stop leaving money on the table.</h2>
          <p>Hunter tracks your tools, finds savings, and secures the credits.</p>

          <div className="steps">
            <div className="step">
              <div>
                <div className="step-title">Upload your expenses</div>
                <div className="step-desc">Upload a bank statement. Our MCP scans it<br/>and maps your stack and spend.</div>
              </div>
              <div className="step-num">01</div>
            </div>
            <div className="step">
              <div><div className="step-title">Track your tools</div></div>
              <div className="step-num">02</div>
            </div>
            <div className="step">
              <div><div className="step-title">Discovery on autopilot</div></div>
              <div className="step-num">03</div>
            </div>
            <div className="step">
              <div><div className="step-title">Claim credits autonomously</div></div>
              <div className="step-num">04</div>
            </div>
          </div>
        </div>

        <div className="how-right">
          <div className="dashboard-card">
            <div className="dashboard-inner">
              <div className="dashboard-label">Total spent</div>
              <div className="dashboard-amount">$5,400.00</div>
              <div className="starburst-container">
                <canvas className="starburst-canvas" id="starburst-canvas" width="220" height="220"></canvas>
              </div>
              <div className="dashboard-bottom">
                <div className="dashboard-bottom-label">Stack Breakdown</div>
                <button className="btn-find-credits">Find credits</button>
              </div>
              <div className="stack-row">
                <span className="stack-name">Vercel</span>
                <span className="stack-amount">$240.00</span>
                <span className="stack-dot"></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="cta-section noise">
        <div className="sparkle sparkle-sm" style={{ top: '20%', left: '10%' }}></div>
        <div className="sparkle" style={{ top: '30%', right: '15%' }}></div>
        <h2>There&apos;s $20k-$100k in startup credits available. Don&apos;t leave money on the table.</h2>
        <Link href="/dashboard" className="btn-cta">Get started today</Link>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-content noise">
            <div className="footer-logo">Hunter</div>
            <div className="footer-mid">
              <div className="footer-location">San Francisco</div>
              <ul className="footer-nav">
                <li><a href="#">Home</a></li>
                <li><a href="#product">Product</a></li>
                <li><a href="#credits">Credits</a></li>
                <li><a href="#pricing">Pricing</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
              <div className="footer-est">Est. 2026</div>
            </div>
            <div className="footer-bottom">
              <a href="#">Privacy Policy</a>
              <span>All rights reserved 2026</span>
              <a href="#">Terms &amp; conditions</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
