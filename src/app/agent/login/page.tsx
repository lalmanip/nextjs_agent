"use client";

import { Suspense } from "react";
import AgentLoginForm from "@/Components/AgentLoginForm";

export default function SignInPage() {
  return (
    <Suspense>
      <AgentLoginForm />
    </Suspense>
  );
}
