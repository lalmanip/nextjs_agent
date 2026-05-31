"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUser, addAgent } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────
type PersonalInfo = {
  firstName: string; lastName: string; mobile: string; email: string;
  addressProof: File | null; countryCode: number; state: string; city: string;
};
type CompanyDetails = {
  corporateId: string; salesPerson: string; companyName: string;
  panNumber: string; panCardHolderName: string; address: string;
  pinCode: string; officePhone: string; establishmentDate: string;
  annualTransaction: string; iata: string;
  gstFile: File | null; panFile: File | null; noOfEmployee: string;
};
type BankDetails = { accountNumber: string; ifscCode: string; accountHolderName: string };
type LoginInfo = { userName: string; password: string; confirmPassword: string };

const STEPS = ["Personal Info", "Company Details", "Bank Details", "Login Info"];

const inputCls =
  "w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand";
const labelCls = "block text-xs font-medium text-brand-light mb-1";

function Field({
  label, name, type = "text", value, onChange, placeholder, required = false,
}: {
  label: string; name: string; type?: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className={labelCls}>{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      <input name={name} type={type} value={value} onChange={onChange}
        placeholder={placeholder} required={required} className={inputCls} />
    </div>
  );
}

function FileField({
  label, name, onChange, required = false,
}: {
  label: string; name: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; required?: boolean;
}) {
  return (
    <div>
      <label className={labelCls}>{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      <input name={name} type="file" onChange={onChange} required={required}
        className="w-full text-sm text-brand-light file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brand file:text-white file:text-xs hover:file:bg-brand-light cursor-pointer" />
    </div>
  );
}

const COUNTRY_CODES: { name: string; code: number }[] = [
  { name: "India", code: 91 },
  { name: "USA", code: 1 },
  { name: "UK", code: 44 },
  { name: "UAE", code: 971 },
  { name: "Australia", code: 61 },
  { name: "Canada", code: 1 },
  { name: "Singapore", code: 65 },
  { name: "Germany", code: 49 },
  { name: "France", code: 33 },
  { name: "Japan", code: 81 },
  { name: "China", code: 86 },
  { name: "South Africa", code: 27 },
  { name: "Brazil", code: 55 },
  { name: "Mexico", code: 52 },
  { name: "Thailand", code: 66 },
  { name: "Malaysia", code: 60 },
  { name: "Nepal", code: 977 },
  { name: "Sri Lanka", code: 94 },
  { name: "Bangladesh", code: 880 },
];


export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [personal, setPersonal] = useState<PersonalInfo>({
    firstName: "", lastName: "", mobile: "", email: "",
    addressProof: null, countryCode: 91, state: "", city: "",
  });
  const [company, setCompany] = useState<CompanyDetails>({
    corporateId: "", salesPerson: "", companyName: "", panNumber: "",
    panCardHolderName: "", address: "", pinCode: "", officePhone: "",
    establishmentDate: "", annualTransaction: "", iata: "",
    gstFile: null, panFile: null, noOfEmployee: "",
  });
  const [bank, setBank] = useState<BankDetails>({
    accountNumber: "", ifscCode: "", accountHolderName: "",
  });
  const [login, setLogin] = useState<LoginInfo>({
    userName: "", password: "", confirmPassword: "",
  });

  const handlePersonal = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.target.type === "file") {
      setPersonal((p) => ({ ...p, [e.target.name]: (e.target as HTMLInputElement).files?.[0] ?? null }));
    } else if (e.target.name === "countryCode") {
      setPersonal((p) => ({ ...p, countryCode: Number(e.target.value) }));
    } else {
      setPersonal((p) => ({ ...p, [e.target.name]: e.target.value }));
    }
  };
  const handleCompany = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.type === "file") {
      setCompany((p) => ({ ...p, [e.target.name]: e.target.files?.[0] ?? null }));
    } else {
      setCompany((p) => ({ ...p, [e.target.name]: e.target.value }));
    }
  };
  const handleBank = (e: React.ChangeEvent<HTMLInputElement>) =>
    setBank((p) => ({ ...p, [e.target.name]: e.target.value }));
  const handleLogin = (e: React.ChangeEvent<HTMLInputElement>) =>
    setLogin((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStep((s) => s + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (login.password !== login.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const userRes = await createUser({
        email: personal.email,
        userName: login.userName,
        password: login.password,
        firstName: personal.firstName,
        lastName: personal.lastName,
        countryCode: personal.countryCode,
      });
      await addAgent({
        userId: userRes.userId ?? userRes.id,
        address: company.address,
        countryName: personal.countryCode,
        state: personal.state,
        city: personal.city,
        pinCode: company.pinCode,
        companyName: company.companyName,
        panNumber: company.panNumber,
        gstNumber: company.iata,
        officePhone: company.officePhone,
      });
      router.push("/?registered=1");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl bg-white/10 backdrop-blur-md shadow-2xl p-8 text-white">
        {/* Brand */}
        <div className="mb-6 text-center">
          <span className="text-3xl">✈️</span>
          <h1 className="mt-1 text-2xl font-bold tracking-wide">Vivance Travel</h1>
          <p className="text-sm text-brand-light">Agent Registration — B2B</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center mb-8">
          {STEPS.map((label, i) => (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                i < step ? "bg-brand border-brand" : i === step ? "border-brand text-brand-light" : "border-white/20 text-white/30"
              }`}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`mt-1 text-[10px] text-center hidden sm:block ${i === step ? "text-brand-light" : "text-white/40"}`}>{label}</span>
              {i < STEPS.length - 1 && (
                <div className="absolute" style={{ display: "none" }} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/20 border border-red-400/40 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Step 0 — Personal Info */}
        {step === 0 && (
          <form onSubmit={handleNext} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="First Name" name="firstName" value={personal.firstName} onChange={handlePersonal} />
            <Field label="Last Name" name="lastName" value={personal.lastName} onChange={handlePersonal} />
            <Field label="Mobile Number" name="mobile" type="tel" value={personal.mobile} onChange={handlePersonal} />
            <Field label="Email" name="email" type="email" value={personal.email} onChange={handlePersonal} />
            <div>
              <label className={labelCls}>Country</label>
              <select name="countryCode" value={personal.countryCode} onChange={handlePersonal}
                className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand">
                {COUNTRY_CODES.map((c) => (
                  <option key={`${c.name}-${c.code}`} value={c.code} className="bg-orange-950 text-white">
                    {c.name} (+{c.code})
                  </option>
                ))}
              </select>
            </div>
            <Field label="State" name="state" value={personal.state} onChange={handlePersonal} />
            <Field label="City" name="city" value={personal.city} onChange={handlePersonal} />
            <div className="sm:col-span-2">
              <FileField label="Address Proof" name="addressProof" onChange={handlePersonal} />
            </div>
            <StepButtons step={step} setStep={setStep} loading={false} isLast={false} />
          </form>
        )}

        {/* Step 1 — Company Details */}
        {step === 1 && (
          <form onSubmit={handleNext} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Corporate ID" name="corporateId" value={company.corporateId} onChange={handleCompany} />
            <Field label="Name of Sales Person" name="salesPerson" value={company.salesPerson} onChange={handleCompany} />
            <Field label="Company Name" name="companyName" value={company.companyName} onChange={handleCompany} />
            <Field label="PAN Number" name="panNumber" value={company.panNumber} onChange={handleCompany} />
            <Field label="PAN Card Holder Name" name="panCardHolderName" value={company.panCardHolderName} onChange={handleCompany} />
            <Field label="Address" name="address" value={company.address} onChange={handleCompany} />
            <Field label="Pin Code" name="pinCode" value={company.pinCode} onChange={handleCompany} />
            <Field label="Office Phone" name="officePhone" type="tel" value={company.officePhone} onChange={handleCompany} />
            <Field label="Establishment Date" name="establishmentDate" type="date" value={company.establishmentDate} onChange={handleCompany} />
            <Field label="Annual Transaction" name="annualTransaction" value={company.annualTransaction} onChange={handleCompany} />
            <Field label="IATA" name="iata" value={company.iata} onChange={handleCompany} />
            <Field label="No. of Employees" name="noOfEmployee" type="number" value={company.noOfEmployee} onChange={handleCompany} />
            <FileField label="GST File" name="gstFile" onChange={handleCompany} />
            <FileField label="PAN File" name="panFile" onChange={handleCompany} />
            <StepButtons step={step} setStep={setStep} loading={false} isLast={false} />
          </form>
        )}

        {/* Step 2 — Bank Details */}
        {step === 2 && (
          <form onSubmit={handleNext} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Account Number" name="accountNumber" value={bank.accountNumber} onChange={handleBank} />
            <Field label="IFSC Code" name="ifscCode" value={bank.ifscCode} onChange={handleBank} />
            <div className="sm:col-span-2">
              <Field label="Account Holder Name" name="accountHolderName" value={bank.accountHolderName} onChange={handleBank} />
            </div>
            <StepButtons step={step} setStep={setStep} loading={false} isLast={false} />
          </form>
        )}

        {/* Step 3 — Login Info */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="User Name" name="userName" value={login.userName} onChange={handleLogin} />
            </div>
            <Field label="Password" name="password" type="password" value={login.password} onChange={handleLogin} />
            <Field label="Confirm Password" name="confirmPassword" type="password" value={login.confirmPassword} onChange={handleLogin} />
            <StepButtons step={step} setStep={setStep} loading={loading} isLast={true} />
          </form>
        )}

        <p className="mt-6 text-center text-xs text-sky-300">
          Already have an account?{" "}
          <a href="/" className="font-semibold text-white hover:underline">Sign In</a>
        </p>
      </div>
    </main>
  );
}

function StepButtons({
  step, setStep, loading, isLast,
}: {
  step: number; setStep: (fn: (s: number) => number) => void; loading: boolean; isLast: boolean;
}) {
  return (
    <div className="sm:col-span-2 flex gap-3 mt-2">
      {step > 0 && (
        <button type="button" onClick={() => setStep((s) => s - 1)}
          className="flex-1 rounded-lg border border-white/20 py-2.5 text-sm font-medium text-brand-light hover:bg-white/10 transition-colors">
          Back
        </button>
      )}
      <button type="submit" disabled={loading}
        className="flex-1 rounded-lg bg-brand hover:bg-brand-light disabled:opacity-60 transition-colors py-2.5 font-semibold text-white">
        {loading ? "Submitting…" : isLast ? "Create Account" : "Next"}
      </button>
    </div>
  );
}
