import { Link } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { Meta, type PageMeta } from '../components/seo/Meta';

export const meta: PageMeta = {
  title: 'О Lumina — self-hosted платформа видеозвонков с E2E',
  description:
    'Lumina — self-hosted сервис видеозвонков и конференций с end-to-end шифрованием. Открытый код, размещение в России, без регистрации и без лимита времени.',
  canonical: 'https://lumina.su/about',
  alternates: [
    { lang: 'ru', href: 'https://lumina.su/about' },
    { lang: 'en', href: 'https://lumina.su/about?lang=en' },
    { lang: 'x-default', href: 'https://lumina.su/about' },
  ],
  jsonLd: [
    {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: 'О Lumina',
      url: 'https://lumina.su/about',
      inLanguage: 'ru-RU',
      isPartOf: { '@id': 'https://lumina.su/#website' },
      about: { '@id': 'https://lumina.su/#software' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Главная', item: 'https://lumina.su/' },
        { '@type': 'ListItem', position: 2, name: 'О Lumina', item: 'https://lumina.su/about' },
      ],
    },
  ],
};

export function AboutPage() {
  return (
    <PageLayout
      heroTitle="О Lumina — self-hosted платформа видеозвонков"
      heroLead="Lumina — это сервис защищённых видеовстреч, который вы можете использовать на lumina.su или развернуть на собственном сервере. Открытый код, end-to-end шифрование, никаких трекеров третьих сторон и никакой регистрации."
    >
      <Meta {...meta} />

      <article className="prose-lumina mt-8 space-y-10">
        <section>
          <h2 className="text-2xl font-semibold mb-3">Зачем нужна ещё одна платформа видеозвонков</h2>
          <p>
            Корпоративные сервисы видеоконференций закрыты, требуют учётную
            запись, навязывают мобильные приложения, ограничивают длительность
            встречи и собирают неограниченную телеметрию. Для личного общения,
            удалённой работы и онлайн-образования всё это лишнее. Нужна
            платформа, где встречу можно создать за секунду, отдать ссылку
            собеседнику и забыть — без лимитов, без профилей, без трекеров.
          </p>
          <p>
            Lumina сделана как раз для этого. Любой участник открывает
            lumina.su, нажимает «Новая встреча», получает ссылку и делится ей.
            Встреча работает прямо в браузере, без установки приложения — а
            если хотите, ставится как Progressive Web App за один клик.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Шифрование и приватность</h2>
          <p>
            Медиапотоки в Lumina передаются через SFU (LiveKit), а ключ
            шифрования генерируется в браузере и хранится во фрагменте URL
            (<code>#key=…</code>). Фрагмент URL никогда не отправляется на
            сервер — это базовое свойство HTTP. Поэтому сервер видит только
            зашифрованные пакеты и не может прослушать встречу, даже если его
            скомпрометируют.
          </p>
          <p>
            Сигнальный канал, чат и сообщения о подключении проходят через
            наш backend на Rust (axum), но каждая запись, идущая на запись в
            Redis, переподписывается сервером — клиент не может подменить
            идентичность. Администратор сервера не имеет доступа к
            содержимому звонка.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Архитектура в одной картинке</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Frontend:</strong> React 19 + TypeScript + Vite, Progressive Web App с offline-режимом.</li>
            <li><strong>Signalling:</strong> Rust axum-сервер, Redis для состояния комнат и fan-out между нодами.</li>
            <li><strong>Media:</strong> LiveKit SFU на той же машине (systemd), порт 7880 сигнал, 50000-60000 UDP для медиа.</li>
            <li><strong>TURN:</strong> встроенный TURN LiveKit + опциональный coturn на 3478 UDP / 5349 TLS.</li>
            <li><strong>Edge:</strong> nginx с HTTP/2, строгой CSP, HSTS preload, `limit_req` и закрытой LiveKit admin plane.</li>
            <li><strong>Лицензия и код:</strong> опубликованы на <a href="https://github.com/shakhbanov/lumina" target="_blank" rel="noopener" className="underline">GitHub</a>.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Принципы, которых мы держимся</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Self-hosted по умолчанию.</strong> Один скрипт ставит Lumina на чистую Ubuntu 22.04+. Вся инфраструктура — ваша.</li>
            <li><strong>Минимум телеметрии.</strong> Единственный внешний скрипт — Яндекс.Метрика на lumina.su. В self-hosted-сборках её можно убрать одной правкой.</li>
            <li><strong>Без учётных записей.</strong> Нет регистрации, нет email, нет идентификатора устройства. Участники присоединяются по одноразовой ссылке.</li>
            <li><strong>Правила сервера жёстче клиента.</strong> Backend переписывает отправителя сообщений из JWT — клиент не может притвориться другим участником.</li>
            <li><strong>Открытый код.</strong> Исходники публичны. Любой может проверить архитектуру безопасности или развернуть копию.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Для кого Lumina</h2>
          <p>
            Мы делаем Lumina для небольших и средних команд, учителей и
            репетиторов, HR-специалистов, врачей на онлайн-консультациях,
            журналистов, студентов и семей, которым надо поговорить по
            видеосвязи без лишних хлопот. Lumina подходит для встреч до 100
            человек в одной комнате; на выделенном VPS мы уверенно держим
            десятки одновременных комнат.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Как попробовать</h2>
          <p>
            Просто откройте <Link to="/" className="underline">главную</Link>,
            нажмите «Новая встреча» и поделитесь ссылкой. Если хотите поднять
            собственный сервер — смотрите инструкцию в{' '}
            <a href="https://github.com/shakhbanov/lumina" target="_blank" rel="noopener" className="underline">
              репозитории на GitHub
            </a>
            . Там же есть полный список параметров, архитектурные решения и
            security-раздел.
          </p>
          <p>
            Если нужно установить Lumina как приложение — перейдите на{' '}
            <Link to="/install" className="underline">страницу установки</Link>,
            где расписаны шаги для iOS, Android, Windows, macOS и Linux.
          </p>
        </section>
      </article>
    </PageLayout>
  );
}
