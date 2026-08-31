import { IdCard, Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
      <Card className="hover:shadow-xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm overflow-hidden mx-auto max-w-2xl">
        <CardHeader className="relative pb-4 pt-8">
          <div className="flex flex-col items-center space-y-6">
            <Avatar className="w-36 h-36 border-4 border-white shadow-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 ring-4 ring-white/50">
              <AvatarFallback className="text-5xl font-black text-blue-600 bg-gradient-to-br from-blue-500/20">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-center space-y-3">
              <CardTitle className="text-3xl lg:text-4xl font-black bg-gradient-to-r from-gray-900 via-gray-800 to-slate-900 bg-clip-text text-transparent drop-shadow-lg">
                {user.name}
              </CardTitle>
              {user.section && (
                <div className="flex flex-wrap gap-3 items-center justify-center">
                  <div className="px-4 py-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-800 rounded-2xl text-sm font-semibold shadow-sm ring-1 ring-indigo-200/50 backdrop-blur-sm">
                    {user.section.yearLevel} &middot; {user.section.name}
                  </div>
                </div>
              )}
              <Badge className="text-base px-6 py-2.5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-800 border border-emerald-200/50 shadow-lg font-semibold tracking-wide">
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
              <IdCard className="h-6 w-6 text-blue-600" />
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
                  Editing your profile is not available yet
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
    </div>
  );
}
