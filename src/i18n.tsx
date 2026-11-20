import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const strings: Record<string, readonly [string, string, string]> = {
  language: ["Language", "மொழி", "භාෂාව"],
  createTitle: [
    "Create a feedback form",
    "கருத்துப் படிவம் உருவாக்கவும்",
    "අදහස් පෝරමයක් සාදන්න",
  ],
  classTitle: ["Class title", "வகுப்பின் தலைப்பு", "පන්තියේ නම"],
  classExample: [
    "e.g. Database Systems, Lecture 4",
    "உதா. தரவுத்தளங்கள், வகுப்பு 4",
    "උදා. දත්ත සමුදා, 4 වන දේශනය",
  ],
  question: [
    "Question for students",
    "மாணவர்களுக்கான கேள்வி",
    "සිසුන්ට ප්‍රශ්නයක්",
  ],
  optional: ["Optional", "விருப்பம்", "අවශ්‍ය නම්"],
  questionExample: [
    "What helped you learn today?",
    "இன்று கற்க எது உதவியது?",
    "අද ඉගෙනීමට ඔබට උදව් වූයේ කුමක්ද?",
  ],
  create: [
    "Create feedback link",
    "கருத்து இணைப்பை உருவாக்கு",
    "පෝරමයේ සබැඳිය සාදන්න",
  ],
  creating: ["Creating…", "உருவாக்குகிறது…", "සාදමින්…"],
  anonymous: ["Anonymous feedback", "பெயரில்லா கருத்து", "නිර්නාමික අදහස්"],
  student: ["Student form", "மாணவர் படிவம்", "ශිෂ්‍ය පෝරමය"],
  lecturer: ["Lecturer workspace", "விரிவுரையாளர் பகுதி", "දේශක අවකාශය"],
  feedback: ["Your feedback", "உங்கள் கருத்து", "ඔබේ අදහස"],
  placeholder: [
    "What worked well? What could improve?",
    "எது நன்றாக இருந்தது? எதை மேம்படுத்தலாம்?",
    "හොඳින් සිදු වූයේ කුමක්ද? වැඩිදියුණු කළ හැක්කේ කුමක්ද?",
  ],
  privacy: [
    "Leave out your name and student ID.",
    "உங்கள் பெயரையும் மாணவர் இலக்கத்தையும் எழுத வேண்டாம்.",
    "ඔබේ නම සහ ශිෂ්‍ය අංකය ඇතුළත් කිරීමෙන් වළකින්න.",
  ],
  rating: ["Overall rating", "மொத்த மதிப்பீடு", "සමස්ත ඇගයීම"],
  low: ["Needs improvement", "மேம்படுத்த வேண்டும்", "වැඩිදියුණු කළ යුතුයි"],
  high: ["Excellent", "மிகச் சிறப்பு", "විශිෂ්ටයි"],
  submit: ["Submit feedback", "கருத்தை அனுப்பு", "අදහස යවන්න"],
  submitting: ["Submitting…", "அனுப்புகிறது…", "යවමින්…"],
  thanks: ["Thank you.", "நன்றி.", "ස්තුතියි."],
  received: [
    "Your feedback was received.",
    "உங்கள் கருத்து பெறப்பட்டது.",
    "ඔබේ අදහස ලැබුණා.",
  ],
  another: [
    "Submit another response",
    "மற்றொரு கருத்தை அனுப்பு",
    "තවත් අදහසක් යවන්න",
  ],
  closed: [
    "Feedback closed",
    "கருத்து பெறுவது முடிந்தது",
    "අදහස් භාර ගැනීම අවසන්",
  ],
  open: ["Accepting feedback", "கருத்துகள் பெறப்படுகின்றன", "අදහස් භාර ගැනේ"],
  loading: ["Loading…", "ஏற்றுகிறது…", "පූරණය වෙමින්…"],
  retry: ["Try again", "மீண்டும் முயற்சி", "යළි උත්සාහ කරන්න"],
  invalid: [
    "This link is unavailable. Open the original link.",
    "இந்த இணைப்பு கிடைக்கவில்லை. அசல் இணைப்பைத் திறக்கவும்.",
    "මෙම සබැඳිය භාවිත කළ නොහැක. මුල් සබැඳිය විවෘත කරන්න.",
  ],
  overview: ["Overview", "கண்ணோட்டம்", "සාරාංශය"],
  responses: ["Responses", "பதில்கள்", "ප්‍රතිචාර"],
  average: ["Average rating", "சராசரி மதிப்பீடு", "සාමාන්‍ය ඇගයීම"],
  reviewed: ["Reviewed by you", "நீங்கள் மதிப்பிட்டவை", "ඔබ ඇගයූ ඒවා"],
  share: ["Class links", "வகுப்பு இணைப்புகள்", "පන්තියේ සබැඳි"],
  studentLink: ["Student link", "மாணவர் இணைப்பு", "ශිෂ්‍ය සබැඳිය"],
  privateLink: [
    "Private results link",
    "தனிப்பட்ட முடிவு இணைப்பு",
    "පෞද්ගලික ප්‍රතිඵල සබැඳිය",
  ],
  saveLink: [
    "Save private link",
    "தனிப்பட்ட இணைப்பைச் சேமி",
    "පෞද්ගලික සබැඳිය සුරකින්න",
  ],
  keepLink: [
    "Keep this link for your next visit. Anyone with it can manage this class.",
    "மீண்டும் இங்கு வர இந்த இணைப்பைச் சேமிக்கவும். இது உள்ளவர் வகுப்பை நிர்வகிக்கலாம்.",
    "යළි පිවිසීමට මෙම සබැඳිය සුරකින්න. එය ඇති අයෙකුට පන්තිය කළමනාකරණය කළ හැකිය.",
  ],
  copy: ["Copy", "நகலெடு", "පිටපත් කරන්න"],
  copied: ["Copied", "நகலெடுக்கப்பட்டது", "පිටපත් කළා"],
  copyManual: [
    "Select the link and copy it.",
    "இணைப்பைத் தேர்ந்தெடுத்து நகலெடுக்கவும்.",
    "සබැඳිය තෝරා පිටපත් කරන්න.",
  ],
  close: ["Close", "மூடு", "වසන්න"],
  stop: [
    "Close feedback",
    "கருத்து பெறுவதை நிறுத்து",
    "අදහස් භාර ගැනීම නවත්වන්න",
  ],
  reopen: [
    "Reopen feedback",
    "மீண்டும் கருத்துகளைப் பெறு",
    "යළි අදහස් භාර ගන්න",
  ],
  refresh: ["Refresh", "புதுப்பி", "යාවත්කාලීන කරන්න"],
  sentiment: ["How students felt", "மாணவர்களின் கருத்துநிலை", "සිසුන්ගේ අදහස්"],
  strengths: ["What worked", "எது நன்றாக இருந்தது", "හොඳින් සිදු වූ දේ"],
  improvements: [
    "What to improve",
    "எதை மேம்படுத்தலாம்",
    "වැඩිදියුණු කළ හැකි දේ",
  ],
  noStrengths: [
    "No clear strength found in these responses.",
    "இந்தப் பதில்களில் தெளிவான பலம் காணப்படவில்லை.",
    "මෙම ප්‍රතිචාරවල පැහැදිලි ශක්තියක් හඳුනාගෙන නැත.",
  ],
  empty: [
    "Waiting for the first response.",
    "முதல் பதிலுக்காகக் காத்திருக்கிறது.",
    "පළමු ප්‍රතිචාරය තෙක් රැඳී සිටී.",
  ],
  emptyHint: [
    "Open the student link to fill in the form.",
    "கருத்தை அனுப்ப மாணவர் இணைப்பைத் திறக்கவும்.",
    "පෝරමය පිරවීමට ශිෂ්‍ය සබැඳිය විවෘත කරන්න.",
  ],
  needsReading: [
    "Some responses still need a closer look. Review them for improvement requests.",
    "சில பதில்களை இன்னும் பார்க்க வேண்டும். அவற்றில் மாற்றத்துக்கான கோரிக்கை உள்ளதா எனப் பாருங்கள்.",
    "තවත් ප්‍රතිචාර කිහිපයක් කියවා බලන්න. වෙනස්කම් සඳහා ඉල්ලීම් තිබිය හැකිය.",
  ],
  noAction: [
    "These responses contain no clear request for a change.",
    "இந்தப் பதில்களில் மாற்றத்துக்கான தெளிவான கோரிக்கை இல்லை.",
    "මෙම ප්‍රතිචාරවල වෙනසක් සඳහා පැහැදිලි ඉල්ලීමක් හමු වී නැත.",
  ],
  sourceQuote: ["Student wording", "மாணவரின் சொற்கள்", "ශිෂ්‍යයාගේ වචන"],
  topics: ["Topics mentioned", "குறிப்பிட்ட தலைப்புகள்", "සඳහන් වූ මාතෘකා"],
  mentions: ["Mentions", "பதில்கள்", "සඳහන් කිරීම්"],
  concerns: ["With concerns", "குறை உள்ளவை", "ගැටලු ඇති ප්‍රතිචාර"],
  positive: ["Positive", "நேர்மறை", "ධනාත්මක"],
  negative: ["Negative", "எதிர்மறை", "සෘණාත්මක"],
  mixed: ["Mixed", "கலப்பு", "මිශ්‍ර"],
  neutral: ["Neutral", "நடுநிலை", "මධ්‍යස්ථ"],
  unreviewed: ["Needs review", "மதிப்பிட வேண்டும்", "සමාලෝචනය අවශ්‍යයි"],
  phrases: ["Phrase analysis", "சொற்றொடர் ஆய்வு", "යෙදුම් විශ්ලේෂණය"],
  baseline: [
    "English classifier",
    "ஆங்கில வகைப்படுத்தி",
    "ඉංග්‍රීසි වර්ගීකරණය",
  ],
  human: ["Your review", "உங்கள் மதிப்பீடு", "ඔබේ ඇගයීම"],
  correction: ["Saved correction", "சேமித்த திருத்தம்", "සුරැකි නිවැරදි කිරීම"],
  learner: ["Similar corrections", "ஒத்த திருத்தங்கள்", "සමාන නිවැරදි කිරීම්"],
  ollama: [
    "Local language model",
    "கணினியில் இயங்கும் மொழி மாதிரி",
    "දේශීය භාෂා ආකෘතිය",
  ],
  filter: ["Filter", "வடிகட்டு", "පෙරන්න"],
  all: ["All responses", "அனைத்துப் பதில்கள்", "සියලු ප්‍රතිචාර"],
  pending: [
    "Awaiting your review",
    "உங்கள் மதிப்பீட்டுக்காக",
    "ඔබේ ඇගයීම සඳහා",
  ],
  search: ["Search feedback", "கருத்தைத் தேடு", "අදහස් සොයන්න"],
  noMatch: [
    "No matching responses.",
    "பொருந்தும் பதில்கள் இல்லை.",
    "ගැළපෙන ප්‍රතිචාර නැත.",
  ],
  previous: ["Previous", "முந்தையது", "පෙර"],
  next: ["Next", "அடுத்து", "ඊළඟ"],
  review: ["Review", "மதிப்பிடு", "සමාලෝචනය"],
  remember: ["Save correction", "திருத்தத்தைச் சேமி", "නිවැරදි කිරීම සුරකින්න"],
  learnHint: [
    "This class will reuse your label for the same wording.",
    "இதே வகுப்பில் இதே கருத்து வந்தால் உங்கள் மதிப்பீடு பயன்படுத்தப்படும்.",
    "මෙම පන්තියට එම අදහස යළි ලැබුණොත් ඔබේ ඇගයීම භාවිත වේ.",
  ],
  original: ["First prediction", "முதல் கணிப்பு", "මුල් අනාවැකිය"],
  history: ["Review history", "மதிப்பீட்டு வரலாறு", "ඇගයීම් ඉතිහාසය"],
  csv: ["Export CSV", "CSV பதிவிறக்கு", "CSV ලබා ගන්න"],
  learning: [
    "Learning & analysis",
    "கற்றலும் பகுப்பாய்வும்",
    "ඉගෙනීම සහ විශ්ලේෂණය",
  ],
  examples: [
    "Distinct corrected comments",
    "திருத்திய தனித்துவமான கருத்துகள்",
    "නිවැරදි කළ වෙනස් අදහස්",
  ],
  trainingExport: [
    "Export corrections",
    "திருத்தங்களைப் பதிவிறக்கு",
    "නිවැරදි කිරීම් ලබා ගන්න",
  ],
  deep: [
    "Analyse with local AI",
    "உள்ளூர் AI மூலம் ஆராய்",
    "දේශීය AI මඟින් විශ්ලේෂණය",
  ],
  analysing: ["Analysing…", "ஆராய்கிறது…", "විශ්ලේෂණය කරමින්…"],
  aiReady: [
    "Local model ready",
    "உள்ளூர் மாதிரி தயார்",
    "දේශීය ආකෘතිය සූදානම්",
  ],
  aiOffline: [
    "Optional local model offline",
    "கூடுதல் உள்ளூர் மாதிரி இயங்கவில்லை",
    "විකල්ප දේශීය ආකෘතිය අක්‍රියයි",
  ],
  aiMissing: [
    "Model download needed",
    "மாதிரியைப் பதிவிறக்க வேண்டும்",
    "ආකෘතිය ලබා ගත යුතුයි",
  ],
  setupHint: [
    "For deeper analysis, install Ollama on the FeedWise PC and run this command once.",
    "மேலும் ஆராய, FeedWise கணினியில் Ollama நிறுவி இந்தக் கட்டளையை ஒருமுறை இயக்கவும்.",
    "වැඩිදුර විශ්ලේෂණයට FeedWise පරිගණකයේ Ollama ස්ථාපනය කර මෙම විධානය වරක් ක්‍රියාත්මක කරන්න.",
  ],
  learnerHint: [
    "Exact corrections apply immediately. After six different examples across at least two labels, closely matching wording can also receive a suggestion.",
    "திருத்தங்கள் உடனே பயன்படும். இரண்டு வகைகளிலாவது ஆறு வெவ்வேறு உதாரணங்கள் இருந்தால் ஒத்த கருத்துகளுக்கும் கணிப்பு கிடைக்கலாம்.",
    "නිවැරදි කිරීම් වහාම භාවිත වේ. වර්ග දෙකකවත් වෙනස් නිදසුන් හයක් ඇති විට සමාන වචන සඳහාද යෝජනාවක් ලැබිය හැකිය.",
  ],
  aiEvidence: ["The model could not support its answer. Review the saved feedback.", "மாதிரியின் கணிப்புக்கு ஆதாரம் போதவில்லை. சேமித்த கருத்தை மதிப்பிடுங்கள்.", "ආකෘතියේ පිළිතුරට ප්‍රමාණවත් සාධක නැත. සුරැකි අදහස සමාලෝචනය කරන්න."],
  aiFailed: [
    "Local analysis could not finish. Your response is saved.",
    "உள்ளூர் ஆய்வு முடிவடையவில்லை. உங்கள் பதில் சேமிக்கப்பட்டது.",
    "දේශීය විශ්ලේෂණය අවසන් කළ නොහැකි විය. ප්‍රතිචාරය සුරැකිණි.",
  ],
  failed: [
    "The request failed. Please try again.",
    "கோரிக்கை தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.",
    "ඉල්ලීම අසාර්ථකයි. යළි උත්සාහ කරන්න.",
  ],
  limit: [
    "Feedback is closed or the class has reached its response limit.",
    "கருத்து பெறுவது முடிந்தது அல்லது பதில் வரம்பு எட்டப்பட்டது.",
    "අදහස් භාර ගැනීම අවසන් හෝ ප්‍රතිචාර සීමාවට ළඟා වී ඇත.",
  ],
  clarity: [
    "Clarity and examples",
    "விளக்கமும் உதாரணங்களும்",
    "පැහැදිලි බව සහ උදාහරණ",
  ],
  pace: ["Teaching pace", "கற்பிக்கும் வேகம்", "ඉගැන්වීමේ වේගය"],
  practical: ["Practical work", "செய்முறைப் பயிற்சி", "ප්‍රායෝගික වැඩ"],
  assessment: ["Assessment", "மதிப்பீடு", "ඇගයීම්"],
  resources: ["Learning materials", "கற்றல் வளங்கள்", "ඉගෙනුම් සම්පත්"],
  communication: ["Communication", "தொடர்பாடல்", "සන්නිවේදනය"],
  environment: ["Classroom", "வகுப்பறை", "පන්ති කාමරය"],
  other: ["Other feedback", "பிற கருத்துகள்", "වෙනත් අදහස්"],
  action_clarity: [
    "Walk through one example, then check which step needs explanation.",
    "ஓர் உதாரணத்தைப் படிப்படியாகக் காட்டி எந்தப் படிக்கு விளக்கம் தேவை எனக் கேளுங்கள்.",
    "උදාහරණයක් පියවරෙන් පියවර පෙන්වා තවත් පැහැදිලි කළ යුතු පියවර අසන්න.",
  ],
  action_pace: [
    "Ask which section needs more or less time.",
    "எந்தப் பகுதிக்கு அதிக அல்லது குறைந்த நேரம் தேவை எனக் கேளுங்கள்.",
    "වැඩි හෝ අඩු කාලයක් අවශ්‍ය කොටස අසන්න.",
  ],
  action_paceFast: [
    "Pause after each key step and allow time for a question.",
    "ஒவ்வொரு முக்கிய படிக்குப் பிறகும் நிறுத்தி கேள்விக்கு நேரம் கொடுங்கள்.",
    "වැදගත් පියවරකට පසු මඳක් නතර වී ප්‍රශ්නයකට කාලය දෙන්න.",
  ],
  action_paceSlow: [
    "Offer a short recap and move on once the class is ready.",
    "சுருக்கமாக மீள்பார்த்து வகுப்பு தயாரானதும் அடுத்த பகுதிக்குச் செல்லுங்கள்.",
    "කෙටි සාරාංශයක් දී පන්තිය සූදානම් වූ විට ඉදිරියට යන්න.",
  ],
  action_practical: [
    "Try one guided exercise, then give students time to practise.",
    "ஒரு பயிற்சியை வழிநடத்தி மாணவர்கள் முயற்சி செய்ய நேரம் கொடுங்கள்.",
    "අභ්‍යාසයක් මඟ පෙන්වා කර සිසුන්ට පුහුණු වීමට කාලය දෙන්න.",
  ],
  action_assessment: [
    "Clarify the stated assessment issue with an example or a timeline.",
    "குறிப்பிட்ட மதிப்பீட்டுச் சிக்கலை உதாரணம் அல்லது கால அட்டவணையுடன் விளக்குங்கள்.",
    "සඳහන් ඇගයීම් ගැටලුව උදාහරණයකින් හෝ කාලසටහනකින් පැහැදිලි කරන්න.",
  ],
  action_resources: [
    "Check the material mentioned and share a revised or accessible copy.",
    "குறிப்பிட்ட வளத்தைச் சரிபார்த்து எளிதில் அணுகக்கூடிய நகலைப் பகிருங்கள்.",
    "සඳහන් සම්පත පරීක්ෂා කර යාවත්කාලීන හෝ පහසුවෙන් ලබාගත හැකි පිටපතක් බෙදා දෙන්න.",
  ],
  action_communication: [
    "Set aside time to answer the question raised.",
    "எழுப்பிய கேள்விக்குப் பதிலளிக்க நேரம் ஒதுக்குங்கள்.",
    "මතු කළ ප්‍රශ්නයට පිළිතුරු දීමට වේලාවක් වෙන් කරන්න.",
  ],
  action_environment: [
    "Check the classroom issue mentioned before the next session.",
    "அடுத்த வகுப்புக்கு முன் குறிப்பிட்ட வகுப்பறைச் சிக்கலைச் சரிபாருங்கள்.",
    "ඊළඟ පන්තියට පෙර සඳහන් පන්ති කාමර ගැටලුව පරීක්ෂා කරන්න.",
  ],
  action_other: [
    "Read the comment and decide what change would address it.",
    "கருத்தைப் படித்து அதற்குப் பொருத்தமான மாற்றத்தைத் தீர்மானியுங்கள்.",
    "අදහස කියවා එයට ගැළපෙන වෙනස තීරණය කරන්න.",
  ],
  positiveQuick: [
    "Mark positive",
    "நேர்மறையாகக் குறி",
    "ධනාත්මක ලෙස සලකුණු කරන්න",
  ],
  negativeQuick: [
    "Mark negative",
    "எதிர்மறையாகக் குறி",
    "සෘණාත්මක ලෙස සලකුණු කරන්න",
  ],
  yourLabel: ["Your label", "உங்கள் மதிப்பீடு", "ඔබේ වර්ගය"],
  saved: ["Saved", "சேமிக்கப்பட்டது", "සුරැකිණි"],
  reviewResponses: [
    "Review responses",
    "பதில்களை மதிப்பிடு",
    "ප්‍රතිචාර සමාලෝචනය",
  ],
  lengthError: [
    "Write 2 to 2,000 characters.",
    "2 முதல் 2,000 எழுத்துகள் வரை எழுதுங்கள்.",
    "අකුරු 2 සිට 2,000 දක්වා ලියන්න.",
  ],
  goHome: ["FeedWise home", "FeedWise முகப்பு", "FeedWise මුල් පිටුව"],
};
export const languages = ["en", "ta", "si"] as const;
export type Language = (typeof languages)[number];
function initialLanguage(): Language {
  let code = navigator.language.split("-")[0];
  try {
    code = localStorage.getItem("feedwise-language") || code;
  } catch {}
  return languages.find((lang) => lang === code) || "en";
}
const Context = createContext({
  lang: "en" as Language,
  setLang: (_value: Language) => {},
  t: (key: string) => key,
});
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(initialLanguage);
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem("feedwise-language", lang);
    } catch {}
  }, [lang]);
  const t = (key: string) => strings[key]?.[languages.indexOf(lang)] ?? key;
  return (
    <Context.Provider value={{ lang, setLang, t }}>{children}</Context.Provider>
  );
}
export const useLanguage = () => useContext(Context);
