"use client";
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import AuthModal from "./AuthModal";
import AgentLoginModal from "./AgentLoginModal";
import AgentWalletModal from "./AgentWalletModal";
import { Plane, Menu, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  getHeaderNavMode,
  HEADER_NAV_MAINTENANCE_MESSAGE,
  type HeaderNavProductKey,
} from "@/lib/headerNavConfig";
import {
  fetchAgentWallet,
  formatWalletAmount,
  type AgentWallet,
} from "@/lib/agentWallet";
import { getAgentPortalLoginUrl } from "@/lib/agentPortal";
import { clearUserSession, syncUserSessionFromCookie } from "@/lib/authSession";

interface HeaderProps {
  onShowProfile?: (initialTab?: string) => void;
  onShowHolidays?: () => void;
  onShowHome?: () => void;
  onSignInSuccess?: (user: any) => void;
  onShowContact?: () => void;
  onShowAgentDashboard?: () => void;
}

const CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", flag: "🇮🇳" },
  { code: "USD", symbol: "$", name: "US Dollar", flag: "🇺🇸" },
  { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺" },
  { code: "GBP", symbol: "£", name: "British Pound", flag: "🇬🇧" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", flag: "🇦🇪" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", flag: "🇸🇬" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", flag: "🇦🇺" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", flag: "🇨🇦" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", flag: "🇯🇵" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", flag: "🇲🇾" },
];

