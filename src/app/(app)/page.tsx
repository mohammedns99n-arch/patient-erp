import { redirect } from "next/navigation";

// The dashboard is the landing "Overview"; the sidebar handles navigation.
export default function Home() {
  redirect("/dashboard");
}
