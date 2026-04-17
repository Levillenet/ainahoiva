import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import EldersList from "./pages/EldersList";
import ElderDetail from "./pages/ElderDetail";
import CognitiveReport from "./pages/CognitiveReport";
import CallSchedule from "./pages/CallSchedule";
import Reports from "./pages/Reports";
import Reminders from "./pages/Reminders";
import SettingsPage from "./pages/SettingsPage";
import SmsLog from "./pages/SmsLog";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="vanhukset" element={<EldersList />} />
              <Route path="vanhukset/:id" element={<ElderDetail />} />
              <Route path="vanhukset/:id/kognitio" element={<CognitiveReport />} />
              <Route path="aikataulu" element={<CallSchedule />} />
              <Route path="raportit" element={<Reports />} />
              <Route path="muistutukset" element={<Reminders />} />
              <Route path="viestit" element={<SmsLog />} />
              <Route path="asetukset" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
