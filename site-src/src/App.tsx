import { useEffect, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Nav } from "./components/Nav";
import { CalendarPanel } from "./components/CalendarPanel";
import { BottomSheet } from "./components/BottomSheet";
import { ThemeProvider } from "./components/ThemeProvider";
import { SessionProvider } from "./hooks/useSession";
import Home from "./pages/Home";
import Contact from "./pages/Contact";
import Setup from "./pages/Setup";

// Dev-only: if config.json still has placeholders, redirect to /setup.
// In production builds the fetch 404s and we just render the normal app.
function useSetupGate() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (location.pathname === "/setup") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/setup/status");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && !data.configured) navigate("/setup", { replace: true });
      } catch {
        // server not running or route not present — ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, navigate]);
}

function Shell() {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const location = useLocation();
  useSetupGate();

  // /setup renders full-width without nav/calendar chrome.
  if (location.pathname === "/setup") {
    return (
      <Routes>
        <Route path="/setup" element={<Setup />} />
      </Routes>
    );
  }

  return (
    <>
      <Nav onOpenSchedule={() => setScheduleOpen(true)} />
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 flex flex-col min-w-0">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/contact" element={<Contact />} />
          </Routes>
        </main>
        <aside className="w-80 lg:w-96 border-l border-foreground/10 hidden md:flex flex-col shrink-0">
          <CalendarPanel />
        </aside>
      </div>
      <BottomSheet
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        className="md:hidden"
        title="Schedule"
      >
        <CalendarPanel onBooked={() => setScheduleOpen(false)} />
      </BottomSheet>
    </>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </SessionProvider>
  );
}
