import type { Metadata } from "next";
import { ProfileExtras } from "@/components/screens/ProfileExtras";
import { LocaleSwitch } from "@/components/shell/LocaleSwitch";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { pageLocale } from "@/lib/page";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/profile">): Promise<Metadata> {
  return { title: (await pageLocale(params)).dictionary.profile.title };
}

// The language and the theme, then what depends on where the data lives: the demo can be started over, an account deleted.
export default async function ProfilePage({ params }: PageProps<"/[locale]/demo/profile">) {
  const { locale, dictionary } = await pageLocale(params);
  const t = dictionary.profile;

  return (
    <>
      <h1 className="type-title">{t.title}</h1>
      <p className="type-lead text-ink-muted mt-2">{t.lead}</p>

      <section aria-labelledby="profile-language" className="card mt-6 p-5 sm:p-6">
        <h2 id="profile-language" className="type-heading">
          {t.language}
        </h2>
        <p className="type-small text-ink-muted mt-1 mb-4">{t.languageHint}</p>
        <LocaleSwitch locale={locale} labels={dictionary.language} />
      </section>

      <section aria-labelledby="profile-theme" className="card mt-4 p-5 sm:p-6">
        <h2 id="profile-theme" className="type-heading">
          {t.theme}
        </h2>
        <p className="type-small text-ink-muted mt-1 mb-4">{t.themeHint}</p>
        <ThemeToggle labels={dictionary.theme} expanded className="max-w-md" />
      </section>

      <ProfileExtras />
    </>
  );
}
