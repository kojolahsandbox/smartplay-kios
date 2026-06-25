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

  const [selectedTv, setSelectedTv] = useState(null);
  const [checkoutStep, setCheckoutStep] = useState(0);
  const [formData, setFormData] = useState({ noWhatsapp: "", idPaket: "" });
  const [paymentMethod, setPaymentMethod] = useState("");

  const [paymentStatus, setPaymentStatus] = useState("Pending");

  // State khusus untuk menampung URL QR Code
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [orderId, setOrderId] = useState("");

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setRefreshing(true);

      // HAPUS COMMENT DI BAWAH JIKA SUDAH TERKONEKSI DENGAN GAS
      const res = await fetch(`${GAS_URL}?action=get_all_kios_data`);
      const data = await res.json();
      setTvs(data.tvs || []);
      setPakets(data.pakets || []);
      setTransactions(data.transaksi || []);

      // ===== MOCK DATA SEMENTARA =====
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
      // setTransactions([]);
      // ===== AKHIR MOCK DATA =====

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
    const total = Date.parse(endTime) - Date.parse(new Date());
    if (total <= 0) return "Waktu Habis";
    const m = Math.floor((total / 1000 / 60) % 60);
    const h = Math.floor((total / (1000 * 60 * 60)) % 24);
    return `${h}j ${m}m tersisa`;
  };

  const handleCheckoutSubmit = async () => {
    if (!formData.noWhatsapp || !formData.idPaket || !paymentMethod)
      return alert("Lengkapi data!");

    setIsProcessingPayment(true);
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

    try {
      // ==========================================
      // MEMANGGIL GAS UNTUK MEMINTA QR / BUAT TRX
      // ==========================================
      const res = await fetch(GAS_URL, {
        method: "POST",
        // GAS membutuhkan header text/plain walau isinya JSON untuk menghindari preflight CORS issue pada metode POST tertentu
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json();
      console.log("<- Respons dari GAS:", responseData);

      // JIKA GAS MENGEMBALIKAN ERROR
      if (!responseData.success) {
        throw new Error(
          responseData.error || "Midtrans / GAS menolak permintaan.",
        );
      }

      setOrderId(responseData.id_transaksi);

      if (paymentMethod === "Cash") {
        setCheckoutStep(4); // Sukses Bayar Tunai
      } else if (paymentMethod === "QRIS") {
        // JIKA MEMILIH QRIS TAPI GAS TIDAK MEMBERIKAN QR STRING
        setPaymentStatus("Pending");
        if (!responseData.qr_string) {
          throw new Error(
            "Transaksi berhasil dicatat, tetapi GAS tidak mengembalikan qr_string dari Midtrans.",
          );
        }

        setQrCodeUrl(responseData.qr_string);
        setCheckoutStep(3);
      }
      setIsProcessingPayment(false);
      fetchData(); // Refresh data Kios
    } catch (err) {
      console.error("[ERROR CHECKOUT]:", err);
      // TAMPILKAN DETAIL ERROR AGAR KITA TAHU MASALAHNYA
      alert(`GAGAL!\nDetail: ${err.message}`);
      setIsProcessingPayment(false);
    }
  };

  const handleKonfirmasiPembayaran = async (orderIdToConfirm) => {
    const isConfirmed = window.confirm(
      `Konfirmasi pembayaran untuk pesanan ${orderIdToConfirm}?`,
    );
    if (!isConfirmed) return;

    try {
      setRefreshing(true);
      await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "payment_success",
          order_id: orderIdToConfirm,
        }),
      });
      alert("Pembayaran berhasil dikonfirmasi.");
      setTransactions(
        transactions.filter((t) => t.id_transaksi !== orderIdToConfirm),
      );
      fetchData();
    } catch (err) {
      alert("Gagal koneksi.");
      setRefreshing(false);
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

  const resetState = () => {
    setCheckoutStep(0);
    setFormData({ noWhatsapp: "", idPaket: "" });
    setPaymentMethod("");
    setQrCodeUrl("");
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-indigo-500">
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
          <div className="flex flex-col items-center justify-center mt-32 text-indigo-400">
            <RefreshCw className="w-12 h-12 mb-4 animate-spin opacity-50" />
            <p className="font-medium text-lg tracking-wide animate-pulse">
              Menyiapkan sistem...
            </p>
          </div>
        ) : view === "kios" ? (
          /* TAMPILAN KIOS */
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                Pilih TV Anda
              </h2>
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
                    className={`relative p-6 rounded-2xl border transition-all duration-300 ${isKosong ? "bg-slate-800/50 border-emerald-500/30 hover:border-emerald-500 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] cursor-pointer hover:-translate-y-1" : "bg-slate-800/80 border-rose-500/30 opacity-75 cursor-not-allowed"}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-xl ${
                            isKosong ? "bg-emerald-500/10" : "bg-rose-500/10"
                          }`}
                        >
                          <Monitor
                            className={`w-8 h-8 ${
                              isKosong ? "text-emerald-400" : "text-rose-400"
                            }`}
                          />
                        </div>

                        <div>
                          <h3 className="font-bold text-xl">{tv.nama_tv}</h3>
                          <p className="text-sm text-gray-400">
                            {tv.ip_address}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wide ${
                          isKosong
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-rose-500/20 text-rose-400"
                        }`}
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
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* DASHBOARD ADMIN */
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* [BAGIAN DASHBOARD ADMIN SAMA SEPERTI SEBELUMNYA] */}
            <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="text-3xl font-bold mb-2">
                  Dashboard Operasional
                </h2>
                <p className="text-slate-400">
                  Pantau armada TV dan konfirmasi antrean tunai.
                </p>
              </div>
            </div>
            <div className="lg:col-span-2 bg-slate-800 rounded-3xl p-6 border border-slate-700 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Antrean Pembayaran Tunai
                  </h3>
                  <p className="text-sm text-slate-400">
                    Menunggu konfirmasi pembayaran
                  </p>
                </div>

                <span className="px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-semibold">
                  {antreanPending.length} Pending
                </span>
              </div>

              {antreanPending.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-400">
                    Tidak ada antrean pembayaran saat ini
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {antreanPending.map((trx) => (
                    <div
                      key={trx.id_transaksi}
                      className="group flex items-center justify-between p-5 rounded-2xl border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:bg-slate-850 transition-all duration-300"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-white text-lg">
                            #{trx.id_transaksi}
                          </h4>

                          <span className="px-2 py-1 rounded-lg bg-sky-500/10 text-sky-400 text-xs">
                            {trx.metode_bayar}
                          </span>
                        </div>

                        <p className="text-sm text-slate-400">
                          Pelanggan:{" "}
                          <span className="text-slate-200 font-medium">
                            {trx.id_pelanggan} | {trx.id_tv}
                          </span>
                        </p>

                        <p className="text-2xl font-bold text-emerald-400">
                          Rp {trx.total_bayar.toLocaleString("id-ID")}
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          handleKonfirmasiPembayaran(trx.id_transaksi)
                        }
                        className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-white transition-all shadow-lg shadow-emerald-600/20"
                      >
                        ✓ Konfirmasi
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL CHECKOUT FLOW */}
      {checkoutStep > 0 && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {/* STEP 1: FORM */}
            {checkoutStep === 1 && (
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold">Pilih Durasi</h3>
                  <button
                    onClick={resetState}
                    className="p-1 rounded-lg text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    {pakets.map((p) => (
                      <div
                        key={p.id_paket}
                        onClick={() =>
                          setFormData({ ...formData, idPaket: p.id_paket })
                        }
                        className={`p-3 rounded-xl border text-center cursor-pointer ${formData.idPaket === p.id_paket ? "bg-indigo-600 border-indigo-500 shadow-lg" : "bg-slate-900 border-slate-700"}`}
                      >
                        <p className="font-bold">{p.nama_paket}</p>
                        <p className="text-xs text-slate-300">
                          Rp {p.harga.toLocaleString("id-ID")}
                        </p>
                      </div>
                    ))}
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
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3.5 pl-11 pr-4 focus:outline-none focus:border-indigo-500"
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
                  className="w-full mt-8 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 rounded-xl transition-all"
                >
                  Pilih Pembayaran
                </button>
              </div>
            )}

            {/* STEP 2: METODE PEMBAYARAN */}
            {checkoutStep === 2 && (
              <div className="p-8 relative">
                <div
                  className="inline-flex items-center gap-2 mb-8 cursor-pointer text-slate-400"
                  onClick={() => !isProcessingPayment && setCheckoutStep(1)}
                >
                  <span>← Kembali</span>
                </div>
                <h3 className="text-2xl font-bold mb-6">Metode Pembayaran</h3>
                <div className="space-y-4">
                  <div
                    onClick={() =>
                      !isProcessingPayment && setPaymentMethod("QRIS")
                    }
                    className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer ${paymentMethod === "QRIS" ? "bg-indigo-600/20 border-indigo-500" : "bg-slate-900 border-slate-700"}`}
                  >
                    <div className="p-3 bg-blue-500/20 text-blue-400 rounded-lg">
                      <ScanLine className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-lg text-white">QRIS</p>
                      <p className="text-sm text-slate-400">
                        Scan via Semua Bank / E-Wallet
                      </p>
                    </div>
                  </div>
                  <div
                    onClick={() =>
                      !isProcessingPayment && setPaymentMethod("Cash")
                    }
                    className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer ${paymentMethod === "Cash" ? "bg-indigo-600/20 border-indigo-500" : "bg-slate-900 border-slate-700"}`}
                  >
                    <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-lg">
                      <Banknote className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-lg text-white">
                        Bayar Tunai
                      </p>
                      <p className="text-sm text-slate-400">
                        Bayar di meja kasir
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleCheckoutSubmit}
                  disabled={!paymentMethod || isProcessingPayment}
                  className="w-full mt-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2"
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" /> Memproses...
                    </>
                  ) : (
                    "Konfirmasi Pesanan"
                  )}
                </button>
              </div>
            )}

            {/* STEP 3: TAMPILAN QRIS DI LAYAR */}
            {checkoutStep === 3 && (
              <div className="p-8 text-center animate-in fade-in zoom-in duration-300">
                <h3 className="text-2xl font-bold mb-1 text-white">
                  Scan untuk Membayar
                </h3>
                <p className="text-slate-400 mb-6 font-mono text-sm">
                  ID: {orderId}
                </p>

                <div className="bg-white p-4 rounded-2xl inline-block shadow-[0_0_40px_rgba(79,70,229,0.2)] mb-6">
                  <img
                    src={qrCodeUrl}
                    alt="QRIS Midtrans"
                    className="w-56 h-56 object-contain"
                  />
                </div>

                <p className="text-slate-300 bg-slate-900 p-4 rounded-xl border border-slate-700 text-sm leading-relaxed mb-6">
                  Buka aplikasi M-Banking atau E-Wallet Anda (Gopay, OVO, Dana,
                  ShopeePay), lalu <strong>scan kode QRIS di atas</strong>. TV
                  akan otomatis menyala setelah pembayaran berhasil.
                </p>

                {/* Tombol simulasi refresh untuk check status (seharusnya via webhook GAS -> Polling Frontend) */}
                <div className="mt-4">
                  {paymentStatus === "Pending" ? (
                    <span className="text-yellow-400">
                      Menunggu pembayaran...
                    </span>
                  ) : (
                    <span className="text-green-400">
                      Pembayaran berhasil ✓
                    </span>
                  )}
                </div>
                <button
                  onClick={resetState}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3.5 rounded-xl transition-colors"
                >
                  Selesai / Kembali ke Menu Utama
                </button>
              </div>
            )}

            {/* STEP 4: SUKSES TUNAI */}
            {checkoutStep === 4 && (
              <div className="p-10 text-center">
                <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-white">
                  Pesanan Disimpan
                </h3>
                <p className="text-slate-400 mb-8 leading-relaxed">
                  Silakan menuju kasir untuk melakukan pembayaran tunai. TV
                  otomatis menyala setelah lunas.
                </p>
                <button
                  onClick={resetState}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3.5 rounded-xl transition-colors"
                >
                  Tutup
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
