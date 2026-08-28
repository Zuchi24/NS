import { RouterProvider } from "react-router";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { AuthProvider } from "@/features/auth/AuthContext";
import { router } from "@/routes/AppRoutes";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  return (
    <AuthProvider>
      <DndProvider backend={HTML5Backend}>
        <RouterProvider router={router} />
        <Toaster />
      </DndProvider>
    </AuthProvider>
  );
}
