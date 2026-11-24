"use strict";

/* ===================================================================
   The AI tools. Each tool is a small form; prompt() turns the answers
   into the message sent to Claude. The business profile is added to the
   system prompt by app.js, so prompts here don't repeat it.
   `demo` values fill the form in demo mode.
   =================================================================== */

const TONES = ["Friendly", "Professional", "Warm and apologetic", "Firm but polite", "Short and direct"];
const line = (label, v) => (String(v || "").trim() ? `${label}: ${String(v).trim()}\n` : "");

self.TOOLS = [
  // ---------------- Customers ----------------
  {
    id: "reply", cat: "Customers", icon: "✉️", name: "Customer email reply", free: true,
    desc: "Paste a customer message and get a ready-to-send reply.",
    fields: [
      { name: "message", label: "The customer's message", type: "textarea", required: true,
        demo: "Hi, I ordered a chocolate truffle cake for Saturday but my daughter's party moved to Friday evening. Is it possible to get it a day early? Also can you write 'Happy 8th Birthday Meera' on it?" },
      { name: "goal", label: "What you want to say", hint: "(optional: the facts and the outcome you want)", type: "textarea",
        demo: "Yes we can do Friday, pickup after 5pm. Writing on the cake is free." },
      { name: "tone", label: "Tone", type: "select", options: TONES, demo: "Friendly" },
    ],
    prompt: (v) => `Write a reply to this customer message.\n\nCustomer's message:\n"""\n${v.message}\n"""\n\n${line("What I want to say", v.goal)}${line("Tone", v.tone)}
Give one ready-to-send reply with a subject line if it is an email. Keep it short and natural. Then add a line "Alternative opening:" with one other way to start the reply.`,
  },
  {
    id: "review", cat: "Customers", icon: "⭐", name: "Review response",
    desc: "Thank happy customers and calmly answer unhappy ones.",
    fields: [
      { name: "review", label: "The review", type: "textarea", required: true,
        demo: "Cake tasted great but it arrived 40 minutes late and the box was a bit dented. Expected better for the price." },
      { name: "stars", label: "Star rating", type: "select", options: ["5 stars", "4 stars", "3 stars", "2 stars", "1 star"], demo: "3 stars" },
      { name: "where", label: "Where it was posted", type: "select", options: ["Google", "Facebook", "Instagram", "Zomato / Swiggy", "Amazon / marketplace", "Yelp", "Other"], demo: "Google" },
      { name: "facts", label: "Anything the reply should mention", hint: "(optional)", type: "textarea", demo: "We now use a sturdier box. Offer 10% off next order." },
    ],
    prompt: (v) => `Write a public reply to this ${v.stars} review on ${v.where}.\n\nReview:\n"""\n${v.review}\n"""\n\n${line("Facts to include", v.facts)}
Rules: thank them, address each specific point, never argue or blame the customer, don't over-apologise, keep it under 90 words, and invite unhappy customers to continue privately. Give two versions labelled "Version A" and "Version B".`,
  },
  {
    id: "outreach", cat: "Customers", icon: "🤝", name: "Sales outreach & follow-ups",
    desc: "A first message plus polite follow-ups for leads and partners.",
    fields: [
      { name: "who", label: "Who you are writing to", type: "text", required: true, demo: "HR managers at offices near Baner, for staff birthday cakes" },
      { name: "offer", label: "What you're offering", type: "textarea", required: true, demo: "Monthly birthday cake plan for offices: one cake per month with names, free delivery within 5 km, from ₹1,800 per cake." },
      { name: "channel", label: "Channel", type: "select", options: ["Email", "LinkedIn message", "WhatsApp", "Phone call script"], demo: "Email" },
      { name: "steps", label: "How many messages", type: "select", options: ["1 message", "2 messages (first + follow-up)", "3 messages (first + 2 follow-ups)"], demo: "3 messages (first + 2 follow-ups)" },
    ],
    prompt: (v) => `Write a cold outreach sequence.\n\n${line("Audience", v.who)}${line("Offer", v.offer)}${line("Channel", v.channel)}${line("Number of messages", v.steps)}
Each message should be short, personal, specific about the benefit and end with one easy call to action. Say when to send each follow-up. Use [square-bracket placeholders] for names and details I need to fill in.`,
  },

  // ---------------- Marketing ----------------
  {
    id: "social", cat: "Marketing", icon: "📣", name: "Social media posts", free: true,
    desc: "Scroll-stopping posts with captions and hashtags.",
    fields: [
      { name: "platform", label: "Platform", type: "select", options: ["Instagram", "Facebook", "LinkedIn", "X (Twitter)", "WhatsApp status / broadcast", "Google Business post", "TikTok / Reels script"], demo: "Instagram" },
      { name: "topic", label: "What the posts are about", type: "textarea", required: true, demo: "Diwali gift boxes: 12 assorted cookies + mini kaju katli cake, ₹899, order by 28 Oct, corporate bulk discount." },
      { name: "count", label: "How many posts", type: "select", options: ["3", "5", "7"], demo: "3" },
      { name: "hashtags", label: "Hashtags", type: "select", options: ["Yes, add hashtags", "No hashtags"], demo: "Yes, add hashtags" },
    ],
    prompt: (v) => `Write ${v.count} different ${v.platform} posts.\n\n${line("Topic", v.topic)}${line("Hashtags", v.hashtags)}
For each post give: a hook (first line), the caption, a call to action${/^yes/i.test(v.hashtags) ? ", 8-12 relevant hashtags" : ""} and a one-line idea for the photo or video. Vary the angle of each post (for example offer, story, behind the scenes, customer benefit).`,
  },
  {
    id: "marketing", cat: "Marketing", icon: "🗓️", name: "30-day marketing plan",
    desc: "A week-by-week plan that fits your budget and time.",
    fields: [
      { name: "goal", label: "Main goal for the next 30 days", type: "text", required: true, demo: "Get 40 Diwali gift box orders and 3 office clients" },
      { name: "budget", label: "Budget", type: "text", demo: "₹10,000 for ads" },
      { name: "time", label: "Time you can spend", type: "select", options: ["Under 2 hours a week", "2-5 hours a week", "5-10 hours a week", "More than 10 hours a week"], demo: "2-5 hours a week" },
      { name: "now", label: "What you already do", hint: "(optional)", type: "textarea", demo: "Instagram (1,200 followers), WhatsApp broadcast list of 300 past customers" },
    ],
    prompt: (v) => `Make a practical 30-day marketing plan.\n\n${line("Goal", v.goal)}${line("Budget", v.budget)}${line("Time available", v.time)}${line("Current marketing", v.now)}
Structure: a one-paragraph strategy; then Week 1-4, each with 3-5 specific tasks (what, where, when); how to split the budget; 3 numbers to track and a realistic target for each; quick wins I can do today. Keep it doable for a busy owner.`,
  },
  {
    id: "product", cat: "Marketing", icon: "🏷️", name: "Product or service description", free: true,
    desc: "Clear, persuasive descriptions for your website or listings.",
    fields: [
      { name: "name", label: "Product or service name", type: "text", required: true, demo: "Custom photo cake" },
      { name: "details", label: "Key facts", hint: "(size, price, what's included, who it's for)", type: "textarea", required: true, demo: "1 kg, edible photo print on top, vanilla / chocolate / butterscotch, eggless option, order 48 hours ahead, ₹1,450" },
      { name: "where", label: "Where it will appear", type: "select", options: ["Website", "Marketplace listing", "Menu or brochure", "Google Business profile", "Instagram shop"], demo: "Website" },
    ],
    prompt: (v) => `Write a product/service description for my ${v.where}.\n\n${line("Name", v.name)}${line("Facts", v.details)}
Give: a headline, a 60-120 word description focused on benefits, 3-5 bullet points of key facts, and a short call to action. Use only the facts given; mark anything I should add with [brackets].`,
  },
  {
    id: "newsletter", cat: "Marketing", icon: "📰", name: "Newsletter or blog post",
    desc: "Helpful articles and customer emails in your voice.",
    fields: [
      { name: "topic", label: "Topic", type: "text", required: true, demo: "How to store and serve a cream cake so it stays fresh" },
      { name: "kind", label: "Type", type: "select", options: ["Email newsletter", "Blog post", "Both (newsletter + blog)"], demo: "Email newsletter" },
      { name: "length", label: "Length", type: "select", options: ["Short (~200 words)", "Medium (~500 words)", "Long (~900 words)"], demo: "Short (~200 words)" },
      { name: "cta", label: "What readers should do next", hint: "(optional)", type: "text", demo: "Order a Christmas plum cake" },
    ],
    prompt: (v) => `Write a ${v.kind.toLowerCase()} about: ${v.topic}.\n\n${line("Length", v.length)}${line("Call to action", v.cta)}
Include a catchy title (and 2 subject-line options if it's an email), short paragraphs, useful practical tips, and end with the call to action.`,
  },

  // ---------------- Planning ----------------
  {
    id: "plan", cat: "Planning", icon: "🧭", name: "Business plan & SWOT",
    desc: "A one-page plan with strengths, risks and next steps.",
    fields: [
      { name: "idea", label: "What you want to plan", type: "textarea", required: true, demo: "Opening a small pickup counter in Baner next year instead of only home orders." },
      { name: "stage", label: "Stage", type: "select", options: ["Just an idea", "Starting soon", "Running under 1 year", "Running 1-3 years", "Running 3+ years"], demo: "Running 1-3 years" },
      { name: "numbers", label: "Numbers you know", hint: "(optional: sales, costs, savings)", type: "textarea", demo: "Monthly sales ~₹1.6 lakh, rent for counter ~₹35,000/month, savings ₹4 lakh" },
    ],
    prompt: (v) => `Make a one-page business plan for this.\n\n${line("Plan", v.idea)}${line("Stage", v.stage)}${line("Known numbers", v.numbers)}
Sections: Summary; Customers & what they need; Offer & pricing approach; Marketing; Simple money check (use my numbers, show the working, state assumptions clearly); SWOT (as a table); Top 3 risks with how to reduce them; Next 5 steps. Don't invent market statistics.`,
  },
  {
    id: "pricing", cat: "Planning", icon: "💰", name: "Pricing helper",
    desc: "Work out a price that covers costs and fits the market.",
    fields: [
      { name: "item", label: "Product or service", type: "text", required: true, demo: "1 kg designer cake" },
      { name: "costs", label: "Your costs per unit", hint: "(materials, time, delivery)", type: "textarea", required: true, demo: "Ingredients ₹420, box ₹60, 2.5 hours of my time, gas & electricity ~₹50" },
      { name: "market", label: "What others charge", hint: "(optional)", type: "text", demo: "Local bakeries ₹1,200-2,200" },
      { name: "position", label: "How you want to be seen", type: "select", options: ["Budget / best value", "Middle of the market", "Premium"], demo: "Premium" },
    ],
    prompt: (v) => `Help me price this.\n\n${line("Item", v.item)}${line("Costs", v.costs)}${line("Market prices", v.market)}${line("Positioning", v.position)}
Show: total cost per unit (state what hourly value you assumed for my time and why), 3 price options in a table with profit per unit and margin %, which one you recommend and why, and 2-3 ideas to raise value (bundles, add-ons, tiers). Show the maths.`,
  },
  {
    id: "notes", cat: "Planning", icon: "📝", name: "Notes to action items",
    desc: "Turn messy meeting or call notes into a summary and to-do list.",
    fields: [
      { name: "notes", label: "Your notes", type: "textarea", required: true,
        demo: "call w/ Ritu (Acme office) - want 12 cakes/yr, budget around 1500 each, she asked eggless option, invoice monthly, need GST no. send menu by thurs. maybe also cupcakes for diwali party ~80 ppl, date 2 nov tbc" },
    ],
    prompt: (v) => `Turn these notes into: a 2-3 sentence summary; key decisions; an action-item table (task, owner if known, deadline if known); open questions; and a short follow-up message I can send.\n\nNotes:\n"""\n${v.notes}\n"""`,
  },

  // ---------------- Team & admin ----------------
  {
    id: "job", cat: "Team & admin", icon: "🧑‍🍳", name: "Job posting",
    desc: "A clear, fair job ad plus interview questions.",
    fields: [
      { name: "role", label: "Role", type: "text", required: true, demo: "Part-time baking assistant" },
      { name: "type", label: "Hours / type", type: "text", demo: "Part-time, 4 hours a day, 5 days a week" },
      { name: "pay", label: "Pay", hint: "(optional)", type: "text", demo: "₹12,000-15,000 per month" },
      { name: "duties", label: "Main duties and must-haves", type: "textarea", required: true, demo: "Help with mixing, baking and packing, keep kitchen clean, basic hygiene knowledge, can work weekends in festive season" },
    ],
    prompt: (v) => `Write a job posting.\n\n${line("Role", v.role)}${line("Hours / type", v.type)}${line("Pay", v.pay)}${line("Duties and requirements", v.duties)}
Use inclusive, plain language with no requirements I didn't give. Include: title, about us, the role, what you'll do, what we're looking for, pay & hours, how to apply. Then add 6 interview questions with what a good answer shows.`,
  },
  {
    id: "policy", cat: "Team & admin", icon: "📜", name: "Policy writer",
    desc: "Plain-language refund, shipping and other policies.",
    fields: [
      { name: "kind", label: "Policy", type: "select", options: ["Refund & returns", "Cancellation", "Shipping & delivery", "Privacy notice (plain language)", "Terms of service", "Staff handbook section"], demo: "Cancellation" },
      { name: "rules", label: "Your rules", type: "textarea", required: true, demo: "Full refund if cancelled 48h before, 50% refund 24-48h, no refund under 24h. Custom photo cakes can't be cancelled once printed. Date changes free if 24h notice." },
    ],
    prompt: (v) => `Write a ${v.kind} policy in plain language for customers.\n\n${line("My rules", v.rules)}
Use short headings and bullet points, cover the common questions customers ask, and include only rules I gave (mark any gap I should decide with [DECIDE: ...]). End with a one-paragraph short version for a website footer or receipt. Add a final note that this is general information, not legal advice, and to check local laws.`,
  },
  {
    id: "explain", cat: "Team & admin", icon: "🔍", name: "Explain a document",
    desc: "Paste a contract, letter or invoice and get it in plain words.",
    fields: [
      { name: "text", label: "Paste the text", type: "textarea", required: true,
        demo: "The Licensee shall indemnify and hold harmless the Licensor against any claims arising from the Licensee's use of the premises. This agreement shall automatically renew for successive 11-month periods unless either party gives 60 days' written notice of termination." },
      { name: "question", label: "What do you want to know?", hint: "(optional)", type: "text", demo: "What does this mean for me and what should I watch out for?" },
    ],
    prompt: (v) => `Explain this document to a busy small-business owner in plain language.\n\n"""\n${v.text}\n"""\n\n${line("My question", v.question)}
Give: what it says in 3-5 bullets; anything unusual, risky or with a deadline; questions I could ask the other side. If it is legal, tax or financial, add a short reminder to check with a professional for important decisions.`,
  },
];

