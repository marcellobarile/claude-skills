# Gap-filling question bank

Ask ONE at a time. Skip any field already filled from discovery. Prioritize: headline → summary → recent experience bullets → skills.

## identity / contacts
- "Full name as it should appear on the CV?" → identity.fullName
- "One-line professional headline (role + specialty)?" → identity.headline
- "City / country for location?" → identity.location
- "Which contacts to show: email, phone, website? (LinkedIn/GitHub/Medium auto-added if given)" → contacts.*

## summary
- "In one sentence, what value do you bring? Then one quantified achievement to back it." → summary

## experience (per role with thin data)
- "For <role> at <company>: what were your 2–3 biggest results? Numbers if you have them (%, scale, time saved)." → experience[].bullets
- "Main tech/tools used in that role?" → experience[].stack
- "Start and end (month/year, or 'Present')?" → experience[].start/end

## skills
- "Group your top skills — e.g. Languages, Infra, Tools. List the items per group." → skills.groups

## projects
- "Any standout side/open-source projects worth showing? Name, link, one-line description, stack." → projects[]

## education
- "Highest relevant degree: title, institution, years, notable honors?" → education[]

## certifications
- "Any certifications to list? (name + year)" → certifications[]

## footer (defaults, confirm tone)
- AI_TAGLINE: craft a sober one-liner on 'AI as a tool in service of humans' in the CV's language.
- AI_DISCLAIMER: 'CV drafted with the support of an AI' (translated to the CV's language).
