import { useEffect, useState, type ReactNode } from "react";

/**
 * Mounts its children one frame AFTER the page has painted, showing `fallback`
 * meanwhile. Heavy widgets (charts, websocket/presence panels, feeds) use this
 * so navigating to a page is instant and only those boxes show a loading state.
 */
export const DeferMount = ({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // rAF -> setTimeout guarantees the browser has painted the fallback first.
    let timer: ReturnType<typeof setTimeout>;
    const raf = requestAnimationFrame(() => { timer = setTimeout(() => setReady(true), 0); });
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, []);

  return <>{ready ? children : fallback}</>;
};

export default DeferMount;
