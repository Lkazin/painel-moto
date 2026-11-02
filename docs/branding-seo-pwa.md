# Identificação NovaesWeb Entregador

O projeto é React/Vite. Os metadados ficam em `index.html`, sem dependência ou migração para Next.js.

O domínio oficial configurado é `https://painel-moto-three.vercel.app/`. Canonical, Open Graph e Twitter usam apenas esse endereço fixo, sem telefone, sessão, código ou identificador de pedido. Os previews contêm somente a marca.

## Indexação

O inventário local encontrou uma única página HTML de SPA: acesso e telas operacionais autenticadas, sem página editorial pública. Não há acesso ao Search Console nesta sessão, nem proposta de palavras-chave ou conteúdo concorrente; aplica-se identificação estática solicitada pelo proprietário. A aplicação inteira recebe `noindex, nofollow` no HTML e na configuração de cabeçalhos Vercel. Nenhuma página privada é publicada em sitemap.

O `robots.txt` permite ler o HTML porque bloquear todo o rastreamento impediria o buscador de ler `noindex`. O caminho de API é bloqueado no robots; esse arquivo não substitui os controles de autenticação existentes. Referência: https://developers.google.com/search/docs/crawling-indexing/block-indexing.

## Instalação e cache

O manifesto principal é `manifest.webmanifest`. `manifest.json` permanece igual para compatibilidade com instalações existentes. O `id`, `start_url` e `scope` usam `/`, preservando a identidade de instalação existente; os atalhos da rota e pedidos continuam presentes.

Ícones normais usam somente o símbolo. O ícone maskable possui propósito separado e deve manter a arte dentro da área segura. Referência: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons.

O service worker usa uma nova versão de cache e remove apenas os caches antigos deste aplicativo. O cache aceita o shell público e assets estáticos, incluindo a logo leve de interface. Durante a instalação, extrai do HTML real apenas entradas JS/CSS locais em `/assets/`, sem parâmetros, para permitir que o primeiro retorno offline tenha o bundle necessário. As logos originais de alta resolução não são pré-carregadas. Não intercepta POST, APIs, endpoints privados, chamadas externas ou pedidos com cabeçalhos de autenticação. Não armazena respostas `private`/`no-store` nem query strings de ofertas.

## Validação e limites

`node --test --test-isolation=none scripts/branding-pwa.test.cjs` valida a identificação, o contrato do manifesto e o comportamento do service worker com rede simulada. `npm run build` verifica o bundle real. A instalação, os recortes dos ícones pelo sistema e a atualização de uma instalação antiga precisam de conferência no celular/navegador real; nenhum teste simulado equivale a isso.

Os cabeçalhos de `vercel.json` só estarão ativos após um deploy aprovado. Nenhuma autenticação, integração Supabase, pedido ou regra de logística foi alterada por esta revisão.

## Arquivos de marca

Em `public/brand/`:

- `novaesweb-entregador.png`: logo oficial sem slogan, PNG transparente.
- `novaesweb-entregador-ui.png`: derivação proporcional de 480 × 320 para o login, evitando baixar a arte grande no celular.
- `novaesweb-entregador-slogan.png`: segunda versão transparente, com o slogan fornecido.
- `novaesweb-symbol.png`: símbolo principal, sem nome ou slogan, para os ícones.
- `og-novaesweb-entregador.png`: apresentação da marca em 1200 × 630 para compartilhamento.

Favicons PNG de 16/32, ICO, ícones PWA de 192/512, Apple Touch Icon de 180 e maskable de 512 ficam na raiz de `public/`. Somente o símbolo entra nos ícones pequenos. O maskable tem fundo opaco e mantém a marca dentro do círculo seguro de raio 40%; o recorte foi verificado nos pixels reais. Os ícones de abertura do Android em `android/app/src/main/res/mipmap-*` receberam o mesmo símbolo e o fundo da marca. A logo do login preserva sua proporção com `height: auto` e `object-fit: contain`.

As duas imagens JPEG de referência tinham fundo preto. As versões transparentes e o símbolo foram preparados com a ferramenta integrada `image_gen`; as dimensões finais e os contêineres de ícones foram derivados proporcionalmente, sem redesenhar a marca em CSS ou SVG. `scripts/branding-artwork.test.cjs` valida o canal alpha, margens e área segura.

### Prompts das imagens

1. Logo sem slogan: “Edit the supplied NovaesWeb Entregador brand image. Remove ONLY the flat solid black background and make it genuinely transparent (RGBA alpha). Preserve the original logo design, exact typography 'NovaesWeb' and 'Entregador', the rider, motorcycle, letter N, all pink/purple/white colors, gradients, shadows, highlights, original proportions and geometry. No redesign, no extra text, no crop of logo, no new slogan, no checkerboard baked into image. Clean edges without black matte fringe. Keep the full emblem and brand wording as supplied, centered and intact with small transparent margin. This is an exact background removal for the existing official brand, not a new logo.”
2. Logo com slogan: “Exact background removal of the supplied NovaesWeb Entregador logo WITH its slogan. Remove the solid black background to actual transparent alpha. Keep ALL original elements intact, original shapes/colors/proportions and text EXACTLY: 'NovaesWeb', 'Entregador', 'Entregas mais rápidas, seguras e organizadas.' Pink/purple/white glossy logo unchanged. No redesign, no new background, no backdrop glow, no fake transparency grid. Preserve the entire logo including slogan and bottom underline, small transparent margins. Background MUST be fully transparent; black areas that are background between letters and around rider should also be transparent. Preserve legitimate dark purple outlines/shadows belonging to brand.”
3. Símbolo: “Extract ONLY the main top emblem from this existing NovaesWeb Entregador logo for the official app icon: the large pink/purple letter N, its sweeping arch, and the white motorcycle rider with motorcycle. Remove the bottom wordmark 'NovaesWeb', remove the bottom 'Entregador' badge, remove all slogan/words. Keep the small N on the delivery box as part of the original symbol. Preserve exact original shapes and glossy pink/purple/white gradients; do not invent or redesign anything. Compose the COMPLETE original top emblem, including the whole wheel and lower swoosh, fully intact and uncropped, centered in a square canvas with a small clear transparent margin, original proportions. Actual transparent alpha background, no colored or black backdrop, no fake checkerboard, no extra glow. This is a clean extraction from the given brand for favicon/PWA, not a new mark.”
