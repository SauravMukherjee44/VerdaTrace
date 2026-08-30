import type { Metadata } from "next";
import { MarketingHome } from "./MarketingHome";

export const metadata: Metadata = {
  title: "VerdaTrace — Every ecological obligation, traceable.",
  description:
    "VerdaTrace turns environmental approvals, amendments, maps, and field evidence into source-cited obligations and prioritized action.",
};

export default function Home() {
  return <MarketingHome />;
}
