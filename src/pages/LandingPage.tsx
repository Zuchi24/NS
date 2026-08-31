import { Link, useNavigate } from "react-router";
import {
  Network,
  Monitor,
  Wifi,
  Target,
  CheckCircle,
  Map,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const topologyNodeVariants = {
  primary: "bg-blue-600 text-white",
  blue: "bg-blue-100 text-blue-600",
  orange: "bg-orange-100 text-orange-600",
  slate: "bg-slate-100 text-slate-700",
  sky: "bg-sky-100 text-sky-600",
} as const;

function TopologyNode({
  icon: Icon,
  variant,
  label,
  name,
  meta,
}: {
  icon: LucideIcon;
  variant: keyof typeof topologyNodeVariants;
  label: string;
  name: string;
  meta: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 flex items-center gap-2.5">
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${topologyNodeVariants[variant]}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">
            {name}
          </div>
          <div className="truncate text-[11px] text-slate-500">{meta}</div>
        </div>
      </div>
    </div>
  );
}

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
        <div className="max-w-8xl mx-auto px-6 md:px-10">
          <div className="flex items-center justify-between h-14">
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
        className="bg-gradient-to-b from-blue-50 to-white py-16"
      >
        <div className="max-w-8xl mx-auto px-6 md:px-10">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="space-y-6 max-w-2xl">
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
            <div className="relative mx-auto w-full max-w-[34rem] lg:max-w-none">
              <div className="absolute -top-6 -left-6 hidden lg:block">
                <div className="w-24 h-24 rounded-full bg-blue-100/75 blur-2xl" />
              </div>
              <div className="absolute -bottom-8 right-4 hidden lg:block">
                <div className="w-28 h-28 rounded-full bg-sky-100/65 blur-2xl" />
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-4 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.15)] sm:p-6 xl:rounded-[2rem] xl:p-7">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-300 via-transparent to-blue-300 opacity-40" />

                <div className="relative space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-600">
                      Simulation Workspace
                    </span>
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
                      <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm" />
                      <div className="w-3 h-3 rounded-full bg-gray-300 shadow-sm" />
                    </div>
                  </div>

                  <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(210px,240px)]">
                    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-blue-100 sm:p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 sm:text-xs">
                          Live topology
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                          <span className="text-xs text-slate-500">Online</span>
                        </div>
                      </div>

                      <div className="relative">
                        <svg
                          className="pointer-events-none absolute inset-0 h-full w-full"
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M25 15 L50 50 L75 15 M50 50 L25 85 M50 50 L75 85"
                            fill="none"
                            stroke="#bfdbfe"
                            strokeWidth="1"
                            vectorEffect="non-scaling-stroke"
                          />
                        </svg>

                        <div className="relative grid grid-cols-2 gap-x-6 gap-y-6 sm:gap-x-10">
                          <TopologyNode
                            icon={Network}
                            variant="primary"
                            label="Router"
                            name="R1"
                            meta="192.168.1.1"
                          />
                          <TopologyNode
                            icon={Wifi}
                            variant="orange"
                            label="Wi-Fi"
                            name="AP1"
                            meta="192.168.1.10"
                          />
                          <div className="col-span-2 flex justify-center">
                            <div className="w-[calc(50%-0.75rem)] sm:w-[calc(50%-1.25rem)]">
                              <TopologyNode
                                icon={Network}
                                variant="blue"
                                label="Switch"
                                name="SW1"
                                meta="24 ports"
                              />
                            </div>
                          </div>
                          <TopologyNode
                            icon={Monitor}
                            variant="slate"
                            label="Workstation"
                            name="PC1"
                            meta="192.168.1.21"
                          />
                          <TopologyNode
                            icon={Monitor}
                            variant="sky"
                            label="Server"
                            name="SVR"
                            meta="10.0.0.5"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-100 sm:p-5">
                      <div className="text-sm font-semibold text-slate-900">
                        Active devices
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between text-sm text-slate-700">
                            <span>Router</span>
                            <span className="font-semibold text-emerald-600">
                              Online
                            </span>
                          </div>
                          <div className="mt-1.5 text-xs text-slate-500">
                            192.168.1.1 · VLAN 10
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between text-sm text-slate-700">
                            <span>Switch</span>
                            <span className="text-slate-500">Stable</span>
                          </div>
                          <div className="mt-1.5 text-xs text-slate-500">
                            24 ports · 12 active
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:col-span-2 2xl:col-span-1">
                          <div className="flex items-center justify-between text-sm text-slate-700">
                            <span>Wi-Fi</span>
                            <span className="text-orange-600">2.4 GHz</span>
                          </div>
                          <div className="mt-1.5 text-xs text-slate-500">
                            Clients connected: 8
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2.5 rounded-xl bg-gray-50 p-4 sm:grid-cols-3 2xl:grid-cols-1">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span>Drag and drop devices</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span>Connect cables across devices</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span>Configure IP addresses quickly</span>
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
          {/* "Support" and "Legal" columns stood here. Every link in them
              was href="#": there is no documentation, help centre, contact
              route, privacy policy or terms of service to point at, and a
              footer that claims a privacy policy it does not have is the
              worst kind of dead link. */}
          <div className="grid md:grid-cols-2 gap-8">
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
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            <p>&copy; 2026 NetSim. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}