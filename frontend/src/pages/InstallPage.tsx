import { Link } from 'react-router-dom';
import { Apple, Smartphone, Monitor } from 'lucide-react';
import { PageLayout } from '../components/layout/PageLayout';
import { Meta, type PageMeta } from '../components/seo/Meta';

export const meta: PageMeta = {
  title: 'Установка Lumina — iPhone, Android, Windows, Mac, Linux',
  description:
    'Пошаговая инструкция по установке Lumina как приложения (PWA) на iPhone, iPad, Android-смартфон, Windows, macOS и Linux. Работает офлайн, открывает ссылки напрямую.',
  canonical: 'https://lumina.su/install',
  alternates: [
    { lang: 'ru', href: 'https://lumina.su/install' },
    { lang: 'en', href: 'https://lumina.su/install?lang=en' },
    { lang: 'x-default', href: 'https://lumina.su/install' },
  ],
  jsonLd: [
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'Как установить Lumina как Progressive Web App',
      description:
        'Инструкция по установке Lumina на iOS, Android и десктопные браузеры.',
      supply: [{ '@type': 'HowToSupply', name: 'Современный браузер с поддержкой PWA' }],
      tool: [{ '@type': 'HowToTool', name: 'Safari, Chrome, Edge или Samsung Internet' }],
      step: [
        {
          '@type': 'HowToStep',
          name: 'Установка на iPhone и iPad',
          text: 'Откройте lumina.su в Safari. Нажмите кнопку «Поделиться», выберите «На экран „Домой"» и подтвердите. Lumina появится как отдельное приложение.',
          url: 'https://lumina.su/install#ios',
        },
        {
          '@type': 'HowToStep',
          name: 'Установка на Android',
          text: 'Откройте lumina.su в Chrome, Samsung Internet или Edge. Нажмите «Установить приложение» в меню браузера или используйте appearing install prompt. Ссылки lumina.su/room/... будут открываться в приложении.',
          url: 'https://lumina.su/install#android',
        },
        {
          '@type': 'HowToStep',
          name: 'Установка на компьютере',
          text: 'В Chrome или Edge нажмите значок установки в правой части адресной строки. Подтвердите — приложение появится в списке программ Windows, macOS или Linux.',
          url: 'https://lumina.su/install#desktop',
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Главная', item: 'https://lumina.su/' },
        { '@type': 'ListItem', position: 2, name: 'Установка', item: 'https://lumina.su/install' },
      ],
    },
  ],
};

export function InstallPage() {
  return (
    <PageLayout
      heroTitle="Как установить Lumina на iPhone, Android и компьютер"
      heroLead="Lumina — это Progressive Web App. Устанавливается за один клик из браузера, работает офлайн, открывает ссылки на встречи напрямую в приложении, без адресной строки."
    >
      <Meta {...meta} />

      <div className="mt-4 grid gap-8">
        <section id="why" className="rounded-2xl border border-[var(--border)]/60 p-6 bg-[var(--bg-secondary)]/40">
          <h2 className="text-xl font-semibold mb-3">Что даёт установка в виде приложения</h2>
          <ul className="list-disc pl-6 space-y-1.5 text-[var(--text-secondary)]">
            <li>Lumina открывается в отдельном окне без адресной строки и вкладок.</li>
            <li>Ссылки вида <code>lumina.su/room/…</code> открываются сразу в установленном приложении (на Android и десктопе).</li>
            <li>Базовая оболочка кэшируется — вход во встречу происходит даже при слабом интернете.</li>
            <li>Установка не требует App Store или Google Play, не запрашивает разрешений, не оставляет фоновых процессов.</li>
          </ul>
        </section>

        <section id="ios" className="rounded-2xl border border-[var(--border)]/60 p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Apple className="w-5 h-5 text-[var(--accent)]" /> На iPhone и iPad
          </h2>
          <ol className="list-decimal pl-6 space-y-2 text-[var(--text-secondary)] leading-relaxed">
            <li>Откройте <strong>lumina.su в Safari</strong>. На iOS только Safari поддерживает установку PWA — Chrome, Firefox и прочие не работают из-за политики Apple.</li>
            <li>Нажмите кнопку «Поделиться» внизу экрана (квадрат со стрелкой вверх).</li>
            <li>Прокрутите список действий и выберите «На экран „Домой"».</li>
            <li>Подтвердите добавление. Lumina появится на домашнем экране как отдельное приложение.</li>
            <li>Открывайте Lumina с домашнего экрана. Чтобы войти во встречу, попросите отправителя прислать ссылку, скопируйте её и откройте уже внутри приложения — Apple не умеет автоматически передавать внешние ссылки в установленное PWA.</li>
          </ol>
        </section>

        <section id="android" className="rounded-2xl border border-[var(--border)]/60 p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-[var(--accent)]" /> На Android
          </h2>
          <ol className="list-decimal pl-6 space-y-2 text-[var(--text-secondary)] leading-relaxed">
            <li>Откройте <strong>lumina.su</strong> в Chrome, Samsung Internet или Edge.</li>
            <li>Нажмите кнопку «Установить приложение» — она появляется в виде баннера или в меню браузера («Установить приложение» / «Добавить на главный экран»).</li>
            <li>Подтвердите установку. Иконка Lumina появится на домашнем экране и в списке приложений.</li>
            <li>Теперь ссылки <code>lumina.su/room/…</code> будут открываться сразу в приложении благодаря `handle_links: preferred` и `launch_handler: navigate-existing`.</li>
          </ol>
        </section>

        <section id="desktop" className="rounded-2xl border border-[var(--border)]/60 p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-[var(--accent)]" /> На компьютере (Windows, macOS, Linux)
          </h2>
          <ol className="list-decimal pl-6 space-y-2 text-[var(--text-secondary)] leading-relaxed">
            <li>Откройте lumina.su в Chrome или Edge.</li>
            <li>В правой части адресной строки нажмите значок установки (монитор со стрелкой). В Chrome может быть в меню ⋮ → «Установить Lumina…».</li>
            <li>Подтвердите установку. Lumina появится в списке программ — в Start Menu на Windows, Applications на macOS, в лаунчере на Linux.</li>
            <li>По умолчанию приложение открывается в отдельном окне без адресной строки и вкладок, как обычная десктопная программа.</li>
          </ol>
        </section>

        <section id="troubleshooting" className="rounded-2xl border border-[var(--border)]/60 p-6">
          <h2 className="text-xl font-semibold mb-3">Что делать, если установка не получается</h2>
          <ul className="list-disc pl-6 space-y-2 text-[var(--text-secondary)] leading-relaxed">
            <li>Убедитесь, что сайт открыт по HTTPS. На lumina.su это всегда так; в self-hosted-развёртывании PWA не работает по HTTP.</li>
            <li>Кнопка установки не появилась на Android — обновите Chrome до актуальной версии и откройте меню ⋮ → «Установить приложение».</li>
            <li>На iOS точно должен быть Safari. Если вы открываете сайт в Chrome или другом браузере, кнопка «На экран „Домой"» не сработает.</li>
            <li>На десктопе Firefox пока не поддерживает полноценную установку PWA — используйте Chrome, Edge или Opera.</li>
            <li>Не получается установить с корпоративного устройства — скорее всего, MDM-профиль запрещает установку приложений, обратитесь к администратору.</li>
          </ul>
        </section>

        <p className="text-sm text-[var(--text-secondary)]">
          Остались вопросы? Посмотрите <Link to="/faq" className="underline">FAQ</Link> или напишите нам на admin@lumina.su.
        </p>
      </div>
    </PageLayout>
  );
}
