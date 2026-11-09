import Login from '@/components/home/login';
import { features } from '@/lib/constants';
import { ShieldCheck, MapPin } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-bleu p-3 sm:p-5">
      <section className="relative isolate min-h-[calc(100vh-24px)] overflow-hidden rounded-2xl sm:min-h-[calc(100vh-40px)]">
        {/* PHOTO DE COUVERTURE */}
        <div
          className="absolute inset-0 -z-20 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1784911546489-a0bdc8160dbe?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D')",
          }}
        />

        {/* OVERLAY */}
        <div className="absolute inset-0 -z-10 bg-linear-to-r from-bleu via-bleu/90 to-bleu/30" />

        <div className="absolute inset-0 -z-10 bg-linear-to-t from-bleu/70 via-transparent to-bleu/20" />

        {/* CONTENU */}
        <div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-[1440px] flex-col justify-between gap-12 px-6 py-8 sm:min-h-[calc(100vh-40px)] sm:px-10 lg:flex-row lg:items-center lg:gap-16 lg:px-16 lg:py-12">
          {/* HERO */}
          <div className="flex w-full flex-col justify-center text-white lg:max-w-[650px]">
            {/* LOGO */}
            <div className="mb-14 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accentuation text-2xl font-bold">
                O
              </div>

              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">
                  Offshore <span className="text-accentuation">Ops</span>
                </h1>
                <p className="text-xs font-medium tracking-[0.25em] text-slate-300">CONGO</p>
              </div>
            </div>

            {/* BADGE */}
            <div className="mb-6 flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-slate-200">
                SOLUTION DE GESTION INDUSTRIELLE
              </span>
            </div>

            {/* TITRE */}
            <h2 className="max-w-[650px] text-4xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
              La plateforme tout-en-un pour les{' '}
              <span className="text-accentuation">sous-traitants parapétroliers.</span>
            </h2>

            <p className="mt-6 max-w-lg text-base leading-7 text-slate-300 sm:text-lg">
              Gérez vos opérations, maîtrisez vos stocks et sécurisez vos chantiers depuis une seule
              plateforme. Simplement, efficacement et en temps réel.
            </p>

            {/* FEATURES */}
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.title}
                    className="rounded-xl border border-white/15 bg-white/[0.06] p-4 backdrop-blur-md transition-colors hover:bg-white/10"
                  >
                    <Icon size={24} className="mb-4 text-accentuation" />

                    <h3 className="text-sm font-semibold text-white">{feature.title}</h3>

                    <p className="mt-1 text-xs leading-5 text-slate-400">{feature.description}</p>
                  </div>
                );
              })}
            </div>

            {/* FOOTER HERO */}
            <div className="mt-10 flex flex-wrap items-center gap-4 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <MapPin size={17} className="text-accentuation" />
                Pointe-Noire, République du Congo
              </div>

              <span className="hidden h-5 w-px bg-white/20 sm:block" />

              <div className="flex items-center gap-2">
                <ShieldCheck size={17} className="text-emerald-400" />
                Gestion sécurisée des opérations
              </div>
            </div>
          </div>

          <div className="flex w-full shrink-0 items-center justify-center lg:w-110">
            <div className="w-full rounded-2xl bg-white p-6 shadow-2xl sm:p-8 backdrop-blur-md">
              <Login />
            </div>
          </div>
        </div>

        {/* SIGNATURE */}
        <div className="absolute bottom-3 right-6 hidden text-[10px] tracking-widest text-white/40 lg:block">
          OFFSHORE OPS · INDUSTRIAL MANAGEMENT
        </div>
      </section>
    </main>
  );
}
