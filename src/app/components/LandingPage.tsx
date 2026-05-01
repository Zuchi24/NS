import { Link, useNavigate } from "react-router";
import {
  Network,
  Monitor,
  Wifi,
  Cable,
  Target,
  TrendingUp,
  CheckCircle,
  BookOpen,
  Award,
  Users,
  Map,
  Wrench,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

export function LandingPage() {
  const navigate = useNavigate();

  const mainFeatures = [
    {
      icon: Target,
      title: "Challenges",
      description:
        "Practice your networking skills through real-world challenges and problem-solving activities.",
      path: "/challenges",
      gradient: "from-orange-500 to-orange-600",
    },
    {
      icon: Wrench,
      title: "Workspace",
      description:
        "Build and simulate network configurations using a drag-and-drop interactive environment similar to Tinkercad.",
      path: "/workspace",
      gradient: "from-blue-500 to-blue-600",
    },
    {
      icon: Map,
      title: "Roadmap",
      description:
        "Follow a structured learning path to master networking concepts step-by-step.",
      path: "/roadmap",
      gradient: "from-green-500 to-green-600",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Network className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">
                NetSim
              </span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a
                href="#home"
                className="text-gray-700 hover:text-blue-600 transition-colors"
              >
                Home
              </a>
              <a
                href="#features"
                className="text-gray-700 hover:text-blue-600 transition-colors"
              >
                Features
              </a>
              <a
                href="#about"
                className="text-gray-700 hover:text-blue-600 transition-colors"
              >
                About
              </a>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/login">
                <Button variant="ghost">Login</Button>
              </Link>
              <Link to="/signup">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Sign Up
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section
        id="home"
        className="bg-gradient-to-b from-blue-50 to-white py-20"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                Networking Simulation Platform for IT Students
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Master Networking Skills Through Interactive
                Simulation
              </h1>
              <p className="text-xl text-gray-600 leading-relaxed">
                A simulation-based learning platform for IT
                students to practice cable wiring, device
                connections, IP configuration, and networking
                challenges.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/signup">
                  <Button
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700 h-12 px-8 text-base"
                  >
                    Get Started
                  </Button>
                </Link>
                <Link to="/login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-8 text-base"
                  >
                    Login
                  </Button>
                </Link>
              </div>
              <div className="flex items-center gap-8 pt-4">
                <div>
                  <div className="text-3xl font-bold text-gray-900">
                    16
                  </div>
                  <div className="text-sm text-gray-600">
                    Learning Topics
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-900">
                    6
                  </div>
                  <div className="text-sm text-gray-600">
                    Challenges
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-900">
                    100%
                  </div>
                  <div className="text-sm text-gray-600">
                    Interactive
                  </div>
                </div>
              </div>
            </div>

            {/* Illustration */}
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-200">
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold text-gray-600">
                      Simulation Workspace
                    </span>
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-3 flex justify-center gap-6">
                      <div className="bg-blue-100 p-4 rounded-xl">
                        <Monitor className="w-8 h-8 text-blue-600" />
                      </div>
                      <div className="bg-orange-100 p-4 rounded-xl">
                        <Wifi className="w-8 h-8 text-orange-600" />
                      </div>
                      <div className="bg-blue-100 p-4 rounded-xl">
                        <Monitor className="w-8 h-8 text-blue-600" />
                      </div>
                    </div>
                    <div className="col-span-3 flex justify-center">
                      <Cable className="w-16 h-16 text-gray-400" />
                    </div>
                    <div className="col-span-3 flex justify-center gap-6">
                      <div className="bg-orange-100 p-4 rounded-xl">
                        <Network className="w-8 h-8 text-orange-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-gray-700">
                        Drag and drop devices
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-gray-700">
                        Connect cables
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-gray-700">
                        Configure IP addresses
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Master Networking
            </h2>
            <p className="text-xl text-gray-600">
              Explore our three core learning features
            </p>
          </div>

          <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
            {mainFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={index}
                  onClick={() => navigate(feature.path)}
                  className="border-2 border-gray-100 hover:border-blue-400 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 cursor-pointer group"
                >
                  <CardContent className="p-8 space-y-4 text-center">
                    <div
                      className={`w-20 h-20 bg-gradient-to-br ${feature.gradient} rounded-full flex items-center justify-center mx-auto shadow-lg group-hover:scale-110 transition-transform duration-300`}
                    >
                      <Icon className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {feature.description}
                    </p>
                    <div className="pt-2">
                      <div className="inline-flex items-center gap-2 text-blue-600 font-semibold group-hover:gap-3 transition-all">
                        Explore
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-4xl font-bold text-gray-900">
                Built for IT Students and Educators
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                NetSim provides a structured, simulation-based
                learning environment that helps IT students
                develop practical networking skills through
                hands-on practice.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">
                      Visual Learning
                    </div>
                    <div className="text-gray-600">
                      Interactive workspace with drag-and-drop
                      interface
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">
                      Structured Activities
                    </div>
                    <div className="text-gray-600">
                      Guided simulations with step-by-step
                      instructions
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">
                      Performance Evaluation
                    </div>
                    <div className="text-gray-600">
                      Track progress and get feedback from
                      instructors
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
              <div className="space-y-4">
                <div className="text-center py-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                  <div className="text-5xl font-bold text-blue-600 mb-2">
                    3
                  </div>
                  <div className="text-gray-700 font-semibold">
                    Core Learning Features
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center py-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      6
                    </div>
                    <div className="text-sm text-gray-700 font-medium">
                      Challenges
                    </div>
                  </div>
                  <div className="text-center py-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      16
                    </div>
                    <div className="text-sm text-gray-700 font-medium">
                      Topics
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
          <h2 className="text-4xl font-bold text-white">
            Ready to Start Your Networking Journey?
          </h2>
          <p className="text-xl text-blue-100">
            Master networking through Challenges, Workspace, and
            Roadmap - all in one platform
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/signup">
              <Button
                size="lg"
                className="bg-white border-2 border-white text-blue-600 hover:bg-blue-700 hover:text-black h-12 px-8 text-base shadow-lg"
              >
                Create Free Account
              </Button>
            </Link>
            <Link to="/login">
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-white text-blue-600 hover:bg-blue-700 h-12 px-8 text-base shadow-lg"
              >
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Network className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-white">
                  NetSim
                </span>
              </div>
              <p className="text-sm">
                Networking simulation platform for IT students
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">
                Platform
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    to="/challenges"
                    className="hover:text-white transition-colors"
                  >
                    Challenges
                  </Link>
                </li>
                <li>
                  <Link
                    to="/workspace"
                    className="hover:text-white transition-colors"
                  >
                    Workspace
                  </Link>
                </li>
                <li>
                  <Link
                    to="/roadmap"
                    className="hover:text-white transition-colors"
                  >
                    Roadmap
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">
                Support
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#"
                    className="hover:text-white transition-colors"
                  >
                    Documentation
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-white transition-colors"
                  >
                    Help Center
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-white transition-colors"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">
                Legal
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#"
                    className="hover:text-white transition-colors"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-white transition-colors"
                  >
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            <p>&copy; 2026 NetSim. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}