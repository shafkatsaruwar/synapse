"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AppStoreLink } from "@/components/ui/AppStoreLink";

const links = [
  { href: "/", label: "Overview" },
  { href: "/features", label: "Features" },
  { href: "/privacy", label: "Privacy" },
  { href: "/story", label: "Our Story" },
  { href: "/support", label: "Support" },
];

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function isHidden(element: HTMLElement) {
  let node: HTMLElement | null = element;
  while (node) {
    if (node.hidden) return true;
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return true;
    node = node.parentElement;
  }
  return false;
}

function focusable(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => {
    if (element.tabIndex < 0) return false;
    if (element.getAttribute("aria-hidden") === "true") return false;
    return !isHidden(element);
  });
}

export function SiteNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => {
      if (document.body.classList.contains("menu-open")) return;
      const y = window.scrollY;
      // Hysteresis so the bar does not flicker when the scroll position sits on the threshold.
      setScrolled((current) => {
        if (y > 120) return true;
        if (y < 80) return false;
        return current;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 860px)");
    const onChange = () => {
      if (!query.matches) setOpen(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const header = headerRef.current;
    const scrollY = window.scrollY;
    const main = document.getElementById("content");
    const footer = document.querySelector("footer");
    const body = document.body;
    const html = document.documentElement;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
      htmlOverflow: html.style.overflow,
    };
    const scrollbar = window.innerWidth - html.clientWidth;

    main?.setAttribute("inert", "");
    footer?.setAttribute("inert", "");
    main?.setAttribute("aria-hidden", "true");
    footer?.setAttribute("aria-hidden", "true");

    // position:fixed is what actually stops iOS Safari from scrolling the page.
    // overflow:hidden on its own does not.
    body.classList.add("menu-open");
    html.classList.add("menu-open");
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    const pinOverlay = () => {
      if (!header) return;
      const viewport = window.visualViewport;
      if (!viewport) return;
      header.style.top = `${viewport.offsetTop}px`;
      header.style.height = `${viewport.height}px`;
      header.style.bottom = "auto";
    };
    pinOverlay();
    window.visualViewport?.addEventListener("resize", pinOverlay);
    window.visualViewport?.addEventListener("scroll", pinOverlay);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !header) return;
      const items = focusable(header);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !header.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !header.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    const allowScroll = (target: EventTarget | null) => {
      const panel = panelRef.current;
      return Boolean(panel && target instanceof Node && panel.contains(target) && panel.scrollHeight > panel.clientHeight + 1);
    };
    const stopBackgroundScroll = (event: Event) => {
      if (allowScroll(event.target)) return;
      event.preventDefault();
    };
    document.addEventListener("touchmove", stopBackgroundScroll, { passive: false });
    document.addEventListener("wheel", stopBackgroundScroll, { passive: false });

    const firstLink = panelRef.current?.querySelector<HTMLElement>("a[href]");
    (firstLink ?? menuButtonRef.current)?.focus({ preventScroll: true });

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("touchmove", stopBackgroundScroll);
      document.removeEventListener("wheel", stopBackgroundScroll);
      window.visualViewport?.removeEventListener("resize", pinOverlay);
      window.visualViewport?.removeEventListener("scroll", pinOverlay);
      main?.removeAttribute("inert");
      footer?.removeAttribute("inert");
      main?.removeAttribute("aria-hidden");
      footer?.removeAttribute("aria-hidden");
      body.classList.remove("menu-open");
      html.classList.remove("menu-open");
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      body.style.paddingRight = previous.paddingRight;
      html.style.overflow = previous.htmlOverflow;
      if (header) {
        header.style.top = "";
        header.style.height = "";
        header.style.bottom = "";
      }
      window.scrollTo(0, scrollY);
      menuButtonRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <header
      ref={headerRef}
      className={`nav${open ? " is-open" : ""}${scrolled && !open ? " is-scrolled" : ""}`}
      role={open ? "dialog" : undefined}
      aria-modal={open ? true : undefined}
      aria-label={open ? "Menu" : undefined}
    >
      <a className="skip" href="#content" tabIndex={open ? -1 : undefined} aria-hidden={open ? true : undefined}>
        Skip to content
      </a>
      <div className="nav-inner">
        <Link className="brand" href="/" aria-label="Synapse home" onClick={() => setOpen(false)}>
          <img src="/brand/mark.webp" alt="" width={32} height={32} decoding="async" fetchPriority="low" />
          <span>Synapse</span>
        </Link>
        <nav className="nav-links" aria-label="Primary">
          {links.map((link) => (
            <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="nav-end">
          <button
            ref={menuButtonRef}
            className="menu-button"
            type="button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Close" : "Menu"}
          </button>
          <AppStoreLink className="btn btn-primary nav-cta" placement="nav">
            Get Synapse
          </AppStoreLink>
        </div>
      </div>
      {open ? (
        <div className="mobile-panel" id="mobile-menu" ref={panelRef}>
          <nav aria-label="Mobile">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
