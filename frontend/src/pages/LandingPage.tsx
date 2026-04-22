import { useReducer, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Video, ArrowRight, Plus, Copy, Check, Link as LinkIcon, Users, Download,
  Lock, MonitorUp, MessageSquare, Sparkles, Zap, Globe,
} from 'lucide-react';

import { createRoom, checkRoomExists } from '../lib/api';
import { t } from '../lib/i18n';
import { InstallModal } from '../components/pwa/InstallModal';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { SiteFooter } from '../components/layout/PageLayout';
import { Meta, type PageMeta } from '../components/seo/Meta';
import { GitHubStars } from '../components/social/GitHubStars';

interface State {
  loading: boolean;
  joining: boolean;
  error: string;
  createdLink: string;
  copied: boolean;
}

type Action =
  | { type: 'SET_LOADING'; value: boolean }
  | { type: 'SET_JOINING'; value: boolean }
  | { type: 'SET_ERROR'; value: string }
  | { type: 'SET_CREATED_LINK'; value: string }
  | { type: 'SET_COPIED'; value: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_LOADING': return { ...state, loading: action.value };
    case 'SET_JOINING': return { ...state, joining: action.value };
    case 'SET_ERROR': return { ...state, error: action.value };
    case 'SET_CREATED_LINK': return { ...state, createdLink: action.value };
    case 'SET_COPIED': return { ...state, copied: action.value };
  }
}

const initialState: State = {
  loading: false,
  joining: false,
  error: '',
  createdLink: '',
  copied: false,
};

interface MiniQA { q: string; a: string }

const miniFaq: MiniQA[] = [
  {
    q: 'Нужно ли регистрироваться?',
    a: 'Нет. Откройте lumina.su, нажмите «Новая встреча» и отправьте ссылку собеседнику.',
  },
  {
    q: 'Есть ли лимит на длительность?',
    a: 'Нет. Lumina не ограничивает продолжительность встреч — ни на бесплатной публичной версии, ни в self-hosted-сборке.',
  },
  {
    q: 'Как работает end-to-end шифрование?',
    a: 'Ключ генерируется в браузере через crypto.getRandomValues и передаётся во фрагменте URL. Фрагмент никогда не уходит на сервер, поэтому ключ есть только у участников.',
  },
  {
    q: 'Работает ли на iPhone и Android?',
    a: 'Да. В Safari на iOS и в Chrome / Samsung Internet / Edge на Android Lumina ставится как Progressive Web App за один клик.',
  },
  {
    q: 'Сколько стоит?',
    a: 'Бесплатно. Публичный сервис и исходный код для self-hosted развёртывания доступны без оплаты.',
  },
  {
    q: 'Чем Lumina отличается от Jitsi?',
    a: 'Lumina требует включённое E2E-шифрование, а не опциональное; edge-узел жёстче закрыт по CSP/HSTS; бэкенд написан на Rust и ограничивает скорость на уровне токен-бакета.',
  },
];

export const meta: PageMeta = {
  title: 'Lumina — защищённые видеозвонки с E2E-шифрованием',
  description:
    'Lumina — self-hosted видеозвонки и конференции с end-to-end шифрованием. Без регистрации, в браузере и как PWA. Бесплатная альтернатива Zoom и Google Meet.',
  canonical: 'https://lumina.su/',
  alternates: [
    { lang: 'ru', href: 'https://lumina.su/' },
    { lang: 'en', href: 'https://lumina.su/?lang=en' },
    { lang: 'x-default', href: 'https://lumina.su/' },
  ],
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: miniFaq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  },
};

