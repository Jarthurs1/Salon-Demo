export const HELP_SEEN_STORAGE_KEY = 'salon_help_seen_v1'

export const PWA_INSTALL_GUIDE = {
  title: 'Install on iPhone',
  steps: [
    'Open Simple Salon in Safari.',
    'Tap Share.',
    'Select Add to Home Screen (or Open as Web App where applicable).',
    'Tap Add.',
  ],
  body: 'Installing puts Simple Salon on your Home Screen and opens it full screen without the Safari address bar.',
}

export function hasSeenHelpGuide(storage = localStorage) {
  try {
    return storage.getItem(HELP_SEEN_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function markHelpGuideSeen(storage = localStorage) {
  try {
    storage.setItem(HELP_SEEN_STORAGE_KEY, '1')
  } catch {
    // Ignore quota / private-mode failures; guide can still be reopened from Help.
  }
}
