import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Network,
  Mail,
  Lock,
  LogIn,
  Cable,
  Monitor,
  Wifi,
  ArrowLeft,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { toast } from "sonner";

export function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ NEW: role state
  const [role, setRole] = useState<"student" | "admin">(
    "student",
  );

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setLoading(false);

      toast.success(
        `Welcome back ${role === "admin" ? "Admin" : "Student"}!`,
      );

      // ✅ role-based navigation (even if admin page not ready yet)
      if (role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/dashboard");
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-gray-50 to-orange-50 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20">
          <Network className="w-32 h-32 text-blue-600" />
        </div>
        <div className="absolute top-40 right-40">
          <Cable className="w-24 h-24 text-orange-600" />
        </div>
        <div className="absolute bottom-20 left-1/3">
          <Monitor className="w-28 h-28 text-blue-600" />
        </div>
        <div className="absolute bottom-40 right-20">
          <Wifi className="w-36 h-36 text-orange-600" />
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 space-y-8">
          {/* Logo */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <Network className="w-7 h-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">
                NetSim
              </span>
            </div>

            <h2 className="text-2xl font-bold text-gray-900">
              Welcome Back
            </h2>
            <p className="text-gray-600">
              Sign in to continue your learning
            </p>

            {/* ✅ ROLE SELECTOR (NEW) */}
            <div className="flex gap-2 bg-gray-100 p-1 rounded-lg mt-4">
              <button
                type="button"
                onClick={() => setRole("student")}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
                  role === "student"
                    ? "bg-white text-blue-600 shadow"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Student
              </button>

              <button
                type="button"
                onClick={() => setRole("admin")}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
                  role === "admin"
                    ? "bg-white text-blue-600 shadow"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Admin
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="student@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 border-gray-300 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-gray-700"
              >
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11 border-gray-300 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) =>
                    setRememberMe(checked as boolean)
                  }
                />
                <Label
                  htmlFor="remember"
                  className="text-sm text-gray-600"
                >
                  Remember Me
                </Label>
              </div>

              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Forgot Password?
              </button>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Login
                </span>
              )}
            </Button>
          </form>

          {/* Signup */}
          <div className="text-center text-sm text-gray-600 border-t pt-6">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="text-blue-600 font-semibold"
            >
              Sign Up
            </Link>
          </div>

          {/* Back */}
          <div className="text-center pt-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-blue-600 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}