"""P2 entity resolution for the AI upskilling ecosystem study.

Reads the six P1 discovery slices in data/p1_raw/ and produces the deduplicated
Parent (O-) -> Platform (P-) -> Program (G-) hierarchy plus all logs.

Every non-default decision is written in DECISIONS below (reviewed by hand) and
lands in dedup_log.csv with its reason. An automatic fuzzy pass then checks that
no likely duplicate was missed; its hits are written to p2_fuzzy_check.csv.

Run:  python3 scripts/p2_entity_resolution.py
"""
import csv, glob, os, re
from collections import defaultdict, OrderedDict
from urllib.parse import urlparse

from rapidfuzz import fuzz
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "p1_raw")
OUT = os.path.join(ROOT, "data")
OBSERVED = "2026-09-28"
SLICE_CODE = {"ainative": "ain", "creator": "cre", "enterprise": "ent",
              "formal": "for", "regional": "reg", "vendor": "ven"}

# ---------------------------------------------------------------------------
# Hand-reviewed decisions. key = raw key (slice code + row number).
#   ("merge",   target, reason)            same platform -> folded into target
#   ("program", target, type, reason)      becomes a G- program under platform target
#   ("initiative", org, reason)            G- program owned by an org, no single platform
#   ("org",     org, reason)               record describes the parent org only
# Targets may be raw keys or synthetic platforms (SYN-*), defined in SYNTHETIC.
# ---------------------------------------------------------------------------
M, G, I, O = "merge", "program", "initiative", "org"
DECISIONS = {
    # --- Coursera / Udemy (combined 2026-05-11, brands still separate learner experiences)
    "ent013": (M, "for001", "Coursera for Business is a commercial product of the Coursera platform (brief §8 example)"),
    "ain007": (G, "for001", "AI-native feature", "Coursera Coach is an AI tutor feature inside Coursera"),
    "ain008": (G, "for001", "AI-native feature (announced)", "Project Helix is an announced Coursera product, not a separate live platform"),
    "ent012": (M, "for002", "Udemy Business is the enterprise product of the Udemy platform"),
    "ain010": (G, "for002", "AI-native feature", "AI Role Play is a feature inside Udemy"),
    # --- edX / 2U
    "for004": (O, "2U", "2U is the parent org of edX, not a learner-facing platform"),
    "for060": (G, "for003", "executive program", "Microsoft CxO Edge is delivered on edX (creator Microsoft, host edX)"),
    # --- Microsoft
    "ven005": (M, "for005", "LinkedIn Learning found by two slices"),
    "ent014": (M, "for005", "LinkedIn Learning Hub is the enterprise product of LinkedIn Learning"),
    "ven002": (G, "ven001", "certification", "Azure AI certification is a program on Microsoft Learn"),
    "ven003": (G, "ven001", "skilling event", "AI Skills Fest is a Microsoft Learn event program"),
    "ven035": (G, "ven001", "certification", "GH-300 exam is delivered via Microsoft Learn (creator GitHub)"),
    "ven004": (I, "Microsoft", "Microsoft Elevate is a skilling commitment delivered across several Microsoft platforms"),
    "ent048": (M, "ven004", "Microsoft Elevate found by two slices"),
    "reg054": (G, "ven004", "regional instance", "Hour of AI Thailand is a country instance of Microsoft Elevate"),
    "reg012": (I, "Microsoft", "ADVANTA(I)GE India is a national skilling initiative, not a platform"),
    "reg014": (I, "IBM", "IBM India commitment (5M youth by 2030) is a skilling pledge, not a platform"),
    "reg047": (I, "Microsoft", "elevAIte Indonesia is a Microsoft-led national skilling initiative with Komdigi"),
    "cre004": (G, "SYN-msgh", "open curriculum (repo)", "Microsoft GitHub curriculum repo"),
    "cre005": (G, "SYN-msgh", "open curriculum (repo)", "Microsoft GitHub curriculum repo"),
    "cre006": (G, "SYN-msgh", "open curriculum (repo)", "Microsoft GitHub curriculum repo"),
    "cre007": (G, "SYN-msgh", "open curriculum (repo)", "Microsoft GitHub curriculum repo"),
    "cre008": (G, "SYN-msgh", "open curriculum (repo)", "Microsoft GitHub curriculum repo"),
    "cre009": (G, "SYN-msgh", "open curriculum (repo)", "Microsoft GitHub curriculum repo"),
    # --- AWS
    "ven008": (G, "ven006", "certification", "AWS certification program on Skill Builder"),
    "ven007": (I, "Amazon Web Services", "AWS AI Ready is a skilling pledge delivered via Skill Builder and partners"),
    "reg013": (M, "ven007", "India instance of the same AWS AI Ready pledge"),
    # --- Google
    "ven010": (M, "ven009", "Google Cloud Skills Boost was renamed Google Skills (Oct 2025) — rebrand, alias kept"),
    "ven011": (G, "ven009", "professional certificate", "Google AI Essentials; creator Google, also hosted on Coursera"),
    "ven012": (I, "Google", "Google.org AI Opportunity Fund is a philanthropic funding initiative"),
    "reg016": (I, "Google", "Free Google AI Plus for Indian students is a product-access initiative (adjacent)"),
    "reg056": (I, "Google", "Gemini learning tool rollout in Kenya is a product-access initiative (adjacent)"),
    "ain004": (G, "ain003", "model / AI-native feature", "LearnLM is the model family behind Gemini learning features"),
    "cre097": (M, "ven014", "Kaggle community discussions are part of the kaggle.com learning platform"),
    # --- OpenAI
    "cre011": (G, "ven015", "developer cookbook", "OpenAI Cookbook is an OpenAI developer-learning asset"),
    "ven016": (G, "ven015", "certification", "OpenAI Certifications are offered via OpenAI Academy"),
    "reg015": (G, "ven015", "regional instance", "OpenAI Academy India is a country instance of OpenAI Academy"),
    # --- Anthropic
    "cre012": (G, "ven018", "open curriculum (repo, archived)", "Anthropic courses repo (archived 2026-09-15)"),
    "cre013": (G, "ven018", "developer cookbook", "Claude Cookbooks (renamed from anthropic-cookbook)"),
    "cre014": (G, "ven018", "tutorial", "Anthropic prompt-engineering interactive tutorial"),
    "ent081": (G, "ven018", "course", "AI Fluency for small business (with PayPal) is an Anthropic course"),
    "reg030": (I, "Pratham", "Pratham x Anthropic assessment tool is an NGO programme with a lab partner"),
    # --- Hugging Face / LangChain
    "cre024": (G, "ven022", "course", "Hugging Face Agents Course"),
    "cre025": (G, "ven022", "course", "Hugging Face LLM/Transformers Course"),
    "cre093": (M, "ven022", "Hugging Face Discord is the community layer of Hugging Face Learn"),
    "cre094": (M, "ven031", "LangChain community is the community layer of LangChain Academy"),
    # --- DeepLearning.AI / fast.ai / creators (one creator = one entity)
    "ven039": (M, "for010", "DeepLearning.AI found by two slices"),
    "cre060": (M, "for010", "DeepLearning.AI YouTube is a distribution channel of the same creator"),
    "cre026": (G, "for011", "book", "fastbook is the fast.ai course book"),
    "cre027": (G, "for011", "course (repo)", "fast.ai Practical Deep Learning course materials"),
    "cre001": (G, "cre042", "open curriculum (repo)", "Karpathy repo — same creator entity"),
    "cre019": (G, "cre042", "open curriculum (repo)", "Karpathy repo — same creator entity"),
    "cre020": (G, "cre042", "open curriculum (repo, archived)", "Karpathy/Eureka Labs repo — same creator entity"),
    "cre021": (G, "cre042", "open curriculum (repo)", "Karpathy repo — same creator entity"),
    "cre002": (G, "SYN-rasbt", "book companion repo", "Raschka repo — same creator entity"),
    "cre037": (G, "SYN-rasbt", "book companion repo", "Raschka repo — same creator entity"),
    "cre104": (G, "SYN-rasbt", "book", "Raschka book — same creator entity"),
    "cre035": (G, "SYN-huyen", "book companion repo", "Chip Huyen book repo — same creator entity"),
    "cre105": (G, "SYN-huyen", "book", "Chip Huyen book — same creator entity"),
    "cre036": (G, "SYN-alammar", "book companion repo", "Alammar & Grootendorst repo — same creator entity"),
    "cre106": (G, "SYN-alammar", "book", "Alammar & Grootendorst book — same creator entity"),
    "cre030": (G, "SYN-diamant", "open curriculum (repo)", "Nir Diamant repo — same creator entity"),
    "cre031": (G, "SYN-diamant", "open curriculum (repo)", "Nir Diamant repo — same creator entity"),
    "cre032": (G, "SYN-diamant", "open curriculum (repo)", "Nir Diamant repo — same creator entity"),
    "cre086": (G, "SYN-diamant", "newsletter", "DiamantAI newsletter — same creator entity"),
    "cre028": (G, "SYN-dtc", "cohort course (free)", "DataTalks.Club Zoomcamp"),
    "cre029": (G, "SYN-dtc", "cohort course (free)", "DataTalks.Club Zoomcamp"),
    # --- Harvard
    "ain018": (G, "for026", "AI-native feature", "CS50 Duck is the AI tutor used in Harvard CS50 courses"),
    # --- Skillsoft / Codecademy / DataCamp / Pluralsight / Udacity / Accenture
    "for020": (M, "ent003", "Skillsoft record describes the company whose learner platform is Percipio"),
    "ain012": (G, "for019", "AI-native feature", "Codecademy AI Learning Assistant is a feature of Codecademy"),
    "ent020": (M, "for006", "DataCamp for Business is the enterprise product of DataCamp"),
    "ain011": (G, "for006", "AI-native feature", "Optima is DataCamp's AI-native learning feature"),
    "ent015": (G, "for007", "enterprise program", "Pluralsight AI Academy is a program of Pluralsight"),
    "ent055": (M, "for008", "Udacity found by two slices"),
    "for062": (M, "ent054", "Accenture LearnVantage found by two slices"),
    # --- other cross-slice duplicates
    "ent075": (M, "for015", "Simplilearn found by three slices"),
    "reg024": (M, "for015", "Simplilearn found by three slices"),
    "for065": (G, "for015", "university-partner program", "IIT Guwahati program delivered by Simplilearn (academic partner)"),
    "reg021": (G, "for016", "free course library", "Great Learning Academy is the free tier of Great Learning"),
    "ent022": (M, "for028", "Multiverse found by two slices"),
    "reg022": (M, "for029", "upGrad found by two slices"),
    "reg023": (M, "for031", "Scaler found by two slices"),
    "for064": (G, "for031", "university-partner program", "IIT Roorkee program delivered via Scaler (academic partner)"),
    "ent021": (M, "for032", "Section found by two slices"),
    "ain025": (M, "for068", "Scrimba found by two slices"),
    "ain038": (M, "for022", "Brilliant found by two slices"),
    "cre052": (M, "for021", "freeCodeCamp YouTube is a channel of freeCodeCamp"),
    "cre098": (M, "for072", "Class Central found by three slices"),
    "ven049": (M, "for072", "Class Central found by three slices"),
    "ent001": (M, "ain020", "Sana found by two slices"),
    "ent016": (M, "ain019", "Uplimit found by two slices"),
    "ent017": (M, "ain022", "Arist found by two slices"),
    "ent019": (M, "ain023", "Disco found by two slices"),
    "cre101": (M, "reg019", "Analytics Vidhya found by two slices"),
    "for047": (G, "for017", "university-partner program", "AIM executive programs delivered by Emeritus"),
    # --- enterprise sub-products
    "ent006": (G, "ent005", "skills-intelligence module", "SkyHive is a Cornerstone skills-intelligence product"),
    "ent071": (G, "ent070", "AI authoring feature", "Courseau acquired into LearnUpon"),
    "ent073": (G, "ent072", "AI coaching feature", "Upduo acquired into Arcade"),
    "ent084": (G, "reg033", "train-and-place program", "RISE is a SkillsFuture-supported program delivered with BCG U"),
    # --- government programmes
    "reg001": (I, "MeitY / IndiaAI Mission", "IndiaAI FutureSkills is a mission pillar delivered via several platforms"),
    "reg003": (G, "reg002", "national literacy course", "YUVA AI for ALL is hosted on FutureSkills Prime"),
    "reg005": (G, "reg004", "national literacy program", "SOAR is delivered via Skill India Digital Hub"),
    "reg034": (G, "SYN-aisg", "apprenticeship", "AIAP is an AI Singapore program"),
    "reg035": (G, "SYN-aisg", "literacy course", "AI4E is an AI Singapore program"),
    "reg045": (G, "reg044", "talent program", "AI Talent Factory is run under the Digital Talent Scholarship"),
    "reg051": (G, "reg050", "regional instance", "Philippines instance of AI Ready ASEAN with DepEd"),
    "reg052": (G, "reg050", "implementing partner", "Break The Fake Movement is a local implementing partner of AI Ready ASEAN"),
}

