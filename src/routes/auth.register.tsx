import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { authClient, signInWithProvider } from "@/lib/auth";
import { VoyceMark } from "@/components/voyce/VoyceMark";

// =============================================================
// Join the Pack — the ONE unified sign-up used by both the app and the website
// "Join the pack" button. Two steps, mirroring the landing form:
//   Step 1: email + ZIP (auto-fills state) + how-you-can-help + consent. This
//           creates a VERIFIED account (passwordless magic link, like the site's
//           "email me a link" style) and drops a network_signups row.
//   Step 2: set alerts now (categories, animals, shelter timing, where, breed,
//           channels) OR skip and finish later from the emailed link.
// The full breed list + ZIP→state map are extracted from the landing page so the
// two stay identical.
// =============================================================

export const Route = createFileRoute("/auth/register")({ component: Register });

// -- Extracted from the landing page (kept in sync) --
const BREED_GROUPS: { group: string; items: string[] }[] = [
  { group: "Dogs", items: ["Mixed breed","Any breed","Pit Bull mix","Labrador mix","German Shepherd mix","Chihuahua mix","Husky mix","Boxer mix","Terrier mix","Hound mix","Border Collie mix","Poodle mix","American Staff mix","Catahoula mix","Rottweiler mix","Australian Cattle Dog mix","Shepherd mix","Dachshund mix","Affenpinscher","Afghan Hound","Airedale Terrier","Akbash","Akita","Alaskan Husky","Alaskan Malamute","Bulldog","American Bulldog","American English Coonhound","American Eskimo Dog","American Foxhound","American Hairless Terrier","American Pit Bull Terrier","American Staff","American Staffordshire Terrier","American Water Spaniel","Anatolian Shepherd","Blue Heeler","Australian Cattle Dog/Blue Heeler","Australian Kelpie","Australian Shepherd","Australian Terrier","Basenji","Basset Hound","Beagle","Bearded Collie","Beauceron","Bedlington Terrier","Belgian Malinois","Belgian Sheepdog","Belgian Tervuren","Bernese Mountain Dog","Bichon Frise","Black and Tan Coonhound","Black Mouth Cur","Bloodhound","Blue Lacy","Bluetick Coonhound","Boerboel","Border Collie","Border Terrier","Borzoi","Boston Terrier","Bouvier des Flandres","Boxer","Boykin Spaniel","Brittany","Brussels Griffon","Bull Terrier","Miniature Bull Terrier","Bullmastiff","Cairn Terrier","Cane Corso","Carolina Dog","Catahoula Leopard Dog","Cavalier King Charles Spaniel","Chesapeake Bay Retriever","Chihuahua","Chinese Crested","Chinese Shar-Pei","Chow Chow","Cocker Spaniel","Collie","Coonhound","Corgi","Coton de Tulear","Dachshund","Miniature Dachshund","Dalmatian","Doberman Pinscher","Dogo Argentino","Dogue de Bordeaux","English Bulldog","English Setter","English Springer Spaniel","English Toy Spaniel","Field Spaniel","Finnish Spitz","Flat-Coated Retriever","Fox Terrier","French Bulldog","German Pinscher","German Shepherd","German Shorthaired Pointer","German Wirehaired Pointer","Giant Schnauzer","Golden Retriever","Goldendoodle","Great Dane","Great Pyrenees","Greater Swiss Mountain Dog","Greyhound","Havanese","Ibizan Hound","Irish Setter","Irish Terrier","Irish Wolfhound","Italian Greyhound","Jack Russell Terrier","Japanese Chin","Keeshond","Kelpie","Labradoodle","Labrador Retriever","Lhasa Apso","Maltese","Manchester Terrier","Mastiff","Miniature Pinscher","Miniature Schnauzer","Mountain Cur","Neapolitan Mastiff","Newfoundland","Norwegian Elkhound","Norwich Terrier","Nova Scotia Duck Tolling Retriever","Old English Sheepdog","Papillon","Patterdale Terrier","Pekingese","Cardigan Welsh Corgi","Pembroke Welsh Corgi","Pharaoh Hound","Pit Bull","Pit Bull Terrier","Plott Hound","Pointer","Pomeranian","Poodle","Portuguese Water Dog","Presa Canario","Pug","Puggle","Rat Terrier","Redbone Coonhound","Rhodesian Ridgeback","Rottweiler","Saint Bernard","Saluki","Samoyed","Schipperke","Schnauzer","Standard Schnauzer","Scottish Terrier","Setter","Shar-Pei","Shetland Sheepdog (Sheltie)","Shepherd","Shiba Inu","Shih Tzu","Siberian Husky","Silky Terrier","Spaniel","Staffordshire Bull Terrier","Miniature Poodle","Standard Poodle","Terrier","Tibetan Mastiff","Tibetan Terrier","Toy Poodle","Treeing Walker Coonhound","Vizsla","Weimaraner","Welsh Corgi","Welsh Terrier","West Highland White Terrier","Whippet","Wire Fox Terrier","Xoloitzcuintli","Yorkshire Terrier"] },
  { group: "Cats", items: ["Domestic Shorthair","Domestic Mediumhair","Domestic Longhair","Tabby","Tuxedo","Calico","Tortoiseshell","Cat (mixed)","Abyssinian","American Shorthair","Bengal","Birman","Bombay","British Shorthair","Burmese","Chartreux","Cornish Rex","Devon Rex","Egyptian Mau","Exotic Shorthair","Himalayan","Maine Coon","Manx","Munchkin","Norwegian Forest Cat","Oriental Shorthair","Persian","Ragdoll","Russian Blue","Savannah","Scottish Fold","Siamese","Siberian","Snowshoe","Sphynx","Turkish Angora"] },
  { group: "Rabbits", items: ["Domestic rabbit","Mixed breed","Any breed","Holland Lop","Mini Lop","Lop (other)","Lionhead","Netherland Dwarf","Mini Rex","Rex","Flemish Giant","Dutch","English Angora","French Angora","Californian","New Zealand","Harlequin","Polish","Himalayan","Dwarf Hotot","Silver Marten"] },
  { group: "Wildlife & other", items: ["Bird","Songbird","Hawk / Owl (raptor)","Duck / Goose (waterfowl)","Raccoon","Opossum","Squirrel","Chipmunk","Rabbit (wild)","Skunk","Fox","Coyote","Deer / Fawn","Groundhog","Bat","Turtle / Tortoise","Snake","Frog / Toad"] },
];

