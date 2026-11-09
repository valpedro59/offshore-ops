'use client';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../ui';

import { Mail, LockKeyhole, Building2, ArrowRight, ShieldCheck } from 'lucide-react';

const Login = () => {
  return (
    <div className="w-full">
      <Tabs defaultValue="connexion" className="w-full">
        {/* TABS */}
        <TabsList className="grid h-12 w-full grid-cols-2 rounded-xl bg-slate-100 p-1">
          <TabsTrigger
            value="connexion"
            className="rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-bleu data-[state=active]:shadow-sm"
          >
            Connexion
          </TabsTrigger>

          <TabsTrigger
            value="societe"
            className="rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-bleu data-[state=active]:shadow-sm"
          >
            Créer une société
          </TabsTrigger>
        </TabsList>

        {/* ================= CONNEXION ================= */}
        <TabsContent value="connexion" className="mt-5">
          <Card className="border-0 bg-white shadow-none">
            <CardHeader className="space-y-2 px-0 pt-2">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50">
                <LockKeyhole className="h-6 w-6 text-accentuation" />
              </div>

              <CardTitle className="text-2xl font-bold tracking-tight text-bleu">
                Bon retour !
              </CardTitle>

              <CardDescription className="text-sm leading-relaxed text-neutre">
                Connectez-vous à votre espace de gestion Offshore Ops.
              </CardDescription>
            </CardHeader>

            <form onSubmit={(e) => e.preventDefault()}>
              <CardContent className="space-y-5 px-0">
                {/* EMAIL */}
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-sm font-semibold text-bleu">
                    Adresse email
                  </Label>

                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <Input
                      id="login-email"
                      type="email"
                      placeholder="nom@entreprise.cg"
                      autoComplete="email"
                      required
                      className="h-12 rounded-xl border-slate-200 pl-10 text-sm focus-visible:border-accentuation focus-visible:ring-accentuation/20"
                    />
                  </div>
                </div>

                {/* PASSWORD */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="login-password" className="text-sm font-semibold text-bleu">
                      Mot de passe
                    </Label>

                    <button
                      type="button"
                      className="text-xs font-semibold text-accentuation transition-colors hover:text-accentuation"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>

                  <div className="relative">
                    <LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Votre mot de passe"
                      autoComplete="current-password"
                      required
                      className="h-12 rounded-xl border-slate-200 pl-10 text-sm focus-visible:border-accentuation focus-visible:ring-accentuation/20"
                    />
                  </div>
                </div>

                {/* REMEMBER */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember-device"
                    className="border-slate-300 data-[state=checked]:border-accentuation data-[state=checked]:bg-accentuation"
                  />

                  <Label
                    htmlFor="remember-device"
                    className="cursor-pointer text-sm font-normal text-slate-600"
                  >
                    Se souvenir de cet appareil
                  </Label>
                </div>
              </CardContent>

              {/* SUBMIT */}
              <CardFooter className="flex flex-col gap-5 px-0 pt-2">
                <Button
                  type="submit"
                  className="h-12 w-full rounded-xl bg-accentuation text-sm font-semibold text-white shadow-md shadow-orange-500/15 transition-all hover:bg-orange-700"
                >
                  Se connecter
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                {/* SECURITY NOTICE */}
                <div className="flex w-full items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-bleu">Accès sécurisé</p>

                    <p className="text-xs leading-relaxed text-neutre">
                      Verrouillage temporaire de 15 minutes après 5 échecs de connexion consécutifs.
                    </p>
                  </div>
                </div>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* ================= CREATION SOCIETE ================= */}
        <TabsContent value="societe" className="mt-5">
          <Card className="border-0 bg-white shadow-none">
            <CardHeader className="space-y-2 px-0 pt-2">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50">
                <Building2 className="h-6 w-6 text-accentuation" />
              </div>

              <CardTitle className="text-2xl font-bold tracking-tight text-bleu">
                Créez votre espace
              </CardTitle>

              <CardDescription className="text-sm leading-relaxed text-neutre">
                Configurez votre société et centralisez vos opérations.
              </CardDescription>
            </CardHeader>

            <form onSubmit={(e) => e.preventDefault()}>
              <CardContent className="space-y-5 px-0">
                {/* COMPANY NAME */}
                <div className="space-y-2">
                  <Label htmlFor="company-name" className="text-sm font-semibold text-bleu">
                    Nom de la société
                  </Label>

                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <Input
                      id="company-name"
                      type="text"
                      placeholder="Ex : Congo Subsea Services"
                      autoComplete="organization"
                      required
                      className="h-12 rounded-xl border-slate-200 pl-10 text-sm focus-visible:border-accentuation focus-visible:ring-accentuation/20"
                    />
                  </div>
                </div>

                {/* ADMIN EMAIL */}
                <div className="space-y-2">
                  <Label htmlFor="admin-email" className="text-sm font-semibold text-bleu">
                    Email administrateur
                  </Label>

                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="direction@entreprise.cg"
                      autoComplete="email"
                      required
                      className="h-12 rounded-xl border-slate-200 pl-10 text-sm focus-visible:border-accentuation focus-visible:ring-accentuation/20"
                    />
                  </div>
                </div>

                {/* PASSWORD */}
                <div className="space-y-2">
                  <Label htmlFor="company-password" className="text-sm font-semibold text-bleu">
                    Mot de passe
                  </Label>

                  <div className="relative">
                    <LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <Input
                      id="company-password"
                      type="password"
                      placeholder="8 caractères minimum"
                      autoComplete="new-password"
                      minLength={8}
                      required
                      className="h-12 rounded-xl border-slate-200 pl-10 text-sm focus-visible:border-accentuation focus-visible:ring-accentuation/20"
                    />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-4 px-0 pt-2">
                <Button
                  type="submit"
                  className="h-12 w-full rounded-xl bg-accentuation text-sm font-semibold text-white shadow-md shadow-orange-500/15 transition-all hover:bg-orange-700"
                >
                  Créer mon espace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <p className="text-center text-xs leading-relaxed text-slate-400">
                  En créant votre société, vous acceptez nos{' '}
                  <a href="/cgu" className="font-semibold text-accentuation hover:underline">
                    conditions générales d &apos; utilisation
                  </a>
                  .
                </p>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>

      {/* FOOTER */}
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
        <ShieldCheck className="h-4 w-4 text-emerald-500" />
        Vos données professionnelles sont protégées.
      </div>
    </div>
  );
};

export default Login;
