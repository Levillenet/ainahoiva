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
import LegacyDashboard from "./pages/legacy/LegacyDashboard";
import LegacyElderView from "./pages/legacy/LegacyElderView";
import LegacyOnboarding from "./pages/legacy/LegacyOnboarding";
import LegacyEdit from "./pages/legacy/LegacyEdit";
import LegacyProgress from "./pages/legacy/LegacyProgress";
import LegacyRequests from "./pages/legacy/LegacyRequests";
import LegacyObservations from "./pages/legacy/LegacyObservations";
import LegacyTestChat from "./pages/legacy/LegacyTestChat";
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
              <Route path="muistoissa" element={<LegacyDashboard />} />
              <Route path="muistoissa/:elderId" element={<LegacyElderView />} />
              <Route path="muistoissa/:elderId/onboarding" element={<LegacyOnboarding />} />
              <Route path="muistoissa/:elderId/muokkaa" element={<LegacyEdit />} />
              <Route path="muistoissa/:elderId/edistyminen" element={<LegacyProgress />} />
              <Route path="muistoissa/:elderId/pyynnot" element={<LegacyRequests />} />
              <Route path="muistoissa/:elderId/huomiot" element={<LegacyObservations />} />
              <Route path="muistoissa/:elderId/testaa" element={<LegacyTestChat />} />
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
