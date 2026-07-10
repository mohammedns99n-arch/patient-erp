import { getT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n.server";
import LanguageToggle from "../language-toggle";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const locale = await getLocale();
  const t = getT(locale);
  return (
    <div className="relative min-h-screen">
      <div className="absolute top-4 end-4 z-10">
        <LanguageToggle locale={locale} />
      </div>
      <LoginForm
        labels={{
          appName: t("appName"),
          subtitle: t("signInToContinue"),
          email: t("email"),
          password: t("password"),
          signIn: t("signIn"),
          signingIn: t("signingIn"),
        }}
      />
    </div>
  );
}
