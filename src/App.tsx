import { lazy, Suspense } from "react";
import { Toaster } from "sonner";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

const LoginPage = lazy(() => import("@/pages/LoginPage"));
const PdfUploadPage = lazy(() => import("@/pages/PdfUploadPage"));
const PdfViewerPage = lazy(() => import("@/pages/PdfViewerPage"));

const Spinner = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (role !== "admin") return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function LoginGuard({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user && role === "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-center" richColors />
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/login" element={<LoginGuard><LoginPage /></LoginGuard>} />
            <Route path="/viewer/:id" element={<PdfViewerPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <PdfUploadPage />
                </ProtectedRoute>
              }
            />
            <Route path="/index" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
