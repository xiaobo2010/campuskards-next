import { useState, useEffect } from "react";
import { API_BASE } from "@/lib/config";

const BG_CACHE_KEY = "campuskards_bg_image";
const BG_CACHE_TIMESTAMP_KEY = "campuskards_bg_image_ts";
const BG_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function useCachedBackground() {
  const [bgImage, setBgImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchBackground = async () => {
      // Check localStorage cache first
      try {
        const cached = localStorage.getItem(BG_CACHE_KEY);
        const cachedTs = localStorage.getItem(BG_CACHE_TIMESTAMP_KEY);
        if (cached && cachedTs) {
          const age = Date.now() - parseInt(cachedTs, 10);
          if (age < BG_CACHE_TTL) {
            setBgImage(cached);
            return;
          }
          // Expired — refetch
        }
      } catch {
        // localStorage may be unavailable (SSR, private mode)
      }

      try {
        const response = await fetch(`${API_BASE}/api/login-bg`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("campuskards_token")}` },
        });
        if (response.ok) {
          const data = await response.json();
          const url = data.url || data.image_url || null;
          if (url) {
            setBgImage(url);
            try {
              localStorage.setItem(BG_CACHE_KEY, url);
              localStorage.setItem(BG_CACHE_TIMESTAMP_KEY, String(Date.now()));
            } catch {
              // ignore storage write failure
            }
          }
        }
      } catch {
        // ignore fetch failure
      }
    };

    fetchBackground();
  }, []);

  return bgImage;
}
