import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/common/BrandLogo";

/** How far down the page the bar turns solid, in pixels. */
const SOLID_AFTER = 16;

const sections = [
  { href: "#home", label: "Home" },
  { href: "#features", label: "Features" },
  { href: "#about", label: "About" },
];

/**
 * The landing page's navigation: see-through over the hero photo at the top of
 * the page, as in the reference design, and a solid white bar once the page
 * scrolls, so it stays readable over the white sections below.
 *
 * It is fixed rather than sticky so the photo runs up behind it; the hero
 * leaves room for it at its top.
 */
export function LandingNav() {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const update = () => setSolid(window.scrollY > SOLID_AFTER);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <nav
      aria-label="Primary"
      data-solid={solid}
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 motion-reduce:transition-none ${
        solid ? "border-border bg-white shadow-sm" : "border-transparent bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          {/* Both logos are always there, one faded out, so the swap is a
              crossfade rather than a flash while the other file loads. */}
          <div className="grid">
            <span
              aria-hidden={!solid}
              className={`[grid-area:1/1] transition-opacity duration-300 motion-reduce:transition-none ${solid ? "opacity-100" : "opacity-0"}`}
            >
              <BrandLogo className="h-8" />
            </span>
            <span
              aria-hidden={solid}
              className={`[grid-area:1/1] transition-opacity duration-300 motion-reduce:transition-none ${solid ? "opacity-0" : "opacity-100"}`}
            >
              <BrandLogo variant="wordmarkDark" className="h-8" />
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {sections.map((section) => (
              <a
                key={section.href}
                href={section.href}
                className={`py-2 transition-colors ${
                  solid ? "text-foreground/80 hover:text-primary" : "text-white/85 hover:text-white"
                }`}
              >
                {section.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              asChild
              variant="ghost"
              className={`h-11 md:h-9 ${solid ? "" : "text-white hover:bg-white/10 hover:text-white focus-visible:ring-white/80"}`}
            >
              <Link to="/login">Sign In</Link>
            </Button>
            <Button
              asChild
              className={`h-11 md:h-9 ${solid ? "" : "bg-white text-brand-teal-dark shadow-none hover:bg-brand-teal-light focus-visible:ring-white/80"}`}
            >
              <Link to="/signup">Sign Up</Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
