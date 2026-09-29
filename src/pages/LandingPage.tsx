import { Link } from "react-router";
import {
  BookOpen,
  Cable,
  CheckCircle,
  Cpu,
  Map,
  Target,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrandLogo } from "@/components/common/BrandLogo";
import { fetchPublicSummary } from "@/features/content/publicSummary";
import { useAsync } from "@/services/useAsync";

/** Stages of the PC-assembly activity, shown as a progression in the hero. */
const buildStages = [
  { src: "/pc-case.webp", label: "Empty case" },
  { src: "/build-state-0.webp", label: "Motherboard" },
  { src: "/build-state-3.webp", label: "Memory" },
  { src: "/build-state-7.webp", label: "Complete" },
];

/** The beginner path, in the order a student meets it. */
const learningPath = [
  { icon: BookOpen, title: "Learn", text: "Networking basics and key terms" },
  { icon: Cpu, title: "Explore Components", text: "Know what each part does" },
  { icon: Wrench, title: "Build", text: "Assemble a PC step by step" },
  { icon: Cable, title: "Connect", text: "Wire cables and link devices" },
  { icon: Target, title: "Practice", text: "Apply it in interactive challenges" },
];

const mainFeatures = [
  {
    icon: Map,
    title: "Learn",
    description:
      "Follow a structured roadmap through basic networking concepts and foundational terminology, one step at a time.",
    path: "/roadmap",
    iconClass: "bg-primary",
  },
  {
    icon: Wrench,
    title: "Build & Connect",
    description:
      "Work with computer hardware, cables, and simple network connections in a hands-on, drag-and-drop workspace.",
    path: "/workspace",
    iconClass: "bg-brand-orange",
  },
  {
    icon: Target,
    title: "Practice",
    description:
      "Apply what you learned through interactive challenges such as PC assembly, motherboard labeling, and cable wiring.",
    path: "/challenges",
    iconClass: "bg-brand-teal-dark",
  },
];

const aboutPoints = [
  {
    title: "Hands-on Learning",
    text: "Interactive activities with hardware, cables, and simple networks",
  },
  {
    title: "Beginner Friendly",
    text: "Start with the basics and build up gradually",
  },
  {
    title: "Structured Activities",
    text: "Guided activities with step-by-step instructions",
  },
];

