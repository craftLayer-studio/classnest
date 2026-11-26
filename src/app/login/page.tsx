import { Login } from "@/components/public/Login";
import { DEMO } from "@/server/seed";
import { formatPhone } from "@/domain";

export const metadata = { title: "Staff sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const { demo } = await searchParams;
  return (
    <Login
      prefill={demo ? DEMO.owner.phone.slice(3) : ""}
      demoUsers={[
        { role: "Owner", name: DEMO.owner.name, phone: formatPhone(DEMO.owner.phone) },
        { role: "Front desk", name: DEMO.staff.name, phone: formatPhone(DEMO.staff.phone) },
        { role: "Teacher", name: DEMO.teacher.name, phone: formatPhone(DEMO.teacher.phone) },
      ]}
    />
  );
}
