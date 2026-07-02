import React, { useState, useEffect } from "react";
import {
  Monitor,
  Clock,
  CreditCard,
  Banknote,
  User,
  CheckCircle,
  Lock,
  Unlock,
  Settings,
  ShoppingCart,
  RefreshCw,
  Loader2,
  ScanLine,
  KeyRound,
  StopCircle,
} from "lucide-react";

// GANTI DENGAN URL WEB APP GOOGLE APPS SCRIPT ANDA
const GAS_URL =
  "https://script.google.com/macros/s/AKfycbzH68zbBh0Ga4z7Pg2yU79K5-Es-Gio5UZiJviJcl8ClgUl5vf1gPlAWAu70UEBUqKeUg/exec";

export default function App() {
  const [view, setView] = useState("kios");
  const [tvs, setTvs] = useState([]);
  const [pakets, setPakets] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // State Kiosk
  const [selectedTv, setSelectedTv] = useState(null);
  const [checkoutStep, setCheckoutStep] = useState(0);
  const [formData, setFormData] = useState({ noWhatsapp: "", idPaket: "" });
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("Pending");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [orderId, setOrderId] = useState("");

  // State Admin Security
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [adminPass, setAdminPass] = useState("");

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const res = await fetch(`${GAS_URL}?action=get_all_kios_data`);
      const data = await res.json();
      setTvs(data.tvs || []);
      setPakets(data.pakets || []);
      setTransactions(data.transaksi || []);
      setLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.error("Gagal load data", err);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getRemainingTime = (endTime) => {
    if (!endTime) return "";
    if (endTime === "PERSONAL") return "Open Billing";
    const total = Date.parse(endTime) - Date.parse(new Date());
    if (total <= 0) return "Waktu Habis";
    const m = Math.floor((total / 1000 / 60) % 60);
    const h = Math.floor((total / (1000 * 60 * 60)) % 24);
    return `${h}j ${m}m tersisa`;
  };

  // Menggabungkan paket database dengan paket personal statis
  const allPakets = [
    ...pakets,
    {
      id_paket: "PKT-PERSONAL",
      nama_paket: "Personal (Open Billing)",
      harga: 0,
      type: "personal",
    },
  ];

  const handleCheckoutSubmit = async () => {
    if (!formData.noWhatsapp || !formData.idPaket)
      return alert("Lengkapi data!");

    // Auto-set metode bayar ke Cash jika paket personal
    const isPersonal = formData.idPaket === "PKT-PERSONAL";
    const finalPaymentMethod = isPersonal ? "Cash" : paymentMethod;
    if (!finalPaymentMethod) return alert("Pilih metode pembayaran!");

    setIsProcessingPayment(true);
    const selectedPaket = allPakets.find(
      (p) => p.id_paket === formData.idPaket,
    );

    const payload = {
      action: "create_transaction",
      id_tv: selectedTv.id_tv,
      id_paket: selectedPaket.id_paket,
      total: selectedPaket.harga,
      metode: finalPaymentMethod,
      no_whatsapp: formData.noWhatsapp,
    };

    try {
      const res = await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json();
      if (!responseData.success)
        throw new Error(responseData.error || "Akses ditolak.");

      setOrderId(responseData.id_transaksi);

      if (finalPaymentMethod === "Cash") {
        setCheckoutStep(4);
      } else if (finalPaymentMethod === "QRIS") {
        setPaymentStatus("Pending");
        if (!responseData.qr_string)
          throw new Error("Gagal mengambil QRIS dari Midtrans.");
        setQrCodeUrl(responseData.qr_string);
        setCheckoutStep(3);
      }
      setIsProcessingPayment(false);
      fetchData();
    } catch (err) {
      alert(`GAGAL!\nDetail: ${err.message}`);
      setIsProcessingPayment(false);
    }
  };

  const handleKonfirmasiPembayaran = async (orderIdToConfirm) => {
    const isConfirmed = window.confirm(
      `Konfirmasi pembayaran awal untuk pesanan ${orderIdToConfirm}?`,
    );
    if (!isConfirmed) return;

    try {
      setRefreshing(true);
      await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "payment_success",
          order_id: orderIdToConfirm,
        }),
      });
      alert("Aktivasi berhasil!");
      fetchData();
    } catch (err) {
      alert("Gagal koneksi.");
      setRefreshing(false);
    }
  };

  const handleStopPersonal = async (orderIdToStop) => {
    const isConfirmed = window.confirm(
      `Hentikan tagihan Open Billing untuk transaksi ${orderIdToStop}?`,
    );
    if (!isConfirmed) return;

    try {
      setRefreshing(true);
      const res = await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "stop_personal_billing",
          order_id: orderIdToStop,
        }),
      });
      const data = await res.json();

      if (data.success) {
        alert(
          `Waktu dihentikan!\nDurasi Main: ${data.durasi_menit} Menit\nTotal Tagihan: Rp ${data.total_bayar.toLocaleString("id-ID")}\n\nSilakan tagih ke pelanggan.`,
        );
        fetchData();
      } else {
        alert("Gagal menghentikan tagihan.");
      }
    } catch (err) {
      alert("Gagal koneksi.");
      setRefreshing(false);
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPass === "sikatabis38") {
      setIsAdminAuth(true);
      setAdminPass("");
    } else {
      alert("PIN Salah!");
      setAdminPass("");
    }
  };

  useEffect(() => {
    if (checkoutStep !== 3 || !orderId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `${GAS_URL}?action=check_transaction&order_id=${orderId}`,
        );
        const data = await res.json();
        if (data.status === "Paid") {
          clearInterval(interval);
          setPaymentStatus("Paid");
          alert("Pembayaran berhasil!");
          resetState();
          fetchData();
        }
      } catch (err) {
        console.error(err);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [checkoutStep, orderId]);

  const antreanPending = transactions.filter(
    (trx) =>
      trx.status_bayar === "Pending" &&
      (trx.metode_bayar === "Cash" || trx.metode_bayar === "QRIS"),
  );

  const transaksiPersonalAktif = transactions.filter(
    (trx) =>
      trx.status_bayar === "Paid" &&
      trx.id_paket === "PKT-PERSONAL" &&
      tvs.find(
        (t) =>
          t.id_tv === trx.id_tv &&
          t.status_tv === "Aktif" &&
          t.waktu_selesai === "PERSONAL",
      ),
  );

  const resetState = () => {
    setCheckoutStep(0);
    setFormData({ noWhatsapp: "", idPaket: "" });
    setPaymentMethod("");
    setQrCodeUrl("");
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-indigo-500">
      <nav className="flex justify-between items-center p-4 md:p-6 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <Monitor className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <h1 className="text-lg md:text-xl font-bold tracking-wider">
            SMART<span className="text-indigo-400">PLAY</span>
          </h1>
        </div>
        <div className="flex gap-2 md:gap-4">
          <button
            onClick={() => setView("kios")}
            className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-sm md:text-base font-medium transition-all ${view === "kios" ? "bg-indigo-600 shadow-lg shadow-indigo-500/20" : "bg-slate-800 hover:bg-slate-700 text-slate-300"}`}
          >
            Kios
          </button>
          <button
            onClick={() => setView("admin")}
            className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-sm md:text-base font-medium transition-all ${view === "admin" ? "bg-indigo-600 shadow-lg shadow-indigo-500/20" : "bg-slate-800 hover:bg-slate-700 text-slate-300"}`}
          >
            Admin
          </button>
        </div>
      </nav>

      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center mt-32 text-indigo-400">
            <RefreshCw className="w-12 h-12 mb-4 animate-spin opacity-50" />
            <p className="font-medium text-lg tracking-wide animate-pulse">
              Memuat sistem...
            </p>
          </div>
        ) : view === "kios" ? (
          /* ========================================================= */
          /* TAMPILAN KIOS */
          /* ========================================================= */
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-3xl md:text-4xl font-extrabold mb-2 md:mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                Pilih TV Anda
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {tvs.map((tv) => {
                const isKosong = tv.status_tv === "Kosong";
                return (
                  <div
                    key={tv.id_tv}
                    onClick={() => {
                      if (isKosong) {
                        setSelectedTv(tv);
                        setCheckoutStep(1);
                      }
                    }}
                    className={`relative p-5 md:p-6 rounded-2xl border transition-all duration-300 ${isKosong ? "bg-slate-800/50 border-emerald-500/30 hover:border-emerald-500 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] cursor-pointer hover:-translate-y-1" : "bg-slate-800/80 border-rose-500/30 opacity-75 cursor-not-allowed"}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-xl ${isKosong ? "bg-emerald-500/10" : "bg-rose-500/10"}`}
                        >
                          <Monitor
                            className={`w-6 h-6 md:w-8 md:h-8 ${isKosong ? "text-emerald-400" : "text-rose-400"}`}
                          />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg md:text-xl">
                            {tv.nama_tv}
                          </h3>
                          <p className="text-xs md:text-sm text-gray-400 font-mono mt-0.5">
                            {tv.id_tv}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`px-2 py-1 md:px-3 md:py-1.5 rounded-full text-[10px] md:text-xs font-bold tracking-wide ${isKosong ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}
                      >
                        {tv.status_tv.toUpperCase()}
                      </div>
                    </div>
                    <div className="mt-4 md:mt-6 flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                      <div className="flex items-center gap-2">
                        <Clock
                          className={`w-4 h-4 ${isKosong ? "text-slate-500" : "text-rose-400"}`}
                        />
                        <span
                          className={`text-xs md:text-sm font-medium ${isKosong ? "text-slate-400" : "text-slate-200"}`}
                        >
                          {isKosong
                            ? "Siap Dimainkan"
                            : getRemainingTime(tv.waktu_selesai)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* TAMPILAN DASHBOARD ADMIN */
          /* ========================================================= */
          <div className="animate-in fade-in duration-300">
            {!isAdminAuth ? (
              <div className="flex justify-center items-center mt-12 md:mt-24">
                <form
                  onSubmit={handleAdminLogin}
                  className="bg-slate-800/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-700 shadow-2xl w-full max-w-sm"
                >
                  <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <KeyRound className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold text-center mb-6">
                    Otorisasi Admin
                  </h3>
                  <input
                    type="password"
                    placeholder="Masukkan PIN"
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-4 px-4 text-center text-xl tracking-[0.5em] focus:outline-none focus:border-indigo-500 mb-6 font-mono"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg"
                  >
                    Akses Dashboard
                  </button>
                </form>
              </div>
            ) : (
              <div className="slide-in-from-bottom-4 duration-300">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold mb-2">
                      Dashboard Operasional
                    </h2>
                    <p className="text-sm md:text-base text-slate-400">
                      Pantau armada TV dan kontrol tagihan.
                    </p>
                  </div>
                  <button
                    onClick={fetchData}
                    className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 border border-slate-700 flex items-center gap-2 text-sm"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-400" : ""}`}
                    />{" "}
                    Refresh
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* KOLOM KIRI: ANTREAN TUNAI BARU */}
                  <div className="bg-slate-800 rounded-3xl p-5 md:p-6 border border-slate-700 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg md:text-xl font-bold text-white">
                        Aktivasi Tunai Baru
                      </h3>
                      <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                        {antreanPending.length} Pending
                      </span>
                    </div>
                    {antreanPending.length === 0 ? (
                      <p className="text-center py-8 text-slate-400 text-sm">
                        Tidak ada antrean aktivasi.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {antreanPending.map((trx) => (
                          <div
                            key={trx.id_transaksi}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-slate-700 bg-slate-900 gap-4"
                          >
                            <div>
                              <p className="font-bold text-white mb-1">
                                #{trx.id_transaksi}
                              </p>
                              <p className="text-xs text-slate-400 mb-2">
                                WA: {trx.id_pelanggan} | {trx.id_tv}
                              </p>
                              <p className="text-lg font-bold text-emerald-400">
                                Rp {trx.total_bayar.toLocaleString("id-ID")}
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                handleKonfirmasiPembayaran(trx.id_transaksi)
                              }
                              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-sm transition-all shadow-lg"
                            >
                              ✓ Konfirmasi
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* KOLOM KANAN: KONTROL OPEN BILLING */}
                  <div className="bg-slate-800 rounded-3xl p-5 md:p-6 border border-slate-700 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg md:text-xl font-bold text-white">
                        Monitoring Open Billing
                      </h3>
                      <span className="px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold">
                        {transaksiPersonalAktif.length} Aktif
                      </span>
                    </div>
                    {transaksiPersonalAktif.length === 0 ? (
                      <p className="text-center py-8 text-slate-400 text-sm">
                        Tidak ada pelanggan Open Billing.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {transaksiPersonalAktif.map((trx) => (
                          <div
                            key={trx.id_transaksi}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-indigo-500/30 bg-slate-900 gap-4"
                          >
                            <div>
                              <p className="font-bold text-white mb-1">
                                {trx.id_tv}
                              </p>
                              <p className="text-xs text-indigo-300 mb-2">
                                Mulai:{" "}
                                {new Date(trx.waktu_mulai).toLocaleTimeString(
                                  "id-ID",
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </p>
                              <p className="text-xs text-slate-400">
                                Tarif otomatis berjalan
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                handleStopPersonal(trx.id_transaksi)
                              }
                              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 font-semibold text-sm transition-all shadow-lg flex justify-center items-center gap-2"
                            >
                              <StopCircle className="w-4 h-4" /> Stop & Tagih
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL CHECKOUT FLOW */}
      {checkoutStep > 0 && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-t-3xl sm:rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* STEP 1: FORM DURASI */}
            {checkoutStep === 1 && (
              <div className="p-6 md:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl md:text-2xl font-bold">
                    Pilih Durasi
                  </h3>
                  <button
                    onClick={resetState}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    {allPakets.map((p) => (
                      <div
                        key={p.id_paket}
                        onClick={() => {
                          setFormData({ ...formData, idPaket: p.id_paket });
                          if (p.type === "personal") setPaymentMethod("Cash");
                          else setPaymentMethod("");
                        }}
                        className={`p-3 md:p-4 rounded-xl border text-center cursor-pointer transition-all ${formData.idPaket === p.id_paket ? "bg-indigo-600 border-indigo-400 shadow-lg" : "bg-slate-900 border-slate-700"}`}
                      >
                        <p className="font-bold text-sm md:text-base">
                          {p.nama_paket}
                        </p>
                        <p className="text-xs md:text-sm text-indigo-200 mt-1">
                          {p.type === "personal"
                            ? "Bayar Akhir"
                            : `Rp ${p.harga.toLocaleString("id-ID")}`}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-slate-400 mb-2">
                      No. WhatsApp
                    </label>
                    <div className="relative">
                      <User className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-500" />
                      <input
                        type="number"
                        placeholder="0812xxxxxx"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 md:py-3.5 pl-11 pr-4 focus:outline-none focus:border-indigo-500 text-sm md:text-base"
                        value={formData.noWhatsapp}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            noWhatsapp: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setCheckoutStep(2)}
                  disabled={!formData.noWhatsapp || !formData.idPaket}
                  className="w-full mt-8 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3.5 md:py-4 rounded-xl transition-all"
                >
                  Lanjut Pembayaran
                </button>
              </div>
            )}

            {/* STEP 2: METODE PEMBAYARAN */}
            {checkoutStep === 2 && (
              <div className="p-6 md:p-8 relative">
                <div
                  className="inline-flex items-center gap-2 mb-6 cursor-pointer text-slate-400 text-sm"
                  onClick={() => !isProcessingPayment && setCheckoutStep(1)}
                >
                  <span>← Kembali</span>
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-6">
                  Metode Pembayaran
                </h3>
                <div className="space-y-3 md:space-y-4">
                  {formData.idPaket !== "PKT-PERSONAL" && (
                    <div
                      onClick={() =>
                        !isProcessingPayment && setPaymentMethod("QRIS")
                      }
                      className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${paymentMethod === "QRIS" ? "bg-indigo-600/20 border-indigo-500" : "bg-slate-900 border-slate-700"}`}
                    >
                      <div className="p-2 md:p-3 bg-blue-500/20 text-blue-400 rounded-lg">
                        <ScanLine className="w-5 h-5 md:w-6 md:h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-base md:text-lg text-white">
                          QRIS
                        </p>
                        <p className="text-xs md:text-sm text-slate-400">
                          Scan via Semua Bank / E-Wallet
                        </p>
                      </div>
                    </div>
                  )}
                  <div
                    onClick={() =>
                      !isProcessingPayment && setPaymentMethod("Cash")
                    }
                    className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${paymentMethod === "Cash" ? "bg-indigo-600/20 border-indigo-500" : "bg-slate-900 border-slate-700"}`}
                  >
                    <div className="p-2 md:p-3 bg-emerald-500/20 text-emerald-400 rounded-lg">
                      <Banknote className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-base md:text-lg text-white">
                        Bayar Tunai
                      </p>
                      <p className="text-xs md:text-sm text-slate-400">
                        {formData.idPaket === "PKT-PERSONAL"
                          ? "Tagihan dihitung saat selesai main"
                          : "Bayar di meja kasir"}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleCheckoutSubmit}
                  disabled={!paymentMethod || isProcessingPayment}
                  className="w-full mt-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 md:py-4 rounded-xl flex justify-center items-center gap-2 transition-all"
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Memproses...
                    </>
                  ) : formData.idPaket === "PKT-PERSONAL" ? (
                    "Mulai Main Sekarang"
                  ) : (
                    "Konfirmasi Pesanan"
                  )}
                </button>
              </div>
            )}

            {/* STEP 3 & 4 SAMA SEPERTI SEBELUMNYA ... */}
            {/* TAMPILAN QRIS DI LAYAR */}
            {checkoutStep === 3 && (
              <div className="p-6 md:p-8 text-center animate-in fade-in zoom-in duration-300">
                <h3 className="text-xl md:text-2xl font-bold mb-1 text-white">
                  Scan untuk Membayar
                </h3>
                <p className="text-slate-400 mb-6 font-mono text-xs md:text-sm">
                  ID: {orderId}
                </p>
                <div className="bg-white p-3 md:p-4 rounded-2xl inline-block shadow-[0_0_40px_rgba(79,70,229,0.2)] mb-6">
                  <img
                    src={qrCodeUrl}
                    alt="QRIS Midtrans"
                    className="w-48 h-48 md:w-56 md:h-56 object-contain"
                  />
                </div>
                <p className="text-slate-300 bg-slate-900 p-4 rounded-xl border border-slate-700 text-xs md:text-sm leading-relaxed mb-6">
                  Scan kode QRIS di atas. TV akan otomatis menyala setelah
                  pembayaran berhasil.
                </p>
                <div className="mt-2 mb-4">
                  {paymentStatus === "Pending" ? (
                    <span className="text-yellow-400 text-sm">
                      Menunggu pembayaran...
                    </span>
                  ) : (
                    <span className="text-green-400 font-bold">
                      Pembayaran berhasil ✓
                    </span>
                  )}
                </div>
                <button
                  onClick={resetState}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3.5 rounded-xl transition-colors"
                >
                  Batal / Kembali
                </button>
              </div>
            )}

            {/* SUKSES TUNAI / PERSONAL */}
            {checkoutStep === 4 && (
              <div className="p-8 md:p-10 text-center">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-8 h-8 md:w-10 md:h-10" />
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-3 text-white">
                  Pesanan Terkonfirmasi
                </h3>
                <p className="text-slate-400 mb-8 text-sm md:text-base leading-relaxed">
                  {formData.idPaket === "PKT-PERSONAL"
                    ? "Permintaan Open Billing diteruskan. Tunggu konfirmasi Admin untuk menyalakan TV."
                    : "Silakan menuju kasir untuk pembayaran tunai. TV otomatis menyala setelah lunas."}
                </p>
                <button
                  onClick={resetState}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3.5 rounded-xl transition-colors"
                >
                  Tutup Menu
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
