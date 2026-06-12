import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { LoginPage } from "./pages/LoginPage.js";
import { TrilhaPage } from "./pages/TrilhaPage.js";
import { LessonPage } from "./pages/LessonPage.js";
import { ReviewsPage } from "./pages/ReviewsPage.js";
import { QuizPage } from "./pages/QuizPage.js";
import { ExamPage } from "./pages/ExamPage.js";
import { GestorDashboard } from "./pages/GestorDashboard.js";
export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><TrilhaPage /></ProtectedRoute>} />
        <Route path="/licao/:id" element={<ProtectedRoute><LessonPage /></ProtectedRoute>} />
        <Route path="/revisoes" element={<ProtectedRoute><ReviewsPage /></ProtectedRoute>} />
        <Route path="/quiz" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
        <Route path="/simulado" element={<ProtectedRoute><ExamPage /></ProtectedRoute>} />
        <Route path="/gestor" element={<ProtectedRoute><GestorDashboard /></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  );
}
