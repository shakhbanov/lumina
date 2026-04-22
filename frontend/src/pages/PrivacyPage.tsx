import { Link } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { Meta, type PageMeta } from '../components/seo/Meta';

export const meta: PageMeta = {
  title: 'Политика конфиденциальности Lumina',
  description:
    'Политика обработки персональных данных Lumina. Какие данные собираются, как защищаются, сколько хранятся. Соответствие 152-ФЗ «О персональных данных».',
  canonical: 'https://lumina.su/privacy',
  alternates: [
    { lang: 'ru', href: 'https://lumina.su/privacy' },
    { lang: 'en', href: 'https://lumina.su/privacy?lang=en' },
    { lang: 'x-default', href: 'https://lumina.su/privacy' },
  ],
  jsonLd: [
    {
      '@context': 'https://schema.org',
      '@type': 'PrivacyPolicy',
      name: 'Политика конфиденциальности Lumina',
      url: 'https://lumina.su/privacy',
      inLanguage: 'ru-RU',
      isPartOf: { '@id': 'https://lumina.su/#website' },
      datePublished: '2026-04-22',
      dateModified: '2026-04-22',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Главная', item: 'https://lumina.su/' },
        { '@type': 'ListItem', position: 2, name: 'Политика конфиденциальности', item: 'https://lumina.su/privacy' },
      ],
    },
  ],
};