const ZIP_RANGES: [number, number, string][] = [[5,5,"NY"],[6,9,"PR"],[10,27,"MA"],[28,29,"RI"],[30,38,"NH"],[39,49,"ME"],[50,59,"VT"],[60,69,"CT"],[70,89,"NJ"],[100,149,"NY"],[150,196,"PA"],[197,199,"DE"],[200,205,"DC"],[206,219,"MD"],[220,246,"VA"],[247,268,"WV"],[270,289,"NC"],[290,299,"SC"],[300,319,"GA"],[320,349,"FL"],[350,369,"AL"],[370,385,"TN"],[386,397,"MS"],[398,399,"GA"],[400,427,"KY"],[430,459,"OH"],[460,479,"IN"],[480,499,"MI"],[500,528,"IA"],[530,549,"WI"],[550,567,"MN"],[570,577,"SD"],[580,588,"ND"],[590,599,"MT"],[600,629,"IL"],[630,658,"MO"],[660,679,"KS"],[680,693,"NE"],[700,714,"LA"],[716,729,"AR"],[730,749,"OK"],[750,799,"TX"],[800,816,"CO"],[820,831,"WY"],[832,838,"ID"],[840,847,"UT"],[850,865,"AZ"],[870,884,"NM"],[889,898,"NV"],[900,961,"CA"],[967,968,"HI"],[970,979,"OR"],[980,994,"WA"],[995,999,"AK"]];
function zipToState(zip: string): string {
  const z = String(zip || "").replace(/[^0-9]/g, "");
  if (z.length < 3) return "";
  const p = parseInt(z.slice(0, 3), 10);
  for (const [lo, hi, st] of ZIP_RANGES) if (p >= lo && p <= hi) return st;
  return "";
}

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DC","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
const STATE_ABBR: Record<string, string> = { Alabama:"AL",Alaska:"AK",Arizona:"AZ",Arkansas:"AR",California:"CA",Colorado:"CO",Connecticut:"CT","District of Columbia":"DC",Delaware:"DE",Florida:"FL",Georgia:"GA",Hawaii:"HI",Idaho:"ID",Illinois:"IL",Indiana:"IN",Iowa:"IA",Kansas:"KS",Kentucky:"KY",Louisiana:"LA",Maine:"ME",Maryland:"MD",Massachusetts:"MA",Michigan:"MI",Minnesota:"MN",Mississippi:"MS",Missouri:"MO",Montana:"MT",Nebraska:"NE",Nevada:"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND",Ohio:"OH",Oklahoma:"OK",Oregon:"OR",Pennsylvania:"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",Tennessee:"TN",Texas:"TX",Utah:"UT",Vermont:"VT",Virginia:"VA",Washington:"WA","West Virginia":"WV",Wisconsin:"WI",Wyoming:"WY" };

