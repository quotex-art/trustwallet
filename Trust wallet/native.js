/* Trust Wallet · native bridge — makes web feel like official app */
(() => {
  "use strict";

  // 1. Haptics — كل نقرة تعطي إحساس أصلي
  const haptic = (type = "light") => {
    try {
      if ("vibrate" in navigator) {
        const map = { light: 10, medium: 20, heavy: 30, selection: 8, success: [10, 30, 60] };
        const p = map[type] || 10;
        navigator.vibrate(Array.isArray(p) ? p : p);
      }
      // iOS Taptic via Haptic API if available (Capacitor/Cordova fallback not needed)
    } catch {}
  };

  // Attach to all tappable
  document.addEventListener("touchstart", (e) => {
    const t = e.target.closest("button, .token, .action, .tab, .pick-row, .sheet-item");
    if (t) haptic("selection");
  }, { passive: true });
  document.addEventListener("click", (e) => {
    const t = e.target.closest("#continueBtn, #confirmBtn, #swapBtn, #doneBtn, #wdSendBtn, .primary-btn");
    if (t && !t.disabled) haptic("medium");
  });

  // 2. Splash — يختفي بعد تحميل الأسعار أو 1.6s كحد أقصى
  const splash = document.getElementById("nativeSplash");
  let splashGone = false;
  const hideSplash = () => {
    if (splashGone || !splash) return;
    splashGone = true;
    splash.classList.add("is-hide");
    setTimeout(() => splash.remove(), 600);
    // trigger entrance animation already handled by CSS
  };
  window.addEventListener("load", () => setTimeout(hideSplash, 900));
  setTimeout(hideSplash, 2600); // safety

  // If prices load quickly, hide earlier — hook into app.js applyPrices via MutationObserver
  const balanceEl = document.getElementById("balanceValue");
  if (balanceEl) {
    const mo = new MutationObserver(() => {
      if (!splashGone && balanceEl.textContent !== "5,627.50") {
        setTimeout(hideSplash, 350);
        mo.disconnect();
      }
    });
    mo.observe(balanceEl, { childList: true, characterData: true, subtree: true });
  }

  // 3. Install prompt — يظهر بانر أصلي
  let deferredPrompt = null;
  const banner = document.getElementById("installBanner");
  const btn = document.getElementById("installBtn");
  const dismiss = document.getElementById("installDismiss");
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches || navigator.standalone;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 767;

  if (!isStandalone && isMobile && banner) {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      banner.hidden = false;
      banner.classList.add("is-visible");
    });
    // iOS fallback — لا يدعم beforeinstallprompt، أظهر بعد 2.5s إذا لم يُثبت
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      const dismissed = localStorage.getItem("tw-install-dismissed");
      if (!dismissed) setTimeout(() => { if (!isStandalone) { banner.hidden = false; banner.classList.add("is-visible"); } }, 2800);
      if (btn) btn.textContent = "Add";
      if (btn) btn.addEventListener("click", () => {
        banner.hidden = true;
        // تعليمات iOS
        const tip = document.createElement("div");
        tip.className = "toast is-visible";
        tip.textContent = "Tap Share → Add to Home Screen";
        tip.style.top = "56px";
        document.body.appendChild(tip);
        setTimeout(() => tip.remove(), 3200);
        haptic("medium");
      });
    } else if (btn) {
      btn.addEventListener("click", async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const r = await deferredPrompt.userChoice.catch(() => null);
        if (r && r.outcome === "accepted") haptic("success");
        banner.hidden = true;
        deferredPrompt = null;
      });
    }
    dismiss?.addEventListener("click", () => {
      banner.hidden = true;
      localStorage.setItem("tw-install-dismissed", "1");
      haptic("light");
    });
    // auto hide after 12s
    setTimeout(() => { if (banner && !banner.hidden) banner.classList.add("is-fade"); }, 12000);
    setTimeout(() => { if (banner) banner.hidden = true; }, 13500);
  }

  // 4. Swipe back — سحب من الحافة للعودة (مثل iOS)
  let startX = 0, startY = 0;
  const phone = document.querySelector(".phone");
  if (phone) {
    phone.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    phone.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = Math.abs(e.changedTouches[0].clientY - startY);
      if (dx > 90 && startX < 28 && dy < 60) {
        // حافة يسار + سحب يمين = رجوع
        const active = document.querySelector(".view--active");
        if (active && active.id !== "homeView") {
          const back = active.querySelector("[id$='Back']");
          if (back) { back.click(); haptic("light"); }
        }
      }
    }, { passive: true });
  }

  // 5. Shortcuts actions (?action=send/swap/buy)
  const params = new URLSearchParams(location.search);
  const action = params.get("action");
  if (action) {
    window.addEventListener("load", () => {
      setTimeout(() => {
        const map = { send: "#sendAction", swap: "#swapAction", buy: "#buyAction", receive: "[data-toast='Receive wallet address']" };
        const sel = map[action];
        const el = sel && document.querySelector(sel);
        if (el) { el.click(); haptic("medium"); }
        // clean url
        history.replaceState({}, "", "./index.html");
      }, 700);
    });
  }

  // 6. Status bar theme sync on scroll/view change (Android)
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  const syncTheme = () => {
    const isDark = true; // app is dark
    if (metaTheme) metaTheme.setAttribute("content", isDark ? "#0B1020" : "#0B1020");
  };
  syncTheme();

  // 7. Prevent pull-to-refresh bounce إلا داخل .app
  let apStartY = 0;
  const appEl = document.getElementById("app");
  if (appEl) {
    appEl.addEventListener("touchstart", (e) => apStartY = e.touches[0].clientY, { passive: true });
    appEl.addEventListener("touchmove", (e) => {
      const atTop = appEl.scrollTop <= 0;
      const atBottom = appEl.scrollTop + appEl.clientHeight >= appEl.scrollHeight - 1;
      const dy = e.touches[0].clientY - apStartY;
      if ((atTop && dy > 0) || (atBottom && dy < 0)) {
        // allow native rubber only at edges inside app, prevent document bounce
        e.preventDefault();
      }
    }, { passive: false });
  }
  document.body.addEventListener("touchmove", (e) => {
    // منع سحب الصفحة بالكامل خارج .app
    if (!e.target.closest("#app, .sheet")) e.preventDefault();
  }, { passive: false });

  // 8. Keyboard inset handling — يرفع الفوتر عند فتح لوحة المفاتيح (Android)
  if ("visualViewport" in window) {
    const vv = window.visualViewport;
    const onResize = () => {
      const h = vv.height;
      document.documentElement.style.setProperty("--vv-height", h + "px");
    };
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    onResize();
  }
})();
