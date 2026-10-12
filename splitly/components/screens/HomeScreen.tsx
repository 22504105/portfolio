"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { errorText, useApp, useLoad } from "@/components/app/AppProvider";
import { buttonClass, Loading, Problem } from "@/components/ui/controls";
import { GroupCard, MyBalance, totalNet } from "./parts";

/** The first screen: where you stand over all your groups, and the groups. */
export function HomeScreen() {
  const { t, base } = useApp();
  const { data: groups, error } = useLoad((store) => store.listGroups(), "groups");
  const open = groups?.filter((group) => !group.archivedAt) ?? [];

  return (
    <>
      <h1 className="type-title">{t.home.title}</h1>
      <p className="type-lead text-ink-muted mt-2">{t.home.lead}</p>

      {error && <Problem className="mt-6">{errorText(t, error)}</Problem>}
      {!groups && !error && <Loading label={t.common.loading} />}

      {groups && (
        <>
          <section aria-labelledby="home-balance" className="card mt-6 p-5 sm:p-6">
            <h2 id="home-balance" className="type-label text-ink-muted mb-3">
              {t.balance.title}
            </h2>
            <MyBalance net={totalNet(groups)} large />
            {Object.keys(totalNet(groups)).length > 1 && <p className="type-small text-ink-muted mt-4">{t.balance.apart}</p>}
          </section>

          <section aria-labelledby="home-groups" className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="home-groups" className="type-heading">
                {t.home.yourGroups}
              </h2>
              <Link
                href={`${base}/groups`}
                className="type-small text-ink inline-flex h-11 items-center font-semibold underline underline-offset-4"
              >
                {t.home.allGroups}
              </Link>
            </div>
            {open.length === 0 ? (
              <div className="card flex flex-col items-start gap-4 p-5">
                <p className="text-ink-muted">{t.home.noGroups}</p>
                <Link href={`${base}/groups`} className={buttonClass("primary")}>
                  <Plus aria-hidden="true" className="size-5" />
                  {t.groups.create}
                </Link>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {open.map((group) => (
                  <GroupCard key={group.id} group={group} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