SYNTHETIC = {  # platforms created in P2 from parent/creator fields of observed rows
    "SYN-msgh": dict(name="Microsoft 'For Beginners' open curricula (GitHub)", parent_org="Microsoft",
                     url="https://github.com/microsoft", category="Self-directed", subcategory="GitHub curricula",
                     in_scope="yes", layers="A;C;D", basis="cre004-cre009"),
    "SYN-rasbt": dict(name="Sebastian Raschka (creator: books, repos, Ahead of AI)", parent_org="Sebastian Raschka",
                      url="https://github.com/rasbt", category="Self-directed", subcategory="Creator (books + repos)",
                      in_scope="yes", layers="C;D", basis="cre002, cre037, cre104"),
    "SYN-huyen": dict(name="Chip Huyen (creator: AI Engineering)", parent_org="Chip Huyen",
                      url="https://github.com/chiphuyen", category="Self-directed", subcategory="Creator (book + repo)",
                      in_scope="yes", layers="C;D", basis="cre035, cre105"),
    "SYN-alammar": dict(name="Jay Alammar & Maarten Grootendorst (Hands-On LLMs)", parent_org="Jay Alammar & Maarten Grootendorst",
                        url="https://github.com/HandsOnLLM", category="Self-directed", subcategory="Creator (book + repo)",
                        in_scope="yes", layers="C;D", basis="cre036, cre106"),
    "SYN-diamant": dict(name="Nir Diamant / DiamantAI (creator)", parent_org="Nir Diamant",
                        url="https://github.com/NirDiamant", category="Self-directed", subcategory="Creator (repos + newsletter)",
                        in_scope="yes", layers="C;D", basis="cre030, cre031, cre032, cre086"),
    "SYN-dtc": dict(name="DataTalks.Club", parent_org="DataTalks.Club",
                    url="https://datatalks.club", category="Community", subcategory="Community + free cohort courses",
                    in_scope="yes", layers="C;D;F", basis="cre028, cre029"),
    "SYN-aisg": dict(name="AI Singapore (learning programmes)", parent_org="AI Singapore (NRF)",
                     url="https://aisingapore.org", category="Government/public", subcategory="National AI programme",
                     in_scope="yes", layers="A;C;F", basis="reg034, reg035"),
}

