import { useState, useEffect, useRef } from 'react';
import { MapPin, RefreshCw, Compass } from 'lucide-react';

interface LocationPanelProps {
  onLocationUpdate: (city: string) => void;
}

export default function LocationPanel({ onLocationUpdate }: LocationPanelProps) {
  const [loading, setLoading] = useState(false);
  const [city, setCity] = useState('Hyderabad');
  const [country, setCountry] = useState('India');
  const [lat, setLat] = useState<number | null>(17.3850);
  const [lon, setLon] = useState<number | null>(78.4867);
  const [accuracy, setAccuracy] = useState<number | null>(12);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Auto-get geolocation on load
  useEffect(() => {
    getLocation();
  }, []);

  // Animate map canvas HUD
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    let sweepAngle = 0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      
      // Clear background
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, w, h);

      // Draw grid
      ctx.strokeStyle = 'rgba(255, 123, 0, 0.08)';
      ctx.lineWidth = 1;
      const gridSize = 16;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Draw radar rings in center
      const cx = w / 2;
      const cy = h / 2;
      ctx.strokeStyle = 'rgba(255, 123, 0, 0.15)';
      for (let r = 20; r < w / 1.5; r += 24) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Radar sweep line
      sweepAngle += 0.015;
      ctx.strokeStyle = 'rgba(255, 123, 0, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweepAngle) * (w / 2), cy + Math.sin(sweepAngle) * (w / 2));
      ctx.stroke();

      // Pulsating target marker in center
      const pulseRadius = 6 + Math.sin(Date.now() * 0.005) * 2;
      ctx.fillStyle = '#ff7b00';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ff7b00';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 123, 0, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0; // Reset

      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, []);

  const getLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const acc = Math.round(position.coords.accuracy);
        
        setLat(latitude);
        setLon(longitude);
        setAccuracy(acc);

        try {
          const res = await fetch(`http://localhost:8000/api/reverse-geocode?lat=${latitude}&lon=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            setCity(data.city);
            setCountry(data.country);
            onLocationUpdate(data.city);
          }
        } catch (err) {
          console.error("Geocoding fetch failed, using fallback.", err);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.warn("Geolocation permission denied or error. Using fallback.", error);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="hud-panel p-4 flex flex-col gap-3">
      <div className="flex justify-between items-center border-b border-orange-500/20 pb-2">
        <h3 className="text-xs font-mono tracking-widest text-[#ff7b00] uppercase font-bold flex items-center gap-1.5">
          <Compass size={13} className="animate-spin-slow" />
          <span>LOCATION TELEMETRY</span>
        </h3>
        <button
          onClick={getLocation}
          disabled={loading}
          className="text-gray-400 hover:text-[#ff7b00] transition-colors disabled:opacity-50"
          title="Refresh coordinates"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-lg font-bold tracking-wide text-white">{city}, {country}</span>
        <div className="flex justify-between text-[10px] font-mono text-gray-400">
          <span>LAT: {lat?.toFixed(4)}° N</span>
          <span>LON: {lon?.toFixed(4)}° E</span>
        </div>
      </div>

      {/* Futuristic Map Canvas */}
      <div className="relative h-28 w-full border border-orange-500/10 rounded-lg overflow-hidden">
        <canvas ref={canvasRef} width={280} height={112} className="w-full h-full block" />
        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 px-2 py-0.5 rounded border border-orange-500/20 text-[9px] font-mono text-gray-300">
          <MapPin size={9} className="text-[#ff7b00] animate-bounce" />
          <span>GPS SIGNAL STRENGTH: STRONG</span>
        </div>
        <div className="absolute bottom-2 right-2 text-[8px] font-mono text-gray-500">
          ACCURACY: {accuracy ? `${accuracy}m` : '12m'}
        </div>
      </div>
    </div>
  );
}