const ROLES: { label: string; val: string }[] = [
  { label: "🐾 I just want to follow along for now", val: "Animal Lover" },
  { label: "❤️ I can adopt", val: "Adopter" },
  { label: "🏠 I can foster", val: "Foster" },
  { label: "🚗 I can transport", val: "Volunteer / Transport" },
  { label: "🚶 I can check on an animal", val: "Volunteer" },
  { label: "🙋 I can help as a good samaritan", val: "Good Samaritan" },
  { label: "🩺 I can give medical care", val: "Vet" },
  { label: "📢 I can spread the word", val: "Networker" },
  { label: "💲 I can sponsor", val: "Donor" },
  { label: "🏢 I run a shelter", val: "Shelter" },
  { label: "🐾 I run a rescue", val: "Rescue / NGO / Non-Profit" },
  { label: "🙌 I volunteer at a shelter or rescue", val: "Shelter/Rescue Volunteer" },
  { label: "💼 I work at a shelter or rescue", val: "Shelter/Rescue Staff" },
  { label: "🐈 I care for a community cat colony", val: "Colony Caretaker" },
  { label: "📣 I create content / spread awareness", val: "Digital Creator / Influencer" },
  { label: "🏛️ I work in animal control", val: "Animal Control" },
  { label: "🏨 I run boarding or daycare", val: "Boarding" },
];

const CATEGORIES: { id: string; label: string; sub: string }[] = [
  { id: "injured", label: "🚨 Injured / sick", sub: "Hurt or ill animals needing urgent help" },
  { id: "lost", label: "🔍 Lost & found", sub: "Lost pets & found strays near you" },
  { id: "shelter", label: "🏥 Shelter animals", sub: "Dogs & cats needing fosters or adopters, at risk, or when a shelter is at capacity" },
  { id: "wildlife", label: "🦉 Wildlife", sub: "Injured or orphaned wild animals" },
  { id: "community", label: "🤝 Community requests", sub: "Neighbors asking for help — food, transport, TNR" },
];
const SPECIES = ["Dogs", "Cats", "Rabbits", "Wildlife", "Other"];
const SHELTER_STATUSES: { tokens: string; label: string }[] = [
  { tokens: "immediate,b6spt,office_crit,outside_crit", label: "🚨 Urgent · needs out now" },
  { tokens: "euthanasia", label: "⚫ Euthanasia in progress" },
  { tokens: "scheduled", label: "📅 Euthanasia date set" },
  { tokens: "atrisk", label: "🟠 At risk of euthanasia" },
  { tokens: "capacity", label: "🏚️ Shelter at capacity" },
  { tokens: "adoptable", label: "❤️ Needs an adopter" },
  { tokens: "foster_needed", label: "🏠 Needs a foster" },
  { tokens: "intake", label: "🆕 New intake" },
];

// Per-category sub-filters that expand when a category is checked. Stored as
// namespaced tokens in p_interests (none checked = everything in that category).
const CAT_OPTIONS: Record<string, { id: string; label: string }[]> = {
  injured: [
    { id: "injured:critical", label: "🚑 Emergency — life-threatening" },
    { id: "injured:sick", label: "🤒 Sick or hurt — not critical" },
  ],
  lost: [
    { id: "lost:lost", label: "🐕 Lost pets" },
    { id: "lost:found", label: "🔎 Found strays" },
  ],
  wildlife: [
    { id: "wild:bird", label: "🐦 Songbirds" },
    { id: "wild:raptor", label: "🦅 Hawks / owls" },
    { id: "wild:waterfowl", label: "🦆 Ducks / geese" },
    { id: "wild:smallmammal", label: "🐿️ Small mammals" },
    { id: "wild:rabbit", label: "🐇 Rabbits / hares (wild)" },
    { id: "wild:deer", label: "🦌 Deer / large mammals" },
    { id: "wild:reptile", label: "🐢 Reptiles / amphibians" },
    { id: "wild:marine", label: "🦭 Marine / shore" },
    { id: "wild:other", label: "🦝 Other wildlife" },
  ],
  community: [
    { id: "comm:food", label: "🍖 Food / supplies" },
    { id: "comm:transport", label: "🚗 Transport" },
    { id: "comm:tnr", label: "🐈 TNR" },
    { id: "comm:funds", label: "💲 Fundraising" },
    { id: "comm:boarding", label: "🏨 Boarding" },
  ],
};

function uuid(): string {
  try { return crypto.randomUUID(); } catch { return "x" + Date.now() + "-" + Math.random().toString(16).slice(2); }
}