# Final scope where slices disagreed (resolution + reason)
SCOPE_RESOLVE = {
    "for005": ("yes", "one slice tagged adjacent; LinkedIn Learning has a dedicated AI catalogue"),
    "for010": ("yes", "one slice tagged adjacent; DeepLearning.AI is an AI-specific provider"),
    "for008": ("yes", "one slice tagged legacy-canonical; Udacity launched AI degrees 2025-26 per formal slice"),
    "for022": ("adjacent", "slices disagreed (yes/adjacent); AI-specific catalogue depth unverified — check in P3"),
    "ain022": ("yes", "slices disagreed; Arist markets AI-upskilling programs — verify in P3"),
    "ain023": ("yes", "slices disagreed; Disco positions as AI-powered cohort learning — verify in P3"),
    "for015": ("yes", "enterprise slice tagged adjacent (out of slice); Simplilearn runs AI/ML programs"),
    "for011": ("legacy-canonical", "course last majorly revised before 2024 per creator slice; canonical"),
    "for072": ("adjacent", "directory, not a learning provider"),
}

# Provisional layers where the discovery slice left them blank (INTERPRETATION, from name/subcategory; verify P3)
LAYER_FILL = {
    # creators / channels
    "cre003": "C;D", "cre010": "B;C", "cre015": "C;D", "cre016": "C", "cre017": "C", "cre018": "C;D",
    "cre022": "D", "cre023": "C;D", "cre033": "C", "cre034": "C;D", "cre038": "C;D;F", "cre039": "B",
    "cre040": "D", "cre041": "A", "cre042": "C", "cre043": "A;C", "cre044": "C", "cre045": "C;D;F",
    "cre046": "C;D;F", "cre047": "C", "cre048": "A;B", "cre049": "A;B;D", "cre050": "A", "cre051": "D",
    "cre053": "B;F", "cre054": "B", "cre055": "B;D", "cre056": "A", "cre057": "C", "cre058": "A;C",
    "cre059": "C", "cre061": "C", "cre062": "B", "cre063": "B", "cre064": "B;D", "cre065": "B;D",
    "cre066": "A", "cre067": "B;D", "cre068": "A;E", "cre069": "C;D", "cre070": "C;D", "cre071": "C;D;F",
    "cre072": "D", "cre073": "C;D", "cre074": "C;D", "cre075": "C", "cre076": "A;B", "cre077": "A;B",
    "cre078": "A;E", "cre079": "A;C", "cre080": "A;B", "cre081": "A;B", "cre082": "A;B", "cre083": "A;B",
    "cre084": "C", "cre085": "C", "cre087": "C", "cre088": "A", "cre089": "C", "cre090": "C;D",
    "cre091": "C", "cre092": "D", "cre095": "D", "cre096": "D", "cre099": "C", "cre100": "A",
    "cre102": "C", "cre103": "C",
    # regional / public
    "reg002": "A;B;C", "reg004": "A;B;F", "reg006": "A", "reg007": "C;F", "reg008": "A;B;E",
    "reg009": "A", "reg010": "A", "reg011": "A", "reg014": "A;B;C", "reg017": "A;B", "reg018": "C;D;F",
    "reg019": "C;D;F", "reg020": "C;F", "reg025": "C;D;F", "reg026": "C;D;F", "reg027": "C;D;F",
    "reg028": "B;D;E", "reg029": "F", "reg031": "A", "reg032": "A", "reg033": "A;B;C;F", "reg036": "C;F",
    "reg037": "D;E", "reg038": "B;C;F", "reg039": "B;C;F", "reg040": "A", "reg041": "A;B", "reg042": "B;C",
    "reg043": "A", "reg044": "A;B;C;F", "reg046": "C;D;F", "reg048": "C;F", "reg049": "C;F", "reg050": "A",
    "reg053": "A;C", "reg055": "B;E", "ven049": "",
}

