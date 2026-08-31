import { Mail, Shield, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/useAuth";

/**
 * The signed-in instructor's own account, as the server holds it.
 *
 * Read-only. There is no endpoint for an admin to edit their profile, and a
 * form whose Save did nothing would be worse than none.
 */
export function AdminProfile() {
  const { user } = useAuth();

  if (!user) return null;

  const fields = [
    { label: "Full name", value: user.name },
    { label: "First name", value: user.firstName },
    { label: "Last name", value: user.lastName },
    { label: "Role", value: user.role === "admin" ? "Administrator" : "Student" },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-gray-600">Your account on this platform</p>
      </div>

      <Card className="border-gray-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">Account</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.label}>
                <p className="text-xs font-semibold text-gray-600">
                  {field.label}
                </p>
                <p className="text-gray-900 font-medium mt-0.5">
                  {field.value}
                </p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600">Email</p>
            <div className="flex items-center gap-2 text-gray-900 mt-0.5">
              <Mail className="w-4 h-4 text-gray-400" />
              <p className="font-medium">{user.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">Access</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-700">
            Instructor accounts can read every student&rsquo;s progress across
            all year levels and sections. The instructor endpoints are
            read-only: every figure they report is derived from students&rsquo;
            own attempts, so there is nothing on these pages to change.
          </p>
          <p className="text-sm text-gray-600">
            Changing your name, email or password is not available in the app
            yet.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
