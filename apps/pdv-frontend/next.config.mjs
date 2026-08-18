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
  assetPrefix: './',
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