HOSTED = {  # creator vs distributor (from discovery notes; verify P3)
    "ven011": ("Coursera; Google Skills / grow.google", ""),
    "for060": ("edX", ""),
    "for064": ("Scaler", "IIT Roorkee"),
    "for065": ("Simplilearn", "IIT Guwahati"),
    "for047": ("Emeritus", "Asian Institute of Management"),
    "ven035": ("Microsoft Learn / Pearson VUE (verify)", ""),
    "reg003": ("FutureSkills Prime", ""),
}

# Organisation name normalisation: regex on parent_org -> canonical org
ORG_RULES = [
    (r"^microsoft|linkedin|github", "Microsoft"), (r"amazon|^aws", "Amazon"), (r"^google|deepmind|kaggle", "Alphabet (Google)"),
    (r"^openai", "OpenAI"), (r"^anthropic", "Anthropic"), (r"^meta\b|meta ai", "Meta"), (r"coursera", "Coursera, Inc."),
    (r"^2u", "2U"), (r"skillsoft|codecademy", "Skillsoft"), (r"accenture", "Accenture"), (r"workday", "Workday"),
    (r"cornerstone", "Cornerstone OnDemand"), (r"absorb|welsh, carson", "Absorb Software"), (r"^sap\b", "SAP"),
    (r"go1", "Go1"), (r"thrive", "Thrive"), (r"learnupon", "LearnUpon"), (r"arcade", "Arcade"),
    (r"physics ?wallah|ineuron", "PhysicsWallah"), (r"harvard", "Harvard University"), (r"^mit\b", "MIT"),
    (r"stanford", "Stanford University"), (r"karpathy|eureka", "Eureka Labs (Andrej Karpathy)"),
    (r"hugging face", "Hugging Face"), (r"fast\.ai", "fast.ai"), (r"deeplearning\.ai", "DeepLearning.AI"),
    (r"meity|indiaai", "Govt of India — MeitY / IndiaAI Mission"), (r"msde|ministry of skill", "Govt of India — MSDE"),
    (r"skillsfuture|govt of singapore", "Govt of Singapore — SkillsFuture Singapore"), (r"ai singapore", "AI Singapore"),
    (r"komdigi|bpsdm", "Govt of Indonesia — Komdigi"), (r"ibm", "IBM"), (r"nvidia", "NVIDIA"),
    (r"pearson", "Pearson"), (r"upgrad", "upGrad Education"), (r"great learning", "Great Learning"),
    (r"simplilearn", "Simplilearn"), (r"asean foundation", "ASEAN Foundation"), (r"pratham", "Pratham"),
    (r"^mistral", "Mistral AI"), (r"^cohere", "Cohere"), (r"make \(celonis\)", "Celonis"), (r"datacamp", "DataCamp"),
    (r"^mckinsey", "McKinsey & Company"), (r"infosys", "Infosys"), (r"tata consult", "Tata Consultancy Services"),
    (r"datatalks", "DataTalks.Club"), (r"raschka", "Sebastian Raschka"), (r"nir diamant", "Nir Diamant"),
]

REGION_BY_COUNTRY = {
    "us": "North America", "usa": "North America", "united states": "North America", "canada": "North America", "ca": "North America",
    "in": "India", "india": "India", "uk": "Europe", "gb": "Europe", "united kingdom": "Europe", "france": "Europe", "fr": "Europe",
    "de": "Europe", "germany": "Europe", "ie": "Europe", "ireland": "Europe", "nl": "Europe", "be": "Europe", "belgium": "Europe",
    "lt": "Europe", "lithuania": "Europe", "es": "Europe", "ch": "Europe", "switzerland": "Europe", "se": "Europe", "fi": "Europe",
    "singapore": "Southeast Asia", "sg": "Southeast Asia", "malaysia": "Southeast Asia", "indonesia": "Southeast Asia",
    "vietnam": "Southeast Asia", "philippines": "Southeast Asia", "thailand": "Southeast Asia", "asean": "Southeast Asia",
    "nl": "Europe", "netherlands": "Europe", "no": "Europe", "norway": "Europe", "cz": "Europe", "india/us": "India",
    "au": "Asia-Pacific (other)", "australia": "Asia-Pacific (other)", "china": "East Asia", "cn": "East Asia",
    "japan": "East Asia", "jp": "East Asia", "korea": "East Asia", "kr": "East Asia", "kenya": "Africa", "israel": "Middle East",
}

