import { Link } from "react-router";
import { BookOpen, Cable, Cpu, Target, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/common/BrandLogo";
import { fetchPublicSummary } from "@/features/content/publicSummary";
import { useAsync } from "@/services/useAsync";
import { ActivityShowcase } from "./landing/ActivityShowcase";
import { LandingHero } from "./landing/LandingHero";
import { LandingNav } from "./landing/LandingNav";

/** The beginner path, in the order a student meets it. */
const learningPath = [
  { icon: BookOpen, title: "Learn", text: "Networking basics and key terms" },
  { icon: Cpu, title: "Explore Components", text: "Know what each part does" },
  { icon: Wrench, title: "Build", text: "Assemble a PC step by step" },
  { icon: Cable, title: "Connect", text: "Wire cables and link devices" },
  { icon: Target, title: "Practice", text: "Apply it in interactive challenges" },
];

export function LandingPage() {
  // The catalogue's size, read from the API. Until it arrives, and if it never
  // does, the page says nothing about it rather than showing a number that may
  // be out of date.
  const { data: summary, loading: summaryLoading } = useAsync(fetchPublicSummary);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav />

      <main>
        <LandingHero summary={summary} loading={summaryLoading} />

        {/* Features Section */}
        <section id="features" className="scroll-mt-14 py-16 md:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-10 md:mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Learn the Basics by Doing Them
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground">
                Five steps, from your first networking term to your first
                working cable
              </p>
            </div>

            {/* The path as one connected line: down the left edge on a
                phone, across the page from md up. */}
            <ol className="relative max-w-6xl mx-auto grid grid-cols-1 gap-6 md:grid-cols-5 md:gap-4">
              <div
                aria-hidden="true"
                className="absolute left-6 top-6 bottom-6 w-0.5 bg-brand-teal-light md:left-[10%] md:right-[10%] md:top-6 md:bottom-auto md:h-0.5 md:w-auto"
              />
              {learningPath.map((step, index) => {
                const Icon = step.icon;
                return (
                  <li
                    key={step.title}
                    className="relative flex items-start gap-4 md:flex-col md:items-center md:gap-3 md:text-center"
                  >
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-white">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="pt-1 md:pt-0">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-orange-dark">
                        Step {index + 1}
                      </div>
                      <div className="font-semibold text-foreground">
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

            <div className="mt-14 md:mt-16">
              <h3 className="mb-6 text-center text-2xl font-bold text-foreground md:mb-8">
                See It in Action
              </h3>
              <ActivityShowcase />
            </div>
          </div>
        </section>

        {/* About Section: who NetSim is for. The activities themselves are
            shown in the features above, so they are not listed again here. */}
        <section id="about" className="scroll-mt-14 py-16 md:py-20 bg-muted/60">
          <div className="max-w-3xl mx-auto px-6 text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Built for IT Students Just Starting Out
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Developed for the Information Technology program at Bulacan
              Agricultural State College (BASC), NetSim gives IT students a
              structured, hands-on place to learn foundational networking and
              computer hardware concepts by actually doing the activities.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              No prior experience needed. Every activity comes with
              step-by-step guidance, so you can start from zero and build up at
              your own pace.
            </p>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 md:py-20 bg-brand-teal-dark">
          <div className="max-w-4xl mx-auto px-6 text-center space-y-6 md:space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Ready to Start Learning?
            </h2>
            <p className="text-lg md:text-xl text-brand-teal-light">
              Create a free account and start with your first topic today.
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
                Networking simulation platform for BASC IT students
              </p>
            </div>
            <div>
              {/* Only pages a visitor can open: the roadmap, workspace and
                  challenges sit behind sign-in, so linking them here just
                  bounced visitors to the login page. */}
              <h4 className="font-semibold text-white mb-4">Explore</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#features" className="hover:text-white transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#about" className="hover:text-white transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <Link to="/signup" className="hover:text-white transition-colors">
                    Create an account
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
