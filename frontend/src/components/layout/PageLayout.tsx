import { Link } from 'react-router-dom';
import { Video } from 'lucide-react';
import type { ReactNode } from 'react';

interface PageLayoutProps {
  children: ReactNode;
  /** Hero title to render inside <h1>. If absent, children should provide one. */
  heroTitle?: string;
  /** Hero sub-headline below the title. */
  heroLead?: string;
}

export function PageLayout({ children, heroTitle, heroLead }: PageLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-white safe-top safe-bottom">
      <header className="border-b border-[var(--border)]/60">
        <div className="max-w-5xl mx-auto px-5 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group" aria-label="На главную Lumina">
            <span className="w-9 h-9 rounded-xl bg-[var(--accent)] flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </span>
            <span className="text-xl font-bold tracking-tight group-hover:text-white/90">Lumina</span>
          </Link>
          <nav aria-label="Основная" className="hidden sm:flex items-center gap-6 text-sm text-[var(--text-secondary)]">
            <Link to="/about" className="hover:text-white transition">О сервисе</Link>
            <Link to="/faq" className="hover:text-white transition">FAQ</Link>
            <Link to="/install" className="hover:text-white transition">Установка</Link>
            <Link to="/" className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] text-white px-3 py-1.5 font-medium hover:brightness-110 transition">
              Начать встречу
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {(heroTitle || heroLead) && (
          <section className="max-w-5xl mx-auto px-5 pt-10 pb-4 sm:pt-16 sm:pb-6">
            {heroTitle && <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">{heroTitle}</h1>}
            {heroLead && <p className="mt-4 text-lg sm:text-xl text-[var(--text-secondary)] max-w-3xl">{heroLead}</p>}
          </section>
        )}
        <div className="max-w-5xl mx-auto px-5 pb-16 sm:pb-24">{children}</div>
      </main>

      <SiteFooter />
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)]/60 text-sm text-[var(--text-secondary)]">
      <div className="max-w-5xl mx-auto px-5 py-10 grid gap-8 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center">
              <Video className="w-4 h-4 text-white" />
            </span>
            <span className="text-base font-semibold text-white">Lumina</span>
          </div>
          <p className="mt-3 max-w-md">
            Self-hosted видеовстречи с end-to-end шифрованием. Бесплатно, без
            регистрации, в браузере и как PWA.
          </p>
        </div>
        <nav aria-label="Продукт">
          <h2 className="text-white font-semibold mb-3">Продукт</h2>
          <ul className="space-y-2">
            <li><Link to="/" className="hover:text-white">Новая встреча</Link></li>
            <li><Link to="/install" className="hover:text-white">Установка</Link></li>
            <li><Link to="/faq" className="hover:text-white">Вопросы и ответы</Link></li>
            <li><a href="https://github.com/shakhbanov/lumina" target="_blank" rel="noopener" className="hover:text-white">GitHub</a></li>
          </ul>
        </nav>
        <nav aria-label="Юридическое">
          <h2 className="text-white font-semibold mb-3">Юридическое</h2>
          <ul className="space-y-2">
            <li><Link to="/about" className="hover:text-white">О Lumina</Link></li>
            <li><Link to="/privacy" className="hover:text-white">Конфиденциальность</Link></li>
            <li><Link to="/terms" className="hover:text-white">Условия</Link></li>
            <li><a href="mailto:admin@lumina.su" className="hover:text-white">admin@lumina.su</a></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-[var(--border)]/60 py-6 text-center text-xs text-[var(--text-secondary)]/80">
        © {new Date().getFullYear()} Lumina — lumina.su · Исходный код открыт на GitHub
      </div>
    </footer>
  );
}