const practiceAreas = [
  "Networking basics",
  "Computer and network components",
  "PC assembly",
  "Motherboard identification",
  "RJ45 cable wiring",
  "Simple network topology",
];

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function LandingPage() {
  // The catalogue's size, read from the API. Until it arrives, and if it never
  // does, the page says nothing about it rather than showing a number that may
  // be out of date.
  const { data: summary, loading: summaryLoading } = useAsync(fetchPublicSummary);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav
        aria-label="Primary"
        className="bg-white border-b border-border sticky top-0 z-50"
      >
        <div className="max-w-8xl mx-auto px-6 md:px-10">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center">
              <BrandLogo className="h-8" />
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a
                href="#home"
                className="py-2 text-foreground/80 hover:text-primary transition-colors"
              >
                Home
              </a>
              <a
                href="#features"
                className="py-2 text-foreground/80 hover:text-primary transition-colors"
              >
                Features
              </a>
              <a
                href="#about"
                className="py-2 text-foreground/80 hover:text-primary transition-colors"
              >
                About
              </a>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Button asChild variant="ghost" className="h-11 md:h-9">
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild className="h-11 md:h-9">
                <Link to="/signup">Sign Up</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section
          id="home"
          className="scroll-mt-14 bg-gradient-to-b from-accent to-white py-10 md:py-16"
        >
          <div className="max-w-8xl mx-auto px-6 md:px-10">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
              <div className="space-y-5 md:space-y-6 max-w-2xl">
                <div className="inline-block px-4 py-2 bg-brand-teal-light text-brand-teal-dark rounded-full text-sm font-semibold">
                  Networking Simulation Platform for IT Students
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                  Learn Networking by Building and Doing
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                  NetSim helps IT students build foundational networking skills
                  through interactive lessons, computer hardware activities,
                  cable wiring, and hands-on network simulations.
                </p>
                <div className="flex flex-wrap gap-3 md:gap-4">
                  <Button asChild size="lg" className="h-12 px-8 text-base">
                    <Link to="/signup">Get Started</Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="h-12 px-8 text-base"
                  >
                    <Link to="/login">Login</Link>
                  </Button>
                </div>
                <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-sm font-medium text-foreground/80">
                  {["Beginner-friendly", "Hands-on activities", "Interactive challenges"].map(
                    (item) => (
                      <li key={item} className="flex items-center gap-2">
                        <CheckCircle
                          className="h-4 w-4 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                        {item}
                      </li>
                    ),
                  )}
                </ul>
              </div>

              {/* Illustration: decorative, the text around it says the same */}
              <div
                aria-hidden="true"
                className="relative mx-auto w-full max-w-[34rem] lg:max-w-none"
              >
                <div className="relative overflow-hidden rounded-3xl border border-border bg-white p-4 shadow-sm shadow-slate-900/5 sm:p-6">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-teal via-transparent to-brand-orange opacity-60" />

                  <div className="relative space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-muted-foreground">
                        Build &amp; Connect
                      </span>
                      <span className="rounded-full bg-brand-orange-light px-2.5 py-1 text-xs font-semibold text-brand-orange-dark">
                        PC assembly
                      </span>
                    </div>

                    <div className="overflow-hidden rounded-2xl bg-muted ring-1 ring-border">
                      <img
                        src="/build-state-7.webp"
                        alt=""
                        width={1408}
                        height={768}
                        className="aspect-[16/10] w-full object-cover"
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-2 sm:gap-3">
                      {buildStages.map((stage, index) => (
                        <div key={stage.src} className="space-y-1.5">
                          <div className="overflow-hidden rounded-lg bg-muted ring-1 ring-border">
                            <img
                              src={stage.src}
                              alt=""
                              width={1408}
                              height={768}
                              loading="lazy"
                              className="aspect-[4/3] w-full object-cover"
                            />
                          </div>
                          <div className="text-[11px] leading-tight text-muted-foreground sm:text-xs">
                            <span className="font-semibold text-primary">
                              {index + 1}.
                            </span>{" "}
                            {stage.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="scroll-mt-14 py-16 md:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-10 md:mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Learn the Basics by Doing Them
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground">
                Start with the fundamentals, then build, connect, and practice
              </p>
              <p
                aria-busy={summaryLoading}
                className="mt-3 min-h-6 text-sm font-medium text-primary"
              >
                {summary
                  ? `${plural(summary.topics, "topic", "topics")} and ${plural(summary.challenges, "interactive challenge", "interactive challenges")} to work through`
                  : null}
              </p>
            </div>

            <ol className="max-w-6xl mx-auto mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
              {learningPath.map((step, index) => {
                const Icon = step.icon;
                return (
                  <li
                    key={step.title}
                    className="flex items-start gap-3 rounded-xl border border-border bg-muted/50 p-4 md:flex-col md:gap-2"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-teal-light text-brand-teal-dark">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">
                        <span className="text-primary">{index + 1}.</span>{" "}
                        {step.title}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {step.text}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6 md:gap-8">
              {mainFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Link
                    key={feature.title}
                    to={feature.path}
                    className="group block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <Card className="h-full border-2 border-border group-hover:border-primary group-hover:shadow-xl group-hover:-translate-y-1 transition-all duration-300 motion-reduce:transition-none motion-reduce:transform-none">
                      <CardContent className="p-8 space-y-4 text-center">
                        <div
                          className={`w-20 h-20 ${feature.iconClass} rounded-full flex items-center justify-center mx-auto shadow-md`}
                        >
                          <Icon
                            className="w-10 h-10 text-white"
                            aria-hidden="true"
                          />
                        </div>
                        <h3 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                          {feature.title}
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                          {feature.description}
                        </p>
                        <div className="pt-2">
                          <div className="inline-flex items-center gap-2 text-primary font-semibold group-hover:gap-3 transition-all">
                            Explore
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              aria-hidden="true"
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
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="scroll-mt-14 py-16 md:py-20 bg-muted/60">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
              <div className="space-y-6">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                  Built for IT Students Just Starting Out
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  NetSim gives IT students a structured, hands-on place to learn
                  foundational networking and computer hardware concepts by
                  actually doing the activities.
                </p>
                <div className="space-y-4">
                  {aboutPoints.map((point) => (
                    <div key={point.title} className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <CheckCircle
                          className="w-4 h-4 text-white"
                          aria-hidden="true"
                        />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">
                          {point.title}
                        </div>
                        <div className="text-muted-foreground">{point.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm shadow-slate-900/5 p-6 md:p-8 border border-border">
                <h3 className="mb-4 text-lg font-semibold text-foreground">
                  What you will practice
                </h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {practiceAreas.map((area, index) => (
                    <li
                      key={area}
                      className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium ${
                        index === 2
                          ? "bg-brand-orange-light text-brand-orange-dark"
                          : "bg-accent text-brand-teal-dark"
                      }`}
                    >
                      <CheckCircle
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      {area}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 md:py-20 bg-brand-teal-dark">
          <div className="max-w-4xl mx-auto px-6 text-center space-y-6 md:space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Ready to Start Learning?
            </h2>
            <p className="text-lg md:text-xl text-brand-teal-light">
              Learn the basics, build, connect, and practice, all in one
              platform.
            </p>
            <div className="flex flex-wrap gap-3 md:gap-4 justify-center">
              <Button
                asChild
                size="lg"
                className="bg-white text-brand-teal-dark hover:bg-brand-teal-light h-12 px-8 text-base shadow-none"
              >
                <Link to="/signup">Create Free Account</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-2 border-white bg-transparent text-white hover:bg-white/10 hover:text-white h-12 px-8 text-base shadow-none"
              >
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

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
              <div className="flex items-center mb-4">
                <BrandLogo variant="dark" className="h-12" />
              </div>
              <p className="text-sm">
                Networking simulation platform for IT students
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Platform</h4>
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
