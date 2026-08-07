import { AdminMfaGate } from "@/components/admin/AdminMfaGate";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminMfaGate>
      <AdminShell>{children}</AdminShell>
    </AdminMfaGate>
  );
}
