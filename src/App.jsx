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
} from "lucide-react";

// GANTI DENGAN URL WEB APP GOOGLE APPS SCRIPT ANDA
const GAS_URL =
  "https://script.google.com/macros/s/AKfycbw_5Tv3vSalZYfygjyZyYz-Dg3zdqAOXAsVnx_hN66l14eQPjY0KWBH6bLRX4g8kR6PkA/exec";

export default function App() {
  const [view, setView] = useState("kios"); // 'kios' atau 'admin'
  const [tvs, setTvs] = useState([]);
  const [pakets, setPakets] = useState([]);
  const [transactions, setTransactions] = useState([]); // State baru untuk transaksi
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // State untuk Checkout
  const [selectedTv, setSelectedTv] = useState(null);
  const [checkoutStep, setCheckoutStep] = useState(0); // 0: hidden, 1: form, 2: payment, 3: success
  const [formData, setFormData] = useState({ noWhatsapp: "", idPaket: "" });
  const [paymentMethod, setPaymentMethod] = useState("");

  // 1. Mengambil Data dari Database (Google Sheets)
  useEffect(() => {
    fetchData();
    // Auto-refresh setiap 10 detik untuk mengupdate waktu & status
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      // Dalam implementasi nyata, aktifkan fetch di bawah ini:

      const res = await fetch(`${GAS_URL}?action=get_all_kios_data`);
      const data = await res.json();
      setTvs(data.tvs || []);
      setPakets(data.pakets || []);
      setTransactions(data.transaksi || []);

      // MOCK DATA UNTUK PREVIEW KANVAS INI:
      // setPakets([
      //   {
      //     id_paket: "PKT-1",
      //     nama_paket: "1 Jam Main",
      //     durasi_menit: 60,
      //     harga: 15000,
      //   },
      //   {
      //     id_paket: "PKT-2",
      //     nama_paket: "2 Jam Main",
      //     durasi_menit: 120,
      //     harga: 28000,
      //   },
      // ]);
      // setTvs([
      //   {
      //     id_tv: "TV-01",
      //     nama_tv: "PS 5 - Sofa A",
      //     ip_address: "192.168.1.17",
      //     status_tv: "Kosong",
      //     waktu_selesai: "",
      //   },
      //   {
      //     id_tv: "TV-02",
      //     nama_tv: "PS 5 - Sofa B",
      //     ip_address: "192.168.1.18",
      //     status_tv: "Aktif",
      //     waktu_selesai: new Date(Date.now() + 45 * 60000).toISOString(),
      //   },
      //   {
      //     id_tv: "TV-03",
      //     nama_tv: "PS 4 Pro - VIP",
      //     ip_address: "192.168.1.19",
      //     status_tv: "Kosong",
      //     waktu_selesai: "",
      //   },
      // ]);
      // setTransactions([
      //   {
      //     id_transaksi: "TRX-1715829910",
      //     id_pelanggan: "08123456789",
      //     id_tv: "TV-01",
      //     id_paket: "PKT-2",
      //     total_bayar: 28000,
      //     metode_bayar: "Cash",
      //     status_bayar: "Pending",
      //     waktu_mulai: "",
      //   },
      //   {
      //     id_transaksi: "TRX-1715829911",
      //     id_pelanggan: "08129999999",
      //     id_tv: "TV-03",
      //     id_paket: "PKT-1",
      //     total_bayar: 15000,
      //     metode_bayar: "Cash",
      //     status_bayar: "Pending",
      //     waktu_mulai: "",
      //   },
      // ]);

      setLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.error("Gagal load data", err);
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fungsi Hitung Mundur Waktu
  const getRemainingTime = (endTime) => {
    if (!endTime) return "";
    const total = Date.parse(endTime) - Date.parse(new Date());
    if (total <= 0) return "Waktu Habis";
    const m = Math.floor((total / 1000 / 60) % 60);
    const h = Math.floor((total / (1000 * 60 * 60)) % 24);
    return `${h}j ${m}m tersisa`;
  };

  // Fungsi Pembuatan Transaksi Baru (Kios)
  const handleCheckoutSubmit = async () => {
    if (!formData.noWhatsapp || !formData.idPaket || !paymentMethod)
      return alert("Lengkapi data!");

    const selectedPaket = pakets.find((p) => p.id_paket === formData.idPaket);

    const payload = {
      action: "create_transaction",
      id_tv: selectedTv.id_tv,
      id_paket: selectedPaket.id_paket,
      total: selectedPaket.harga,
      metode: paymentMethod,
      no_whatsapp: formData.noWhatsapp,
    };

    console.log("Mengirim transaksi ke GAS:", payload);

    // UNCOMMENT KODE DI BAWAH UNTUK IMPLEMENTASI NYATA
    try {
      await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      fetchData(); // Refresh data otomatis setelah insert
    } catch (err) {
      console.error("Gagal buat transaksi", err);
    }

    if (paymentMethod === "Cash") {
      setCheckoutStep(3); // Langsung sukses (Pending kasir)
    } else {
      alert("Sistem mengenerate QRIS Midtrans di layar...");
      setCheckoutStep(3);
    }
  };

  // Fungsi Konfirmasi Pembayaran Kasir (Admin)
  const handleKonfirmasiPembayaran = async (orderId) => {
    const isConfirmed = window.confirm(
      `Apakah Anda yakin ingin mengkonfirmasi pembayaran tunai untuk pesanan ${orderId}? TV akan otomatis dinyalakan.`,
    );
    if (!isConfirmed) return;

    const payload = {
      action: "payment_success",
      order_id: orderId,
    };

    console.log("Mengkonfirmasi pembayaran ke GAS:", payload);

    // UNCOMMENT KODE DI BAWAH UNTUK IMPLEMENTASI NYATA
    try {
      setRefreshing(true);
      await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      alert("Pembayaran berhasil dikonfirmasi. TV sedang dihidupkan...");
      fetchData(); // Refresh data setelah status berubah
    } catch (err) {
      alert("Terjadi kesalahan jaringan.");
      setRefreshing(false);
    }

    // MOCK RESPONSE UNTUK UI KANVAS:
    // alert(
    //   `[Simulasi] Pembayaran dikonfirmasi! \n\nSinyal GAS -> Node.js akan memicu ADB untuk TV terkait order ${orderId}.`,
    // );
    setTransactions(transactions.filter((t) => t.id_transaksi !== orderId)); // Hapus dari antrean lokal sementara
  };

  // Filter antrean transaksi (Hanya yang Cash & Pending)
  const antreanPending = transactions.filter(
    (trx) => trx.status_bayar === "Pending" && trx.metode_bayar === "Cash",
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-indigo-500">
      {/* Navbar */}
      <nav className="flex justify-between items-center p-6 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <Monitor className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-wider">
            SMART<span className="text-indigo-400">PLAY</span>
          </h1>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setView("kios")}
            className={`px-4 py-2 rounded-full font-medium transition-all ${view === "kios" ? "bg-indigo-600 shadow-lg shadow-indigo-500/20" : "bg-slate-800 hover:bg-slate-700 text-slate-300"}`}
          >
            Kios (User)
          </button>
          <button
            onClick={() => setView("admin")}
            className={`px-4 py-2 rounded-full font-medium transition-all ${view === "admin" ? "bg-indigo-600 shadow-lg shadow-indigo-500/20" : "bg-slate-800 hover:bg-slate-700 text-slate-300"}`}
          >
            Dashboard Admin
          </button>
        </div>
      </nav>

      <main className="p-8 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center mt-32 animate-pulse text-indigo-400">
            <RefreshCw className="w-12 h-12 mb-4 animate-spin opacity-50" />
            <p className="font-medium text-lg tracking-wide">
              Sinkronisasi dengan Hub Lokal...
            </p>
          </div>
        ) : view === "kios" ? (
          /* ========================================================= */
          /* TAMPILAN KIOS SELF SERVICE                                */
          /* ========================================================= */
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                Pilih TV Anda
              </h2>
              <p className="text-slate-400 text-lg">
                Sentuh layar pada TV yang kosong untuk mulai bermain.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    className={`relative p-6 rounded-2xl border transition-all duration-300 ${
                      isKosong
                        ? "bg-slate-800/50 border-emerald-500/30 hover:border-emerald-500 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] cursor-pointer hover:-translate-y-1"
                        : "bg-slate-800/80 border-rose-500/30 opacity-75 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-xl ${isKosong ? "bg-emerald-500/10" : "bg-rose-500/10"}`}
                        >
                          <Monitor
                            className={`w-8 h-8 ${isKosong ? "text-emerald-400" : "text-rose-400"}`}
                          />
                        </div>
                        <div>
                          <h3 className="font-bold text-xl">{tv.nama_tv}</h3>
                          <p className="text-xs text-slate-500 font-mono mt-1">
                            IP: {tv.ip_address}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wide ${isKosong ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}
                      >
                        {tv.status_tv.toUpperCase()}
                      </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between bg-slate-900/50 p-3.5 rounded-xl border border-slate-700/50">
                      <div className="flex items-center gap-2">
                        <Clock
                          className={`w-4 h-4 ${isKosong ? "text-slate-500" : "text-rose-400"}`}
                        />
                        <span
                          className={`text-sm font-medium ${isKosong ? "text-slate-400" : "text-slate-200"}`}
                        >
                          {isKosong
                            ? "Siap Dimainkan"
                            : getRemainingTime(tv.waktu_selesai)}
                        </span>
                      </div>
                      {!isKosong && <Lock className="w-4 h-4 text-rose-400" />}
                      {isKosong && (
                        <Unlock className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* TAMPILAN DASHBOARD ADMIN (DINAMIS)                        */
          /* ========================================================= */
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="text-3xl font-bold mb-2">
                  Dashboard Operasional
                </h2>
                <p className="text-slate-400">
                  Pantau armada TV dan konfirmasi antrean pembayaran tunai.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchData}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors border border-slate-700"
                >
                  <RefreshCw
                    className={`w-5 h-5 ${refreshing ? "animate-spin text-indigo-400" : ""}`}
                  />
                </button>
                <div className="bg-indigo-600/20 text-indigo-400 px-4 py-2.5 rounded-lg border border-indigo-500/30 flex items-center gap-2 font-medium">
                  <Settings className="w-5 h-5" /> Database Online
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Kolom Kiri: Daftar Antrean */}
              <div className="lg:col-span-2 bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
                <div className="flex items-center justify-between mb-6 border-b border-slate-700 pb-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-indigo-400" />
                    Antrean Pembayaran Tunai
                  </h3>
                  <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-xs font-bold">
                    {antreanPending.length} MENUNGGU
                  </span>
                </div>

                {antreanPending.length === 0 ? (
                  <div className="text-center py-12 bg-slate-900/50 rounded-xl border border-slate-700/50 border-dashed">
                    <CheckCircle className="w-12 h-12 text-emerald-500/50 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">
                      Tidak ada antrean pembayaran saat ini.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {antreanPending.map((trx) => {
                      // Cari detail TV dan Paket dari State
                      const tvDetail = tvs.find(
                        (t) => t.id_tv === trx.id_tv,
                      ) || { nama_tv: "TV Tidak Ditemukan" };
                      const paketDetail = pakets.find(
                        (p) => p.id_paket === trx.id_paket,
                      ) || { nama_paket: "Paket Tidak Ditemukan" };

                      return (
                        <div
                          key={trx.id_transaksi}
                          className="flex flex-col md:flex-row md:items-center justify-between p-5 bg-slate-900 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors"
                        >
                          <div className="mb-4 md:mb-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-lg text-white">
                                {trx.id_transaksi}
                              </p>
                              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                                {trx.id_pelanggan}
                              </span>
                            </div>
                            <p className="text-sm text-slate-400 flex items-center gap-2">
                              <Monitor className="w-4 h-4" /> {tvDetail.nama_tv}
                              <span className="text-slate-600">•</span>
                              <Clock className="w-4 h-4" />{" "}
                              {paketDetail.nama_paket}
                              <span className="text-slate-600">•</span>
                              <span className="font-semibold text-emerald-400">
                                Rp {trx.total_bayar.toLocaleString("id-ID")}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() =>
                                handleKonfirmasiPembayaran(trx.id_transaksi)
                              }
                              className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-600/20"
                            >
                              <CheckCircle className="w-5 h-5" /> Konfirmasi
                              Lunas
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Kolom Kanan: Info Panel */}
              <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl h-fit">
                <h3 className="text-lg font-bold mb-4 border-b border-slate-700 pb-3">
                  Ringkasan Sistem
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total TV Terdaftar</span>
                    <span className="font-bold text-xl">{tvs.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">TV Sedang Aktif</span>
                    <span className="font-bold text-xl text-emerald-400">
                      {tvs.filter((t) => t.status_tv === "Aktif").length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">TV Kosong</span>
                    <span className="font-bold text-xl text-rose-400">
                      {tvs.filter((t) => t.status_tv === "Kosong").length}
                    </span>
                  </div>
                </div>

                <div className="mt-8 p-4 bg-indigo-900/20 border border-indigo-500/20 rounded-xl">
                  <p className="text-sm text-indigo-300 leading-relaxed">
                    Data master (TV, Paket, dan Harga) diatur sepenuhnya melalui
                    Google Spreadsheet. Setiap perubahan di Spreadsheet akan
                    otomatis terupdate di sini setiap 10 detik.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL CHECKOUT */}
      {checkoutStep > 0 && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {checkoutStep === 1 && (
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold">Setup Profil</h3>
                  <button
                    onClick={() => setCheckoutStep(0)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="mb-6 p-4 bg-indigo-900/30 border border-indigo-500/30 rounded-xl flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/20 rounded-lg text-indigo-400">
                    <Monitor className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-indigo-300 mb-0.5">
                      TV Terpilih
                    </p>
                    <p className="font-bold text-lg">{selectedTv?.nama_tv}</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Pilih Durasi
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {pakets.map((p) => (
                        <div
                          key={p.id_paket}
                          onClick={() =>
                            setFormData({ ...formData, idPaket: p.id_paket })
                          }
                          className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                            formData.idPaket === p.id_paket
                              ? "bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-500/25"
                              : "bg-slate-900 border-slate-700 hover:border-slate-500"
                          }`}
                        >
                          <p className="font-bold">{p.nama_paket}</p>
                          <p className="text-xs text-slate-300 mt-1">
                            Rp {p.harga.toLocaleString("id-ID")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      No. WhatsApp
                    </label>
                    <div className="relative">
                      <User className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-500" />
                      <input
                        type="number"
                        placeholder="0812xxxxxx"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3.5 pl-11 pr-4 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
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
                  className="w-full mt-8 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg disabled:shadow-none"
                >
                  Lanjut ke Pembayaran
                </button>
              </div>
            )}

            {checkoutStep === 2 && (
              <div className="p-8">
                <div
                  className="inline-flex items-center gap-2 mb-8 cursor-pointer text-slate-400 hover:text-white transition-colors py-1 pr-4"
                  onClick={() => setCheckoutStep(1)}
                >
                  <span>←</span> <span className="font-medium">Kembali</span>
                </div>
                <h3 className="text-2xl font-bold mb-6">Metode Pembayaran</h3>
                <div className="space-y-4">
                  <div
                    onClick={() => setPaymentMethod("QRIS")}
                    className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === "QRIS"
                        ? "bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500"
                        : "bg-slate-900 border-slate-700 hover:border-slate-500"
                    }`}
                  >
                    <div className="p-3 bg-blue-500/20 text-blue-400 rounded-lg">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-lg text-white">
                        QRIS (Otomatis)
                      </p>
                      <p className="text-sm text-slate-400">
                        Scan via BCA, Gopay, OVO, dll
                      </p>
                    </div>
                  </div>
                  <div
                    onClick={() => setPaymentMethod("Cash")}
                    className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === "Cash"
                        ? "bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500"
                        : "bg-slate-900 border-slate-700 hover:border-slate-500"
                    }`}
                  >
                    <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-lg">
                      <Banknote className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-lg text-white">
                        Bayar Tunai
                      </p>
                      <p className="text-sm text-slate-400">
                        Bayar di kasir untuk aktivasi
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleCheckoutSubmit}
                  disabled={!paymentMethod}
                  className="w-full mt-8 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg disabled:shadow-none text-lg"
                >
                  Konfirmasi Pesanan
                </button>
              </div>
            )}

            {checkoutStep === 3 && (
              <div className="p-10 text-center">
                <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-white">
                  Pesanan Diterima!
                </h3>
                <p className="text-slate-400 mb-8 leading-relaxed">
                  {paymentMethod === "Cash"
                    ? "Silakan menuju meja kasir dan sebutkan nomor TV Anda. Admin akan mengkonfirmasi pembayaran dan TV akan otomatis menyala."
                    : "Sistem Midtrans memproses pembayaran QRIS... TV akan otomatis menyala setelah pembayaran berhasil."}
                </p>
                <button
                  onClick={() => {
                    setCheckoutStep(0);
                    setFormData({ noWhatsapp: "", idPaket: "" });
                    setPaymentMethod("");
                  }}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3.5 rounded-xl transition-colors"
                >
                  Kembali ke Menu
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