// Pre-written answers for demo mode (matching the demo form values above).
self.DEMO_ANSWERS = {
  reply: `**Subject:** Re: Your cake for Meera's birthday 🎂

Hi there,

Great news: we can absolutely have your chocolate truffle cake ready a day early! It will be ready for pickup on **Friday from 5 pm onwards**.

And yes, we'd love to write **"Happy 8th Birthday Meera"** on top, at no extra cost.

If anything else changes, just reply here. We hope Meera has a wonderful party!

Warm wishes,
[Your name]
Saffron Lane Bakery

---

**Alternative opening:** "Thanks for letting us know about the change, and happy early birthday to Meera!"`,

  social: `### Post 1: The offer
**Hook:** This Diwali, gift something they'll actually finish 😄
**Caption:** Our Diwali gift box has 12 assorted handmade cookies + a mini kaju katli cake, packed and ready to gift. Just **₹899**.
**Call to action:** DM us or tap the link in bio. Orders close **28 Oct**!
**Hashtags:** #DiwaliGifts #PuneBakers #HomeBakery #DiwaliHampers #CookieBox #FestiveTreats #PuneFoodie #ShopLocalPune #KajuKatli #GiftIdeas
**Photo idea:** Open box on a brass thali with diyas glowing around it.

### Post 2: Behind the scenes
**Hook:** 3,000 cookies. One tiny kitchen. Zero shortcuts. 🍪
**Caption:** Every box is baked in small batches the week you order, never weeks in advance. That's why they taste homemade: they are.
**Call to action:** Reserve your boxes before we sell out.
**Hashtags:** #BehindTheScenes #SmallBatch #HomeBaker #DiwaliBaking #PuneBakery #MadeWithLove #FestiveSeason #BakingLife
**Photo idea:** Reel of trays coming out of the oven, sped up.

### Post 3: For offices
**Hook:** Sorting Diwali gifts for your team? We've got you. 💼
**Caption:** Ordering 20+ boxes for staff or clients? Ask about our **corporate bulk discount**, with custom thank-you cards included.
**Call to action:** WhatsApp us for a quote today.
**Hashtags:** #CorporateGifting #DiwaliCorporateGifts #PuneBusiness #EmployeeGifts #ClientGifts #BulkOrders #DiwaliHampers #ShopLocal
**Photo idea:** A stack of boxes with a sample "Thank you, team!" card.`,

  marketing: `**Strategy:** Your 300 past customers are your fastest route to 40 orders, so lead with WhatsApp, use Instagram to build urgency, and spend most of the ad budget reaching offices within 5 km.

### Week 1: Warm up
- Send a WhatsApp broadcast with the gift box photo and an **early-bird price** for the first 15 orders.
- Post the offer reel on Instagram; pin it to your profile.
- List 25 offices nearby and find the HR or admin contact for each.

### Week 2: Reach offices
- Email or WhatsApp 25 offices with a corporate offer (sample box for the first 5 who reply).
- Run a ₹4,000 Instagram ad, 5 km radius, ages 25-45.
- Share 2 behind-the-scenes stories.

### Week 3: Push
- Second broadcast: "Only 10 boxes left at this price."
- Run ₹4,000 more on the best-performing ad.
- Follow up with offices that didn't reply.

### Week 4: Close & collect
- Final reminder 48 hours before the order deadline.
- Ask every buyer for a Google review with a photo.
- Keep ₹2,000 for a boosted "thank you" post with customer photos.

| Track | Target |
|---|---|
| Gift box orders | 40 |
| Office clients | 3 |
| Cost per order from ads | under ₹200 |

**Quick win today:** Send the WhatsApp broadcast. Past customers usually reply within hours.`,
};

self.DEMO_CHAT = {
  "How can I get more repeat customers?": `Here are five practical ways for a home bakery to bring customers back:

1. **Remember the occasion.** Note birthdays and anniversaries from past orders and send a WhatsApp message 10 days before: *"Meera turns 9 soon. Shall we bake her cake again?"*
2. **Start a simple loyalty card.** Every 5th order gets a free box of 6 cookies. A note in a spreadsheet is enough.
3. **Add a thank-you card** with a small discount code in every box (for example 10% off the next order within 60 days).
4. **Ask for feedback 2 days later.** It shows you care and is the perfect moment to ask for a Google review.
5. **Post regular "what's new" updates** to your WhatsApp broadcast list, about twice a month, so you're never forgotten.

Want me to write the birthday reminder message or design the loyalty card wording?`,
};
self.DEMO_FALLBACK = `This is **demo mode**, so this answer is a sample.

With your own Anthropic API key, the assistant answers any business question using your business profile, for example:

- Drafting emails, posts and offers in your tone
- Planning promotions and checking prices
- Explaining contracts, invoices and policies in plain words

Add your key in **Settings** to get real answers.`;
