import { useEffect, useRef, useState } from 'react';
import { net } from '../net/client.js';
import { useUi } from '../store.js';

interface Callout {
  text: string;
  color: string;
  key: number;
}

// Reactive EA-BIG-style callouts for the WO-02/03/04 events. A single transient
// slot (so they never stack/leak) flashed near the top, biased away from center
// so it doesn't cover the puck. Gamebreaker/goal keep the big center banner.
export function Callouts() {
  const [msg, setMsg] = useState<Callout | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const show = (text: string, color: string) => {
      seq.current += 1;
      setMsg({ text, color, key: seq.current });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMsg(null), 1000);
    };
    const offs = [
      net.events.on('ankle_break', () => show('BROKEN ANKLES!', '#ffd23c')),
      net.events.on('bank_play', () => show('OFF THE WALL!', '#27c93f')),
      net.events.on('nolook_pass', () => show('NO LOOK!', '#b347ff')),
    ];
    // milestones off my own chain (every 2 links from x3)
    let lastMilestone = 0;
    const unsub = useUi.subscribe((st) => {
      const c = st.myCombo;
      if (c >= 3 && c >= lastMilestone + 2) {
        lastMilestone = c;
        show(`${c}× COMBO 🔥`, '#ff8c19');
      }
      if (c === 0) lastMilestone = 1;
    });
    return () => {
      offs.forEach((o) => o());
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <>
      <GamebreakerReady />
      {msg && (
        <div
          key={msg.key}
          style={{
            position: 'absolute',
            top: '16%',
            left: '50%',
            fontSize: 46,
            fontWeight: 900,
            color: msg.color,
            letterSpacing: 1,
            whiteSpace: 'nowrap',
            textShadow: `0 0 24px ${msg.color}, 0 3px 14px rgba(0,0,0,0.7)`,
            animation: 'bbhCallout 1s ease-out forwards',
          }}
        >
          {msg.text}
          <style>{`@keyframes bbhCallout{0%{transform:translateX(-50%) scale(0.6) rotate(-4deg);opacity:0}18%{transform:translateX(-50%) scale(1.14) rotate(-2deg);opacity:1}100%{transform:translateX(-50%) scale(1) rotate(0);opacity:0}}`}</style>
        </div>
      )}
    </>
  );
}

// Persistent "GAMEBREAKER READY" indicator: shows while the meter is full and
// clears the moment it's spent (ult active or charge dropped).
function GamebreakerReady() {
  const ready = useUi((s) => s.myUltCharge >= 1);
  const active = useUi((s) => s.myUltActiveUntil > s.serverTime);
  if (!ready || active) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: 64,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '4px 16px',
        borderRadius: 20,
        background: 'rgba(255,210,60,0.16)',
        border: '1px solid #ffd23c',
        color: '#ffd23c',
        fontWeight: 800,
        fontSize: 13,
        letterSpacing: 1.5,
        textShadow: '0 0 10px rgba(255,210,60,0.8)',
        animation: 'bbhGbReady 0.9s ease-in-out infinite',
      }}
    >
      ⚡ GAMEBREAKER READY
      <style>{`@keyframes bbhGbReady{0%,100%{opacity:1}50%{opacity:0.45}}`}</style>
    </div>
  );
}
