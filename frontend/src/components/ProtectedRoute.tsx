import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import type { JSX } from "react";
export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}
