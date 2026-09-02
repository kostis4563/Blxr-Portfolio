export const LANGUAGES = [
  { code: 'en', name: 'English',    flag: '🇬🇧', group: 'en',      english: 'English' },

  { code: 'es', name: 'Español',    flag: '🇪🇸', group: 'west',    english: 'Spanish',    alt: 'castellano castilian' },
  { code: 'fr', name: 'Français',   flag: '🇫🇷', group: 'west',    english: 'French' },
  { code: 'de', name: 'Deutsch',    flag: '🇩🇪', group: 'west',    english: 'German' },
  { code: 'it', name: 'Italiano',   flag: '🇮🇹', group: 'west',    english: 'Italian' },
  { code: 'pt', name: 'Português',  flag: '🇵🇹', group: 'west',    english: 'Portuguese', alt: 'brasil brazil' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱', group: 'west',    english: 'Dutch',      alt: 'holland flemish vlaams' },
  { code: 'el', name: 'Ελληνικά',   flag: '🇬🇷', group: 'west',    english: 'Greek',      alt: 'ellinika hellenic' },

  { code: 'no', name: 'Norsk',      flag: '🇳🇴', group: 'nordic',  english: 'Norwegian',  alt: 'bokmal nynorsk' },
  { code: 'sv', name: 'Svenska',    flag: '🇸🇪', group: 'nordic',  english: 'Swedish' },
  { code: 'da', name: 'Dansk',      flag: '🇩🇰', group: 'nordic',  english: 'Danish' },
  { code: 'fi', name: 'Suomi',      flag: '🇫🇮', group: 'nordic',  english: 'Finnish' },

  { code: 'pl', name: 'Polski',     flag: '🇵🇱', group: 'east',    english: 'Polish' },
  { code: 'cs', name: 'Čeština',    flag: '🇨🇿', group: 'east',    english: 'Czech' },
  { code: 'hu', name: 'Magyar',     flag: '🇭🇺', group: 'east',    english: 'Hungarian' },
  { code: 'ro', name: 'Română',     flag: '🇷🇴', group: 'east',    english: 'Romanian' },
  { code: 'bg', name: 'Български',  flag: '🇧🇬', group: 'east',    english: 'Bulgarian' },
  { code: 'sr', name: 'Српски',     flag: '🇷🇸', group: 'east',    english: 'Serbian',    alt: 'srpski' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦', group: 'east',    english: 'Ukrainian' },
  { code: 'ru', name: 'Русский',    flag: '🇷🇺', group: 'east',    english: 'Russian' },
  { code: 'tr', name: 'Türkçe',     flag: '🇹🇷', group: 'east',    english: 'Turkish' },

  { code: 'ja', name: '日本語',      flag: '🇯🇵', group: 'asia',    english: 'Japanese',   alt: 'nihongo' },
  { code: 'ko', name: '한국어',      flag: '🇰🇷', group: 'asia',    english: 'Korean',     alt: 'hangul hangugeo' },
  { code: 'zh', name: '中文',        flag: '🇨🇳', group: 'asia',    english: 'Chinese',    alt: 'mandarin zhongwen hanyu' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳', group: 'asia',    english: 'Vietnamese' },
  { code: 'th', name: 'ไทย',        flag: '🇹🇭', group: 'asia',    english: 'Thai' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩', group: 'asia', english: 'Indonesian' },
  { code: 'hi', name: 'हिन्दी',       flag: '🇮🇳', group: 'asia',    english: 'Hindi' },
  { code: 'bn', name: 'বাংলা',       flag: '🇧🇩', group: 'asia',    english: 'Bengali',    alt: 'bangla' },

  { code: 'ar', name: 'العربية',    flag: '🇸🇦', group: 'rtl',     english: 'Arabic',     alt: 'arabiya', dir: 'rtl' },
  { code: 'fa', name: 'فارسی',      flag: '🇮🇷', group: 'rtl',     english: 'Persian',    alt: 'farsi',   dir: 'rtl' },
  { code: 'he', name: 'עברית',      flag: '🇮🇱', group: 'rtl',     english: 'Hebrew',     alt: 'ivrit',   dir: 'rtl' }
]

export const LANG_CODES = LANGUAGES.map((l) => l.code)
export const STORAGE_KEY = 'blxr-lang'
export const DEFAULT_LANG = 'en'

export const LOCALE_TAGS = {
  en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', pt: 'pt-PT',
  nl: 'nl-NL', el: 'el-GR', no: 'nb-NO', sv: 'sv-SE', da: 'da-DK', fi: 'fi-FI',
  pl: 'pl-PL', cs: 'cs-CZ', hu: 'hu-HU', ro: 'ro-RO', bg: 'bg-BG', sr: 'sr-RS',
  uk: 'uk-UA', ru: 'ru-RU', tr: 'tr-TR', ja: 'ja-JP', ko: 'ko-KR', zh: 'zh-CN',
  vi: 'vi-VN', th: 'th-TH', id: 'id-ID', hi: 'hi-IN', bn: 'bn-BD',
  ar: 'ar', fa: 'fa-IR', he: 'he-IL'
}
