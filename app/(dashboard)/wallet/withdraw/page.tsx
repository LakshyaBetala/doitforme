"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wallet, CreditCard, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function WithdrawPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [user, setUser] = useState<any | null>(null);
  const [balance, setBalance] = useState(0);
  
  // Form State
  const [amount, setAmount] = useState("");
  const [upi, setUpi] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      // 1. Get User
      const { data } = await supabase.auth.getUser();
      
      // --- FIX FOR BUILD ERROR: Check if user exists ---
      if (!data?.user) {
        router.push("/login"); // Redirect if not logged in
        return; 
      }
      
      setUser(data.user);

      // 2. Get Wallet Balance
      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance, frozen_amount")
        .eq("user_id", data.user.id) // Safe to access .id now
        .maybeSingle();

      setBalance(wallet?.balance ?? 0);
      setLoading(false);
    };

    loadData();
  }, [router, supabase]);

  const submitRequest = async () => {
    setError("");
    const amt = Number(amount);

    // Validation
    if (!amt || amt < 50) return setError("Minimum withdrawal is ₹50");
    if (amt > balance) return setError("Amount exceeds wallet balance");
    if (!upi.includes("@")) return setError("Invalid UPI ID format");

    // Fee Warning Confirmation
    const fee = amt * 0.10; // 10% fee
    const finalAmount = amt - fee;
    if (!confirm(`A 10% platform fee (₹${fee}) will be deducted.\n\nYou will receive: ₹${finalAmount}\n\nProceed?`)) {
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          amount: amt,
          upi,
        }),
      });

      const out = await res.json();

      if (!out.success) {
        throw new Error(out.error || "Request failed");
      }

      // Success
      router.push("/dashboard/wallet");
      
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-purple animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white p-6 lg:p-12 pb-24 selection:bg-brand-purple selection:text-white">
      
      <div className="max-w-xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <Link href="/dashboard/wallet" className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-4 group w-fit">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Wallet</span>
          </Link>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-brand-purple" /> Withdraw Funds
          </h1>
        </div>

        {/* Balance Display */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex justify-between items-center">
           <div>
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-1">Available Balance</p>
              <p className="text-3xl font-bold text-white">₹{balance.toLocaleString()}</p>
           </div>
           <div className="w-12 h-12 rounded-full bg-brand-purple/10 flex items-center justify-center text-brand-purple">
              <Wallet className="w-6 h-6" />
           </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {/* Form */}
        <div className="space-y-6">
          
          <div className="space-y-2">
            <label className="text-sm font-bold text-white/60">Amount (₹)</label>
            <input
              type="number"
              className="w-full bg-[#121217] border border-white/10 rounded-xl p-4 text-white placeholder:text-white/20 focus:border-brand-purple focus:ring-1 focus:ring-brand-purple outline-none transition-all"
              placeholder="e.g. 500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-white/30">Min: ₹50 • Platform Fee: 10%</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-white/60">UPI ID / VPA</label>
            <input
              type="text"
              className="w-full bg-[#121217] border border-white/10 rounded-xl p-4 text-white placeholder:text-white/20 focus:border-brand-purple focus:ring-1 focus:ring-brand-purple outline-none transition-all"
              placeholder="username@okicici"
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
            />
          </div>

          <button
            onClick={submitRequest}
            disabled={submitting}
            className="w-full py-4 bg-brand-purple text-white font-bold rounded-xl hover:bg-brand-purple/90 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(139,92,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            {submitting ? "Processing..." : "Submit Withdrawal Request"}
          </button>

        </div>

      </div>
    </div>
  );
}