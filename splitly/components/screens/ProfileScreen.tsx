import { Languages, Palette, SlidersHorizontal } from "lucide-react";
import { LocaleSwitch } from "@/components/shell/LocaleSwitch";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import type { Dictionary, Locale } from "@/lib/i18n";
import { CurrencyRow, ProfileCard, ProfileExtras } from "./ProfileExtras";
import { SectionTitle, SettingRow } from "./settings-parts";

/**
 * The profile, after Stitch: who this is, then the settings in one card (the
 * language, the theme, the usual currency), then what depends on where the
 * data lives: the demo can be started over, an account deleted.
 */
export function ProfileScreen({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const t = dictionary.profile;
  return (
    <>
      <h1 className="type-title">{t.title}</h1>
      <p className="type-lead text-ink-muted mt-2">{t.lead}</p>
      <ProfileCard />

      <SectionTitle icon={SlidersHorizontal}>{t.settings}</SectionTitle>
      <div className="card divide-line mt-2.5 divide-y">
        <SettingRow icon={Languages} title={t.language} hint={t.languageHint}>
          <LocaleSwitch locale={locale} labels={dictionary.language} />
        </SettingRow>
        <SettingRow icon={Palette} title={t.theme} hint={t.themeHint}>
          <ThemeToggle labels={dictionary.theme} expanded className="w-full" />
        </SettingRow>
        <CurrencyRow />
      </div>

      <ProfileExtras />
    </>
  );
}
