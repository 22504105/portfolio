// Creates an account with a role, for staff and for demonstrations. Sign-up on
// the site only ever creates clients; this is how an admin or a barber is made.
//
// Usage:
//   npm run user:create -- <email> <client|barber|admin> [barber-slug] [name]
//   npm run user:create -- marcus@example.com barber marcus-hale "Marcus Hale"
//
// The address is marked as confirmed, so no email is sent. A password is
// generated and printed once; it can be changed after signing in. If the
// account exists already, only its role and its barber link are updated.
//
// It writes to Supabase's auth tables directly, with the database connection
// in .env.local. That is a privileged operation: run it yourself, on purpose.

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

const [email, role, barberSlug, name] = process.argv.slice(2);
if (!email?.includes("@") || !["client", "barber", "admin"].includes(role) || (role === "barber" && !barberSlug)) {
  console.error('Usage: npm run user:create -- <email> <client|barber|admin> [barber-slug] ["Name"]');
  process.exit(1);
}

const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((entry) => entry.startsWith("DATABASE_URL="));
const url = line.slice("DATABASE_URL=".length).trim();
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
await client.connect();

try {
  await client.query("begin");
  const address = email.trim().toLowerCase();
  let password = null;

  let userId = (await client.query("select id from auth.users where lower(email) = $1", [address])).rows[0]?.id;
  if (!userId) {
    password = randomBytes(12).toString("base64url");
    // The empty strings matter: the auth server reads these columns as text and fails on null.
    userId = (
      await client.query(
        `insert into auth.users (
           instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
           raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
           confirmation_token, recovery_token, email_change_token_new, email_change
         )
         values (
           '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1,
           extensions.crypt($2, extensions.gen_salt('bf')), now(),
           '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', $3::text), now(), now(),
           '', '', '', ''
         )
         returning id`,
        [address, password, name ?? null],
      )
    ).rows[0].id;
    await client.query(
      `insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
       values (gen_random_uuid(), $1::uuid, ($1::uuid)::text, 'email',
               jsonb_build_object('sub', ($1::uuid)::text, 'email', $2::text, 'email_verified', true, 'phone_verified', false),
               now(), now(), now())`,
      [userId, address],
    );
  }

  // The profile is created by a trigger on sign-up; make sure of it, then set the role.
  await client.query(
    `insert into public.profiles (id, role, full_name) values ($1, $2::public.app_role, $3)
     on conflict (id) do update set role = excluded.role, full_name = coalesce(excluded.full_name, public.profiles.full_name)`,
    [userId, role, name ?? null],
  );

  if (role === "barber") {
    const linked = await client.query("update public.barbers set profile_id = $1 where slug = $2 returning name", [userId, barberSlug]);
    if (linked.rowCount !== 1) throw new Error(`No barber with the slug "${barberSlug}"`);
    console.log(`linked to barber: ${linked.rows[0].name}`);
  } else {
    await client.query("update public.barbers set profile_id = null where profile_id = $1", [userId]);
  }

  await client.query("select public.link_customer_account($1)", [userId]);
  await client.query("commit");

  console.log(`${address}: ${role}`);
  console.log(password ? `password (shown once): ${password}` : "the account existed already; its password is unchanged");
} catch (error) {
  await client.query("rollback");
  console.error("Nothing was changed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
