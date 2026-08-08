import { createBrowserRouter } from "react-router-dom";
import { HomePage } from "@/pages/HomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { LaunchControlPage } from "@/pages/admin/LaunchControlPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
  {
    path: "/admin/launch",
    element: <LaunchControlPage />,
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
