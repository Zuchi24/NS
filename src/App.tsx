import { RouterProvider } from "react-router";
import { AuthProvider } from "@/features/auth/AuthContext";
import { router } from "@/routes/AppRoutes";
import { Toaster } from "@/components/ui/sonner";

/**
 * The app shell: authentication, the router, and notifications.
 *
 * No DndProvider. Drag-and-drop is used by exactly three pages — the workspace
 * canvas and the two bespoke simulators — and each of them now mounts its own,
 * so react-dnd is fetched with the canvas that needs it instead of by everyone
 * who signs in. Mounting it here also meant two HTML5 backends were live at
 * once whenever the computer-assembly page was open, since that page has always
 * had a provider of its own.
 */
export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster />
    </AuthProvider>
  );
}
