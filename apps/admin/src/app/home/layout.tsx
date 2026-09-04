import type { Metadata } from "next";
import { HomeAuthGuard } from "./HomeAuthGuard";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <HomeAuthGuard>{children}</HomeAuthGuard>;
}
