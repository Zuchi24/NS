import { IdCard, Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChangePasswordCard } from "@/features/auth/ChangePasswordCard";
import { useAuth } from "@/features/auth/useAuth";
import { shortDate } from "@/services/time";

/**
 * The student's own account, exactly as the server holds it.
 *
 * Read-only, and deliberately short. The platform records a name, a student
 * id, an email, a section and the date the account was opened — so those are
 * the fields here. It holds no birth date, age or gender, and this page would
 * rather be brief than fill itself in.
 */
export function UserProfile() {
  const { user } = useAuth();

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const fields = [
    { label: "Email", value: user.email },
    { label: "Student ID", value: user.studentId ?? "Not set" },
    { label: "First Name", value: user.firstName },
    { label: "Last Name", value: user.lastName },
    {
      label: "Year Level",
      value: user.section?.yearLevel ?? "Not assigned",
    },
    { label: "Section", value: user.section?.name ?? "Not assigned" },
    { label: "Joined", value: shortDate(user.joinedAt) },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Identity Section - Top Card */}
      <Card className="border border-border bg-white shadow-sm overflow-hidden mx-auto max-w-2xl">
        <CardHeader className="relative pb-4 pt-8">
          <div className="flex flex-col items-center space-y-6">
            <Avatar className="w-36 h-36 border-4 border-white shadow-md bg-accent ring-4 ring-brand-teal/20">
              <AvatarFallback className="text-5xl font-black text-primary bg-accent">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-center space-y-3">
              <CardTitle className="text-3xl lg:text-4xl font-black text-foreground">
                {user.name}
              </CardTitle>
              {user.section && (
                <div className="flex flex-wrap gap-3 items-center justify-center">
                  <div className="px-4 py-2 bg-accent text-accent-foreground rounded-2xl text-sm font-semibold ring-1 ring-brand-teal/25">
                    {user.section.yearLevel} &middot; {user.section.name}
                  </div>
                </div>
              )}
              <Badge className="text-base px-6 py-2.5 bg-brand-orange-light text-brand-orange-dark border border-brand-orange/30 shadow-sm font-semibold tracking-wide">
                {user.role.toUpperCase()}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="flex justify-center">
        {/* Personal Information Card - Centered */}
        <Card className="border-0 bg-white shadow-md w-full max-w-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-2xl font-semibold text-gray-900">
              <IdCard className="h-6 w-6 text-primary" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map((field) => (
                <div key={field.label}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {field.label}
                  </p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {field.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-dashed border-gray-300 p-4">
              <Info className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Editing these details is not available yet
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  These details come from your account on the server. Ask your
                  instructor to correct anything that is wrong.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <div className="w-full max-w-2xl">
          <ChangePasswordCard />
        </div>
      </div>
    </div>
  );
}
