import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  Network,
  Mail,
  Lock,
  LogIn,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/useAuth";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const [role, setRole] = useState<"student" | "admin">("student");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);

    try {
      const user = await login({ email, password, role });
      toast.success(`Welcome back ${user.name || (role === "admin" ? "Admin" : "Student")}!`);

      // Return the user to wherever a route guard interrupted them, if anywhere.
      const from = (location.state as { from?: string } | null)?.from;
      const home = role === "admin" ? "/admin/dashboard" : "/dashboard";
      navigate(from ?? home, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
          {/* Logo */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <Network className="w-7 h-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">NetSim</span>
            </div>

            <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
            <p className="text-gray-600">Sign in to continue your learning</p>

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
                  placeholder="gfdfdd@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 border-gray-300 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700">
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
                <Label htmlFor="remember" className="text-sm text-gray-600">
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
            <Link to="/signup" className="text-blue-600 font-semibold">
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
  );
}
