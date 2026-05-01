import { RouterProvider } from "react-router";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { router } from "./routes";
import { Toaster } from "./components/ui/sonner";

export default function App() {
  return (
    <DndProvider backend={HTML5Backend}>
      <RouterProvider router={router} />
      <Toaster />
    </DndProvider>
  );
}
