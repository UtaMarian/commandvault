import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "cv-theme";

function getInitial(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function useTheme() {
  const [isDark, setIsDark] = useState(getInitial);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
      } catch {
        // private-window/blocked storage — theme just won't persist across reloads
      }
      return next;
    });
  }, []);

  return { isDark, toggle };
}