# Brief §7.4 seed + candidate list (both lines treated as "seed list" — conservative for the ≥30 non-seed test)
SEED_PATTERNS = [
    r"^coursera$", r"^udemy$", r"^edx$", r"^linkedin learning$", r"^datacamp$", r"^pluralsight$", r"^udacity$",
    r"deeplearning\.ai", r"^fast\.ai", r"kaggle learn", r"hugging face learn", r"^microsoft learn$", r"aws skill builder",
    r"google (cloud skills boost|skills)$", r"google ai essentials", r"ibm skillsbuild", r"nvidia deep learning institute",
    r"trailhead", r"openai academy", r"anthropic academy", r"meta llama", r"o'reilly", r"^maven$", r"^reforge$",
    r"simplilearn", r"^great learning$", r"^emeritus$", r"general assembly", r"^codecademy$", r"^freecodecamp$",
    r"^brilliant$", r"mit (ocw|opencourseware|xpro)", r"stanford online", r"cs50", r"khanmigo", r"elements of ai",
    r"oracle university", r"databricks academy", r"snowflake", r"dataiku academy", r"^dataquest$", r"langchain academy",
    r"cohere llm university", r"weights & biases", r"^make academy$", r"zapier", r"skillsoft", r"^degreed$",
    r"cornerstone", r"^docebo$", r"^360learning$", r"^sana", r"^section$", r"^multiverse$", r"^upgrad$", r"^scaler$",
    r"analytics vidhya", r"^nptel$", r"swayam",
]

# Tier corrections after reading each entity's P1 signal against brief §7.6 (reason recorded in providers.tier_basis)
TIER_OVERRIDE = {
    "ain016": ("major (provisional)", "≥1M learners: company-reported 24M students in China (PLATFORM-REPORTED, all subjects)"),
    "ent062": ("major (provisional)", "≥100k on AI content: 150,000+ employees trained on AI (PLATFORM-REPORTED)"),
    "ent066": ("major (provisional)", "≥1M learners: reports exceeding 1M skilling goal (PLATFORM-REPORTED)"),
    "ent064": ("major (provisional)", "≥100k on AI content: 300,000+ TCS employees reskilled on AI/ML (PLATFORM-REPORTED, internal)"),
    "ent011": ("major (provisional)", "≥1M learners: ~50M registered users (THIRD-PARTY ESTIMATE; registered ≠ learners)"),
    "reg008": ("major (provisional)", "≥1M learners: 1.7 crore registered users (PLATFORM-REPORTED via press; all subjects)"),
    "ain027": ("major (provisional)", "≥1M learners: '36M+ learners' community (PLATFORM-REPORTED; definition unclear)"),
    "ain017": ("major (provisional)", "≥1M learners: Alakh AI '1.5M users in < 2 months' (PLATFORM-REPORTED, 2024 — stale)"),
    "reg050": ("lite", "hint cited a *target* (5.5M); targets are not learners — demoted until reach is reported"),
    "ven031": ("lite", "hint cited framework-library GitHub stars, not a learning repo — official academy of a framework vendor is not a §7.6 criterion"),
}

MAJOR_KEYS = ["1m", "100k", "10k github", "top-3", "frontier", "hyperscaler", "cited by", "≥2"]


# ---------------------------------------------------------------------------
def load_raw():
    rows = OrderedDict()
    for path in sorted(glob.glob(os.path.join(RAW, "*_candidates.csv"))):
        sl = os.path.basename(path).split("_")[0]
        with open(path, newline="", encoding="utf-8") as f:
            for i, r in enumerate(csv.DictReader(f)):
                r = {k: (v or "").strip() for k, v in r.items()}
                key = f"{SLICE_CODE[sl]}{i+1:03d}"
                r["raw_key"], r["slice"] = key, sl
                rows[key] = r
    return rows


def canon_org(text, fallback):
    t = (text or "").strip()
    for pat, name in ORG_RULES:
        if re.search(pat, t, re.I):
            return name
    if not t:
        return fallback
    t = re.sub(r"\(.*?\)", "", t).strip(" ,;")
    return t.split(" / ")[0].strip() or fallback


def region_of(r):
    m = re.search(r"Region:\s*([A-Za-z \-]+?)(?:[;.,]|$)", r.get("notes", ""))
    if m:
        return m.group(1).strip()
    c = (r.get("hq_country") or "").strip().lower()
    return REGION_BY_COUNTRY.get(c, "Global/unspecified" if not c else REGION_BY_COUNTRY.get(c.split()[0], c.upper()))


def tier_of(hint, in_scope):
    h = (hint or "").lower()
    if in_scope not in ("yes", "legacy-canonical"):
        return "lite (not core)"
    if "distinctive" in h:
        return "distinctive-small (provisional)"
    if any(k in h for k in MAJOR_KEYS):
        return "major (provisional)"
    return "lite"


def host(url):
    try:
        return (urlparse(url.split(";")[0].strip()).hostname or "").removeprefix("www.")
    except ValueError:
        return ""


