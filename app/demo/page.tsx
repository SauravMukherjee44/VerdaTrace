import type { Metadata } from "next";
import { CanopyApp } from "../CanopyApp";

export const metadata: Metadata = {
  title: "Public Demo — VerdaTrace",
  description:
    "Explore an amendment-aware environmental obligation ledger, evidence map, and inspection plan built from public forest-clearance records.",
};

export default function DemoPage() {
  return <CanopyApp />;
}
