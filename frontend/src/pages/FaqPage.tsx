import { PageLayout } from '../components/layout/PageLayout';
import { Meta, type PageMeta } from '../components/seo/Meta';

interface QA {
  q: string;
  a: string;
}

const faqs: QA[] = [
  {
    q: 'Что такое Lumina и зачем она нужна?',
    a: 'Lumina — self-hosted сервис видеозвонков и конференций с end-to-end шифрованием. Сервис бесплатный, не требует регистрации, работает в браузере и как PWA. Её можно использовать как публичный сервис на lumina.su или развернуть на собственном сервере из открытого исходного кода.',
  },
  {
    q: 'Нужно ли регистрироваться, чтобы провести встречу?',
    a: 'Нет. Организатор открывает lumina.su, нажимает «Новая встреча», получает одноразовую ссылку и отдаёт её собеседнику. Никаких учётных записей, номеров телефона или email.',
  },
  {
    q: 'Есть ли лимит по длительности встречи?',
    a: 'Нет, Lumina не ограничивает длительность встреч. В отличие от Zoom (40 минут на бесплатном тарифе) и Google Meet (60 минут), вы можете говорить часами.',
  },
  {
    q: 'Сколько участников помещается в одну встречу?',
    a: 'По умолчанию в одной комнате может быть до 100 участников. Это хард-лимит, который можно поднять или опустить переменной окружения MAX_PARTICIPANTS при self-hosted развёртывании.',
  },
  {
    q: 'Как работает end-to-end шифрование в Lumina?',
    a: 'Когда вы создаёте встречу, браузер генерирует 256-битный ключ через crypto.getRandomValues и кладёт его во фрагмент URL (часть после #). Фрагмент URL по протоколу HTTP никогда не отправляется на сервер, поэтому ключ остаётся только у участников. Все медиапотоки шифруются этим ключом до отправки на SFU и расшифровываются уже на стороне получателя.',
  },
  {
    q: 'Видит ли администратор сервера содержимое встречи?',
    a: 'Нет. Сервер получает только зашифрованные пакеты. Даже если кто-то получит доступ к серверу или базе Redis, он не сможет прослушать звонки без ключа из фрагмента URL.',
  },
  {
    q: 'Поддерживает ли Lumina демонстрацию экрана?',
    a: 'Да. В панели инструментов встречи есть кнопка «Демонстрация» — она включает стандартный запрос браузера на трансляцию окна, вкладки или всего экрана. Поддерживается в Chrome, Edge, Safari, Firefox, Samsung Internet.',
  },
  {
    q: 'Есть ли чат и реакции?',
    a: 'Да. Встроенный чат поддерживает базовую Markdown-разметку (ссылки, жирный, курсив), реакции представлены шестью эмодзи (👍 👏 😂 ❤️ 🎉 🤔) и кнопкой поднятия руки.',
  },
  {
    q: 'Можно ли записать встречу?',
    a: 'Да, поддерживается локальная запись встречи со стороны участника — Lumina не записывает звонки на сервер, поэтому запись остаётся полностью приватной. Видимость «LIVE» и статус записи отображаются в шапке для всех участников.',
  },
  {
    q: 'Как установить Lumina на iPhone, Android или компьютер?',
    a: 'Lumina — это Progressive Web App. На iPhone откройте lumina.su в Safari и выберите «На экран „Домой"». На Android — «Установить приложение» из меню Chrome. На компьютере — значок установки в адресной строке Chrome или Edge. Подробная инструкция есть на странице /install.',
  },
  {
    q: 'Работает ли Lumina на iPhone и iPad?',
    a: 'Да, в Safari. Для установки в качестве приложения используйте именно Safari — Chrome на iOS не поддерживает установку PWA, потому что Apple запрещает сторонние движки.',
  },
  {
    q: 'Lumina — это российский сервис? Где размещены серверы?',
    a: 'Публичный сервис на lumina.su размещается на серверах в Российской Федерации. Для self-hosted-инсталляций выбор страны за вами. Для публичного сервиса применяется 152-ФЗ «О персональных данных».',
  },
  {
    q: 'Какие браузеры поддерживаются?',
    a: 'Любой современный браузер с поддержкой WebRTC: Chrome, Edge, Firefox, Safari, Samsung Internet, Opera. Internet Explorer не поддерживается.',
  },
  {
    q: 'Чем Lumina отличается от Jitsi Meet?',
    a: 'Jitsi — тоже self-hosted-проект. Отличия Lumina: обязательное E2E-шифрование через ключ в URL-фрагменте (в Jitsi E2E опционально и работает не во всех браузерах), строгая CSP и HSTS preload на edge, бэкенд на Rust с token-bucket rate-limit, и минимальный UI без перегруженных настроек.',
  },
  {
    q: 'Можно ли использовать Lumina для корпоративных встреч?',
    a: 'Да. Для корпоративных сценариев мы рекомендуем self-hosted-развёртывание: устанавливаете Lumina на свой сервер, закрываете доступ по VPN или через HTTP Basic Auth в nginx, и получаете полный контроль над инфраструктурой. Для приватных сценариев E2E-шифрование делает невозможным прослушивание даже администратором сервера.',
  },
  {
    q: 'Сколько это стоит?',
    a: 'Публичный сервис на lumina.su — бесплатный. Self-hosted-сборка также бесплатна, но вы платите за VPS, доменное имя и TLS-сертификат (Let\'s Encrypt — бесплатный). На практике VPS за 500–1500 ₽/месяц тянет десятки одновременных встреч.',
  },
  {
    q: 'Как обратиться за поддержкой или сообщить о найденной уязвимости?',
    a: 'Общие вопросы — admin@lumina.su. Security-отчёты — security@lumina.su (см. /.well-known/security.txt). Для обсуждения функций и багов открывайте issues на GitHub: github.com/shakhbanov/lumina.',
  },
];

export const meta: PageMeta = {
  title: 'FAQ Lumina — ответы о защищённых видеозвонках',
  description:
    'Как работает E2E-шифрование, сколько участников помещается во встрече, поддерживается ли iPhone, чем Lumina отличается от Zoom, Jitsi и Google Meet — 17 ответов на типичные вопросы.',
  canonical: 'https://lumina.su/faq',
  alternates: [
    { lang: 'ru', href: 'https://lumina.su/faq' },
    { lang: 'en', href: 'https://lumina.su/faq?lang=en' },
    { lang: 'x-default', href: 'https://lumina.su/faq' },
  ],
  jsonLd: [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Главная', item: 'https://lumina.su/' },
        { '@type': 'ListItem', position: 2, name: 'FAQ', item: 'https://lumina.su/faq' },
      ],
    },
  ],
};

export function FaqPage() {
  return (
    <PageLayout
      heroTitle="Вопросы и ответы о Lumina"
      heroLead="Разбор самых частых вопросов о защищённых видеозвонках Lumina: шифрование, установка, сценарии использования, ограничения."
    >
      <Meta {...meta} />

      <div className="mt-8 divide-y divide-[var(--border)]/40">
        {faqs.map((f) => (
          <details key={f.q} className="py-5 group" name="faq">
            <summary className="cursor-pointer list-none flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold text-white group-hover:text-white/90">{f.q}</h2>
              <span className="shrink-0 mt-1 text-[var(--text-secondary)] group-open:rotate-45 transition">+</span>
            </summary>
            <p className="mt-3 text-[var(--text-secondary)] leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </PageLayout>
  );
}
