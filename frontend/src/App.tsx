import { Routes, Route } from "react-router-dom";
import { type ReactNode } from "react";
import { AuthProvider } from "./auth/AuthContext.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { AppShell } from "./components/AppShell.js";
import { LoginPage } from "./pages/LoginPage.js";
import { CertificationsPage } from "./pages/CertificationsPage.js";
import { TrilhaPage } from "./pages/TrilhaPage.js";
import { LessonPage } from "./pages/LessonPage.js";
import { LabPage } from "./pages/LabPage.js";
import { ReviewsPage } from "./pages/ReviewsPage.js";
import { QuizPage } from "./pages/QuizPage.js";
import { ExamPage } from "./pages/ExamPage.js";
import { GestorDashboard } from "./pages/GestorDashboard.js";

/** Rota protegida com a casca visual (header da marca) aplicada. */
function shell(element: ReactNode) {
  return (
    <ProtectedRoute>
      <AppShell>{element}</AppShell>
    </ProtectedRoute>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={shell(<CertificationsPage />)} />
        <Route path="/trilha/:slug" element={shell(<TrilhaPage />)} />
        <Route path="/licao/:id" element={shell(<LessonPage />)} />
        <Route path="/lab/:id" element={shell(<LabPage />)} />
        <Route path="/revisoes" element={shell(<ReviewsPage />)} />
        <Route path="/quiz" element={shell(<QuizPage />)} />
        <Route path="/simulado" element={shell(<ExamPage />)} />
        <Route path="/gestor" element={shell(<GestorDashboard />)} />
      </Routes>
    </AuthProvider>
  );
}
