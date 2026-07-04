"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createAgentUser,
  addAgentProfile,
  uploadAgentSignupDocuments,
} from "@/lib/agentSignup";
import {
  validateAgentSignupPersonal,
  validateAgentSignupLocation,
  validateAgentSignupCompany,
  validateAgentSignupBank,
  validateAgentSignupLogin,
  firstAgentSignupError,
  maxEstablishmentDateIso,
  type AgentPersonalInfo,
  type AgentCompanyDetails,
  type AgentBankDetails,
  type AgentLoginInfo,
} from "@/lib/agentSignupValidation";
import { useSignupStyleLocation } from "@/lib/useSignupStyleLocation";
import AgentSignupLocationFields from "@/Components/AgentSignupLocationFields";
import { setUserSession } from "@/lib/authSession";

const STEPS = ["Personal Info", "Company Details", "Bank Details", "Login Info"];

const inputBaseCls =
  "w-full rounded-lg bg-white/10 border px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary";
const labelCls = "block text-xs font-medium text-orange-200 mb-1";

function inputCls(hasError: boolean) {
  return `${inputBaseCls} ${hasError ? "border-red-400" : "border-white/20"}`;
}

function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  error,
  maxLength,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  maxLength?: number;
  max?: string;
}) {
  return (
    <div>
      <label className={labelCls}>
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        max={max}
        className={inputCls(!!error)}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error && (
        <p id={`${name}-error`} className="mt-1 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

function FileField({
  label,
  name,
  onChange,
  required = false,
  error,
  fileName,
}: {
  label: string;
  name: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  error?: string;
  fileName?: string | null;
}) {
  return (
    <div>
      <label className={labelCls}>
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        name={name}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        onChange={onChange}
        className={`w-full text-sm text-orange-200 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-white file:text-xs hover:file:bg-primary-dark cursor-pointer ${
          error ? "rounded-lg ring-1 ring-red-400" : ""
        }`}
        aria-invalid={!!error}
      />
      {fileName && !error && (
        <p className="mt-1 text-xs text-orange-200/80 truncate">Selected: {fileName}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
      {!error && (
        <p className="mt-1 text-xs text-white/40">PDF, JPG or PNG — max 5 MB</p>
      )}
    </div>
  );
}

function parseDialCountryCode(dial?: string): number {
  const digits = String(dial ?? "").replace(/\D/g, "");
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : 91;
}

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const location = useSignupStyleLocation("IN");

  const [personal, setPersonal] = useState<AgentPersonalInfo>({
    firstName: "",
    lastName: "",
    mobile: "",
    addressProof: null,
    idProof: null,
  });
  const [company, setCompany] = useState<AgentCompanyDetails>({
    corporateId: "",
    salesPerson: "",
    companyName: "",
    panNumber: "",
    panCardHolderName: "",
    address: "",
    pinCode: "",
    officePhone: "",
    establishmentDate: "",
    annualTransaction: "",
    iata: "",
    gstFile: null,
    panFile: null,
    noOfEmployee: "",
  });
  const [bank, setBank] = useState<AgentBankDetails>({
    accountNumber: "",
    ifscCode: "",
    accountHolderName: "",
    bankProof: null,
  });
  const [login, setLogin] = useState<AgentLoginInfo>({
    userName: "",
    password: "",
    confirmPassword: "",
  });
  const clearFieldError = (name: string) => {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handlePersonal = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    clearFieldError(e.target.name);
    if (e.target.type === "file") {
      setPersonal((p) => ({ ...p, [e.target.name]: (e.target as HTMLInputElement).files?.[0] ?? null }));
    } else {
      setPersonal((p) => ({ ...p, [e.target.name]: e.target.value }));
    }
  };

  const handleCompany = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearFieldError(e.target.name);
    if (e.target.type === "file") {
      setCompany((p) => ({ ...p, [e.target.name]: e.target.files?.[0] ?? null }));
    } else if (e.target.name === "panNumber") {
      setCompany((p) => ({ ...p, panNumber: e.target.value.toUpperCase() }));
    } else {
      setCompany((p) => ({ ...p, [e.target.name]: e.target.value }));
    }
  };

  const handleBank = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearFieldError(e.target.name);
    if (e.target.type === "file") {
      setBank((p) => ({ ...p, [e.target.name]: e.target.files?.[0] ?? null }));
    } else {
      const v =
        e.target.name === "ifscCode" ? e.target.value.toUpperCase() : e.target.value;
      setBank((p) => ({ ...p, [e.target.name]: v }));
    }
  };

  const handleLogin = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearFieldError(e.target.name);
    setLogin((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const validateStep = (stepIndex: number): boolean => {
    let errors: Record<string, string> = {};
    if (stepIndex === 0) {
      errors = {
        ...validateAgentSignupPersonal(personal),
        ...validateAgentSignupLocation({
          countryIso: location.countryIso,
          stateKey: location.stateKey,
          cityKey: location.cityKey,
          cityManual: location.cityManual,
          cityName: location.getCityName(),
          hasCityDropdown: location.hasCityDropdown,
        }),
      };
    } else if (stepIndex === 1) {
      errors = validateAgentSignupCompany(company, location.countryIso);
    } else if (stepIndex === 2) {
      errors = validateAgentSignupBank(bank);
    } else if (stepIndex === 3) {
      errors = validateAgentSignupLogin(login);
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(firstAgentSignupError(errors) ?? "Please fix the highlighted fields.");
      return false;
    }
    setError("");
    return true;
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(step)) return;
    setFieldErrors({});
    setError("");
    setStep((s) => s + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(3)) return;

    setLoading(true);
    setError("");
    try {
      const countryRow = location.countryList.find(
        (c) => c.isoCountryCode === location.countryIso,
      );
      const dialCode = parseDialCountryCode(countryRow?.countryCode);
      const stateOid =
        location.selectedState?.stateOrigin?.trim() || location.getStateName();
      const cityRow = location.cityList.find(
        (c) =>
          (c.cityCode && c.cityCode === location.cityKey) ||
          c.cityName === location.cityKey,
      );
      const cityOid = cityRow?.cityCode?.trim() || location.getCityName();
      const cityNumeric = parseInt(String(cityOid).replace(/\D/g, ""), 10);
      const annualAmount = parseFloat(company.annualTransaction.replace(/,/g, ""));
      const employeeCount = parseInt(company.noOfEmployee, 10);

      if (!personal.addressProof || !personal.idProof || !company.panFile || !bank.bankProof) {
        setError("Address proof, ID proof, PAN, and bank statement or cancelled cheque are required.");
        setLoading(false);
        return;
      }

      const loginId = login.userName.trim();
      const userRes = await createAgentUser({
        email: loginId,
        userName: loginId,
        password: login.password,
        firstName: personal.firstName.trim(),
        lastName: personal.lastName.trim(),
        countryCode: dialCode,
        phone: personal.mobile.replace(/[\s\-\(\)]/g, ""),
      });

      const docs = await uploadAgentSignupDocuments(userRes.userId, {
        addressProof: personal.addressProof,
        idProof: personal.idProof,
        panFile: company.panFile,
        bankProof: bank.bankProof,
        gstFile: company.gstFile,
      });

      await addAgentProfile({
        userId: userRes.userId,
        address: company.address.trim(),
        countryName: dialCode,
        state: stateOid,
        city: Number.isFinite(cityNumeric) ? cityNumeric : 0,
        cityName: location.getCityName(),
        pinCode: company.pinCode.trim(),
        companyName: company.companyName.trim(),
        corporateId: company.corporateId.trim(),
        salesPersonName: company.salesPerson.trim(),
        panNumber: company.panNumber.trim().toUpperCase(),
        panCardHolderName: company.panCardHolderName.trim(),
        gstNumber: company.iata.trim(),
        officePhone: company.officePhone.replace(/[\s\-\(\)]/g, ""),
        establishmentDate: company.establishmentDate,
        annualTransactionAmount: Number.isFinite(annualAmount) ? annualAmount : 0,
        noOfEmployees: Number.isFinite(employeeCount) ? employeeCount : 0,
        bankAccountNumber: bank.accountNumber.trim(),
        bankIfsc: bank.ifscCode.trim().toUpperCase(),
        bankAccountHolderName: bank.accountHolderName.trim(),
        addressProof: docs.addressProof,
        idProof: docs.idProof,
        panFilePath: docs.panFilePath,
        bankProof: docs.bankProof,
        ...(docs.gstFilePath ? { gstFilePath: docs.gstFilePath } : {}),
      });
      router.push("/?registered=1");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="agent-auth-screen py-10">
      <div className="agent-auth-card agent-auth-card--wide">
        <div className="mb-6 text-center">
          <span className="text-3xl">✈️</span>
          <h1 className="mt-1 text-2xl font-bold tracking-wide">Vivance Travel</h1>
          <p className="text-sm text-orange-200">Agent Registration — B2B</p>
        </div>

        <div className="flex items-center mb-8">
          {STEPS.map((label, i) => (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  i < step
                    ? "bg-primary border-primary text-white"
                    : i === step
                      ? "border-primary text-orange-200"
                      : "border-white/20 text-white/30"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span
                className={`mt-1 text-[10px] text-center hidden sm:block ${
                  i === step ? "text-orange-200" : "text-white/40"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/20 border border-red-400/40 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {step === 0 && (
          <form onSubmit={handleNext} className="grid grid-cols-1 sm:grid-cols-2 gap-4" noValidate>
            <Field
              label="First Name"
              name="firstName"
              value={personal.firstName}
              onChange={handlePersonal}
              required
              error={fieldErrors.firstName}
              maxLength={50}
            />
            <Field
              label="Last Name"
              name="lastName"
              value={personal.lastName}
              onChange={handlePersonal}
              required
              error={fieldErrors.lastName}
              maxLength={50}
            />
            <Field
              label="Mobile Number"
              name="mobile"
              type="tel"
              value={personal.mobile}
              onChange={handlePersonal}
              placeholder="10-digit mobile"
              required
              error={fieldErrors.mobile}
            />
            <AgentSignupLocationFields
              location={location}
              errors={{
                country: fieldErrors.country,
                state: fieldErrors.state,
                city: fieldErrors.city,
              }}
              onCountryChange={() => {
                clearFieldError("country");
                clearFieldError("state");
                clearFieldError("city");
                clearFieldError("pinCode");
              }}
              onStateChange={() => {
                clearFieldError("state");
                clearFieldError("city");
              }}
              onCityChange={() => clearFieldError("city")}
            />
            <FileField
              label="Address Proof"
              name="addressProof"
              onChange={handlePersonal}
              required
              error={fieldErrors.addressProof}
              fileName={personal.addressProof?.name}
            />
            <FileField
              label="ID Proof"
              name="idProof"
              onChange={handlePersonal}
              required
              error={fieldErrors.idProof}
              fileName={personal.idProof?.name}
            />
            <StepButtons step={step} setStep={setStep} loading={false} isLast={false} />
          </form>
        )}

        {step === 1 && (
          <form onSubmit={handleNext} className="grid grid-cols-1 sm:grid-cols-2 gap-4" noValidate>
            <Field
              label="Corporate ID"
              name="corporateId"
              value={company.corporateId}
              onChange={handleCompany}
              required
              error={fieldErrors.corporateId}
              maxLength={30}
            />
            <Field
              label="Name of Sales Person"
              name="salesPerson"
              value={company.salesPerson}
              onChange={handleCompany}
              required
              error={fieldErrors.salesPerson}
              maxLength={50}
            />
            <Field
              label="Company Name"
              name="companyName"
              value={company.companyName}
              onChange={handleCompany}
              required
              error={fieldErrors.companyName}
              maxLength={120}
            />
            <Field
              label="PAN Number"
              name="panNumber"
              value={company.panNumber}
              onChange={handleCompany}
              placeholder="ABCDE1234F"
              required
              error={fieldErrors.panNumber}
              maxLength={10}
            />
            <Field
              label="PAN Card Holder Name"
              name="panCardHolderName"
              value={company.panCardHolderName}
              onChange={handleCompany}
              required
              error={fieldErrors.panCardHolderName}
              maxLength={50}
            />
            <Field
              label="Address"
              name="address"
              value={company.address}
              onChange={handleCompany}
              required
              error={fieldErrors.address}
              maxLength={300}
            />
            <Field
              label="Pin Code"
              name="pinCode"
              value={company.pinCode}
              onChange={handleCompany}
              placeholder={location.countryIso.toUpperCase() === "IN" ? "6 digits" : ""}
              required
              error={fieldErrors.pinCode}
              maxLength={14}
            />
            <Field
              label="Office Phone"
              name="officePhone"
              type="tel"
              value={company.officePhone}
              onChange={handleCompany}
              required
              error={fieldErrors.officePhone}
            />
            <Field
              label="Establishment Date"
              name="establishmentDate"
              type="date"
              value={company.establishmentDate}
              onChange={handleCompany}
              max={maxEstablishmentDateIso()}
              required
              error={fieldErrors.establishmentDate}
            />
            <Field
              label="Annual Transaction"
              name="annualTransaction"
              type="number"
              value={company.annualTransaction}
              onChange={handleCompany}
              placeholder="Amount in INR"
              required
              error={fieldErrors.annualTransaction}
            />
            <Field
              label="IATA"
              name="iata"
              value={company.iata}
              onChange={handleCompany}
              error={fieldErrors.iata}
              maxLength={20}
            />
            <Field
              label="No. of Employees"
              name="noOfEmployee"
              type="number"
              value={company.noOfEmployee}
              onChange={handleCompany}
              required
              error={fieldErrors.noOfEmployee}
            />
            <FileField
              label="GST File"
              name="gstFile"
              onChange={handleCompany}
              error={fieldErrors.gstFile}
              fileName={company.gstFile?.name}
            />
            <FileField
              label="PAN File"
              name="panFile"
              onChange={handleCompany}
              required
              error={fieldErrors.panFile}
              fileName={company.panFile?.name}
            />
            <StepButtons step={step} setStep={setStep} loading={false} isLast={false} />
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleNext} className="grid grid-cols-1 sm:grid-cols-2 gap-4" noValidate>
            <Field
              label="Account Number"
              name="accountNumber"
              value={bank.accountNumber}
              onChange={handleBank}
              required
              error={fieldErrors.accountNumber}
            />
            <Field
              label="IFSC Code"
              name="ifscCode"
              value={bank.ifscCode}
              onChange={handleBank}
              placeholder="HDFC0001234"
              required
              error={fieldErrors.ifscCode}
              maxLength={11}
            />
            <div className="sm:col-span-2">
              <Field
                label="Account Holder Name"
                name="accountHolderName"
                value={bank.accountHolderName}
                onChange={handleBank}
                required
                error={fieldErrors.accountHolderName}
                maxLength={50}
              />
            </div>
            <div className="sm:col-span-2">
              <FileField
                label="Bank Statement or Cancelled Cheque"
                name="bankProof"
                onChange={handleBank}
                required
                error={fieldErrors.bankProof}
                fileName={bank.bankProof?.name}
              />
            </div>
            <StepButtons step={step} setStep={setStep} loading={false} isLast={false} />
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4" noValidate>
            <div className="sm:col-span-2">
              <Field
                label="Username"
                name="userName"
                value={login.userName}
                onChange={handleLogin}
                placeholder="Email address or username (used to sign in)"
                required
                error={fieldErrors.userName}
                maxLength={100}
              />
            </div>
            <Field
              label="Password"
              name="password"
              type="password"
              value={login.password}
              onChange={handleLogin}
              required
              error={fieldErrors.password}
            />
            <Field
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              value={login.confirmPassword}
              onChange={handleLogin}
              required
              error={fieldErrors.confirmPassword}
            />
            <p className="sm:col-span-2 text-xs text-white/50">
              Password: at least 8 characters, one uppercase letter, and one number.
            </p>
            <StepButtons step={step} setStep={setStep} loading={loading} isLast={true} />
          </form>
        )}

        <p className="mt-6 text-center text-xs text-orange-200">
          Already have an account?{" "}
          <a href="/" className="font-semibold text-white hover:underline">
            Sign In
          </a>
        </p>
      </div>
    </main>
  );
}

function StepButtons({
  step,
  setStep,
  loading,
  isLast,
}: {
  step: number;
  setStep: (fn: (s: number) => number) => void;
  loading: boolean;
  isLast: boolean;
}) {
  return (
    <div className="sm:col-span-2 flex gap-3 mt-2">
      {step > 0 && (
        <button
          type="button"
          onClick={() => setStep((s) => s - 1)}
          className="flex-1 rounded-lg border border-white/20 py-2.5 text-sm font-medium text-orange-200 hover:bg-white/10 transition-colors"
        >
          Back
        </button>
      )}
      <button
        type="submit"
        disabled={loading}
        className="flex-1 rounded-lg bg-primary hover:bg-primary-dark disabled:opacity-60 transition-colors py-2.5 font-semibold text-white"
      >
        {loading ? "Submitting…" : isLast ? "Create Account" : "Next"}
      </button>
    </div>
  );
}