export default function Header({ onShowProfile, onShowHolidays, onShowHome, onSignInSuccess, onShowContact, onShowAgentDashboard }: HeaderProps) {
  const router = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [agent, setAgent] = useState<any>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("agent");
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });
  const [user, setUser] = useState<any>(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(CURRENCIES[0]);
  const [currencySearch, setCurrencySearch] = useState("");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [wallet, setWallet] = useState<AgentWallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currencyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    syncUserSessionFromCookie();
    const savedUser = localStorage.getItem("user");
    if (savedUser) setUser(JSON.parse(savedUser));
    const savedCurrency = localStorage.getItem("currency");
    if (savedCurrency) setSelectedCurrency(JSON.parse(savedCurrency));
  }, []);

  const loadWallet = useCallback(async () => {
    const userId = user?.userId ?? user?.id;
    if (!userId) {
      setWallet(null);
      return;
    }
    setWalletLoading(true);
    try {
      setWallet(await fetchAgentWallet(userId));
    } catch {
      setWallet(null);
    } finally {
      setWalletLoading(false);
    }
  }, [user?.userId, user?.id]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node))
        setShowProfileDropdown(false);
      if (currencyRef.current && !currencyRef.current.contains(event.target as Node)) {
        setShowCurrencyDropdown(false);
        setCurrencySearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = () => {
    clearUserSession();
    setUser(null);
    setWallet(null);
    window.location.href = getAgentPortalLoginUrl();
  };

  const openAuthModal = (mode: "signin" | "signup") => { setAuthMode(mode); setShowAuthModal(true); };

  const handleSignInSuccess = (userData: any) => {
    setUser(userData);
    setShowAuthModal(false);
    onSignInSuccess?.(userData);
  };

  const handleSelectCurrency = (currency: typeof CURRENCIES[0]) => {
    setSelectedCurrency(currency);
    localStorage.setItem("currency", JSON.stringify(currency));
    setShowCurrencyDropdown(false);
    setCurrencySearch("");
  };

  const filteredCurrencies = CURRENCIES.filter(
    (c) =>
      c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
      c.name.toLowerCase().includes(currencySearch.toLowerCase())
  );

  const goToHotels = () => {
    setMobileMenuOpen(false);
    router.push("/hotels");
  };

  const goToHolidayPartners = () => {
    setMobileMenuOpen(false);
    router.push("/holiday-partners");
  };

  const showMaintenanceNotice = () => {
    window.alert(HEADER_NAV_MAINTENANCE_MESSAGE);
  };

  /** Header product links: controlled by NEXT_PUBLIC_HEADER_NAV_* (see `headerNavConfig.ts`). */
  function NavProductControl(props: {
    navKey: HeaderNavProductKey;
    className: string;
    onLiveClick: () => void;
    children: ReactNode;
    closeMobileMenu?: boolean;
  }) {
    const { navKey, className, onLiveClick, children, closeMobileMenu } = props;
    const mode = getHeaderNavMode(navKey);
    if (mode === "hidden") return null;

    const afterClick = () => {
      if (closeMobileMenu) setMobileMenuOpen(false);
    };

    if (mode === "maintenance") {
      return (
        <button
          type="button"
          className={`${className} text-gray-400 hover:text-gray-500 cursor-pointer`}
          title="Under maintenance"
          onClick={() => {
            showMaintenanceNotice();
            afterClick();
          }}
        >
          {children}
        </button>
      );
    }

    return (
      <button
        type="button"
        className={className}
        onClick={() => {
          onLiveClick();
          afterClick();
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <>
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            {/* <Plane className="w-4 h-4 text-orange-500" /> */}
            <button onClick={() => onShowHome?.()} className="flex items-center gap-1">
              <span className="text-xl sm:text-3xl font-extrabold tracking-tight text-primary">
                Vivance Travels
              </span>
            </button>

            {/* Nav */}
            <nav className="hidden md:flex items-center space-x-6">
              <NavProductControl
                navKey="flights"
                className="flex items-center gap-2 text-gray-700 hover:text-orange-500 text-sm font-medium"
                onLiveClick={() => onShowHome?.()}
              >
                <Plane className="w-4 h-4 text-orange-500" />
                Flights
              </NavProductControl>
              <NavProductControl
                navKey="hotels"
                className="text-gray-700 hover:text-primary text-sm font-medium"
                onLiveClick={goToHotels}
              >
                🏨 Hotels
              </NavProductControl>
              <NavProductControl
                navKey="cruises"
                className="text-gray-700 hover:text-primary text-sm font-medium"
                onLiveClick={() => {}}
              >
                🚢 Cruises
              </NavProductControl>
              <NavProductControl
                navKey="holidays"
                className="text-gray-700 hover:text-primary text-sm font-medium"
                onLiveClick={() => onShowHolidays?.()}
              >
                🏖️ Old Holidays
              </NavProductControl>
              <NavProductControl
                navKey="holidayPartners"
                className="text-gray-700 hover:text-primary text-sm font-medium"
                onLiveClick={goToHolidayPartners}
              >
                🏖️ Holidays
              </NavProductControl>
              <button onClick={onShowContact} className="text-gray-700 hover:text-primary text-sm font-medium">
                📞 Contact
              </button>

            </nav>

            {/* Mobile hamburger */}
            <button
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:border-primary hover:text-primary"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Right side: Currency + Auth */}
            <div className="hidden md:flex items-center gap-3">
              {/* Currency Selector */}
              <div className="relative" ref={currencyRef}>
                <button
                  onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                  className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm hover:border-primary hover:text-primary transition-colors"
                >
                  <span className="text-base">{selectedCurrency.flag}</span>
                  <span className="font-medium">{selectedCurrency.code}</span>
                  <span className="text-gray-400 text-xs">{selectedCurrency.symbol}</span>
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showCurrencyDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                    <div className="p-2 border-b">
                      <input
                        type="text"
                        placeholder="Search currency..."
                        value={currencySearch}
                        onChange={(e) => setCurrencySearch(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {filteredCurrencies.map((currency) => (
                        <button
                          key={currency.code}
                          onClick={() => handleSelectCurrency(currency)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                            selectedCurrency.code === currency.code ? "bg-primary/5 text-primary font-medium" : "text-gray-700"
                          }`}
                        >
                          <span className="text-xl">{currency.flag}</span>
                          <div className="flex-1 text-left">
                            <div className="font-medium">{currency.code}</div>
                            <div className="text-xs text-gray-500">{currency.name}</div>
                          </div>
                          <span className="text-gray-400 font-medium">{currency.symbol}</span>
                          {selectedCurrency.code === currency.code && (
                            <span className="text-primary text-xs">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Agent wallet summary */}
              {user && (walletLoading || wallet) && (
                <div className="hidden lg:flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs">
                  {walletLoading && !wallet ? (
                    <span className="text-gray-500">Loading wallet…</span>
                  ) : wallet ? (
                    <>
                      <span className="text-gray-600">
                        Balance{" "}
                        <span className="font-semibold text-gray-900">{formatWalletAmount(wallet.balance)}</span>
                      </span>
                      <span className="text-orange-300">|</span>
                      <span className="text-gray-600">
                        Available to Book{" "}
                        <span className="font-semibold text-gray-900">{formatWalletAmount(wallet.availableToBook)}</span>
                      </span>
                      <span className="text-orange-300">|</span>
                      <span className="text-gray-600">
                        Due{" "}
                        <span className={`font-semibold ${wallet.dueAmount > 0 ? "text-red-600" : "text-gray-900"}`}>
                          {formatWalletAmount(wallet.dueAmount)}
                        </span>
                      </span>
                    </>
                  ) : null}
                </div>
              )}

              {/* Auth / Profile */}
              {user ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                    className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                      {user.firstName?.[0]?.toUpperCase()}
                    </div>
                    <span className="hidden md:block font-medium">{user.firstName}</span>
                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showProfileDropdown && (
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50">
                      <div className="px-4 py-2 border-b">
                        <div className="font-semibold text-sm">{user.firstName} {user.lastName}</div>
                        <div className="text-xs text-gray-500 truncate">{user.email}</div>
                      </div>
                      <button
                        onClick={() => { onShowProfile?.("overview"); setShowProfileDropdown(false); }}
                        className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        🗺️ My Trips
                      </button>
                      <button
                        onClick={() => { onShowProfile?.("bookings"); setShowProfileDropdown(false); }}
                        className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        🎫 My Bookings
                      </button>
                      <button
                        onClick={() => {
                          // Ensure this works from any page (e.g. flight search) by navigating to dashboard.
                          router.push("/dashboard?tab=family");
                          onShowProfile?.("family");
                          setShowProfileDropdown(false);
                        }}
                        className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        👨‍👩‍👧‍👦 Family
                      </button>
                      <button
                        onClick={() => {
                          setShowWalletModal(true);
                          setShowProfileDropdown(false);
                        }}
                        className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        💰 Manage Wallet
                      </button>
                      <button
                        onClick={() => { setShowChangePasswordModal(true); setShowProfileDropdown(false); }}
                        className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        🔑 Change Password
                      </button>
                      <div className="border-t mt-1">
                        <button
                          onClick={() => { handleSignOut(); setShowProfileDropdown(false); }}
                          className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          🚪 Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openAuthModal("signin")}
                    className="text-sm text-primary hover:text-primary-dark font-medium px-3 py-1.5"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => openAuthModal("signup")}
                    className="text-sm bg-primary text-white px-4 py-1.5 rounded-lg hover:bg-primary-dark font-medium"
                  >
                    Sign Up
                  </button>
                  {/* Agent Login / Agent Dashboard button */}
                  {/* {agent ? (
                    <button
                      onClick={() => onShowAgentDashboard?.()}
                      className="flex items-center gap-1.5 text-sm border-2 border-primary text-primary px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white font-semibold transition-colors"
                    >
                      <span>🧑‍💼</span>
                      <span>{agent.name.split(" ")[0]}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowAgentModal(true)}
                      className="flex items-center gap-1.5 text-sm border-2 border-primary text-primary px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white font-semibold transition-colors"
                    >
                      🧑‍💼 Agent Login
                    </button>
                  )} */}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Nav Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-lg z-40 px-4 py-3 flex flex-col gap-1">
          <NavProductControl
            navKey="flights"
            className="flex items-center gap-2 text-left text-gray-700 hover:text-primary py-2 text-sm font-medium"
            onLiveClick={() => onShowHome?.()}
            closeMobileMenu
          >
            <Plane className="w-4 h-4 text-orange-500" /> Flights
          </NavProductControl>
          <NavProductControl
            navKey="hotels"
            className="text-left text-gray-700 hover:text-primary py-2 text-sm font-medium"
            onLiveClick={goToHotels}
            closeMobileMenu
          >
            🏨 Hotels
          </NavProductControl>
          <NavProductControl
            navKey="cruises"
            className="text-left text-gray-700 hover:text-primary py-2 text-sm font-medium"
            onLiveClick={() => {}}
            closeMobileMenu
          >
            🚢 Cruises
          </NavProductControl>
          <NavProductControl
            navKey="holidays"
            className="text-left text-gray-700 hover:text-primary py-2 text-sm font-medium"
            onLiveClick={() => onShowHolidays?.()}
            closeMobileMenu
          >
            🏖️ Old Holidays
          </NavProductControl>
          <NavProductControl
            navKey="holidayPartners"
            className="text-left text-gray-700 hover:text-primary py-2 text-sm font-medium"
            onLiveClick={goToHolidayPartners}
            closeMobileMenu
          >
            🏖️ Holidays
          </NavProductControl>
          <button onClick={() => { onShowContact?.(); setMobileMenuOpen(false); }} className="text-left text-gray-700 hover:text-primary py-2 text-sm font-medium">📞 Contact</button>
          {user && wallet && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-gray-700 space-y-1">
              <div>Balance: <span className="font-semibold">{formatWalletAmount(wallet.balance)}</span></div>
              <div>Available to Book: <span className="font-semibold">{formatWalletAmount(wallet.availableToBook)}</span></div>
              <div>Due: <span className={`font-semibold ${wallet.dueAmount > 0 ? "text-red-600" : ""}`}>{formatWalletAmount(wallet.dueAmount)}</span></div>
            </div>
          )}
          {user && (
            <button
              onClick={() => { setShowWalletModal(true); setMobileMenuOpen(false); }}
              className="flex items-center gap-1.5 text-sm font-semibold text-primary border border-primary rounded-lg px-3 py-2 hover:bg-primary hover:text-white transition-colors mt-1"
            >
              💰 Manage Wallet
            </button>
          )}
          <button
            onClick={() => { user ? onShowProfile?.() : openAuthModal("signin"); setMobileMenuOpen(false); }}
            className="flex items-center gap-1.5 text-sm font-semibold text-primary border border-primary rounded-lg px-3 py-2 hover:bg-primary hover:text-white transition-colors mt-1"
          >
            🗺️ My Trips
          </button>
          {!user && (
            <div className="flex gap-2 mt-1">
              <button onClick={() => { openAuthModal("signin"); setMobileMenuOpen(false); }} className="flex-1 text-sm text-primary border border-primary rounded-lg px-3 py-2 font-medium">Sign In</button>
              <button onClick={() => { openAuthModal("signup"); setMobileMenuOpen(false); }} className="flex-1 text-sm bg-primary text-white rounded-lg px-3 py-2 font-medium">Sign Up</button>
            </div>
          )}
        </div>
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
        onSignInSuccess={handleSignInSuccess}
      />

      <AgentLoginModal
        isOpen={showAgentModal}
        onClose={() => setShowAgentModal(false)}
        onLoginSuccess={(agentData) => {
          setAgent(agentData);
          onShowAgentDashboard?.();
        }}
      />

      {showChangePasswordModal && (
        <AuthModal
          isOpen={showChangePasswordModal}
          onClose={() => setShowChangePasswordModal(false)}
          initialMode="reset"
        />
      )}

      {user && showWalletModal && (
        <AgentWalletModal
          isOpen={showWalletModal}
          onClose={() => setShowWalletModal(false)}
          userId={user.userId ?? user.id}
          performedByUserId={user.userId ?? user.id}
          onWalletUpdated={loadWallet}
        />
      )}
    </>
  );
}
