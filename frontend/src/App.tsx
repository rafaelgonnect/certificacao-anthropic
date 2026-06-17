import { Routes, Route, Navigate } from "react-router-dom";
import { type ReactNode } from "react";
import { AuthProvider, useAuth } from "./auth/AuthContext.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { AppShell } from "./components/AppShell.js";
import { LoginPage } from "./pages/LoginPage.js";
import { RegisterPage } from "./pages/RegisterPage.js";
import { OnboardingPage } from "./pages/OnboardingPage.js";
import { CertificationsPage } from "./pages/CertificationsPage.js";
import { GamePage } from "./pages/GamePage.js";
import { TrilhaPage } from "./pages/TrilhaPage.js";
import { LessonPage } from "./pages/LessonPage.js";
import { LabPage } from "./pages/LabPage.js";
import { ReviewsPage } from "./pages/ReviewsPage.js";
import { QuizPage } from "./pages/QuizPage.js";
import { ExamPage } from "./pages/ExamPage.js";
import { GestorDashboard } from "./pages/GestorDashboard.js";
import { UsersAdminPage } from "./pages/UsersAdminPage.js";

/** Redireciona para o onboarding quem ainda não o concluiu. */
function RequireOnboarded({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user && !user.onboarded) return <Navigate to="/bem-vindo" replace />;
  return <>{children}</>;
}

/** Rota protegida + gate de onboarding + casca visual (header da marca). */
function shell(element: ReactNode) {
  return (
    <ProtectedRoute>
      <RequireOnboarded>
        <AppShell>{element}</AppShell>
      </RequireOnboarded>
    </ProtectedRoute>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<RegisterPage />} />
        <Route
          path="/bem-vindo"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={shell(<CertificationsPage />)} />
        <Route path="/jogo" element={shell(<GamePage />)} />
        <Route path="/jogo/:slug" element={shell(<GamePage />)} />
        <Route path="/trilha/:slug" element={shell(<TrilhaPage />)} />
        <Route path="/licao/:id" element={shell(<LessonPage />)} />
        <Route path="/lab/:id" element={shell(<LabPage />)} />
        <Route path="/revisoes" element={shell(<ReviewsPage />)} />
        <Route path="/quiz" element={shell(<QuizPage />)} />
        <Route path="/simulado" element={shell(<ExamPage />)} />
        <Route path="/gestor" element={shell(<GestorDashboard />)} />
        <Route path="/admin/usuarios" element={shell(<UsersAdminPage />)} />
      </Routes>
    </AuthProvider>
  );
}
