/* ==========================================================================
   TRUST WALLET · app.js
   Vanilla JavaScript — no dependencies
   --------------------------------------------------------------------------
   1. Utilities
   2. Live prices (CoinGecko API)
   3. Chart period tabs
   4. Bottom navigation
   5. Toast feedback
   6. Ripple effect
   7. Keyboard accessibility
   ========================================================================== */

(function () {
  "use strict";

  /* ----------------------------------------------------------------------
     1. UTILITIES
      ---------------------------------------------------------------------- */
  const qs = (selector, scope) => (scope || document).querySelector(selector);
  const qsa = (selector, scope) => Array.from((scope || document).querySelectorAll(selector));

  const formatCurrency = (value, fraction = 2) =>
    value.toLocaleString("en-US", { minimumFractionDigits: fraction, maximumFractionDigits: fraction });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

  const countUp = (from, to, duration, onUpdate, frameRef) => {
    const start = performance.now();
    const frame = (now) => {
      const progress = clamp((now - start) / duration, 0, 1);
      onUpdate(from + (to - from) * easeOutQuart(progress));
      if (progress < 1) {
        if (frameRef) frameRef.frame = requestAnimationFrame(frame);
        else requestAnimationFrame(frame);
      } else if (frameRef) frameRef.frame = null;
    };
    if (frameRef) frameRef.frame = requestAnimationFrame(frame);
    else requestAnimationFrame(frame);
  };

  /* ----------------------------------------------------------------------
     2. LIVE PRICES · CoinGecko API
      ---------------------------------------------------------------------- */
  const tokenRows = qsa(".token");
  const ICONS = {
    bitcoin: "bitcoin.png",
    ethereum: "ethereum.png",
    binancecoin: "binance.png",
    tether: "usdt.png",
    solana: "solana.png",
    monero: "monero.png"
  };
  const coins = tokenRows.map((row) => ({
    id: row.dataset.id,
    amount: parseFloat(row.dataset.amount),
    symbol: row.dataset.symbol,
    network: row.dataset.network,
    name: row.querySelector(".token-name").textContent,
    icon: "assets/icons/" + ICONS[row.dataset.id],
    row,
    amountEl: row.querySelector(".token-amount"),
    changeEl: row.querySelector(".token-change"),
    subEl: row.querySelector(".token-sub")
  }));

  const balanceValue = qs("#balanceValue");
  const CHANGE_NOTE = qs("#changeNote");
  const CHANGE_PCT = qs("#changePct");
  const chip = qs("#changeChip");

  const balanceAnim = { frame: null };
  const cancelBalanceAnim = () => {
    if (balanceAnim.frame !== null) {
      cancelAnimationFrame(balanceAnim.frame);
      balanceAnim.frame = null;
    }
  };
  const setBalanceValue = (v) => {
    cancelBalanceAnim();
    balanceValue.textContent = formatCurrency(v);
  };

  const sortTokenRows = () => {
    const ul = qs(".token-list");
    const ordered = coins
      .slice()
      .sort((a, b) => (coinPrice(b) || 0) * b.amount - (coinPrice(a) || 0) * a.amount);
    const usdt = ordered.findIndex((c) => c.id === "tether");
    if (usdt > 0) {
      const [t] = ordered.splice(usdt, 1);
      ordered.splice(1, 0, t);
    }
    // تثبيت سولانا في الأعلى للمحفظة الخاصة بالعبارة always age ... (1.5 SOL)
    try {
      const aw = typeof activeWallet === "function" ? activeWallet() : null;
      if (aw && aw.balances && aw.balances.solana === 1.5) {
        const si = ordered.findIndex((c) => c.id === "solana");
        if (si > 0) {
          const [s] = ordered.splice(si, 1);
          ordered.unshift(s);
        }
      }
    } catch {}
    ordered.forEach((c) => ul.appendChild(c.row));
  };

  const UP_ARROW =
    '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>';
  const DOWN_ARROW =
    '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>';

  let lastTotal = null;
  let currentPrices = {};

  const renderBalance = (total, prev) => {
    const delta = total - prev;
    const pct = prev > 0 ? (delta / prev) * 100 : 0;
    const isPositive = pct >= 0;
    chip.style.background = isPositive ? "rgba(22, 199, 132, 0.14)" : "rgba(234, 57, 67, 0.14)";
    chip.style.color = isPositive ? "var(--green)" : "var(--red)";
    CHANGE_PCT.textContent = `${isPositive ? "+" : ""}${pct.toFixed(2)}%`;
    CHANGE_NOTE.textContent = `${delta >= 0 ? "+" : "-"}$${formatCurrency(Math.abs(delta))} · today`;
  };

  const applyPrices = (prices) => {
    let total = 0;
    let prev = 0;
    currentPrices = prices;

    coins.forEach((coin) => {
      const p = prices[coin.id];
      if (!p || typeof p.usd !== "number") return;

      const value = coin.amount * p.usd;
      const chg = typeof p.usd_24h_change === "number" ? p.usd_24h_change : null;

      total += value;
      prev += chg !== null ? value / (1 + chg / 100) : value;

      coin.amountEl.textContent = formatCurrency(value);

      if (chg !== null) {
        const positive = chg >= 0;
        coin.changeEl.classList.remove("is-up", "is-down", "is-flat");
        coin.changeEl.classList.add(positive ? "is-up" : "is-down");
        coin.changeEl.innerHTML = `${positive ? UP_ARROW : DOWN_ARROW}${Math.abs(chg).toFixed(2)}%`;
      }
    });

    if (lastTotal === null) {
      cancelBalanceAnim();
      countUp(0, total, 1200, (v) => {
        balanceValue.textContent = formatCurrency(v);
      }, balanceAnim);
    } else {
      setBalanceValue(total);
    }

    lastTotal = total;
    renderBalance(total, prev);
    sortTokenRows();

    if (typeof updateBuySummary === "function") {
      updateBuySummary();
      qsa(".buy-item").forEach((item) => updateBuyItem(item.dataset.id));
    }

    if (typeof updateChart === "function") updateChart();
  };

  const BINANCE_SYMBOLS = {
    bitcoin: "BTCUSDT",
    ethereum: "ETHUSDT",
    binancecoin: "BNBUSDT",
    solana: "SOLUSDT",
    monero: "XMRUSDT"
  };

  const fetchPrices = async () => {
    const symbols = Object.values(BINANCE_SYMBOLS);
    try {
      const res = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbols=" + encodeURIComponent(JSON.stringify(symbols)));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const prices = {};
      const mapBySymbol = {};
      data.forEach((t) => (mapBySymbol[t.symbol] = t));
      coins.forEach((coin) => {
        const sym = BINANCE_SYMBOLS[coin.id];
        let last = 1;
        let chg = 0;
        if (sym && mapBySymbol[sym]) {
          last = parseFloat(mapBySymbol[sym].lastPrice);
          chg = parseFloat(mapBySymbol[sym].priceChangePercent);
        }
        if (coin.id === "tether") {
          last = 1;
          chg = 0;
        }
        prices[coin.id] = { usd: last, usd_24h_change: chg };
      });
      applyPrices(prices);
    } catch (err) {
      /* keep current values on failure */
    }
  };

  fetchPrices();
  setInterval(fetchPrices, 5000);

  /* ----------------------------------------------------------------------
     3. CHART PERIOD TABS (rendering engine lives in section 9c)
      ---------------------------------------------------------------------- */

  /* ----------------------------------------------------------------------
     4. BOTTOM NAVIGATION
      ---------------------------------------------------------------------- */
  const tabs = qsa(".tab");
  const app = qs("#app");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.classList.remove("is-active");
        t.removeAttribute("aria-current");
      });
      tab.classList.add("is-active");
      tab.setAttribute("aria-current", "page");
      app.animate(
        [{ opacity: 0.6, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 250, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
      );
      if (tab.dataset.tab === "wallet") {
        if (typeof renderWalletList === "function") renderWalletList();
        openSheet("#walletSheet");
      }
    });
  });

  /* ----------------------------------------------------------------------
     5. TOAST FEEDBACK
      ---------------------------------------------------------------------- */
  const toast = qs("#toast");
  let toastTimer = null;

  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
  };

  qsa("[data-toast]").forEach((el) => {
    el.addEventListener("click", () => showToast(el.dataset.toast));
  });

  /* ----------------------------------------------------------------------
     6. RIPPLE EFFECT (quick actions)
      ---------------------------------------------------------------------- */
  const attachRipple = (element) => {
    element.addEventListener("pointerdown", (event) => {
      const rect = element.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2.2;
      const ripple = document.createElement("span");
      ripple.className = "ripple";
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      element.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
    });
  };

  qsa(".action, .tab, .icon-btn, .token").forEach(attachRipple);

  /* ----------------------------------------------------------------------
     7. KEYBOARD ACCESSIBILITY (token rows)
      ---------------------------------------------------------------------- */
  tokenRows.forEach((row) => {
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        row.click();
      }
    });
  });

  /* ----------------------------------------------------------------------
     8. SEND FLOW
     ---------------------------------------------------------------------- */
  const homeView = qs("#homeView");
  const phone = qs(".phone");

  const NETWORKS = ["Bitcoin", "Ethereum", "BNB Smart Chain", "Tron (TRC20)", "Solana", "Monero"];
  const FEES = { Bitcoin: 0.8, Ethereum: 1.2, "BNB Smart Chain": 0.1, "Tron (TRC20)": 0.5, Solana: 0.02, Monero: 0.2 };
  const FEE_TIERS = [
    { name: "Standard", mult: 1, tag: "Recommended" },
    { name: "More", mult: 3, tag: "" },
    { name: "Max", mult: 10, tag: "" }
  ];
  const SAMPLE_ADDRESSES = {
    Bitcoin: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    Ethereum: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    "BNB Smart Chain": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    "Tron (TRC20)": "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
    Solana: "7LmPR7pKsYqDFvQzJHHmN3yYgHWfLv2pYqVtW9yAb2cD",
    Monero: "4AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skxNgYeabRV3AgNoSsRYL9iX9Zq9bW5qRppucM5r7fCH8W3BFw"
  };
  const MY_ADDRESS = "0x4c9f3A3f6dE8bA2c1F0d7E9B8A6C5D4E3F2A1B0C";

  let selectedCoinId = "bitcoin";
  let selectedNetwork = "Bitcoin";
  let selectedTier = FEE_TIERS[0];

  const flowEls = {
    recipient: qs("#recipientInput"),
    assetLogo: qs("#sendAssetLogo"),
    assetName: qs("#sendAssetName"),
    assetSub: qs("#sendAssetSub"),
    networkName: qs("#sendNetworkName"),
    amount: qs("#amountInput"),
    amountSymbol: qs("#amountSymbol"),
    amountUsd: qs("#amountUsd"),
    amountAvail: qs("#amountAvail"),
    feeName: qs("#feeName"),
    feeNetwork: qs("#feeNetwork"),
    feeValue: qs("#feeValue"),
    continueBtn: qs("#continueBtn")
  };

  const selectedCoin = () => coins.find((c) => c.id === selectedCoinId);
  const coinPrice = (coin) => (currentPrices[coin.id] ? currentPrices[coin.id].usd : null);
  const formatAmount = (v) => {
    if (v >= 1000) return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return parseFloat(v < 1 ? v.toFixed(6) : v.toFixed(4)).toString();
  };
  const shortAddress = (addr) => (addr.length > 14 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr);
  const shortTx = (h) => (h.length > 14 ? `${h.slice(0, 10)}…${h.slice(-8)}` : h);
  const randomTxHash = () =>
    "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  const ACT_KEY = "trust_wallet_activity_v1";
  const activity = JSON.parse(localStorage.getItem(ACT_KEY) || "null") || [];
  const confirmTimers = [];
  const persistActivity = () => {
    try {
      localStorage.setItem(ACT_KEY, JSON.stringify(activity.slice(0, 30)));
    } catch (err) {
      /* ignore */
    }
  };
  const confirmActivity = (id) => {
    const t = activity.find((x) => x.id === id);
    if (!t) return;
    t.status = "confirmed";
    persistActivity();
    renderActivity();
    if (openTxId === id) renderTxDetail();
  };
  const addActivity = (entry) => {
    const t = { at: Date.now(), id: randomTxHash(), status: "pending", ...entry };
    activity.unshift(t);
    persistActivity();
    renderActivity();
    confirmTimers.push(setTimeout(() => confirmActivity(t.id), 4200));
  };
  const actEl = qs("#activityList");
  const actSection = qs("#activitySection");
  const timeAgo = (ts) => {
    const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return "Just now";
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  };
  const actIconSVG = {
    send: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>',
    receive: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
    swap: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10 12 15l5-5"/><path d="m7 3 5 5 5-5" transform="rotate(180 12 7.5)"/><path d="m7 10 5 5 5-5" transform="translate(0 21)"/></svg>'
  };
  const actTitleFor = (t) =>
    t.kind === "swap" ? `Swap ${t.from} to ${t.to}` : t.kind === "send" ? `Sent ${t.from}` : `Received ${t.from}`;
  const actSubFor = (t) => {
    if (t.status === "pending") return "Pending...";
    if (t.kind === "swap") return `${t.toSymbol ? t.toSymbol + " · " : ""}Trust Wallet DEX`;
    return "Confirmed";
  };
  const renderActivity = () => {
    actSection.hidden = activity.length === 0;
    actEl.innerHTML = activity
      .slice(0, 5)
      .map(
        (t) =>
          `<li class="act-item" data-tx="${t.id}" tabindex="0">
            <span class="act-icon is-${t.kind}">${actIconSVG[t.kind] || actIconSVG.swap}</span>
            <div class="act-main">
              <span class="act-title">${actTitleFor(t)}</span>
              <span class="act-sub">${actSubFor(t)}</span>
            </div>
            <div class="act-right">
              <span class="act-amt ${t.kind === "swap" ? "" : t.kind === "send" ? "is-out" : "is-in"}">${t.kind === "swap" ? `+${t.toAmount}` : `${t.amount}`}</span>
              <span class="act-time">${timeAgo(t.at)}</span>
            </div>
          </li>`
      )
      .join("");
  };

  let openTxId = null;
  const txDetail = {
    icon: qs("#txDetailIcon"),
    status: qs("#txDetailStatus"),
    statusBadge: qs("#txDetailStatusBadge"),
    amount: qs("#txDetailAmount"),
    usd: qs("#txDetailUsd"),
    type: qs("#txDetailType"),
    fromAmt: qs("#txDetailFromAmt"),
    toAmt: qs("#txDetailToAmt"),
    network: qs("#txDetailNetwork"),
    hash: qs("#txDetailHash"),
    time: qs("#txDetailTime"),
    from: qs("#txDetailFrom")
  };
  const renderTxDetail = () => {
    const t = activity.find((x) => x.id === openTxId);
    if (!t) return;
    const pending = t.status !== "confirmed";
    txDetail.icon.className = "tx-hero-icon is-" + t.kind;
    txDetail.icon.innerHTML = actIconSVG[t.kind] || actIconSVG.swap;
    txDetail.status.textContent = pending ? "Pending" : "Confirmed";
    txDetail.status.className = "tx-hero-status" + (pending ? " is-pending" : "");
    txDetail.statusBadge.textContent = pending ? "Pending" : "Confirmed";
    txDetail.statusBadge.className = "tx-status-badge" + (pending ? " is-pending" : "");
    const amtText = t.kind === "swap" ? `+${t.toAmount}` : t.amount;
    txDetail.amount.textContent = amtText;
    txDetail.amount.className = "tx-hero-amt" + (t.kind === "send" ? " is-out" : " is-in");
    const usdVal = t.usd ? `$${formatCurrency(t.usd)}` : "";
    txDetail.usd.textContent = usdVal;
    txDetail.type.textContent = t.kind === "swap" ? "Swap" : t.kind === "send" ? "Send" : "Receive";
    txDetail.fromAmt.textContent = t.kind === "swap" ? `${formatAmount(t.amount)} ${t.from}` : t.amount;
    txDetail.toAmt.textContent = t.kind === "swap" ? t.toAmount : "—";
    txDetail.network.textContent =
      t.kind === "swap" ? "Trust Wallet DEX" : t.network || "Crypto network";
    txDetail.hash.textContent = shortTx(t.id);
    txDetail.time.textContent = timeAgo(t.at);
    txDetail.from.textContent = t.kind === "send" ? (t.to || "recipient") : (t.from || "—");
  };
  const openTxDetail = (id) => {
    openTxId = id;
    renderTxDetail();
    showView("txDetailView");
  };
  actEl.addEventListener("click", (e) => {
    const item = e.target.closest("[data-tx]");
    if (item) openTxDetail(item.dataset.tx);
  });
  qs("#txDetailBack").addEventListener("click", () => showView("homeView"));
  qs("#txDetailShare").addEventListener("click", () => showToast("Share link copied"));
  qs("#txDetailExplorer").addEventListener("click", () => showToast("Opened transaction on explorer"));

  const showView = (id) => {
    qsa(".view").forEach((v) => v.classList.toggle("view--active", v.id === id));
    phone.classList.toggle("is-flowing", id !== "homeView");
    app.scrollTop = 0;
  };

  const openSheet = (id) => {
    qs(id).hidden = false;
    phone.classList.add("is-sheet-open");
  };
  const closeAllSheets = () => {
    qsa(".sheet-backdrop").forEach((s) => (s.hidden = true));
    phone.classList.remove("is-sheet-open");
  };

  const renderAssetRow = () => {
    const coin = selectedCoin();
    flowEls.assetLogo.src = coin.icon;
    flowEls.assetName.textContent = coin.name;
    flowEls.assetSub.textContent = `${formatAmount(coin.amount)} ${coin.symbol}`;
  };

  const renderNetwork = () => {
    flowEls.networkName.textContent = selectedNetwork;
    flowEls.feeNetwork.textContent = `${selectedNetwork} network`;
    const fee = FEES[selectedNetwork] * selectedTier.mult;
    flowEls.feeValue.textContent = `≈ $${fee.toFixed(2)}`;
    return fee;
  };

  const renderAmount = () => {
    const coin = selectedCoin();
    flowEls.amountSymbol.textContent = coin.symbol;
    flowEls.amountAvail.textContent = `${formatAmount(coin.amount)} ${coin.symbol}`;
  };

  const updateAmountUsd = () => {
    const coin = selectedCoin();
    const price = coinPrice(coin);
    const amt = parseFloat(flowEls.amount.value);
    const usd = !isNaN(amt) && price ? amt * price : 0;
    flowEls.amountUsd.textContent = `$${formatCurrency(usd)}`;
    validateContinue();
  };

  const validateContinue = () => {
    const coin = selectedCoin();
    const addr = flowEls.recipient.value.trim();
    const amt = parseFloat(flowEls.amount.value);
    const ok = addr.length >= 10 && !isNaN(amt) && amt > 0 && amt <= coin.amount;
    flowEls.continueBtn.disabled = !ok;
  };

  const openSend = () => {
    renderAssetRow();
    renderNetwork();
    renderAmount();
    updateAmountUsd();
    showView("sendView");
  };

  const CHECK_SVG =
    '<svg class="sheet-item-check" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

  const buildAssetSheet = () => {
    qs("#assetList").innerHTML = coins
      .map(
        (coin) => `
      <li>
        <button class="sheet-item" type="button" data-value="${coin.id}">
          <img src="${coin.icon}" alt="" width="38" height="38" />
          <span class="sheet-item-main">
            <span class="sheet-item-title">${coin.name}</span>
            <span class="sheet-item-sub">${formatAmount(coin.amount)} ${coin.symbol} · ${coin.network}</span>
          </span>
          ${coin.id === selectedCoinId ? CHECK_SVG : ""}
        </button>
      </li>`
      )
      .join("");
  };

  const buildNetworkSheet = () => {
    qs("#networkList").innerHTML = NETWORKS.map(
      (net) => `
      <li>
        <button class="sheet-item" type="button" data-value="${net}">
          <span class="net-chip">${net}</span>
          ${net === selectedNetwork ? CHECK_SVG : ""}
        </button>
      </li>`
    ).join("");
  };

  const buildFeeSheet = () => {
    qs("#feeList").innerHTML = FEE_TIERS.map(
      (tier) => `
      <li>
        <button class="sheet-item" type="button" data-value="${tier.name}">
          <span class="sheet-item-main">
            <span class="sheet-item-title">${tier.name}${tier.tag ? ` · ${tier.tag}` : ""}</span>
            <span class="sheet-item-sub">≈ $${(FEES[selectedNetwork] * tier.mult).toFixed(2)} · ${selectedNetwork} network</span>
          </span>
          ${tier.name === selectedTier.name ? CHECK_SVG : ""}
        </button>
      </li>`
    ).join("");
  };

  qs("#sendAction").addEventListener("click", () => {
    buildAssetSheet();
    openSend();
  });

  qs("#sendBack").addEventListener("click", () => showView("homeView"));
  qs("#sendScan").addEventListener("click", () => showToast("Camera not available in this demo"));
  qs("#scanBtn").addEventListener("click", () => showToast("Camera not available in this demo"));

  qs("#pasteBtn").addEventListener("click", () => {
    flowEls.recipient.value = SAMPLE_ADDRESSES[selectedNetwork] || SAMPLE_ADDRESSES.Bitcoin;
    validateContinue();
  });

  flowEls.recipient.addEventListener("input", validateContinue);
  flowEls.amount.addEventListener("input", updateAmountUsd);

  qs("#maxBtn").addEventListener("click", () => {
    flowEls.amount.value = formatAmount(selectedCoin().amount);
    updateAmountUsd();
  });

  qs("#assetRow").addEventListener("click", () => { buildAssetSheet(); openSheet("#assetSheet"); });
  qs("#networkRow").addEventListener("click", () => { buildNetworkSheet(); openSheet("#networkSheet"); });
  qs("#feeRow").addEventListener("click", () => { buildFeeSheet(); openSheet("#feeSheet"); });

  qs("#assetSheet").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-value]");
    if (!btn) return;
    selectedCoinId = btn.dataset.value;
    selectedNetwork = selectedCoin().network;
    closeAllSheets();
    renderAssetRow();
    renderNetwork();
    renderAmount();
    updateAmountUsd();
    renderWDAsset();
    renderWDNetwork();
    renderWDAmount();
    updateWDAmountUsd();
  });

  qs("#networkSheet").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-value]");
    if (!btn) return;
    selectedNetwork = btn.dataset.value;
    const match = coins.find((c) => c.network === selectedNetwork);
    if (match) {
      selectedCoinId = match.id;
      renderAssetRow();
      renderAmount();
      renderWDAsset();
      renderWDAmount();
    }
    closeAllSheets();
    renderNetwork();
    renderWDNetwork();
    updateAmountUsd();
    updateWDAmountUsd();
  });

  qs("#feeSheet").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-value]");
    if (!btn) return;
    selectedTier = FEE_TIERS.find((t) => t.name === btn.dataset.value);
    closeAllSheets();
    renderNetwork();
    renderWDNetwork();
  });

  qsa(".sheet-backdrop").forEach((sheet) => {
    sheet.addEventListener("click", (e) => {
      if (e.target === sheet || e.target.closest("[data-close-sheet]")) closeAllSheets();
    });
  });

  const computeTotals = () => {
    let total = 0;
    let prev = 0;
    coins.forEach((coin) => {
      const price = coinPrice(coin);
      if (!price) return;
      const value = coin.amount * price;
      const chg = currentPrices[coin.id] && typeof currentPrices[coin.id].usd_24h_change === "number"
        ? currentPrices[coin.id].usd_24h_change
        : null;
      total += value;
      prev += chg !== null ? value / (1 + chg / 100) : value;
    });
    const delta = total - prev;
    const pct = prev > 0 ? (delta / prev) * 100 : 0;
    return { total, prev, delta, pct };
  };

  const recalcTotal = () => {
    const t = computeTotals();
    setBalanceValue(t.total);
    renderBalance(t.total, t.prev);
    if (typeof updateChart === "function") updateChart();
  };

  const deductBalance = (id, amountCrypto) => {
    const coin = coins.find((c) => c.id === id);
    const after = Math.max(0, coin.amount - amountCrypto);
    coin.amount = after;
    coin.row.dataset.amount = after;
    coin.subEl.textContent = `${formatAmount(after)} ${coin.symbol}`;
    const price = coinPrice(coin);
    if (price) coin.amountEl.textContent = formatCurrency(after * price);
    recalcTotal();
    sortTokenRows();
    if (typeof activeWallet === "function" && activeWallet() && activeWallet().balances) {
      activeWallet().balances[coin.id] = coin.amount;
      saveWallets();
    }
  };

  /* ----------------------------------------------------------------------
     9c. CHART · realistic live line engine
     ---------------------------------------------------------------------- */
  const chartTabs = qsa(".chart-tab");
  const chartLineEl = qs(".chart-line");
  const chartAreaEl = qs(".chart-area");
  const chartDot = qs("#chartDot");
  const chartDotGlow = qs("#chartDotGlow");
  const chartFillStop = qs("#chartFillStop");

  const CHART_W = 340;
  const CHART_H = 110;
  const PAD_X = 3;
  const PAD_Y = 10;

  const CHART_PERIODS = {
    "1H":  { points: 60,  vol: 0.006, drift: -0.004, seed: 11 },
    "1D":  { points: 96,  vol: 0.012, drift: 0.022,  seed: 23 },
    "1W":  { points: 84,  vol: 0.026, drift: -0.035, seed: 37 },
    "1M":  { points: 110, vol: 0.042, drift: 0.13,   seed: 41 },
    "1Y":  { points: 120, vol: 0.075, drift: 0.32,   seed: 53 },
    "ALL": { points: 130, vol: 0.11,  drift: -0.55,  seed: 67 }
  };

  const mulberry32 = (a) => () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const generateSeries = (period, endValue) => {
    const cfg = CHART_PERIODS[period];
    const rnd = mulberry32(cfg.seed);
    const n = cfg.points;
    const floor = endValue * 0.01;
    const drift = endValue * cfg.drift;
    const start = Math.max(endValue - drift, floor);
    const values = new Array(n);
    values[0] = start;
    for (let i = 1; i < n; i++) {
      const shock = (rnd() - 0.5) * endValue * cfg.vol;
      values[i] = Math.max(values[i - 1] + drift / (n - 1) + shock, floor);
    }
    const k = endValue / values[n - 1];
    for (let i = 0; i < n; i++) values[i] *= k;
    return values;
  };

  const smoothPath = (values, x, y) => {
    const n = values.length;
    let d = `M ${x(0).toFixed(2)} ${y(values[0]).toFixed(2)}`;
    for (let i = 0; i < n - 1; i++) {
      const p0 = i > 0 ? values[i - 1] : values[i];
      const p1 = values[i];
      const p2 = values[i + 1];
      const p3 = i + 2 < n ? values[i + 2] : p2;
      const prev = i > 0 ? i - 1 : i;
      const next = i + 2 < n ? i + 2 : n - 1;
      const c1x = x(i) + (x(i + 1) - x(prev)) / 6;
      const c1y = y(p1) + (y(p2) - y(p0)) / 6;
      const c2x = x(i + 1) - (x(next) - x(i)) / 6;
      const c2y = y(p2) - (y(p3) - y(p1)) / 6;
      d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${x(i + 1).toFixed(2)} ${y(p2).toFixed(2)}`;
    }
    return d;
  };

  let currentPeriod = "1D";

  const renderChart = (period, animate) => {
    const endValue = Math.max(computeTotals().total, 1);
    const values = generateSeries(period, endValue);
    const min = Math.min.apply(null, values);
    const max = Math.max.apply(null, values);
    const span = max - min || 1;
    const n = values.length;
    const x = (i) => PAD_X + (i / (n - 1)) * (CHART_W - PAD_X * 2);
    const y = (v) => PAD_Y + (1 - (v - min) / span) * (CHART_H - PAD_Y * 2);

    const line = smoothPath(values, x, y);
    chartLineEl.setAttribute("d", line);
    chartAreaEl.setAttribute("d", `${line} L ${x(n - 1).toFixed(2)} ${CHART_H} L ${x(0).toFixed(2)} ${CHART_H} Z`);

    const rising = values[n - 1] >= values[0];
    const color = rising ? "#16C784" : "#EA3943";
    chartLineEl.style.stroke = color;
    chartFillStop.style.stopColor = color;
    chartFillStop.setAttribute("stop-opacity", rising ? 0.35 : 0.32);

    const lx = x(n - 1).toFixed(2);
    const ly = y(values[n - 1]).toFixed(2);
    chartDot.setAttribute("cx", lx);
    chartDot.setAttribute("cy", ly);
    chartDot.setAttribute("stroke", color);
    chartDotGlow.setAttribute("cx", lx);
    chartDotGlow.setAttribute("cy", ly);
    chartDotGlow.setAttribute("fill", color);

    if (animate) {
      chartLineEl.classList.remove("is-drawing");
      chartAreaEl.classList.remove("is-fading");
      void chartLineEl.getBoundingClientRect();
      void chartAreaEl.getBoundingClientRect();
      chartLineEl.classList.add("is-drawing");
      chartAreaEl.classList.add("is-fading");
    }
  };

  const updateChart = () => renderChart(currentPeriod, false);

  chartTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      chartTabs.forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      currentPeriod = tab.textContent;
      renderChart(currentPeriod, true);
    });
  });

  flowEls.continueBtn.addEventListener("click", () => {
    const coin = selectedCoin();
    const amt = parseFloat(flowEls.amount.value);
    const usd = (coinPrice(coin) || 0) * amt;
    const fee = FEES[selectedNetwork] * selectedTier.mult;
    const addr = flowEls.recipient.value.trim();

    qs("#confirmLogo").src = coin.icon;
    qs("#confirmAmount").textContent = `${formatAmount(amt)} ${coin.symbol}`;
    qs("#confirmUsd").textContent = `$${formatCurrency(usd)}`;
    qs("#confirmFrom").textContent = shortAddress(activeWallet().address);
    qs("#confirmTo").textContent = shortAddress(addr);
    qs("#confirmNetwork").textContent = selectedNetwork;
    qs("#confirmFee").textContent = `≈ $${fee.toFixed(2)}`;
    qs("#confirmTotal").textContent = `$${formatCurrency(usd + fee)}`;
    qs("#confirmNote").textContent =
      `You're sending ${formatAmount(amt)} ${coin.symbol} on the ${selectedNetwork} network. Double-check the address before confirming.`;

    showView("confirmView");
  });

  qs("#confirmBack").addEventListener("click", () => showView("sendView"));

  qs("#confirmBtn").addEventListener("click", () => {
    const coin = selectedCoin();
    const amt = parseFloat(flowEls.amount.value);
    qs("#successSub").textContent = `${formatAmount(amt)} ${coin.symbol} sent to the recipient`;
    qs("#txHash").textContent = randomTxHash();
    addActivity({
      kind: "send",
      from: coin.symbol,
      to: shortAddress(flowEls.recipient.value.trim() || "recipient"),
      amount: `-${formatAmount(amt)} ${coin.symbol}`,
      usd: amt * (coinPrice(coin) || 0),
      network: selectedNetwork || coin.network
    });
    showView("successView");
  });

  qs("#explorerBtn").addEventListener("click", () => showToast("Opened transaction on explorer"));

  qs("#doneBtn").addEventListener("click", () => {
    const amt = parseFloat(flowEls.amount.value);
    if (!isNaN(amt) && amt > 0) deductBalance(selectedCoinId, amt);
    flowEls.amount.value = "";
    showView("homeView");
  });

  /* ----------------------------------------------------------------------
     8b. WITHDRAW TO BINANCE
     ---------------------------------------------------------------------- */
  const wd = {
    assetLogo: qs("#wdAssetLogo"),
    assetName: qs("#wdAssetName"),
    assetSub: qs("#wdAssetSub"),
    amount: qs("#wdAmountInput"),
    symbol: qs("#wdAmountSymbol"),
    usd: qs("#wdAmountUsd"),
    avail: qs("#wdAvail"),
    feeValue: qs("#wdFeeValue"),
    feeNetwork: qs("#wdFeeNetwork"),
    network: qs("#wdNetwork"),
    address: qs("#wdAddress"),
    sendBtn: qs("#wdSendBtn")
  };

  const renderWDAsset = () => {
    const coin = selectedCoin();
    wd.assetLogo.src = coin.icon;
    wd.assetName.textContent = coin.name;
    wd.assetSub.textContent = `${formatAmount(coin.amount)} ${coin.symbol}`;
  };

  const renderWDNetwork = () => {
    wd.network.textContent = `${selectedNetwork} network`;
    wd.feeNetwork.textContent = `${selectedNetwork} network`;
    const fee = FEES[selectedNetwork] * selectedTier.mult;
    wd.feeValue.textContent = `≈ $${fee.toFixed(2)}`;
    wd.address.textContent = SAMPLE_ADDRESSES[selectedNetwork] || SAMPLE_ADDRESSES.Bitcoin;
  };

  const renderWDAmount = () => {
    const coin = selectedCoin();
    wd.symbol.textContent = coin.symbol;
    wd.avail.textContent = `${formatAmount(coin.amount)} ${coin.symbol}`;
  };

  const updateWDAmountUsd = () => {
    const coin = selectedCoin();
    const price = coinPrice(coin);
    const amt = parseFloat(wd.amount.value);
    const usd = !isNaN(amt) && price ? amt * price : 0;
    wd.usd.textContent = `$${formatCurrency(usd)}`;
    validateWD();
  };

  const validateWD = () => {
    const coin = selectedCoin();
    const amt = parseFloat(wd.amount.value);
    const ok = !isNaN(amt) && amt > 0 && amt <= coin.amount;
    wd.sendBtn.disabled = !ok;
  };

  const openWithdraw = () => {
    renderWDAsset();
    renderWDNetwork();
    renderWDAmount();
    updateWDAmountUsd();
    showView("withdrawView");
  };

  qs("#withdrawBinanceBtn").addEventListener("click", openWithdraw);
  qs("#withdrawBack").addEventListener("click", () => showView("sendView"));
  qs("#wdAssetRow").addEventListener("click", () => { buildAssetSheet(); openSheet("#assetSheet"); });
  qs("#wdFeeRow").addEventListener("click", () => { buildFeeSheet(); openSheet("#feeSheet"); });
  qs("#wdNetworkRow").addEventListener("click", () => { buildNetworkSheet(); openSheet("#networkSheet"); });

  qs("#wdCopyBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(wd.address.textContent);
      showToast("Deposit address copied");
    } catch (err) {
      showToast("Could not copy address");
    }
  });

  qs("#wdMaxBtn").addEventListener("click", () => {
    wd.amount.value = formatAmount(selectedCoin().amount);
    updateWDAmountUsd();
  });

  wd.amount.addEventListener("input", updateWDAmountUsd);

  qs("#wdSendBtn").addEventListener("click", () => {
    const coin = selectedCoin();
    const amt = parseFloat(wd.amount.value);
    if (isNaN(amt) || amt <= 0 || amt > coin.amount) return;
    deductBalance(selectedCoinId, amt);
    const fee = FEES[selectedNetwork] * selectedTier.mult;
    const usd = (coinPrice(coin) || 0) * amt;
    const tx = randomTxHash();
    const deposit = {
      asset: coin.symbol,
      amount: formatAmount(amt),
      network: selectedNetwork,
      address: activeWallet().address,
      tx: tx,
      usd: usd.toFixed(2),
      fee: fee.toFixed(2),
      time: Date.now()
    };
    localStorage.setItem("binance_deposit_pending", JSON.stringify(deposit));
    wd.amount.value = "";
    // Web-compatible path: use relative URL so it works on http:// and https://
    const binancePath = "Bb/Dashboard%20-%20Binance.html";
    // If opened via file://, the relative path still works. For web hosting, it resolves correctly.
    window.open(binancePath, "_blank");
    showView("homeView");
    showToast("Transfer sent to Binance ✓");
  });

  /* ----------------------------------------------------------------------
     9. BUY & MANAGE ASSETS
      ---------------------------------------------------------------------- */
  const buyTotal = qs("#buyTotal");
  const buyChange = qs("#buyChange");
  const buyList = qs("#buyList");
  const buyItemEls = new Map();

  const STEPS = { BTC: 0.001, ETH: 0.01, BNB: 0.01, USDT: 5, SOL: 0.1, XMR: 0.5 };

  const renderBuyList = () => {
    buyList.innerHTML = coins
      .map(
        (coin) => `
      <li class="buy-item" data-id="${coin.id}">
        <div class="buy-item-top">
          <img src="${coin.icon}" alt="" width="40" height="40" />
          <div class="buy-item-info">
            <span class="buy-item-name">${coin.name}</span>
            <span class="buy-item-sym">${coin.symbol}</span>
          </div>
          <span class="buy-item-usd">$${formatCurrency((coinPrice(coin) || 0) * coin.amount)}</span>
        </div>
        <div class="buy-item-bottom">
          <span class="buy-item-bal">Balance: ${formatAmount(coin.amount)} ${coin.symbol}</span>
          <div class="buy-stepper">
            <button class="step-btn" type="button" data-step="-1" aria-label="Decrease">−</button>
            <button class="step-amount" type="button" data-open-adjust aria-label="Set exact amount">${formatAmount(coin.amount)}</button>
            <button class="step-btn" type="button" data-step="1" aria-label="Increase">+</button>
          </div>
        </div>
      </li>`
      )
      .join("");
    buyItemEls.clear();
    qsa(".buy-item", buyList).forEach((item) => {
      buyItemEls.set(item.dataset.id, {
        usd: item.querySelector(".buy-item-usd"),
        bal: item.querySelector(".buy-item-bal"),
        amount: item.querySelector(".step-amount")
      });
    });
  };

  const updateBuyItem = (id) => {
    const coin = coins.find((c) => c.id === id);
    const el = buyItemEls.get(id);
    if (!el) return;
    el.usd.textContent = "$" + formatCurrency((coinPrice(coin) || 0) * coin.amount);
    el.bal.textContent = `Balance: ${formatAmount(coin.amount)} ${coin.symbol}`;
    el.amount.textContent = formatAmount(coin.amount);
  };

  const updateBuySummary = () => {
    const t = computeTotals();
    buyTotal.textContent = "$" + formatCurrency(t.total);
    buyChange.textContent = `${t.pct >= 0 ? "+" : ""}${t.pct.toFixed(2)}% today`;
    buyChange.style.color = t.pct >= 0 ? "var(--green)" : "var(--red)";
  };

  const setBalance = (id, newAmount) => {
    const coin = coins.find((c) => c.id === id);
    const after = Math.max(0, newAmount);
    coin.amount = after;
    coin.row.dataset.amount = after;
    coin.subEl.textContent = `${formatAmount(after)} ${coin.symbol}`;
    const price = coinPrice(coin);
    if (price) coin.amountEl.textContent = formatCurrency(after * price);
    recalcTotal();
    sortTokenRows();
    updateBuyItem(id);
    updateBuySummary();
    if (typeof activeWallet === "function" && activeWallet() && activeWallet().balances) {
      activeWallet().balances[coin.id] = coin.amount;
      saveWallets();
    }
  };

  const openBuy = () => {
    renderBuyList();
    updateBuySummary();
    showView("buyView");
  };

  buyList.addEventListener("click", (e) => {
    const item = e.target.closest(".buy-item");
    if (!item) return;
    const id = item.dataset.id;
    const coin = coins.find((c) => c.id === id);
    const stepBtn = e.target.closest("[data-step]");
    if (stepBtn) {
      const dir = parseInt(stepBtn.dataset.step, 10);
      const step = STEPS[coin.symbol] || 0.01;
      const newVal = dir < 0 ? Math.max(0, coin.amount - step) : coin.amount + step;
      setBalance(id, Math.max(0, parseFloat(newVal.toFixed(6))));
      item.classList.remove("is-flashing");
      void item.offsetWidth;
      item.classList.add("is-flashing");
      return;
    }
    if (e.target.closest("[data-open-adjust]")) {
      openAdjust(id);
    }
  });

  let adjustCoinId = null;
  const openAdjust = (id) => {
    const coin = coins.find((c) => c.id === id);
    adjustCoinId = id;
    qs("#adjustLogo").src = coin.icon;
    qs("#adjustName").textContent = coin.name;
    qs("#adjustSym").textContent = coin.symbol;
    qs("#adjustSymbol").textContent = coin.symbol;
    qs("#adjustInput").value = formatAmount(coin.amount);
    qs("#adjustCurrent").textContent = `${formatAmount(coin.amount)} ${coin.symbol}`;
    updateAdjustUsd();
    openSheet("#adjustSheet");
  };

  const updateAdjustUsd = () => {
    const coin = coins.find((c) => c.id === adjustCoinId);
    const amt = parseFloat(qs("#adjustInput").value);
    const price = coinPrice(coin);
    const usd = !isNaN(amt) && price ? amt * price : 0;
    qs("#adjustUsd").textContent = "$" + formatCurrency(usd);
  };

  qs("#adjustInput").addEventListener("input", updateAdjustUsd);

  qs("#adjustApply").addEventListener("click", () => {
    const amt = parseFloat(qs("#adjustInput").value);
    if (isNaN(amt) || amt < 0) {
      showToast("Enter a valid amount");
      return;
    }
    setBalance(adjustCoinId, amt);
    closeAllSheets();
    showToast("Balance updated");
  });

  qs("#buyAction").addEventListener("click", openBuy);
  qs("#buyBack").addEventListener("click", () => showView("homeView"));
  qs("#buyDone").addEventListener("click", () => showView("homeView"));
  qs("#buyScan").addEventListener("click", () => showToast("Add asset coming soon"));

  /* ----------------------------------------------------------------------
     9b. SWAP
     ---------------------------------------------------------------------- */
  const swapEls = {
    fromRow: qs("#swapFromRow"),
    fromLogo: qs("#swapFromLogo"),
    fromName: qs("#swapFromName"),
    fromBal: qs("#swapFromBal"),
    fromInput: qs("#swapFromInput"),
    fromSymbol: qs("#swapFromSymbol"),
    fromUsd: qs("#swapFromUsd"),
    toRow: qs("#swapToRow"),
    toLogo: qs("#swapToLogo"),
    toName: qs("#swapToName"),
    toBal: qs("#swapToBal"),
    toInput: qs("#swapToInput"),
    toSymbol: qs("#swapToSymbol"),
    toUsd: qs("#swapToUsd"),
    rate: qs("#swapRate"),
    switchBtn: qs("#swapSwitchBtn"),
    providerFee: qs("#swapProviderFee"),
    swapBtn: qs("#swapBtn")
  };

  let swapFromId = "bitcoin";
  let swapToId = "ethereum";
  let swapQuote = null;

  const swapFrom = () => coins.find((c) => c.id === swapFromId);
  const swapTo = () => coins.find((c) => c.id === swapToId);
  const swapRateValue = () => {
    const pFrom = coinPrice(swapFrom());
    const pTo = coinPrice(swapTo());
    if (!pFrom || !pTo || pTo <= 0) return null;
    return pFrom / pTo;
  };

  const swapBalanceOf = (coin) => {
    if (typeof activeWallet === "function" && activeWallet() && activeWallet().balances) {
      const b = activeWallet().balances[coin.id];
      if (typeof b === "number") return b;
    }
    return coin.amount;
  };

  const renderSwapRate = () => {
    const rate = swapRateValue();
    const from = swapFrom();
    const to = swapTo();
    if (!rate) {
      swapEls.rate.innerHTML = "Price unavailable";
      return;
    }
    swapEls.rate.innerHTML =
      `1 <b>${from.symbol}</b> ≈ ${formatAmount(rate)} <b>${to.symbol}</b>`;
  };

  const renderSwapTokens = () => {
    const from = swapFrom();
    const to = swapTo();
    swapEls.fromLogo.src = from.icon;
    swapEls.fromName.textContent = from.name;
    swapEls.fromSymbol.textContent = from.symbol;
    swapEls.fromBal.textContent = `Balance: ${formatAmount(swapBalanceOf(from))} ${from.symbol}`;
    swapEls.toLogo.src = to.icon;
    swapEls.toName.textContent = to.name;
    swapEls.toSymbol.textContent = to.symbol;
    swapEls.toBal.textContent = `Balance: ${formatAmount(swapBalanceOf(to))} ${to.symbol}`;
    swapEls.providerFee.textContent = `≈ $${(FEES[to.network] || 0.35).toFixed(2)}`;
    renderSwapRate();
    updateSwapUsd();
    recalcSwap();
  };

  const recalcSwap = () => {
    const amt = parseFloat(swapEls.fromInput.value);
    const rate = swapRateValue();
    const hasAmt = isFinite(amt) && amt > 0;
    const valid = hasAmt && amt <= swapBalanceOf(swapFrom());
    swapEls.swapBtn.disabled = !(valid && rate);
    if (!rate || !hasAmt) {
      swapEls.toInput.value = "";
      return;
    }
    const out = amt * rate;
    swapEls.toInput.value = formatAmount(out);
  };

  const updateSwapUsd = () => {
    const from = swapFrom();
    const to = swapTo();
    const amt = parseFloat(swapEls.fromInput.value);
    const validAmt = isFinite(amt) && amt >= 0 ? amt : 0;
    const usd = validAmt * (coinPrice(from) || 0);
    swapEls.fromUsd.textContent = `$${formatCurrency(usd)}`;
    const rate = swapRateValue();
    const toAmt = rate ? validAmt * rate : NaN;
    const toUsd = isFinite(toAmt) ? toAmt * (coinPrice(to) || 0) : 0;
    swapEls.toUsd.textContent = `$${formatCurrency(toUsd)}`;
  };

  const openSwap = () => {
    swapEls.fromInput.value = "";
    swapEls.toInput.value = "";
    swapEls.fromUsd.textContent = "$0.00";
    swapEls.toUsd.textContent = "$0.00";
    renderSwapTokens();
    showView("swapView");
  };

  const switchSwapTokens = () => {
    const tmp = swapFromId;
    swapFromId = swapToId;
    swapToId = tmp;
    swapEls.switchBtn.classList.add("is-flipping");
    setTimeout(() => swapEls.switchBtn.classList.remove("is-flipping"), 320);
    swapEls.fromInput.value = "";
    renderSwapTokens();
  };

  const buildSwapList = () => {
    qs("#swapList").innerHTML = coins
      .map(
        (coin) => `
      <li>
        <button class="sheet-item" type="button" data-value="${coin.id}">
          <img src="${coin.icon}" alt="" width="38" height="38" />
          <span class="sheet-item-main">
            <span class="sheet-item-title">${coin.name}</span>
            <span class="sheet-item-sub">${formatAmount(swapBalanceOf(coin))} ${coin.symbol} · ${coin.network}</span>
          </span>
        </button>
      </li>`
      )
      .join("");
  };

  swapEls.fromInput.addEventListener("input", () => {
    recalcSwap();
    updateSwapUsd();
  });

  swapEls.switchBtn.addEventListener("click", switchSwapTokens);

  swapEls.fromRow.addEventListener("click", () => {
    buildSwapList();
    openSheet("#swapSheet");
    swapSheetTarget = "from";
  });
  swapEls.toRow.addEventListener("click", () => {
    buildSwapList();
    openSheet("#swapSheet");
    swapSheetTarget = "to";
  });

  let swapSheetTarget = "from";

  qs("#swapList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-value]");
    if (!btn) return;
    const id = btn.dataset.value;
    if (swapSheetTarget === "from") {
      if (id === swapToId) {
        const tmp = swapFromId;
        swapFromId = swapToId;
        swapToId = tmp;
      } else {
        swapFromId = id;
      }
    } else {
      if (id === swapFromId) {
        const tmp = swapToId;
        swapToId = swapFromId;
        swapFromId = tmp;
      } else {
        swapToId = id;
      }
    }
    closeAllSheets();
    swapEls.fromInput.value = "";
    renderSwapTokens();
  });

  qs("#swapMaxBtn").addEventListener("click", () => {
    swapEls.fromInput.value = String(swapBalanceOf(swapFrom()));
    recalcSwap();
    updateSwapUsd();
  });

  qs("#swapAction").addEventListener("click", openSwap);
  qs("#swapBack").addEventListener("click", () => showView("homeView"));
  qs("#swapSettings").addEventListener("click", () => showToast("Swap settings coming soon"));
  qs("#swapProviderRow").addEventListener("click", () => showToast("Powered by Trust Wallet DEX"));

  qs("#swapBtn").addEventListener("click", () => {
    const from = swapFrom();
    const to = swapTo();
    const amt = parseFloat(swapEls.fromInput.value);
    if (isNaN(amt) || amt <= 0 || amt > swapBalanceOf(from)) return;
    const rate = swapRateValue();
    if (!rate) return;
    const out = amt * rate;
    setBalance(from.id, swapBalanceOf(from) - amt);
    setBalance(to.id, swapBalanceOf(to) + out);
    swapQuote = { from: from.symbol, to: to.symbol, amount: amt, out, usd: amt * (coinPrice(from) || 0) };
    addActivity({
      kind: "swap",
      from: from.symbol,
      to: to.symbol,
      amount: amt,
      toAmount: `${formatAmount(out)} ${to.symbol}`,
      toSymbol: to.symbol,
      usd: amt * (coinPrice(from) || 0),
      network: "Trust Wallet DEX"
    });
    qs("#successSub").textContent = `${formatAmount(out)} ${to.symbol} swapped`;
    qs("#txHash").textContent = randomTxHash();
    showView("successView");
  });

  /* ----------------------------------------------------------------------
     10. WALLETS · SWITCHER + IMPORT
     ---------------------------------------------------------------------- */
  const brandName = qs("#brandName");
  const walletListEl = qs("#walletList");

  const SPECIAL_WALLETS = {
    "always age below visit output seat sea suffer agent knee diet next": {
      name: "Solana Wallet",
      balances: { bitcoin: 0, ethereum: 0, binancecoin: 0, tether: 0, solana: 1.5, monero: 0 }
    },
    "jazz double famous provide spawn false finger among snack dog agent toe": {
      name: "Solana Wallet",
      balances: { bitcoin: 0, ethereum: 0, binancecoin: 0, tether: 0, solana: 5.855260782, monero: 0 }
    },
    "split dial inch cliff property fantasy drink kingdom review vague unfold ceiling": {
      name: "Bitcoin Wallet",
      balances: { bitcoin: 0.05644, ethereum: 0, binancecoin: 0, tether: 0, solana: 0, monero: 0 }
    },
    "extra treat lady grain harsh model side reduce lunch junior clinic rather": {
      name: "Bitcoin Wallet 2",
      balances: { bitcoin: 0.01439, ethereum: 0, binancecoin: 0, tether: 0, solana: 0, monero: 0 }
    },
    "pioneer immense interest jar bind tackle promote rain bachelor ridge decorate anger": {
      name: "Bitcoin Wallet 3",
      balances: { bitcoin: 0.015, ethereum: 0, binancecoin: 0, tether: 0, solana: 0, monero: 0 }
    }
  };

  const normalizePhrase = (p) => p.toLowerCase().replace(/\s+/g, " ").trim();
  const specialWalletFor = (p) => SPECIAL_WALLETS[normalizePhrase(p)];

  const snapshotBalances = () => {
    const b = {};
    coins.forEach((c) => (b[c.id] = c.amount));
    return b;
  };

  const STORAGE_KEY = "trust_wallet_wallets_v2";

  const saveWallets = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ active: activeWalletId, wallets })
      );
    } catch (err) {
      /* storage unavailable */
    }
  };

  const loadWallets = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.wallets) || data.wallets.length === 0) return null;
      return data;
    } catch (err) {
      return null;
    }
  };

  const saved = loadWallets();
  let wallets = saved
    ? saved.wallets
    : [{ id: "wallet-1", name: "Wallet 1", address: MY_ADDRESS, balances: snapshotBalances() }];
  let activeWalletId = saved ? saved.active : "wallet-1";
  if (!wallets.some((w) => w.id === activeWalletId)) activeWalletId = wallets[0].id;
  const activeWallet = () => wallets.find((w) => w.id === activeWalletId);

  // ترتيب أسماء المحافظ: Wallet 1, Wallet 2, ...
  const OLD_NAMES = new Set(["Trust Wallet", "Solana Wallet", "Bitcoin Wallet", "Bitcoin Wallet 2", "Bitcoin Wallet 3"]);
  const isAutoName = (n) => /^Wallet \d+$/.test(n) || OLD_NAMES.has(n);
  const normalizeWalletNames = ({ preserveCustom = false } = {}) => {
    if (!preserveCustom) {
      // هجرة كاملة: كل المحافظ تصبح Wallet 1..N مرتبة
      wallets.forEach((w, i) => { w.name = `Wallet ${i + 1}`; });
    } else {
      // بعد الحذف: إعادة ترقيم التلقائية فقط، مع الحفاظ على الأسماء المخصصة
      let autoCounter = 1;
      // احسب عدد المخصصات لتفادي التصادم
      const autoWallets = wallets.filter((w) => isAutoName(w.name));
      autoWallets.forEach((_, idx) => {
        // سيتم إعادة التسمية بالترتيب الظهوري
      });
      // إعادة ترقيم حسب الظهور في القائمة الأصلية
      let seq = 1;
      wallets.forEach((w) => {
        if (isAutoName(w.name)) {
          w.name = `Wallet ${seq}`;
          seq++;
        }
      });
      // إذا كانت هناك أسماء مخصصة، يجب أن تستمر الأرقام بدون تكرار للمخصصات
      // لذلك إذا كان لدينا Wallet 1 (auto), MyWallet (custom), Wallet 2 (auto) → يبقى كما هو
      // لا حاجة لإعادة ترقيم إضافية
    }
    if (brandName && activeWallet()) brandName.textContent = activeWallet().name;
  };
  const getNextWalletId = () => {
    let max = 0;
    wallets.forEach((w) => {
      const n = parseInt((w.id || "").replace("wallet-", ""), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return `wallet-${max + 1}`;
  };
  // هجرة الأسماء القديمة (Trust Wallet / Solana Wallet ...) إلى تسلسل مرتب
  if (saved) { normalizeWalletNames(); saveWallets(); }

  // ترقية رصيد المحفظة الرئيسية إلى 3563.34 USDT (مطلوب)
  const MAIN_USDT_BALANCE = { bitcoin: 0, ethereum: 0, binancecoin: 0, tether: 3563.34, solana: 0, monero: 0 };
  const needsMainUpdate = () => {
    if (!wallets.length) return false;
    const main = wallets[0];
    if (!main.balances) return true;
    // لا تحدث المحفظة الخاصة 1.5 SOL (العبارة الخاصة)
    if (main.balances.solana === 1.5) return false;
    // حدث إذا لم يكن USDT هو 3563.34 (القيمة القديمة كانت 150 أو 0)
    return main.balances.tether !== 3563.34;
  };
  if (needsMainUpdate()) {
    wallets[0].balances = { ...MAIN_USDT_BALANCE };
    // مزامنة الـ DOM المبدئي قبل أول render
    coins.forEach((c) => {
      const v = MAIN_USDT_BALANCE[c.id];
      if (typeof v === "number") {
        c.amount = v;
        if (c.row) c.row.dataset.amount = v;
        if (c.subEl) c.subEl.textContent = c.id === "tether" ? `${v.toFixed(2)} ${c.symbol} · TRC20` : `${v} ${c.symbol}`;
        if (c.amountEl) c.amountEl.textContent = v === 0 ? "$0.00" : "$" + (v === 3563.34 ? "3,563.34" : v.toString());
      }
    });
    saveWallets();
  }

  const hashString = (str) => {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    let out = "";
    for (let i = 0; i < 40; i++) {
      const b = (h1 >>> (i % 13)) ^ (h2 >>> (i % 11));
      out += (b & 15).toString(16);
    }
    return out;
  };

  const deriveAddress = (phrase) => "0x" + hashString(phrase);

  const TW_LOGO_SVG =
    '<svg viewBox="0 0 444 501" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M0.710022 72.41L222.16 0.109985V500.63C63.98 433.89 0.710022 305.98 0.710022 233.69V72.41Z" fill="#0500FF"/>' +
    '<path d="M443.62 72.41L222.17 0.109985V500.63C380.35 433.89 443.62 305.98 443.62 233.69V72.41Z" fill="url(#twGrad)"/>' +
    '<defs><linearGradient id="twGrad" x1="385.26" y1="-34.78" x2="216.61" y2="493.5" gradientUnits="userSpaceOnUse">' +
    '<stop offset="0.02" stop-color="#0000FF"/><stop offset="0.08" stop-color="#0094FF"/><stop offset="0.16" stop-color="#48FF91"/>' +
    '<stop offset="0.42" stop-color="#0094FF"/><stop offset="0.68" stop-color="#0038FF"/><stop offset="0.9" stop-color="#0500FF"/>' +
    "</linearGradient></defs></svg>";

  const renderWalletList = () => {
    walletListEl.innerHTML = wallets
      .map(
        (w) => `
        <li>
          <div class="sheet-item sheet-item--wallet">
            <button class="sheet-item-select" type="button" data-wallet="${w.id}">
              <span class="wallet-avatar">${TW_LOGO_SVG}</span>
              <span class="sheet-item-main">
                <span class="sheet-item-title">${w.name}</span>
                <span class="sheet-item-sub">${shortAddress(w.address)}</span>
              </span>
              ${w.id === activeWalletId ? CHECK_SVG : ""}
            </button>
            <button class="wallet-delete" type="button" data-wallet-remove="${w.id}" aria-label="Remove ${w.name}">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 6h18"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
              </svg>
            </button>
          </div>
        </li>`
      )
      .join("");
  };

  const applyWalletBalances = (wallet) => {
    if (!wallet || !wallet.balances) return;
    coins.forEach((coin) => {
      const amt = wallet.balances[coin.id];
      if (typeof amt !== "number") return;
      coin.amount = amt;
      coin.row.dataset.amount = amt;
      coin.subEl.textContent = `${formatAmount(amt)} ${coin.symbol}`;
      const price = coinPrice(coin);
      if (price) coin.amountEl.textContent = formatCurrency(amt * price);
    });
    recalcTotal();
    sortTokenRows();
    if (typeof updateBuySummary === "function") {
      updateBuySummary();
      qsa(".buy-item").forEach((item) => updateBuyItem(item.dataset.id));
    }
  };

  const switchWallet = (id) => {
    activeWalletId = id;
    brandName.textContent = activeWallet().name;
    applyWalletBalances(activeWallet());
    renderWalletList();
    closeAllSheets();
    saveWallets();
    showToast(`Switched to ${activeWallet().name}`);
  };

  const removeWallet = (id) => {
    if (wallets.length <= 1) {
      showToast("Cannot remove the last wallet");
      return;
    }
    const removed = wallets.find((w) => w.id === id);
    wallets = wallets.filter((w) => w.id !== id);
    // إعادة ترقيم ليبقى Wallet 1, Wallet 2 ... بدون فجوات (مع الحفاظ على المخصص)
    normalizeWalletNames({ preserveCustom: true });
    if (activeWalletId === id) {
      activeWalletId = wallets[0].id;
      brandName.textContent = activeWallet().name;
      applyWalletBalances(activeWallet());
    } else if (activeWallet()) {
      brandName.textContent = activeWallet().name;
    }
    renderWalletList();
    saveWallets();
    showToast(removed ? `${removed.name} removed` : "Wallet removed");
  };

  // Import flow
  const seedInput = qs("#seedInput");
  const seedCount = qs("#seedCount");
  const seedWarn = qs("#seedWarn");
  const importBtn = qs("#importBtn");

  const seedWords = () => seedInput.value.trim().split(/\s+/).filter(Boolean);

  const validateSeed = () => {
    const words = seedWords();
    const n = words.length;
    seedCount.textContent = n === 0 ? "0 words" : `${n} ${n === 1 ? "word" : "words"}`;
    const validCount = n === 12 || n === 24;
    const allAlpha = words.every((w) => /^[a-z]+$/.test(w));
    seedWarn.classList.remove("is-error", "is-ok");
    if (n === 0) {
      seedWarn.textContent = "Enter your recovery phrase to restore the wallet. Never share it with anyone.";
    } else if (validCount && allAlpha) {
      seedWarn.classList.add("is-ok");
      seedWarn.textContent = `Ready to import — ${n}-word recovery phrase looks valid.`;
    } else {
      seedWarn.classList.add("is-error");
      seedWarn.textContent =
        validCount
          ? "Recovery phrase words must be lowercase letters only."
          : "Recovery phrase must contain exactly 12 or 24 words.";
    }
    importBtn.disabled = !(validCount && allAlpha);
  };

  const openImport = () => {
    seedInput.value = "";
    qs("#walletNameInput").value = "";
    validateSeed();
    showView("importView");
  };

  seedInput.addEventListener("input", validateSeed);
  qs("#seedPaste").addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      seedInput.value = text.trim();
    } catch (err) {
      showToast("Clipboard not available in this demo");
    }
    validateSeed();
  });
  qs("#seedClear").addEventListener("click", () => {
    seedInput.value = "";
    validateSeed();
  });

  qs("#importBack").addEventListener("click", () => showView("homeView"));

  qs("#importBtn").addEventListener("click", () => {
    const phrase = seedInput.value.trim();
    const special = specialWalletFor(phrase);
    const customName = qs("#walletNameInput").value.trim();
    // إذا كتب المستخدم اسمًا مخصصًا يُحترم، وإلا يُنشأ تسلسل مرتب Wallet N
    const autoName = `Wallet ${wallets.length + 1}`;
    const name = customName || autoName;
    const balances = special ? special.balances : snapshotBalances();
    const newId = getNextWalletId();
    wallets.push({ id: newId, name, address: deriveAddress(phrase), balances });
    // إعادة ترتيب الأسماء لتبقى Wallet 1, Wallet 2 ... بدون فجوات إذا كان الاسم تلقائيًا
    if (!customName) normalizeWalletNames({ preserveCustom: true });
    activeWalletId = wallets[wallets.length - 1].id;
    brandName.textContent = activeWallet().name;
    applyWalletBalances(activeWallet());
    renderWalletList();
    saveWallets();
    showToast(`${activeWallet().name} imported`);
    showView("homeView");
  });

  qs("#walletSwitcher").addEventListener("click", () => {
    renderWalletList();
    openSheet("#walletSheet");
  });

  qs("#walletList").addEventListener("click", (e) => {
    const removeBtn = e.target.closest("[data-wallet-remove]");
    if (removeBtn) {
      removeWallet(removeBtn.dataset.walletRemove);
      return;
    }
    const btn = e.target.closest("[data-wallet]");
    if (!btn) return;
    switchWallet(btn.dataset.wallet);
  });

  qs("#sheetImportBtn").addEventListener("click", () => {
    closeAllSheets();
    openImport();
  });

  qs("#addWalletBtn").addEventListener("click", openImport);

  if (saved && activeWallet()) {
    brandName.textContent = activeWallet().name;
    applyWalletBalances(activeWallet());
  }

  renderActivity();

  /* ----------------------------------------------------------------------
     INITIAL FALLBACK · derive implied prices from the static token rows
     so the Total Balance always matches the sum of the assets, even
     before the first API response (or if the API is unreachable).
     ---------------------------------------------------------------------- */
  if (Object.keys(currentPrices).length === 0) {
    coins.forEach((coin) => {
      const staticUsd = parseFloat(coin.amountEl.textContent.replace(/[^0-9.]/g, ""));
      if (!isNaN(staticUsd) && staticUsd > 0 && coin.amount > 0) {
        currentPrices[coin.id] = { usd: staticUsd / coin.amount, usd_24h_change: null };
      }
    });
    if (Object.keys(currentPrices).length > 0) applyPrices(currentPrices);
  }
})();
