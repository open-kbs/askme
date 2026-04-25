import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import { DevBanner } from "./components/DevBanner";
import { Nav } from "./components/Nav";
import { CalendarPanel } from "./components/CalendarPanel";
import { BottomSheet } from "./components/BottomSheet";
import { ThemeProvider } from "./components/ThemeProvider";
import { SessionProvider } from "./hooks/useSession";
import Home from "./pages/Home";
import Contact from "./pages/Contact";

function Shell() {
  const [scheduleOpen, setScheduleOpen] = useState(false);

  return (
    <>
      <DevBanner />
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
