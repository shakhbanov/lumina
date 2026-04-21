type Locale = 'ru' | 'en';

const translations: Record<Locale, Record<string, string>> = {
  ru: {
    // App
    'app.title': 'Lumina',

    // Landing
    'landing.create': 'Новая встреча',
    'landing.join': 'Присоединиться',
    'landing.enter': 'Войти',
    'landing.copy': 'Копировать',
    'landing.copied': 'Скопировано',
    'landing.error.create': 'Не удалось создать комнату',
    'landing.error.noLink': 'В буфере нет ссылки на встречу',
    'landing.error.expired': 'Встреча завершена или ссылка недействительна',
    'landing.error.clipboard': 'Скопируйте ссылку на встречу и попробуйте снова',

    // PreJoin
    'prejoin.title': 'Настройка перед входом',
    'prejoin.name': 'Ваше имя',
    'prejoin.namePlaceholder': 'Введите имя',
    'prejoin.nameHint': 'Оставьте пустым для случайного имени',
    'prejoin.join': 'Войти в комнату',
    'prejoin.camera': 'Камера',
    'prejoin.mic': 'Микрофон',
    'prejoin.room': 'Комната:',

    // Meeting
    'meeting.mute': 'Микрофон',
    'meeting.camera': 'Камера',
    'meeting.share': 'Демонстрация',
    'meeting.record': 'Запись',
    'meeting.hand': 'Рука',
    'meeting.chat': 'Чат',
    'meeting.participants': 'Участники',
    'meeting.leave': 'Выйти',
    'meeting.e2e': 'E2E',
    'meeting.live': 'LIVE',
    'meeting.you': '(Вы)',
    'meeting.host': 'Ведущий',
    'meeting.speakerView': 'Спикер',
    'meeting.gridView': 'Сетка',
    'meeting.noCamera': 'Камера отключена',
    'meeting.connecting': 'Подключение...',
    'meeting.recording': 'Запись идёт',
    'meeting.screenSharing': 'Демонстрация экрана',
    'meeting.reaction': 'Реакция',
    'meeting.more': 'Ещё',
    'meeting.anonymous': 'Аноним',
    'meeting.copyLink': 'Копировать ссылку',

    // Meeting toasts
    'toast.joined': 'присоединился',
    'toast.left': 'вышел',
    'toast.reconnected': 'Соединение восстановлено',
    'toast.mediaError': 'Ошибка подключения к медиа-серверу',
    'toast.muted': 'Ведущий отключил ваш микрофон',
    'toast.roomClosed': 'Организатор завершил встречу',
    'toast.screenShareError': 'Не удалось включить демонстрацию экрана',

    // Meeting page
    'meetingPage.notFound': 'Встреча не найдена',
    'meetingPage.notFoundDesc': 'Эта встреча завершена или ссылка недействительна',
    'meetingPage.goHome': 'На главную',

    // Leave modal
    'leave.title': 'Покинуть встречу?',
    'leave.description': 'Вы будете отключены от звонка',
    'leave.stay': 'Остаться',
    'leave.confirm': 'Выйти',

    // Connection
    'connection.connecting': 'Подключение...',
    'connection.reconnecting': 'Переподключение...',
    'connection.lost': 'Соединение потеряно',

    // Chat
    'chat.title': 'Чат',
    'chat.empty': 'Сообщений пока нет',
    'chat.placeholder': 'Сообщение...',
  },

  en: {
    // App
    'app.title': 'Lumina',

    // Landing
    'landing.create': 'New meeting',
    'landing.join': 'Join',
    'landing.enter': 'Enter',
    'landing.copy': 'Copy',
    'landing.copied': 'Copied',
    'landing.error.create': 'Failed to create room',
    'landing.error.noLink': 'No meeting link in clipboard',
    'landing.error.expired': 'Meeting ended or link is invalid',
    'landing.error.clipboard': 'Copy a meeting link and try again',

    // PreJoin
    'prejoin.title': 'Setup before joining',
    'prejoin.name': 'Your name',
    'prejoin.namePlaceholder': 'Enter name',
    'prejoin.nameHint': 'Leave empty for a random name',
    'prejoin.join': 'Join room',
    'prejoin.camera': 'Camera',
    'prejoin.mic': 'Microphone',
    'prejoin.room': 'Room:',

    // Meeting
    'meeting.mute': 'Microphone',
    'meeting.camera': 'Camera',
    'meeting.share': 'Screen share',
    'meeting.record': 'Record',
    'meeting.hand': 'Raise hand',
    'meeting.chat': 'Chat',
    'meeting.participants': 'Participants',
    'meeting.leave': 'Leave',
    'meeting.e2e': 'E2E',
    'meeting.live': 'LIVE',
    'meeting.you': '(You)',
    'meeting.host': 'Host',
    'meeting.speakerView': 'Speaker',
    'meeting.gridView': 'Grid',
    'meeting.noCamera': 'Camera off',
    'meeting.connecting': 'Connecting...',
    'meeting.recording': 'Recording',
    'meeting.screenSharing': 'Screen sharing',
    'meeting.reaction': 'Reaction',
    'meeting.more': 'More',
    'meeting.anonymous': 'Anonymous',
    'meeting.copyLink': 'Copy link',

    // Meeting toasts
    'toast.joined': 'joined',
    'toast.left': 'left',
    'toast.reconnected': 'Connection restored',
    'toast.mediaError': 'Failed to connect to media server',
    'toast.muted': 'Host muted your microphone',
    'toast.roomClosed': 'Host ended the meeting',
    'toast.screenShareError': 'Failed to start screen share',

    // Meeting page
    'meetingPage.notFound': 'Meeting not found',
    'meetingPage.notFoundDesc': 'This meeting has ended or the link is invalid',
    'meetingPage.goHome': 'Go home',

    // Leave modal
    'leave.title': 'Leave meeting?',
    'leave.description': 'You will be disconnected from the call',
    'leave.stay': 'Stay',
    'leave.confirm': 'Leave',

    // Connection
    'connection.connecting': 'Connecting...',
    'connection.reconnecting': 'Reconnecting...',
    'connection.lost': 'Connection lost',

    // Chat
    'chat.title': 'Chat',
    'chat.empty': 'No messages yet',
    'chat.placeholder': 'Message...',
  },
};

function detectLocale(): Locale {
  const lang = navigator.language.slice(0, 2).toLowerCase();
  return lang === 'ru' ? 'ru' : 'en';
}

let currentLocale: Locale = detectLocale();

export function t(key: string): string {
  return translations[currentLocale][key] || translations.en[key] || key;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale) {
  currentLocale = locale;
}
