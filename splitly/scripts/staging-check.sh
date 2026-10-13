#!/usr/bin/env bash
# Checks a trial deployment that has no database and has its self-test switched on
# (SPLITLY_SELFTEST=1 and a throwaway SESSION_SECRET): the server answers, accounts are
# off, rates come from the source, and the demo group's report is made on the server
# and handed out by a signed address that is refused when altered or out of date.
#
#   bash scripts/staging-check.sh https://<deployment>.vercel.app [out-dir]
#
# The deployment is behind Vercel's own sign-in, so requests go through `vercel curl`.
set -u
URL="${1:?the deployment address}"
OUT="${2:-.tmp/staging}"
mkdir -p "$OUT"
pass=0
fail=0

# get <path> <file>: saves the body, prints the status.
get() { npx vercel curl "$URL$1" --scope riddle6 -- -s -o "$OUT/$2" -w "%{http_code}" 2>/dev/null | tail -c 3; }
head_of() { npx vercel curl "$URL$1" --scope riddle6 -- -s -D - -o /dev/null 2>/dev/null; }
check() { # check <what> <got> <wanted>
  if [ "$2" = "$3" ]; then pass=$((pass + 1)); echo "  ok    $1"; else fail=$((fail + 1)); echo "  FAIL  $1: got '$2', wanted '$3'"; fi
}
field() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s)[process.argv[1]]??"")}catch{console.log("")}})' "$1" < "$OUT/$2"; }

echo "the server"
check "health answers" "$(get /api/health health.json)" 200
check "it runs beside the database's region" "$(field region health.json)" dub1
check "the demo opens" "$(get /ru/demo demo.html)" 200
check "the front page opens" "$(get /en front.html)" 200

echo "no accounts here: nothing of anyone's can be read"
check "the data API says it is not configured" "$(get /api/v1/groups groups.json)" 503
check "  and says only that" "$(cat "$OUT/groups.json")" '{"error":"not_configured"}'
check "a download address cannot be asked for" "$(get /api/v1/downloads/x.y dl.json)" 503
check "the person's own app says to open the demo, not an error" "$(get /ru/app app.html)" 200

echo "exchange rates"
check "EUR to TRY comes from the source" "$(get '/api/rates?from=EUR&to=TRY' rate.json)" 200
check "  for the pair asked" "$(field from rate.json)$(field to rate.json)" EURTRY
echo "        rate $(field rate rate.json) of $(field date rate.json)"
check "a pair the table lacks is refused" "$(get '/api/rates?from=RUB&to=TRY' rate2.json)" 404
# Vercel's own cache takes the "keep for twelve hours" part of the header for itself and says when it answered from it.
check "a repeated request is answered from the cache" "$(head_of '/api/rates?from=EUR&to=TRY' | grep -i '^x-vercel-cache' | tr -d '' | sed 's/^[^:]*: //')" "HIT"

echo "files made on the server, by signed address"
for format in pdf xlsx csv; do
  check "an address for the $format is issued" "$(get "/api/v1/selftest/link?format=$format&locale=ru" link-$format.json)" 200
  check "  and gives the file" "$(get "$(field url link-$format.json)" "report.$format")" 200
done
check "the PDF is a PDF" "$(head -c 5 "$OUT/report.pdf")" "%PDF-"
check "the workbook is a ZIP" "$(head -c 2 "$OUT/report.xlsx")" "PK"
check "the CSV has the demo's debt, Cyrillic whole" "$(grep -c 'Керем,Алексей,830.12,TRY' "$OUT/report.csv")" 1
echo "        pdf $(wc -c < "$OUT/report.pdf") bytes, xlsx $(wc -c < "$OUT/report.xlsx") bytes"
check "the file is sent to be saved, under its Cyrillic name" "$(head_of "$(field url link-pdf.json)" | grep -i '^content-disposition' | grep -c "filename\*=UTF-8''splitly-%D0%92")" 1
check "  and may not be kept by anything in between" "$(head_of "$(field url link-pdf.json)" | grep -i '^cache-control' | tr -d '\r' | sed 's/^[^:]*: //')" "private, no-store"

echo "an address is refused unless it is exactly as signed and in date"
good="$(field url link-csv.json)"
ticket="${good##*/}"
payload="${ticket%%.*}"
signature="${ticket##*.}"
longer="$(node -e 'const n=JSON.parse(Buffer.from(process.argv[1],"base64url"));n.e+=86400;console.log(Buffer.from(JSON.stringify(n)).toString("base64url"))' "$payload")"
other="$(node -e 'const n=JSON.parse(Buffer.from(process.argv[1],"base64url"));n.u="11111111-1111-4111-8111-111111111111";console.log(Buffer.from(JSON.stringify(n)).toString("base64url"))' "$payload")"
check "its time made longer" "$(get "/api/v1/selftest/file/$longer.$signature" bad.json)" 404
check "made out to someone else" "$(get "/api/v1/selftest/file/$other.$signature" bad.json)" 404
check "its signature cut" "$(get "/api/v1/selftest/file/$payload.${signature%??}AA" bad.json)" 404
check "no signature at all" "$(get "/api/v1/selftest/file/$payload" bad.json)" 404
check "a session-shaped token instead" "$(get "/api/v1/selftest/file/x.y" bad.json)" 404
check "  each with the same answer" "$(cat "$OUT/bad.json")" '{"error":"not_found"}'
check "an address issued 301 seconds ago is issued" "$(get '/api/v1/selftest/link?format=csv&age=301' stale.json)" 200
check "  and is out of date" "$(get "$(field url stale.json)" bad.json)" 404
check "one issued 290 seconds ago still works" "$(get '/api/v1/selftest/link?format=csv&age=290' fresh.json)" 200
check "  " "$(get "$(field url fresh.json)" fresh.csv)" 200
check "the real download route does not take a self-test address" "$(get "/api/v1/downloads/$ticket" bad.json)" 503

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
