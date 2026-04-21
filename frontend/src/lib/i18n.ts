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

    // PWA install
    'install.cta': 'Установить приложение',
    'install.title': 'Установить Lumina',
    'install.subtitle': 'Работает офлайн, открывает ссылки напрямую в приложении, без адресной строки.',
    'install.button': 'Установить',
    'install.installed': 'Приложение установлено',
    'install.close': 'Готово',
    'install.ios.title': 'На iPhone и iPad',
    'install.ios.step1': 'Откройте lumina.su в Safari (не в Chrome и не в других браузерах).',
    'install.ios.step2': 'Нажмите кнопку «Поделиться» внизу экрана (квадрат со стрелкой вверх).',
    'install.ios.step3': 'Выберите «На экран «Домой»» и подтвердите добавление.',
    'install.ios.step4': 'Открывайте Lumina с главного экрана — ссылки на встречи попросите присылать, затем открывайте уже внутри приложения. Apple не умеет автоматически передавать ссылку в установленное PWA.',
    'install.android.title': 'На Android',
    'install.android.step1': 'Откройте lumina.su в Chrome, Samsung Internet или Edge.',
    'install.android.step2': 'Нажмите кнопку «Установить» ниже. Если она не появилась — откройте меню браузера и выберите «Установить приложение» / «Добавить на главный экран».',
    'install.android.step3': 'Теперь ссылки вида lumina.su/room/... будут открываться сразу в приложении.',
    'install.desktop.title': 'На компьютере',
    'install.desktop.step1': 'В Chrome или Edge нажмите значок установки в правой части адресной строки.',
    'install.desktop.step2': 'Подтвердите установку — приложение появится в списке программ.',
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

    // PWA install
    'install.cta': 'Install app',
    'install.title': 'Install Lumina',
    'install.subtitle': 'Works offline and opens meeting links straight in the app, without the address bar.',
    'install.button': 'Install',
    'install.installed': 'App already installed',
    'install.close': 'Done',
    'install.ios.title': 'On iPhone and iPad',
    'install.ios.step1': 'Open lumina.su in Safari (not Chrome or any other browser).',
    'install.ios.step2': 'Tap the Share button at the bottom of the screen (square with an up arrow).',
    'install.ios.step3': 'Choose "Add to Home Screen" and confirm.',
    'install.ios.step4': 'Open Lumina from the home screen. For meeting links, ask the sender to share the URL and then paste/open it inside the app — Apple does not auto-route links into installed PWAs.',
    'install.android.title': 'On Android',
    'install.android.step1': 'Open lumina.su in Chrome, Samsung Internet, or Edge.',
    'install.android.step2': 'Tap the Install button below. If it is missing, open the browser menu and pick "Install app" / "Add to home screen".',
    'install.android.step3': 'From now on lumina.su/room/... links will open directly in the app.',
    'install.desktop.title': 'On desktop',
    'install.desktop.step1': 'In Chrome or Edge click the install icon on the right side of the address bar.',
    'install.desktop.step2': 'Confirm — the app will appear in your application list.',
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