def main():
    raw = load_raw()
    missing = [k for k in DECISIONS if k not in raw]
    assert not missing, f"decisions reference unknown raw keys: {missing}"
    for k, d in DECISIONS.items():
        tgt = d[1]
        if d[0] in (M, G) and tgt not in raw and tgt not in SYNTHETIC:
            raise SystemExit(f"bad target {tgt} for {k}")

    # resolve merge chains (e.g. ent048 -> ven004 which is an initiative)
    def root(k):
        seen = set()
        while k in DECISIONS and DECISIONS[k][0] == M and k not in seen:
            seen.add(k); k = DECISIONS[k][1]
        return k

    platforms, programs, orgs_extra = OrderedDict(), OrderedDict(), []
    dedup = []
    for k, r in raw.items():
        d = DECISIONS.get(k)
        if d is None:
            platforms.setdefault(k, {"members": []})["members"].append(k)
        elif d[0] == M:
            tgt = root(k)
            bucket = programs if (tgt in DECISIONS and DECISIONS[tgt][0] in (G, I)) else platforms
            bucket.setdefault(tgt, {"members": []})["members"].append(k)
            dedup.append((tgt, k, r["name"], "merge", d[2]))
        elif d[0] == G:
            programs.setdefault(k, {"members": []})["members"].append(k)
            programs[k]["platform"] = root(d[1]); programs[k]["ptype"] = d[2]
            dedup.append((d[1], k, r["name"], "re-levelled to program", d[3]))
        elif d[0] == I:
            programs.setdefault(k, {"members": []})["members"].append(k)
            programs[k]["platform"] = ""; programs[k]["org"] = d[1]; programs[k]["ptype"] = "skilling initiative / pledge"
            dedup.append(("(org) " + d[1], k, r["name"], "re-levelled to initiative", d[2]))
        elif d[0] == O:
            orgs_extra.append((d[1], k, r))
            dedup.append(("(org) " + d[1], k, r["name"], "re-levelled to parent org", d[2]))
    # programs that received merges but were initialised by the merge first
    for k in list(programs):
        if k not in [m for m in programs[k]["members"]]:
            programs[k]["members"].insert(0, k)
        if "ptype" not in programs[k]:
            d = DECISIONS[k]
            programs[k]["platform"] = "" if d[0] == I else root(d[1])
            programs[k]["org"] = d[1] if d[0] == I else ""
            programs[k]["ptype"] = "skilling initiative / pledge" if d[0] == I else d[2]
    for s in SYNTHETIC:
        platforms.setdefault(s, {"members": []})

    # ---- build platform records
    def merged_field(members, f, sep="; "):
        vals = []
        for m in members:
            v = raw[m].get(f, "")
            if v and v not in vals:
                vals.append(v)
        return sep.join(vals)

    prow = []
    for key, p in platforms.items():
        mem = p["members"]
        if key in SYNTHETIC:
            s = SYNTHETIC[key]
            base = dict(name=s["name"], aliases="", parent_org=s["parent_org"], url=s["url"], hq_country="",
                        category=s["category"], subcategory=s["subcategory"], in_scope=s["in_scope"],
                        layers=s["layers"], on_seed_list="", major_hint="", notes=f"Synthetic P2 entity from {s['basis']}")
            child = [k for k, g in programs.items() if g.get("platform") == key]
            base["major_hint"] = merged_field(child, "major_hint")
            base["on_seed_list"] = "yes" if any(raw[c].get("on_seed_list", "").lower().startswith("y") for c in child) else "no"
            slices = sorted({raw[c]["slice"] for c in child}); rawkeys = child
            layers_basis = "P2 provisional (researcher)"
        else:
            b = raw[key]
            base = dict(b)
            base["aliases"] = "; ".join(OrderedDict.fromkeys(
                [a for a in (merged_field(mem, "aliases") + "; " + "; ".join(raw[m]["name"] for m in mem[1:] if raw[m]["name"] != b["name"])).split("; ") if a.strip()]))
            base["notes"] = merged_field(mem, "notes", " | ")
            base["major_hint"] = merged_field(mem, "major_hint")
            base["on_seed_list"] = "yes" if any(raw[m].get("on_seed_list", "").lower().startswith("y") for m in mem) else "no"
            lay = sorted({x for m in mem for x in raw[m].get("layers", "").split(";") if x.strip()})
            if lay:
                base["layers"], layers_basis = ";".join(lay), "discovery slice"
            else:
                base["layers"], layers_basis = LAYER_FILL.get(key, ""), ("P2 provisional (researcher)" if LAYER_FILL.get(key) else "not assigned")
            slices = sorted({raw[m]["slice"] for m in mem}); rawkeys = mem
        scopes = sorted({raw[m]["in_scope"] for m in rawkeys if raw[m]["in_scope"]}) if key not in SYNTHETIC else [base["in_scope"]]
        conflict = ""
        if key in SCOPE_RESOLVE:
            base["in_scope"], why = SCOPE_RESOLVE[key]
            conflict = f"{'/'.join(scopes)} -> {base['in_scope']}: {why}"
        elif len(scopes) > 1:
            conflict = f"{'/'.join(scopes)} (unresolved; kept {base['in_scope']})"
        hosted, acad = HOSTED.get(key, ("", ""))
        region = region_of(base) if key not in SYNTHETIC else ("Southeast Asia" if key == "SYN-aisg" else "Global/unspecified")
        prow.append(dict(
            key=key, name=base["name"], aliases=base.get("aliases", ""),
            parent_org=canon_org(base.get("parent_org", ""), base["name"]),
            category=base["category"], subcategory=base.get("subcategory", ""), url=base.get("url", ""),
            hq=base.get("hq_country", ""), region=region, hosted_on=hosted, academic_partner=acad,
            in_scope=base["in_scope"],
            tier=TIER_OVERRIDE.get(key, (tier_of(base["major_hint"], base["in_scope"]),))[0],
            tier_basis=TIER_OVERRIDE.get(key, (None, "discovery major_hint (agent-reported; confirm in P3)" if base["major_hint"] else ""))[1],
            layers=base["layers"], layers_basis=layers_basis, on_seed_list=base["on_seed_list"],
            major_hint=base["major_hint"], scope_resolution=conflict, discovery_slices=";".join(slices),
            raw_keys=";".join(rawkeys), notes=base.get("notes", ""),
            on_brief_seed_list="yes" if any(re.search(pt, re.sub(r"\s*\(.*?\)", "", base["name"]).strip(), re.I) for pt in SEED_PATTERNS) else "no"))

    # ---- IDs
    prow.sort(key=lambda x: (x["category"], x["name"].lower()))
    pid = {p["key"]: f"P-{i+1:03d}" for i, p in enumerate(prow)}
    org_names = sorted({p["parent_org"] for p in prow} | {g.get("org") or "" for g in programs.values()} - {""}
                       | {o[0] for o in orgs_extra}, key=str.lower)
    org_names = sorted({canon_org(o, o) for o in org_names}, key=str.lower)
    oid = {o: f"O-{i+1:03d}" for i, o in enumerate(org_names)}
    for p in prow:
        p["id"], p["parent_id"] = pid[p["key"]], oid[canon_org(p["parent_org"], p["parent_org"])]

    grow = []
    for k, g in programs.items():
        r = raw[k]
        plat = g.get("platform", "")
        platrec = next((p for p in prow if p["key"] == plat), None)
        org = canon_org(g.get("org") or (platrec["parent_org"] if platrec else r.get("parent_org", "")), r["name"])
        hosted, acad = HOSTED.get(k, ("", ""))
        grow.append(dict(key=k, name=r["name"], platform_id=pid.get(plat, ""), platform=platrec["name"] if platrec else "",
                         org_id=oid.get(org, ""), org=org, program_type=g["ptype"], category=r["category"],
                         layers=r.get("layers") or LAYER_FILL.get(k, ""), in_scope=r["in_scope"], url=r.get("url", ""),
                         hosted_on=hosted, academic_partner=acad, raw_keys=";".join(g["members"]),
                         notes=" | ".join(OrderedDict.fromkeys(raw[m].get("notes", "") for m in g["members"] if raw[m].get("notes")))))
    grow.sort(key=lambda x: (x["platform_id"] or "~", x["org"], x["name"].lower()))
    for i, g in enumerate(grow):
        g["id"] = f"G-{i+1:03d}"
    gid = {g["key"]: g["id"] for g in grow}

    orow = []
    for o in org_names:
        plats = [p for p in prow if p["parent_org"] == o]
        progs = [g for g in grow if g["org"] == o]
        own = "; ".join(OrderedDict.fromkeys(
            [raw[k]["parent_org"] for p in plats for k in p["raw_keys"].split(";") if k in raw and raw[k].get("parent_org")]
            + [f"{x[2]['name']}: {x[2].get('notes','')}" for x in orgs_extra if x[0] == o]))
        orow.append(dict(id=oid[o], name=o, platform_count=len(plats), program_count=len(progs),
                         platform_ids=";".join(p["id"] for p in plats), ownership_as_reported=own[:600]))

    def resolve_id(k):
        if k.startswith("(org) "):
            return oid.get(canon_org(k[6:], k[6:]), k)
        return pid.get(k) or gid.get(k) or pid.get(root(k)) or gid.get(root(k)) or k

    dlog = [dict(kept_id=resolve_id(t), merged_raw_key=k, merged_raw_id=f"R-{k}", merged_name=n, action=a, reason=why,
                 decided="P2 manual review 2026-09-28") for t, k, n, a, why in dedup]

    # ---- fuzzy safety net over the final platform list
    fz = []
    names = [(p["id"], p["name"], host(p["url"])) for p in prow]
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            a, b = names[i], names[j]
            r1 = fuzz.token_set_ratio(re.sub(r"\(.*?\)", "", a[1]).lower(), re.sub(r"\(.*?\)", "", b[1]).lower())
            same = a[2] and a[2] == b[2] and a[2] not in ("github.com", "youtube.com", "skool.com")
            if r1 >= 88 or (same and r1 >= 60):
                fz.append(dict(id_a=a[0], name_a=a[1], id_b=b[0], name_b=b[1], score=round(r1), same_host=bool(same),
                               decision="kept separate — reviewed" ))
    # ---- sources + usage signals + logs
    src, srows = OrderedDict(), []
    def sid(url, prov, tier, claim):
        url = url.strip()
        if not url:
            return ""
        if url not in src:
            src[url] = f"S-{len(src)+1:04d}"
            srows.append(dict(source_id=src[url], provider=prov, url=url, type="", date_published="", date_accessed=OBSERVED,
                              claim_supported=claim[:200], tier=tier, authority="", freshness="", directness="",
                              relevance="", confidence="", notes="Discovery-phase record; page content not verified unless tier says T1 and slice notes say fetched. Scoring deferred to P4."))
        return src[url]

    ent_of = {}
    for p in prow:
        for k in p["raw_keys"].split(";"):
            ent_of[k] = p["id"]
    for g in grow:
        for k in g["raw_keys"].split(";"):
            ent_of[k] = g["id"]
    usage = []
    for k, r in raw.items():
        ids = [sid(u, r["name"], r.get("source_tier", ""), r.get("key_signal", "")) for u in re.split(r";\s*(?=https?://)", r.get("source_url", "")) if u.strip()]
        if r.get("key_signal"):
            label = r.get("signal_label", "") or "UNKNOWN"
            usage.append(dict(metric_id=f"U-{len(usage)+1:04d}", entity_id=ent_of.get(k, ""), entity=r["name"],
                              signal_text=r["key_signal"], label=label, as_of=r.get("signal_as_of", ""), observed=OBSERVED,
                              source_ids=";".join(i for i in ids if i), source_tier=r.get("source_tier", ""),
                              status="P1 discovery signal — value, definition & scope to be verified in P3/P4",
                              raw_key=k))

    slog = []
    for path in sorted(glob.glob(os.path.join(RAW, "*_search_log.csv"))):
        sl = os.path.basename(path).split("_")[0]
        for r in csv.DictReader(open(path, encoding="utf-8")):
            slog.append(dict(query_id=f"Q-{len(slog)+1:04d}", slice=sl, **{k: (v or "") for k, v in r.items()}))
    sat = []
    for path in sorted(glob.glob(os.path.join(RAW, "*_saturation.csv"))):
        sl = os.path.basename(path).split("_")[0]
        for r in csv.DictReader(open(path, encoding="utf-8")):
            sat.append(dict(slice=sl, **{k: (v or "") for k, v in r.items()}))
    ctx = []
    for r in csv.DictReader(open(os.path.join(RAW, "reports_datapoints.csv"), encoding="utf-8")):
        ctx.append(dict(item=r["report"], publisher=r["publisher"], date=r["edition_date"], url=r["url"],
                        datapoint=r["datapoint"], value=r["exact_value"], definition=r["definition"], scope=r["scope_geo"],
                        label=r["label"], providers_named=r["providers_named"], trend_tag=r["trend_tag"], origin="ainative slice"))
    for r in csv.DictReader(open(os.path.join(RAW, "enterprise_regulatory_and_reports.csv"), encoding="utf-8")):
        ctx.append(dict(item=r["item"], publisher="", date=r["date"], url=r["url"], datapoint=r["type(regulation|report|survey)"],
                        value=r["key_point"], definition="", scope="", label=r["label"], providers_named="", trend_tag="",
                        origin="enterprise slice"))
    for i, c in enumerate(ctx):
        c["context_id"] = f"C-{i+1:03d}"
        c["source_id"] = sid(c["url"], c["item"], "", c["datapoint"])

    # ---- write
    def write(name, rows, fields):
        with open(os.path.join(OUT, name), "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore"); w.writeheader(); w.writerows(rows)
        return name, rows, fields

    PF = ["id", "name", "aliases", "parent_id", "parent_org", "category", "subcategory", "url", "hq", "region", "hosted_on",
          "academic_partner", "in_scope", "tier", "tier_basis", "layers", "layers_basis", "on_brief_seed_list", "on_seed_list", "major_hint", "scope_resolution",
          "discovery_slices", "raw_keys", "notes"]
    tabs = [
        write("providers.csv", prow, PF),
        write("orgs.csv", orow, ["id", "name", "platform_count", "program_count", "platform_ids", "ownership_as_reported"]),
        write("programs.csv", grow, ["id", "name", "platform_id", "platform", "org_id", "org", "program_type", "category",
                                     "layers", "in_scope", "url", "hosted_on", "academic_partner", "raw_keys", "notes"]),
        write("usage_signals_p1.csv", usage, ["metric_id", "entity_id", "entity", "signal_text", "label", "as_of", "observed",
                                              "source_ids", "source_tier", "status", "raw_key"]),
        write("sources.csv", srows, ["source_id", "provider", "url", "type", "date_published", "date_accessed", "claim_supported",
                                     "tier", "authority", "freshness", "directness", "relevance", "confidence", "notes"]),
        write("context_datapoints.csv", ctx, ["context_id", "item", "publisher", "date", "url", "source_id", "datapoint", "value",
                                              "definition", "scope", "label", "providers_named", "trend_tag", "origin"]),
        write("search_log.csv", slog, ["query_id", "slice", "query", "date", "engine", "batch_no", "pass", "new_entities_count", "new_entities"]),
        write("dedup_log.csv", dlog, ["kept_id", "merged_raw_id", "merged_raw_key", "merged_name", "action", "reason", "decided"]),
        write("saturation_log.csv", sat, ["slice", "category", "batches_run", "last3_batches_new_counts", "saturated(Y/N)", "note"]),
        write("p2_fuzzy_check.csv", fz, ["id_a", "name_a", "id_b", "name_b", "score", "same_host", "decision"]),
    ]
    rawrows = [dict(raw_id=f"R-{k}", **r) for k, r in raw.items()]
    rf = ["raw_id", "slice"] + [c for c in rawrows[0] if c not in ("raw_id", "slice", "raw_key")]
    tabs.append(write("p1_raw_candidates_all.csv", rawrows, rf))

    wb = Workbook(); wb.remove(wb.active)
    for name, rows, fields in tabs:
        ws = wb.create_sheet(name.replace(".csv", "")[:31])
        ws.append(fields)
        for c in ws[1]:
            c.font = Font(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="1F3A5F")
        for r in rows:
            ws.append([str(r.get(f, "")) for f in fields])
        ws.freeze_panes = "A2"; ws.auto_filter.ref = ws.dimensions
        for col in ws.columns:
            w = min(60, max(10, max(len(str(c.value or "")) for c in col[:200]) + 2))
            ws.column_dimensions[col[0].column_letter].width = w
            for c in col[1:]:
                c.alignment = Alignment(vertical="top", wrap_text=w >= 60)
    wb.save(os.path.join(OUT, "ai_upskilling_ecosystem_run1.xlsx"))

    # summary to stdout
    from collections import Counter
    print("raw rows", len(raw), "| platforms", len(prow), "| programs", len(grow), "| orgs", len(orow),
          "| dedup actions", len(dlog), "| sources", len(srows), "| usage signals", len(usage), "| queries", len(slog))
    print("in_scope", Counter(p["in_scope"] for p in prow))
    print("tier", Counter(p["tier"] for p in prow))
    print("category(core)", Counter(p["category"] for p in prow if p["in_scope"] in ("yes", "legacy-canonical")))
    print("region(core)", Counter(p["region"] for p in prow if p["in_scope"] in ("yes", "legacy-canonical")))
    core = [p for p in prow if p["in_scope"] in ("yes", "legacy-canonical")]
    ns = [p for p in core if p["on_brief_seed_list"] != "yes"]
    print("seed platforms matched", sum(p["on_brief_seed_list"] == "yes" for p in prow))
    print("non-seed core", len(ns), "| non-seed major/distinctive (provisional)", sum("major" in p["tier"] or "distinctive" in p["tier"] for p in ns),
          "| of which non-US", sum(("major" in p["tier"] or "distinctive" in p["tier"]) and p["region"] not in ("North America", "Global/unspecified") for p in ns))
    print("fuzzy hits", len(fz))


if __name__ == "__main__":
    main()
