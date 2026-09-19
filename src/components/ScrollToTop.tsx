// src/components/ScrollToTop.tsx
//
// React Router doesn't reset scroll position on navigation the way a
// traditional page load does — since it's just swapping content in place,
// whatever scroll position you were at on the previous page carries over
// to the new one. This component fixes that: renders nothing, just watches
// the route and scrolls to top whenever the path changes.

import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // "instant" not "smooth" — a page navigation should land you at the
    // top immediately, not animate there (that would look like a bug).
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
};