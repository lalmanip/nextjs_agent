"use client";

import { Suspense } from "react";
import AgentLoginForm from "@/Components/AgentLoginForm";

export default function AgentLoginPage() {
  return (
    <Suspense>
      <AgentLoginForm />
    </Suspense>
  );
}
