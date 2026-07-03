import { createFileRoute, Navigate, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";

  if (normalizedPath === "/admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Outlet />;
}
