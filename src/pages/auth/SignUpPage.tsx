import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Network,
  Mail,
  Lock,
  UserPlus,
  IdCard,
  ArrowLeft,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/useAuth";
import { fetchSections } from "@/features/auth/authService";
import type { YearLevelOptions } from "@/features/auth/types";

export function SignUpPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [lastName, setLastName] = useState("");
  const [nameExtension, setNameExtension] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  /*
   * The section the student is enrolling into.
   *
   * Held as the option's own id, never as typed text: the list comes from the
   * server and the server checks the id against it again, so there is no way
   * to enrol into a section that does not exist or has been closed.
   *
   * It is asked for because every instructor view is organised by section — a
   * roster, a cohort head count, a year-level breakdown. An account without
   * one is an account no instructor can find.
   */
  const [yearLevels, setYearLevels] = useState<YearLevelOptions[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [sectionsError, setSectionsError] = useState(false);

  useEffect(() => {
    let active = true;

    fetchSections()
      .then((data) => {
        if (active) setYearLevels(data);
      })
      .catch(() => {
        // The form stays usable and says what is wrong rather than silently
        // offering an empty list.
        if (active) setSectionsError(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!sectionId) {
      toast.error("Please choose your year level and section");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      await signup({
        firstName,
        middleInitial,
        lastName,
        nameExtension,
        studentId,
        email,
        password,
        passwordConfirmation: confirmPassword,
        sectionId: Number(sectionId),
      });
      toast.success("Account created successfully!");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
          {/* Logo */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <Network className="w-7 h-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">NetSim</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Create Account</h2>
            <p className="text-gray-600">Join NetSim to start learning</p>
          </div>

          {/* Sign Up Form */}
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-700">Full Name</Label>
              <div className="grid grid-cols-8 gap-3">
                {/* First Name - wider */}
                <div className="col-span-3">
                  <Input
                    type="text"
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="h-11 bg-gray-100 border-gray-300 focus:border-blue-500"
                  />
                </div>
                {/* Middle Initial - smaller */}
                <div className="col-span-1">
                  <Input
                    type="text"
                    placeholder="M.I."
                    maxLength={1}
                    value={middleInitial}
                    onChange={(e) => setMiddleInitial(e.target.value)}
                    className="h-11 bg-gray-100 border-gray-300 focus:border-blue-500"
                  />
                </div>
                {/* Last Name - wider */}
                <div className="col-span-3">
                  <Input
                    type="text"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="h-11 bg-gray-100 border-gray-300 focus:border-blue-500"
                  />
                </div>
                {/* Name Extension - smaller */}
                <div className="col-span-1">
                  <Input
                    type="text"
                    placeholder="Ext."
                    maxLength={5}
                    value={nameExtension}
                    onChange={(e) => setNameExtension(e.target.value)}
                    className="h-11 bg-gray-100 border-gray-300 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="studentId" className="text-gray-700">
                Student ID{" "}
                <span className="text-gray-400 text-xs">(required)</span>
              </Label>
              <div className="relative">
                <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="studentId"
                  type="text"
                  placeholder="202*******"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="pl-10 h-11 border-gray-300 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sectionId" className="text-gray-700">
                Year Level and Section
              </Label>
              <div className="relative">
                <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <select
                  id="sectionId"
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                  disabled={sectionsError || yearLevels.length === 0}
                  className="w-full pl-10 h-11 rounded-md border border-gray-300 bg-white text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">
                    {sectionsError
                      ? "Could not load sections"
                      : yearLevels.length === 0
                        ? "Loading sections…"
                        : "Select your section"}
                  </option>
                  {/* Grouped by year level, which is where a section gets its
                      year from — so choosing one settles both. */}
                  {yearLevels.map((yearLevel) => (
                    <optgroup key={yearLevel.id} label={yearLevel.name}>
                      {yearLevel.sections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {sectionsError && (
                <p className="text-xs text-red-600">
                  We could not load the section list. Refresh the page to try
                  again.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="user@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 border-gray-300 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11 border-gray-300 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-gray-700">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 h-11 border-gray-300 focus:border-blue-500"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium mt-6"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Create Account
                </span>
              )}
            </Button>
          </form>

          {/* Login Link */}
          <div className="text-center text-sm text-gray-600 border-t pt-6">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-blue-600 font-semibold hover:text-blue-700"
            >
              Sign In
            </Link>
          </div>

          {/* Back to Home */}
          <div className="text-center pt-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
    </div>
  );
}