export function LandingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [installOpen, setInstallOpen] = useState(false);
  const { installed, platform } = usePwaInstall();
  const showInstallCta = !installed && (platform === 'ios' || platform === 'android');

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      handleCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    dispatch({ type: 'SET_LOADING', value: true });
    dispatch({ type: 'SET_ERROR', value: '' });
    try {
      const { code, creatorToken } = await createRoom();
      sessionStorage.setItem(`lumina:creator:${code}`, creatorToken);
      const link = `${window.location.origin}/room/${code}`;
      dispatch({ type: 'SET_CREATED_LINK', value: link });
    } catch {
      dispatch({ type: 'SET_ERROR', value: t('landing.error.create') });
    } finally {
      dispatch({ type: 'SET_LOADING', value: false });
    }
  }

  async function handleJoin() {
    dispatch({ type: 'SET_JOINING', value: true });
    dispatch({ type: 'SET_ERROR', value: '' });
    try {
      const text = await navigator.clipboard.readText();
      const match = text.match(/\/room\/([a-z0-9]+)/i);
      if (!match) {
        dispatch({ type: 'SET_ERROR', value: t('landing.error.noLink') });
        dispatch({ type: 'SET_JOINING', value: false });
        return;
      }
      const code = match[1].toLowerCase();
      const exists = await checkRoomExists(code);
      if (exists) {
        navigate(`/room/${code}/preview`);
      } else {
        dispatch({ type: 'SET_ERROR', value: t('landing.error.expired') });
      }
    } catch {
      dispatch({ type: 'SET_ERROR', value: t('landing.error.clipboard') });
    } finally {
      dispatch({ type: 'SET_JOINING', value: false });
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(state.createdLink);
    dispatch({ type: 'SET_COPIED', value: true });
    setTimeout(() => dispatch({ type: 'SET_COPIED', value: false }), 2000);
  }

  function handleGoToRoom() {
    const match = state.createdLink.match(/\/room\/([a-z0-9]+)/);
    if (match) navigate(`/room/${match[1]}/preview`);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-white safe-top safe-bottom">
      <Meta {...meta} />

      {/* Top nav — hidden in installed PWA */}
      <header data-landing-chrome className="absolute top-0 left-0 right-0 z-10">
        <div className="max-w-5xl mx-auto px-5 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" aria-label="Lumina — главная">
            <span className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
              <Video className="w-4 h-4 text-white" />
            </span>
            <span className="font-semibold tracking-tight">Lumina</span>
          </Link>
          <nav aria-label="Основная" className="flex items-center gap-3 sm:gap-5 text-sm text-[var(--text-secondary)]">
            <Link to="/about" className="hidden sm:inline hover:text-white transition">О сервисе</Link>
            <Link to="/faq" className="hidden sm:inline hover:text-white transition">FAQ</Link>
            <Link to="/install" className="hidden sm:inline hover:text-white transition">Установка</Link>
            <GitHubStars />
          </nav>
        </div>
      </header>

      {/* Hero + CTA. In standalone PWA mode [data-landing-hero] goes full-height
          and the marketing H1 + subheadline below are hidden, leaving only
          logo + 2 action buttons. */}
      <section data-landing-hero className="flex-1 flex flex-col items-center justify-center px-5 pt-24 pb-10 text-center">
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent)] flex items-center justify-center">
            <Video className="w-7 h-7 text-white" />
          </div>
          <span className="text-3xl font-bold tracking-tight">{t('app.title')}</span>
        </div>

        <h1 data-landing-chrome className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight max-w-3xl">
          Защищённые видеозвонки с E2E-шифрованием
        </h1>
        <p data-landing-chrome className="mt-4 text-lg sm:text-xl text-[var(--text-secondary)] max-w-2xl">
          Self-hosted альтернатива Zoom и Google Meet. Без регистрации, без лимита времени, в браузере и как PWA.
        </p>

        <div className="w-full max-w-md space-y-3 mt-8">
          {!state.createdLink ? (
            <>
              <button
                onClick={handleCreate}
                disabled={state.loading}
                className="w-full h-14 rounded-2xl bg-[var(--accent)] text-white font-semibold text-lg flex items-center justify-center gap-2 hover:brightness-110 transition disabled:opacity-50"
              >
                {state.loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
                {t('landing.create')}
              </button>

              <button
                onClick={handleJoin}
                disabled={state.joining}
                className="w-full h-14 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] text-white font-semibold text-lg flex items-center justify-center gap-2 hover:border-[var(--accent)] transition disabled:opacity-50"
              >
                {state.joining ? (
                  <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Users className="w-5 h-5 text-[var(--accent)]" />
                )}
                {t('landing.join')}
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 h-14 px-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--accent)]/40">
                <LinkIcon className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span className="flex-1 text-sm text-white truncate font-mono text-left">{state.createdLink}</span>
                <button onClick={handleCopyLink} className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition shrink-0" aria-label={t('landing.copy')}>
                  {state.copied ? (
                    <Check className="w-4 h-4 text-[var(--success)]" />
                  ) : (
                    <Copy className="w-4 h-4 text-[var(--text-secondary)]" />
                  )}
                </button>
              </div>

              <div className="flex gap-2">
                <button onClick={handleCopyLink} className="flex-1 h-12 rounded-xl bg-[var(--bg-tertiary)] text-white font-medium flex items-center justify-center gap-2 hover:bg-[var(--bg-hover)] transition text-sm">
                  {state.copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {state.copied ? t('landing.copied') : t('landing.copy')}
                </button>
                <button onClick={handleGoToRoom} className="flex-1 h-12 rounded-xl bg-[var(--accent)] text-white font-medium flex items-center justify-center gap-2 hover:brightness-110 transition text-sm">
                  {t('landing.enter')}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {state.error && <p className="text-[var(--danger)] text-sm text-center">{state.error}</p>}

          {showInstallCta && (
            <button
              onClick={() => setInstallOpen(true)}
              className="w-full h-11 mt-2 rounded-xl text-sm text-[var(--text-secondary)] hover:text-white flex items-center justify-center gap-2 transition"
            >
              <Download className="w-4 h-4" />
              {t('install.cta')}
            </button>
          )}
        </div>

        <p data-landing-chrome className="mt-6 text-xs text-[var(--text-secondary)]/80">
          Бесплатно · Без учётной записи · Работает офлайн · Open-source
        </p>
      </section>

      {/* Features */}
      <section data-landing-chrome aria-labelledby="features-heading" className="max-w-5xl mx-auto w-full px-5 py-12 sm:py-20">
        <h2 id="features-heading" className="text-2xl sm:text-4xl font-bold tracking-tight text-center">Почему Lumina</h2>
        <p className="mt-3 text-center text-[var(--text-secondary)] max-w-2xl mx-auto">
          Минимальный интерфейс, максимальная приватность. Всё, что нужно для одной встречи — и ничего лишнего.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Lock className="w-5 h-5" />}
            title="E2E-шифрование"
            body="Ключ шифрования создаётся в браузере и передаётся во фрагменте URL. Сервер видит только зашифрованные пакеты и не может прослушать встречу."
          />
          <FeatureCard
            icon={<MonitorUp className="w-5 h-5" />}
            title="Демонстрация экрана"
            body="Покажите окно, вкладку или весь экран одним кликом. Поддерживается в Chrome, Edge, Safari, Firefox и Samsung Internet."
          />
          <FeatureCard
            icon={<MessageSquare className="w-5 h-5" />}
            title="Чат и реакции"
            body="Встроенный чат с Markdown-разметкой, поднятие руки и шесть эмодзи-реакций. Всё внутри встречи, без сторонних мессенджеров."
          />
          <FeatureCard
            icon={<Sparkles className="w-5 h-5" />}
            title="Без регистрации"
            body="Никаких email, телефонов, профилей. Создаёте комнату, отправляете ссылку — участники входят прямо из браузера."
          />
          <FeatureCard
            icon={<Zap className="w-5 h-5" />}
            title="PWA и офлайн"
            body="Устанавливается за один клик на iPhone, Android, Windows, macOS и Linux. Открывает ссылки на встречи напрямую в приложении."
          />
          <FeatureCard
            icon={<Globe className="w-5 h-5" />}
            title="Self-hosted"
            body="Разверните Lumina на своём сервере за одну команду. Исходный код открыт на GitHub, данные остаются в вашей инфраструктуре."
          />
        </div>
      </section>

      {/* Compare */}
      <section data-landing-chrome aria-labelledby="compare-heading" className="max-w-5xl mx-auto w-full px-5 py-12 sm:py-20 border-t border-[var(--border)]/40">
        <h2 id="compare-heading" className="text-2xl sm:text-4xl font-bold tracking-tight text-center">
          Чем Lumina отличается от Zoom, Google Meet и Jitsi
        </h2>
        <p className="mt-3 text-center text-[var(--text-secondary)] max-w-3xl mx-auto">
          Lumina — это российская self-hosted альтернатива крупным корпоративным сервисам видеоконференций. Ниже — честное сравнение по ключевым параметрам.
        </p>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-[var(--text-secondary)]">
                <th className="p-3 font-medium">Критерий</th>
                <th className="p-3 font-medium text-white">Lumina</th>
                <th className="p-3 font-medium">Zoom</th>
                <th className="p-3 font-medium">Google Meet</th>
                <th className="p-3 font-medium">Jitsi</th>
              </tr>
            </thead>
            <tbody className="[&_td]:p-3 [&_td]:border-t [&_td]:border-[var(--border)]/40">
              <tr><td>E2E-шифрование</td><td className="text-white">Всегда включено</td><td>Опционально, не во всех планах</td><td>Только 1:1-звонки</td><td>Опционально</td></tr>
              <tr><td>Регистрация</td><td className="text-white">Не нужна</td><td>Требуется</td><td>Требуется Google-аккаунт</td><td>Не нужна</td></tr>
              <tr><td>Лимит времени</td><td className="text-white">Нет</td><td>40 мин на бесплатном</td><td>60 мин на бесплатном</td><td>Нет</td></tr>
              <tr><td>Self-hosted</td><td className="text-white">Да, одна команда</td><td>Нет</td><td>Нет</td><td>Да</td></tr>
              <tr><td>Цена</td><td className="text-white">Бесплатно</td><td>Pro от $14.99/мес</td><td>Business от $12/мес</td><td>Бесплатно</td></tr>
              <tr><td>Русский интерфейс</td><td className="text-white">Да</td><td>Да</td><td>Да</td><td>Частично</td></tr>
              <tr><td>PWA-установка</td><td className="text-white">Да, из браузера</td><td>Отдельное приложение</td><td>Отдельное приложение</td><td>Частично</td></tr>
              <tr><td>Открытый исходный код</td><td className="text-white">Да</td><td>Нет</td><td>Нет</td><td>Да</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* How it works */}
      <section data-landing-chrome aria-labelledby="how-heading" className="max-w-5xl mx-auto w-full px-5 py-12 sm:py-20 border-t border-[var(--border)]/40">
        <h2 id="how-heading" className="text-2xl sm:text-4xl font-bold tracking-tight text-center">Как это работает</h2>
        <p className="mt-3 text-center text-[var(--text-secondary)] max-w-2xl mx-auto">
          От создания встречи до полного подключения — не больше тридцати секунд.
        </p>
        <ol className="mt-10 grid gap-6 sm:grid-cols-3 list-none">
          <Step
            n={1}
            title="Создайте комнату"
            body="Нажмите «Новая встреча» на главной. Сервер сгенерирует код, браузер создаст ключ шифрования и склеит шareable-ссылку с фрагментом."
          />
          <Step
            n={2}
            title="Отправьте ссылку"
            body="Скопируйте ссылку и отправьте её собеседникам любым удобным способом — в мессенджере, в почте, через QR-код."
          />
          <Step
            n={3}
            title="Подключитесь"
            body="Собеседник открывает ссылку, вводит имя, проверяет камеру и микрофон — и заходит во встречу. E2E-шифрование уже включено."
          />
        </ol>
      </section>

      {/* Use cases */}
      <section data-landing-chrome aria-labelledby="usecases-heading" className="max-w-5xl mx-auto w-full px-5 py-12 sm:py-20 border-t border-[var(--border)]/40">
        <h2 id="usecases-heading" className="text-2xl sm:text-4xl font-bold tracking-tight text-center">Сценарии использования</h2>
        <p className="mt-3 text-center text-[var(--text-secondary)] max-w-2xl mx-auto">
          Lumina одинаково хорошо работает для личных звонков, команды и образования.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          <UseCaseCard
            title="Удалённая работа"
            body="Ежедневные stand-up, планирования и ретроспективы без корпоративных учёток и корпоративных подписок. Self-hosted-сборка подходит для команд, которым важно хранить данные на своём сервере."
          />
          <UseCaseCard
            title="Онлайн-образование"
            body="Репетиторы, онлайн-школы и вузы проводят занятия без лимитов по времени. Встроенный чат с Markdown и демонстрация экрана заменяют доску и код-редактор."
          />
          <UseCaseCard
            title="Интервью и HR"
            body="Быстрые собеседования и HR-интервью без регистрации кандидата. Одна ссылка — одно интервью. Пригодится рекрутерам, журналистам, врачам на телеконсультациях."
          />
        </div>
      </section>

      {/* Security */}
      <section data-landing-chrome aria-labelledby="security-heading" className="max-w-5xl mx-auto w-full px-5 py-12 sm:py-20 border-t border-[var(--border)]/40">
        <h2 id="security-heading" className="text-2xl sm:text-4xl font-bold tracking-tight text-center">Безопасность и приватность</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 text-[var(--text-secondary)] leading-relaxed">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Сервер не видит содержимое встречи</h3>
            <p>Ключ шифрования генерируется в браузере через <code>crypto.getRandomValues</code> и кладётся во фрагмент URL. Фрагмент по протоколу HTTP никогда не отправляется на сервер — поэтому администратор сервера физически не может прослушать звонок.</p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Авторитет на стороне сервера</h3>
            <p>Отправитель каждого сообщения чата, реакции или сигнального пакета переписывается бэкендом из подписанного JWT. Клиент не может подменить участника, даже если получит исходники.</p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Строгая CSP и HSTS</h3>
            <p>
              На edge-узле nginx: <code>default-src 'self'</code>,{' '}
              <code>frame-ancestors 'none'</code>, HSTS preload (2 года), HTTP/2 и TLS 1.3. Rate-limit на уровне токен-бакета защищает от автоматизированных атак.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Российская юрисдикция</h3>
            <p>Публичный сервис lumina.su размещается в РФ и работает в рамках 152-ФЗ «О персональных данных». Подробнее — в <Link to="/privacy" className="underline">политике конфиденциальности</Link>.</p>
          </div>
        </div>
      </section>

      {/* Mini FAQ */}
      <section data-landing-chrome aria-labelledby="faq-heading" className="max-w-5xl mx-auto w-full px-5 py-12 sm:py-20 border-t border-[var(--border)]/40">
        <h2 id="faq-heading" className="text-2xl sm:text-4xl font-bold tracking-tight text-center">Часто задаваемые вопросы</h2>
        <p className="mt-3 text-center text-[var(--text-secondary)]">
          Самое важное — кратко. Полный список ответов — на <Link to="/faq" className="underline">странице FAQ</Link>.
        </p>
        <div className="mt-8 divide-y divide-[var(--border)]/40 max-w-3xl mx-auto">
          {miniFaq.map((f) => (
            <details key={f.q} className="py-4 group">
              <summary className="cursor-pointer list-none flex items-start justify-between gap-4">
                <h3 className="text-base sm:text-lg font-semibold text-white">{f.q}</h3>
                <span className="shrink-0 mt-1 text-[var(--text-secondary)] group-open:rotate-45 transition">+</span>
              </summary>
              <p className="mt-2 text-[var(--text-secondary)] leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div data-landing-chrome>
        <SiteFooter />
      </div>

      <InstallModal open={installOpen} onClose={() => setInstallOpen(false)} />
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  body: string;
}
function FeatureCard({ icon, title, body }: FeatureCardProps) {
  return (
    <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--bg-secondary)]/40 p-5">
      <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center">{icon}</div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">{body}</p>
    </article>
  );
}

interface StepProps { n: number; title: string; body: string }
function Step({ n, title, body }: StepProps) {
  return (
    <li className="rounded-2xl border border-[var(--border)]/60 p-5">
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--accent)] text-white text-sm font-semibold">{n}</div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">{body}</p>
    </li>
  );
}

interface UseCaseCardProps { title: string; body: string }
function UseCaseCard({ title, body }: UseCaseCardProps) {
  return (
    <article className="rounded-2xl border border-[var(--border)]/60 p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">{body}</p>
    </article>
  );
}
