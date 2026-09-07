Planned edit for ShelterPicker.tsx (at-risk list rows):

In the AnimalRow action row, replace the external "View listing" anchor:

    {a.pet_search_url && (
      <a href={a.pet_search_url} target="_blank" rel="noopener noreferrer"
         onClick={(e) => e.stopPropagation()}
         className="rounded-full border border-[#D9D2C2] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1A1611] transition active:scale-95">
        🔗 View listing
      </a>
    )}

with a primary "See details" button that opens the in-app rich card (onPick):

    <button onClick={(e) => { e.stopPropagation(); onPick(a); }}
      className="rounded-full px-3 py-1 text-[11px] font-bold transition active:scale-95"
      style={{ background: GOLD, borderColor: GOLD, color: "#3A2A07" }}>
      See details →
    </button>

Rationale: the ACS listing + ACS PDF links already live INSIDE the rich card,
so the external listing stays reachable one tap deeper. This makes the rich
Voyce card the obvious primary action from the at-risk list.
