import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { LoginPage } from "./pages/LoginPage.js";
import { TrilhaPage } from "./pages/TrilhaPage.js";
import { LessonPage } from "./pages/LessonPage.js";
export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><TrilhaPage /></ProtectedRoute>} />
        <Route path="/licao/:id" element={<ProtectedRoute><LessonPage /></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  );
}