function Register() {
  const [step, setStep] = useState<1 | 2 | "done" | "skipped">(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Step 1
  const [email, setEmail] = useState("");
  const [zip, setZip] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState("TX");
  const [role, setRole] = useState("");
  const [consent, setConsent] = useState(false);
  // The created signup's id + token, so step 2 can finish it.
  const [ctx, setCtx] = useState<{ id: string; token: string } | null>(null);
  // Step 2
  const [cats, setCats] = useState<Record<string, boolean>>({ injured: true, lost: true, shelter: true });
  const [species, setSpecies] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<Record<string, boolean>>({ 0: true, 1: true, 2: true });
  const [perDay, setPerDay] = useState(0);
  const [whereMode, setWhereMode] = useState<"mine" | "city" | "county" | "custom" | "nationwide" | "shelter">("mine");
  const [customStates, setCustomStates] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [breedInput, setBreedInput] = useState("");
  const [breeds, setBreeds] = useState<string[]>([]);
  const [breedOpen, setBreedOpen] = useState(false);
  const [chApp, setChApp] = useState(true);
  const [chEmail, setChEmail] = useState(true);
  const [chText, setChText] = useState(false);
  const [moreRoles, setMoreRoles] = useState(false);
  const [shelterSel, setShelterSel] = useState("san_antonio_acs");
  const [shelterReq, setShelterReq] = useState("");
  const [allStatus, setAllStatus] = useState(false);
  const [citySuggest, setCitySuggest] = useState<{ city: string; st: string }[]>([]);
  const cityTimer = useRef<number | null>(null);
  const [subs, setSubs] = useState<Record<string, boolean>>({});

  const filteredBreeds = useMemo(() => {
    const q = breedInput.trim().toLowerCase();
    // If they picked animal types (Dogs/Cats/…), narrow the breed list to match.
    const groupMap: Record<string, string | null> = { Dogs: "Dogs", Cats: "Cats", Wildlife: "Wildlife & other", Rabbits: "Rabbits", Other: null };
    let allowed: Set<string> | null = null;
    if (species.length) {
      const set = new Set<string>();
      let showAll = false;
      for (const sp of species) { const g = groupMap[sp]; if (g) set.add(g); else showAll = true; }
      allowed = showAll ? null : set;
    }
    const out: { group: string; items: string[] }[] = [];
    for (const g of BREED_GROUPS) {
      if (allowed && !allowed.has(g.group)) continue;
      const items = q ? g.items.filter((b) => b.toLowerCase().includes(q)) : g.items;
      if (items.length) out.push({ group: g.group, items });
    }
    return out;
  }, [breedInput, species]);

  const onZip = (v: string) => {
    setZip(v);
    const st = zipToState(v);
    if (st) setState(st);
  };

  // Live city autocomplete via the OpenStreetMap lookup the app already uses.
  const onCityInput = (v: string) => {
    setCity(v);
    if (cityTimer.current) window.clearTimeout(cityTimer.current);
    if (v.trim().length < 3) { setCitySuggest([]); return; }
    cityTimer.current = window.setTimeout(async () => {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=us&limit=6&q=${encodeURIComponent(v)}`, { headers: { Accept: "application/json" } });
        const j = (await r.json()) as { address?: Record<string, string> }[];
        const seen = new Set<string>();
        const out: { city: string; st: string }[] = [];
        for (const it of j) {
          const a = it.address || {};
          const c = a.city || a.town || a.village || a.hamlet || a.municipality;
          const st = STATE_ABBR[a.state || ""] || "";
          if (c && st) { const key = c + "," + st; if (!seen.has(key)) { seen.add(key); out.push({ city: c, st }); } }
        }
        setCitySuggest(out);
      } catch { setCitySuggest([]); }
    }, 350);
  };

  const submit1 = async () => {
    setErr(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setErr("Please enter a valid email.");
    if (!zip.trim()) return setErr("Please enter your ZIP code.");
    if (!consent) return setErr("Please agree to the Privacy Policy and Terms.");
    setBusy(true);
    try {
      const id = uuid(), token = uuid(), nowIso = new Date().toISOString();
      // Verified account: passwordless magic link (matches the site's "email me
      // a link" style). Sends a confirmation link; account is created pending.
      try {
        await authClient().auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/login`, data: { name: name.trim() } },
        });
      } catch { /* don't block joining the list if the mailer hiccups */ }
      // Lead + preferences record (public insert allowed).
      await authClient().from("network_signups").insert([{
        id, unsubscribe_token: token, email: email.trim().toLowerCase(), zip: zip.trim(),
        name: name.trim() || null, state: state || null, role: role || null, source: "network",
        consent_privacy: true, consent_terms: true, consent_at: nowIso, created_at: nowIso,
        alert_channels: ["in_app", "email"],
        alert_statuses: ["immediate", "b6spt", "office_crit", "outside_crit", "euthanasia", "scheduled"],
      }]);
      setCtx({ id, token });
      setStep(2);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submit2 = async () => {
    if (!ctx) { setStep("done"); return; }
    setBusy(true);
    try {
      const alertStates =
        whereMode === "nationwide" ? [] :
        whereMode === "mine" ? (state ? [state] : []) :
        whereMode === "custom" ? customStates : [];
      const statusTokens = SHELTER_STATUSES.filter((_, i) => statuses[i]).flatMap((s) => s.tokens.split(","));
      const channels = [
        ...(chApp ? ["in_app"] : []),
        ...(chEmail ? ["email"] : []),
        ...(chText ? ["text"] : []),
      ];
      await authClient().rpc("finish_network_signup", {
        p_id: ctx.id, p_token: ctx.token,
        p_state: (whereMode === "mine" || whereMode === "city" || whereMode === "county") ? state : "",
        p_alert_states: alertStates,
        p_alert_statuses: statusTokens.length ? statusTokens : ["immediate", "b6spt", "office_crit", "outside_crit", "euthanasia", "scheduled"],
        p_alert_channels: channels.length ? channels : ["in_app"],
        p_alert_per_day: perDay,
        p_interests: [...Object.keys(cats).filter((k) => cats[k]), ...Object.keys(subs).filter((k) => subs[k])],
        p_alert_breeds: breeds,
        p_shelter: whereMode === "shelter" ? (shelterSel === "__request" ? shelterReq.trim() : shelterSel) : "",
        p_alert_species: species,
        p_alert_city: whereMode === "city" ? city.trim() : "",
        p_alert_county: whereMode === "county" ? county.trim() : "",
      });
    } catch { /* best-effort */ } finally {
      setBusy(false);
      setStep("done");
    }
  };

  const oauth = async (provider: "google" | "apple" | "facebook") => {
    setErr(null); setBusy(true);
    try {
      const { error } = await signInWithProvider(provider);
      if (error) { setErr(error.message); setBusy(false); }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't start sign-in — please try again.");
      setBusy(false);
    }
  };

  const input = "mt-1 w-full rounded-xl border border-[#E2DED6] bg-white px-3.5 py-3 text-[15px] text-[#1A1611] outline-none focus:border-[#C9871A]";
  const label = "text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A8175]";
  const pill = (on: boolean) =>
    "rounded-full border-2 px-3 py-1.5 text-[12.5px] font-semibold transition active:scale-95 " +
    (on ? "border-[#FFDF3B] bg-[#FFF7D6] text-[#8A5A0E]" : "border-[#E3DAC4] bg-white text-[#6B5832]");

  return (
    <div className="flex min-h-[100dvh] flex-col items-center bg-[#FBF7EC] px-5 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <VoyceMark size={56} className="mb-2" />
        <div className="text-[22px] font-black tracking-tight text-[#0B0B0C]">Voyce <span className="italic text-[#C9871A]">for</span> Paws&trade;</div>
      </div>

      <div className="w-full max-w-sm rounded-3xl border border-[#EDE5D8] bg-white/70 p-5 shadow-[0_8px_30px_-12px_rgba(60,40,10,0.15)]">
        {step === 1 && (
          <>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#C9871A]">Join the Voyce Pack</div>
            <h1 className="mt-1 font-serif text-[24px] font-bold text-[#0B0B0C]">Join the people who save them all.</h1>
            <p className="mt-1 text-[13px] leading-relaxed text-[#6B5832]">Become part of the pack that answers when animals need help — injured strays, lost pets, shelter dogs, and more.</p>

            <div className="mt-4"><SocialButtons busy={busy} onPick={oauth} /></div>
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#E3DAC4]" /><span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8175]">or</span><div className="h-px flex-1 bg-[#E3DAC4]" />
            </div>

            <label className="block"><span className={label}>Name <span className="font-normal normal-case text-[#8A8175]">(optional)</span></span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="First and last" className={input} /></label>
            <label className="mt-4 block"><span className={label}>Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@email.com" className={input} /></label>
            <label className="mt-4 block"><span className={label}>ZIP code</span>
              <input value={zip} onChange={(e) => onZip(e.target.value)} inputMode="numeric" placeholder="e.g. 78201" className={input} /></label>
            <label className="mt-4 block"><span className={label}>State <span className="font-normal normal-case text-[#8A8175]">(auto-fills from ZIP)</span></span>
              <select value={state} onChange={(e) => setState(e.target.value)} className={input}>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></label>

            <div className="mt-4">
              <span className={label}>How can you help? <span className="font-normal normal-case text-[#8A8175]">— pick any (optional)</span></span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(moreRoles ? ROLES : ROLES.slice(0, 11)).map((r) => (
                  <button key={r.val} type="button" onClick={() => setRole(role === r.val ? "" : r.val)} className={pill(role === r.val)}>{r.label}</button>
                ))}
                {!moreRoles && <button type="button" onClick={() => setMoreRoles(true)} className="rounded-full border-2 border-dashed border-[#C9871A] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#8A5A0E]">More options →</button>}
              </div>
            </div>

            {(role === "Shelter" || role === "Rescue / NGO / Non-Profit") && (
              <div className="mt-2 rounded-xl border border-[#F0C88A] bg-[#FFF6E5] px-3.5 py-3 text-[12.5px] leading-snug text-[#4a4033]">
                <b>{role === "Shelter" ? "🏛️ Run a shelter?" : "🐾 Run a rescue?"}</b> No rush — finish joining below to follow along. When you're ready,{" "}
                <a href={role === "Shelter" ? "https://voyceforpaws.org/register-shelter.html" : "https://voyceforpaws.org/register-rescue.html"} target="_blank" rel="noopener" className="font-bold text-[#C9871A] underline">register your {role === "Shelter" ? "shelter" : "rescue"} →</a> so Voyce watches your list for you.
              </div>
            )}

            <p className="mt-3 text-[12px] leading-relaxed text-[#6B5832]">⚡ Just your <b>email &amp; ZIP</b> is all it takes. Everything else is optional — after you join you can set up alerts now <b>or have us email a link to finish later</b>.</p>

            <label className="mt-3 flex items-start gap-2.5 text-[12px] leading-snug text-[#6B5832]">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#C9871A]" />
              <span>I agree to the <a href="/privacy" target="_blank" className="underline">Privacy Policy</a> and <a href="/terms" target="_blank" className="underline">Terms of Use</a>.</span>
            </label>

            {err && <p className="mt-3 rounded-xl bg-[#FCE4E4] px-3 py-2 text-[12.5px] font-medium text-[#7E1F1F]">{err}</p>}
            <button type="button" onClick={submit1} disabled={busy}
              className="mt-5 w-full rounded-2xl px-5 py-3.5 text-[15px] font-bold text-[#3A2A07] shadow transition active:scale-[0.99] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#FFDF3B,#C9871A)" }}>
              {busy ? "Joining…" : "Join the Pack →"}
            </button>
            <p className="mt-3 text-center text-[13px] text-[#6B5832]">Already have an account? <a href="/auth/login" className="font-bold text-[#C9871A] hover:underline">Sign in</a></p>
          </>
        )}

        {step === 2 && (
          <>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#C9871A]">🎉 Welcome to the Voyce Pack</div>
            <h1 className="mt-1 font-serif text-[24px] font-bold text-[#0B0B0C]">You're in.</h1>
            <p className="mt-1 text-[13px] leading-relaxed text-[#6B5832]">Check your email to confirm. Set your alerts now, or skip and we'll email a link to finish anytime.</p>

            <button type="button" onClick={() => setStep("skipped")}
              className="mt-3 w-full rounded-2xl border-[1.5px] border-[#E3DAC4] bg-white px-4 py-3 text-[13px] font-bold text-[#1A1611]">
              ✉️ Skip for now — email me the link
            </button>
            <div className="my-3 text-center text-[12.5px] text-[#8A8175]">…or set it up right here 👇</div>

            <div><span className={label}>What should we alert you about?</span>
              <div className="mt-2 space-y-1.5">
                {CATEGORIES.map((c) => {
                  const on = !!cats[c.id];
                  const opts = CAT_OPTIONS[c.id];
                  return (
                    <div key={c.id}>
                      <button type="button" onClick={() => setCats((p) => ({ ...p, [c.id]: !on }))}
                        className="flex w-full items-start gap-2.5 rounded-2xl border-2 px-3.5 py-2.5 text-left transition"
                        style={on ? { borderColor: "#FFDF3B", background: "#FFF7D6" } : { borderColor: "#EAE6DE", background: "#fff" }}>
                        <span className="mt-0.5 grid h-4 w-4 shrink-0 place-content-center rounded border-2 text-[10px] font-bold"
                          style={on ? { borderColor: "#C9871A", background: "#FFDF3B", color: "#3A2A07" } : { borderColor: "#D9D2C2", color: "transparent" }}>✓</span>
                        <span><span className="block text-[13px] font-semibold text-[#1A1611]">{c.label}</span><span className="block text-[11px] text-[#6B5832]">{c.sub}</span></span>
                      </button>
                      {on && c.id === "shelter" && (
                        <div className="mb-1 ml-3 mt-1 border-l-2 border-[#F0E4C6] pl-3">
                          <div className="py-1 text-[11px] font-semibold text-[#8A5A0E]">Alert me when…</div>
                          {SHELTER_STATUSES.map((sst, i) => {
                            const son = !!statuses[i];
                            return (
                              <label key={i} className="flex items-center gap-2.5 py-0.5 text-[13px] text-[#3A2A07]">
                                <input type="checkbox" checked={son} onChange={() => setStatuses((p) => ({ ...p, [i]: !son }))} className="h-4 w-4 accent-[#C9871A]" />
                                <span>{sst.label}</span>
                              </label>
                            );
                          })}
                          <label className="flex items-center gap-2.5 py-0.5 text-[13px] font-semibold text-[#3A2A07]">
                            <input type="checkbox" checked={allStatus} onChange={(e) => { const v = e.target.checked; setAllStatus(v); setStatuses(Object.fromEntries(SHELTER_STATUSES.map((_, i) => [i, v]))); }} className="h-4 w-4 accent-[#C9871A]" />
                            <span>🔔 Everything — any change</span>
                          </label>
                        </div>
                      )}
                      {on && opts && (
                        <div className="mb-1 ml-3 mt-1 border-l-2 border-[#F0E4C6] pl-3">
                          <div className="py-1 text-[11px] text-[#8A8175]">Narrow it down <span className="italic">(optional · none = all)</span></div>
                          <div className="flex flex-wrap gap-1.5">
                            {opts.map((o) => (
                              <button key={o.id} type="button" onClick={() => setSubs((p) => ({ ...p, [o.id]: !p[o.id] }))} className={pill(!!subs[o.id])}>{o.label}</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4"><span className={label}>Which animals? <span className="font-normal normal-case text-[#8A8175]">(blank = all)</span></span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SPECIES.map((s) => (
                  <button key={s} type="button" onClick={() => { const has = species.includes(s); setSpecies(has ? species.filter((x) => x !== s) : [...species, s]); if (!has) setBreedOpen(true); }} className={pill(species.includes(s))}>{s}</button>
                ))}
              </div>
            </div>

            <label className="mt-4 block"><span className={label}>How often</span>
              <select value={perDay} onChange={(e) => setPerDay(Number(e.target.value))} className={input}>
                <option value={0}>As it happens</option><option value={1}>Once a day</option><option value={2}>Twice a day</option><option value={3}>3× a day</option><option value={24}>Hourly</option>
              </select></label>

            <div className="mt-4"><span className={label}>Where — states to watch</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {([["mine", "🏙️ My state"], ["city", "📍 My city"], ["county", "🗺️ My county"], ["custom", "🗺️ Pick states"], ["nationwide", "🌎 Nationwide"], ["shelter", "🏥 Shelter"]] as const).map(([m, lbl]) => (
                  <button key={m} type="button" onClick={() => setWhereMode(m)} className={pill(whereMode === m)}>{lbl}</button>
                ))}
              </div>
              {whereMode === "mine" && (
                <select value={state} onChange={(e) => setState(e.target.value)} className={input}>{US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
              )}
              {whereMode === "city" && (
                <div className="mt-1.5 space-y-1.5">
                  <div className="relative">
                    <input value={city} onChange={(e) => onCityInput(e.target.value)} placeholder="Your city — e.g. Cleveland" className={input} autoComplete="off" />
                    {citySuggest.length > 0 && (
                      <div className="absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-auto rounded-xl border border-[#E3DAC4] bg-white shadow-lg">
                        {citySuggest.map((sg, i) => (
                          <button key={i} type="button" onClick={() => { setCity(sg.city); setState(sg.st); setCitySuggest([]); }}
                            className="block w-full px-3 py-2 text-left text-[13.5px] text-[#2a2419] hover:bg-[#FFF6E5]">{sg.city}, {sg.st}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <select value={state} onChange={(e) => setState(e.target.value)} className={input} aria-label="State">
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              {whereMode === "county" && (
                <div className="mt-1.5 space-y-1.5">
                  <input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="Your county — e.g. Cuyahoga County" className={input} />
                  <select value={state} onChange={(e) => setState(e.target.value)} className={input} aria-label="State">
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              {whereMode === "custom" && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {US_STATES.map((s) => {
                    const on = customStates.includes(s);
                    return (
                      <button key={s} type="button" onClick={() => setCustomStates((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s])}
                        className="rounded-md px-2 py-1 text-[11px] font-semibold transition active:scale-95"
                        style={on ? { background: "#FFDF3B", color: "#3A2A07" } : { background: "#fff", color: "#6B5832", border: "1px solid #E3DAC4" }}>{s}</button>
                    );
                  })}
                </div>
              )}
              {whereMode === "shelter" && (
                <div className="mt-2">
                  <select value={shelterSel} onChange={(e) => setShelterSel(e.target.value)} className={input}>
                    <option value="san_antonio_acs">San Antonio ACS — San Antonio, TX</option>
                    <option value="__request">Request another shelter…</option>
                  </select>
                  {shelterSel === "__request" && <input value={shelterReq} onChange={(e) => setShelterReq(e.target.value)} placeholder="Shelter name…" className={input} />}
                  <p className="mt-1 text-[11px] text-[#8A8175]">Get alerts whenever anything changes at this shelter.</p>
                </div>
              )}
              {whereMode === "nationwide" && <p className="mt-1 text-[11px] text-[#8A8175]">Alerts for every state, as more cities come online.</p>}
            </div>

            <div className="mt-4"><span className={label}>Breed or type <span className="font-normal normal-case text-[#8A8175]">(optional · blank = any)</span></span>
              {breeds.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {breeds.map((b) => (
                    <button key={b} type="button" onClick={() => setBreeds((p) => p.filter((x) => x !== b))}
                      className="inline-flex items-center gap-1 rounded-full border border-[#C9871A] bg-[#FFF6E5] px-2.5 py-1 text-[12px] font-semibold text-[#8A5A0E]">{b} <span aria-hidden>✕</span></button>
                  ))}
                </div>
              )}
              <input value={breedInput} onChange={(e) => { setBreedInput(e.target.value); setBreedOpen(true); }} onFocus={() => setBreedOpen(true)}
                placeholder="Select or type a breed…" className={input} />
              {breedOpen && (
                <div className="mt-1 max-h-56 overflow-auto rounded-xl border border-[#E3DAC4] bg-white">
                  {filteredBreeds.map((g) => (
                    <div key={g.group}>
                      <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-[#8A8175]">{g.group}</div>
                      {g.items.map((b) => (
                        <button key={b} type="button" onClick={() => { if (!breeds.includes(b)) setBreeds((p) => [...p, b]); setBreedInput(""); setBreedOpen(false); }}
                          className="block w-full px-3 py-2 text-left text-[13.5px] text-[#2a2419] hover:bg-[#FFF6E5]">{b}</button>
                      ))}
                    </div>
                  ))}
                  {filteredBreeds.length === 0 && <div className="px-3 py-2 text-[13px] text-[#8A8175]">No match</div>}
                </div>
              )}
            </div>

            <div className="mt-4"><span className={label}>How should we reach you?</span>
              <label className="mt-1.5 flex items-center gap-2.5 text-[13px] text-[#3A2A07]"><input type="checkbox" checked={chApp} onChange={(e) => setChApp(e.target.checked)} className="h-4 w-4 accent-[#C9871A]" /><span>🔔 In the app</span></label>
              <label className="mt-1.5 flex items-center gap-2.5 text-[13px] text-[#3A2A07]"><input type="checkbox" checked={chEmail} onChange={(e) => setChEmail(e.target.checked)} className="h-4 w-4 accent-[#C9871A]" /><span>✉️ Email me</span></label>
              <label className="mt-1.5 flex items-center gap-2.5 text-[13px] text-[#3A2A07]"><input type="checkbox" checked={chText} onChange={(e) => setChText(e.target.checked)} className="h-4 w-4 accent-[#C9871A]" /><span>💬 Text me <span className="text-[#8A8175]">(phone added later)</span></span></label>
            </div>

            <button type="button" onClick={submit2} disabled={busy}
              className="mt-5 w-full rounded-2xl bg-[#0B0B0C] px-5 py-3.5 text-[15px] font-bold text-white shadow transition active:scale-[0.99] disabled:opacity-60">
              {busy ? "Saving…" : "✉️ Save my alert settings"}
            </button>
            <button type="button" onClick={() => setStep("skipped")} className="mt-2 block w-full text-[13px] font-semibold text-[#6b6b70]">Finish later — we'll email you a link →</button>
          </>
        )}

        {(step === "done" || step === "skipped") && (
          <div className="py-6 text-center">
            <div className="text-4xl">🎉</div>
            <h1 className="mt-3 font-serif text-[24px] font-bold text-[#0B0B0C]">You're in the Voyce Pack!</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[#6B5832]">
              {step === "skipped"
                ? "No need to finish now — we've emailed you a link so you can set up exactly which alerts you want whenever it's convenient. Please also confirm your email from the link we just sent."
                : "Your alerts are set. Please confirm your email from the link we just sent so everything's active."}
            </p>
            <a href="/" className="mt-5 inline-block rounded-2xl px-5 py-3 text-[14px] font-bold text-[#3A2A07] no-underline shadow" style={{ background: "linear-gradient(135deg,#FFDF3B,#C9871A)" }}>Explore Voyce for Paws</a>
          </div>
        )}
      </div>

      <a href="/" className="mt-6 text-[13px] font-semibold text-[#8A5A0E] underline-offset-2 hover:underline">Just looking? Explore the app first →</a>
    </div>
  );
}

function SocialButtons({ busy, onPick }: { busy: boolean; onPick: (p: "google" | "apple" | "facebook") => void }) {
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => onPick("google")} disabled={busy}
        className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-[#E2DED6] bg-white px-5 py-3 text-[14.5px] font-semibold text-[#1A1611] shadow-sm transition active:scale-[0.99] disabled:opacity-60">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
          <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.3 7.4 24 12 24z" />
          <path fill="#FBBC05" d="M5.4 14.4c-.2-.7-.4-1.4-.4-2.4s.1-1.7.4-2.4V6.5H1.4C.5 8.2 0 10 0 12s.5 3.8 1.4 5.5l4-3.1z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.5l4 3.1C6.3 6.8 8.9 4.8 12 4.8z" />
        </svg><span>Continue with Google</span>
      </button>
      <button type="button" onClick={() => onPick("apple")} disabled={busy}
        className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#1A1611] px-5 py-3 text-[14.5px] font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-60">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="#fff" aria-hidden><path d="M16.365 1.43c0 1.14-.42 2.2-1.12 2.99-.76.86-2 1.52-3.02 1.44-.13-1.1.44-2.28 1.1-3.02.74-.84 2.02-1.46 3.04-1.41zM20.5 17.06c-.55 1.27-.82 1.84-1.53 2.96-.99 1.57-2.38 3.53-4.1 3.54-1.53.01-1.92-.99-4-.98-2.08.01-2.51.99-4.04.98-1.72-.01-3.04-1.77-4.03-3.34C.02 16.6-.35 12.4 1.3 9.98c1.1-1.63 2.86-2.58 4.5-2.58 1.68 0 2.73 1 4.12 1 1.35 0 2.17-1 4.11-1 1.47 0 3.03.8 4.14 2.18-3.64 1.99-3.05 7.18.23 8.48z" /></svg><span>Continue with Apple</span>
      </button>
    </div>
  );
}
