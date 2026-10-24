import type { Metadata } from "next";
import { PlanView } from "@/components/plan/plan-view";

export const metadata: Metadata = { title: "計画作成 | 家庭学習タスク" };

export default function PlanPage() {
  return <PlanView />;
}