export function PrivacyPage() {
  return (
    <PageLayout
      heroTitle="Политика конфиденциальности Lumina"
      heroLead="Документ описывает, какие данные сервис lumina.su собирает, как их защищает и сколько хранит. Последняя редакция: 22 апреля 2026 года."
    >
      <Meta {...meta} />

      {/*
        TODO: Требует проверки юристом под 152-ФЗ и GDPR перед публикацией.
        Владелец подтверждает финальную редакцию. Ниже — рабочий черновик
        на основе реальной архитектуры Lumina (см. backend/lumina-server,
        deploy/nginx/lumina.conf). Не публиковать без ревью.
      */}
      <article className="prose-lumina mt-8 space-y-8 text-[var(--text-secondary)] leading-relaxed">
        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">1. Общие положения</h2>
          <p>
            Настоящая Политика конфиденциальности (далее — «Политика»)
            применяется к сервису Lumina, доступному по адресу https://lumina.su
            (далее — «Сервис»). Политика составлена в соответствии с
            Федеральным законом от 27 июля 2006 г. №152-ФЗ «О персональных
            данных» и определяет порядок обработки персональных данных
            пользователей Сервиса и меры по обеспечению их безопасности.
          </p>
          <p>
            Продолжая пользоваться Сервисом, пользователь подтверждает, что
            ознакомлен с Политикой и принимает её.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">2. Оператор персональных данных</h2>
          <p>
            Оператором в смысле 152-ФЗ является владелец домена lumina.su.
            Контакты для запросов о персональных данных:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Электронная почта: admin@lumina.su</li>
            <li>Контакт по вопросам безопасности: security@lumina.su</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">3. Какие данные мы обрабатываем</h2>
          <p>Сервис разработан так, чтобы собирать минимум данных, необходимых для работы. Мы обрабатываем следующие категории сведений:</p>
          <h3 className="text-lg font-semibold text-white mt-4 mb-2">3.1 Данные встречи (room state)</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Сгенерированный на сервере код комнаты (например, «abc12345»).</li>
            <li>Серверный идентификатор участника, сгенерированный при входе.</li>
            <li>Время создания и последней активности комнаты.</li>
            <li>Количество участников в данный момент.</li>
          </ul>
          <p>Эти данные хранятся в Redis и автоматически удаляются по истечении TTL (по умолчанию 24 часа неактивности).</p>

          <h3 className="text-lg font-semibold text-white mt-4 mb-2">3.2 Сигнальный трафик</h3>
          <p>Сервер получает сигнальные сообщения WebSocket (подключение, отключение, изменение состояния мультимедиа, чат). Содержимое чата проходит через сервер для ретрансляции, но авторство каждой записи переписывается из JWT — клиент не может подменить отправителя.</p>

          <h3 className="text-lg font-semibold text-white mt-4 mb-2">3.3 Медиапотоки (видео, аудио, демонстрация экрана)</h3>
          <p>Медиа-потоки передаются через SFU LiveKit. При включённом E2E-шифровании они зашифрованы ключом, который сгенерирован в браузере и хранится во фрагменте URL. Сервер получает только зашифрованные пакеты и не имеет доступа к содержимому звонка.</p>

          <h3 className="text-lg font-semibold text-white mt-4 mb-2">3.4 Технические журналы</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>IP-адрес, User-Agent, URL запроса, код ответа, размер ответа.</li>
            <li>Время запроса и длительность обработки.</li>
          </ul>
          <p>Эти данные необходимы для защиты от автоматизированных атак (rate-limit, обнаружение ботов) и диагностики. Журналы nginx хранятся не дольше 30 дней и удаляются по ротации.</p>

          <h3 className="text-lg font-semibold text-white mt-4 mb-2">3.5 Веб-аналитика</h3>
          <p>На публичных страницах lumina.su используется Яндекс.Метрика (счётчик 108160396). Метрика собирает обезличенные данные о визитах: страница, реферер, устройство, поведение на странице. Встречи (страницы /room/...) в аналитике не отслеживаются отдельно. Вы можете отключить сбор данных через стандартные механизмы браузера (Do Not Track, блокировщики) или полностью отказаться от Метрики в self-hosted-сборке Lumina.</p>

          <h3 className="text-lg font-semibold text-white mt-4 mb-2">3.6 Что мы НЕ собираем</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Имя, email, номер телефона, адрес — Сервис не требует регистрации.</li>
            <li>Содержимое ваших звонков при включённом E2E.</li>
            <li>Постоянный идентификатор устройства или профиля.</li>
            <li>Данные геолокации сверх того, что уже содержит IP-адрес.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">4. Цели обработки</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Обеспечение работы Сервиса (создание, поддержание и закрытие комнат).</li>
            <li>Защита от злоупотреблений (rate-limit, обнаружение ботов и DDoS).</li>
            <li>Анализ использования Сервиса в агрегированном виде (статистика посещений).</li>
            <li>Исполнение требований закона при получении соответствующих запросов от уполномоченных органов.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">5. Правовые основания</h2>
          <p>Обработка данных ведётся на следующих основаниях:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Согласие пользователя, выраженное началом использования Сервиса.</li>
            <li>Законный интерес оператора в обеспечении безопасности и работоспособности Сервиса.</li>
            <li>Исполнение требований применимого законодательства.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">6. Хранение и сроки</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Данные о комнате и идентификаторы участников — до 24 часов неактивности (<code>ROOM_TTL_SECS</code>), затем удаляются автоматически.</li>
            <li>Журналы nginx и backend — не более 30 дней, с ротацией.</li>
            <li>Данные Яндекс.Метрики — в соответствии с политикой Яндекса.</li>
            <li>Персональные данные, полученные через почту admin@lumina.su или security@lumina.su, — до закрытия запроса, максимум 3 года.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">7. Меры защиты</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Шифрование трафика: TLS 1.3, HSTS preload, HTTP/2.</li>
            <li>End-to-end шифрование содержимого встречи ключом из URL-фрагмента.</li>
            <li>Строгая CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff.</li>
            <li>Rate-limit на API и WebSocket, token-bucket в backend, connection-limit на nginx.</li>
            <li>Переписывание идентичности отправителя чата и сигналов на сервере из подписанного JWT.</li>
            <li>Секреты (JWT, TURN, LiveKit API) — минимум 32 байта, файлы `.env` с режимом 0600.</li>
            <li>Регулярное обновление зависимостей и мониторинг уязвимостей.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">8. Передача данных третьим лицам</h2>
          <p>Мы не продаём и не передаём персональные данные третьим лицам, кроме случаев:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Передача обезличенной аналитики в Яндекс.Метрику (см. п. 3.5).</li>
            <li>Исполнение законного запроса уполномоченного органа в соответствии с применимым правом.</li>
            <li>Вынужденное раскрытие для защиты прав Оператора в случае угрозы жизни, здоровью или имуществу.</li>
          </ul>
          <p>При необходимости передачи данных за пределы Российской Федерации применяется статья 12 Федерального закона 152-ФЗ.</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">9. Права субъекта персональных данных</h2>
          <p>В соответствии с 152-ФЗ пользователь вправе:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Получить подтверждение факта обработки своих данных.</li>
            <li>Получить информацию о целях, способах и сроках обработки.</li>
            <li>Потребовать уточнения, блокирования или уничтожения своих данных, если они неполные, устаревшие, неточные или неправомерно полученные.</li>
            <li>Отозвать согласие на обработку.</li>
            <li>Обжаловать действия Оператора в Роскомнадзоре или в суде.</li>
          </ul>
          <p>Обращения по этим правам направляйте на admin@lumina.su. Мы рассматриваем запросы в срок до 30 дней.</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">10. Cookies и локальное хранилище</h2>
          <p>Сервис использует:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><code>sessionStorage</code> браузера для временного хранения одноразового creator-токена между созданием встречи и входом в неё.</li>
            <li>Cookie Яндекс.Метрики (см. п. 3.5).</li>
            <li>Кэш Service Worker для офлайн-работы PWA.</li>
          </ul>
          <p>Сервис не использует сторонние рекламные куки.</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">11. Дети</h2>
          <p>Сервис не предназначен для использования лицами младше 14 лет без согласия родителей или законных представителей. Если вы знаете, что ребёнок младше 14 лет предоставил нам персональные данные без такого согласия, напишите на admin@lumina.su, и мы удалим эти данные.</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">12. Изменения Политики</h2>
          <p>Оператор вправе изменять Политику. Новая редакция публикуется по этому адресу с обновлением даты редакции. Продолжение использования Сервиса после публикации новой редакции означает согласие с ней.</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">13. Связанные документы</h2>
          <p>См. также <Link to="/terms" className="underline">Условия использования</Link> и <Link to="/about" className="underline">страницу о сервисе</Link>. Security-отчёты отправляйте согласно <code>/.well-known/security.txt</code>.</p>
        </section>
      </article>
    </PageLayout>
  );
}
