/** @type {import('next').NextConfig} */
const nextConfig = {
  // Export estático: o Electron carrega os arquivos direto, sem rodar servidor Next embutido.
  // Ver Claude/Projetos/EasyPDV/Arquitetura e Stack.md no cofre Obsidian.
  output: 'export',
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
