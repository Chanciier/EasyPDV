/** @type {import('next').NextConfig} */
const nextConfig = {
  // Export estático: o Electron carrega os arquivos direto, sem rodar servidor Next embutido.
  // Ver Claude/Projetos/EasyPDV/Arquitetura e Stack.md no cofre Obsidian.
  output: 'export',
  // Sem isso, o export gera caminhos absolutos (/_next/static/...) que quebram
  // sob file:// (o Electron tenta resolver a partir da raiz do disco, não da
  // pasta do index.html) — bug real, achado testando o instalador de verdade:
  // a tela carregava (HTML estático embutido) mas sem CSS/JS nenhum, então
  // nenhum botão reagia a clique (React nunca hidratava).
  //
  // `./` só funciona pra uma página na RAIZ do export (o PDV é single-page,
  // sempre foi só isso). As rotas /admin/* (painel admin, Fase 2, 2026-09-14)
  // ficam uma pasta abaixo (out/admin/login/index.html) — a partir dali,
  // "./_next/..." resolve pra "/admin/login/_next/..." (errado), 404 em tudo.
  // Achado testando de verdade: a build do Electron (single-page, file://)
  // e a build hospedada como site comum (múltiplas rotas, http://) têm
  // requisitos CONFLITANTES pro mesmo assetPrefix — não dá pra ser "a mesma
  // build" pros dois destinos como o plano original assumia (corrigido em
  // "Planejamento - Lembrete de Renovação do Clube.md" no cofre Obsidian).
  // `BUILD_TARGET=admin-web` troca pra caminho absoluto — funciona sob
  // http:// em qualquer profundidade de rota, mas quebraria sob file:// do
  // Electron, por isso não é o default. Existe também `NEXT_PUBLIC_BUILD_TARGET`
  // (mesmo valor, prefixo NEXT_PUBLIC_ pra ficar visível no bundle do
  // navegador) — usado em app/page.tsx pra redirecionar "/" pro painel
  // nesse build; esta variável aqui (sem o prefixo) só importa em build
  // time, não precisa ir pro bundle do cliente.
  assetPrefix: process.env.BUILD_TARGET === 'admin-web' ? undefined : './',
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
