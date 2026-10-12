"use client";

import { useEffect, useRef } from "react";

export function Animation({ name = "cheerleader", className = "" }: { name?: string; className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    let animation: { destroy: () => void } | undefined;
    import("lottie-web").then(({ default: lottie }) => {
      if (disposed || !container.current) return;
      animation = lottie.loadAnimation({ container: container.current, renderer: "svg", loop: !window.matchMedia("(prefers-reduced-motion: reduce)").matches, autoplay: !window.matchMedia("(prefers-reduced-motion: reduce)").matches, path: `/sites/rolly/jsons/${name}.json`, rendererSettings: { preserveAspectRatio: "xMidYMid meet" } });
    });
    return () => { disposed = true; animation?.destroy(); };
  }, [name]);
  return <div ref={container} className={className} aria-hidden="true" />;
}
