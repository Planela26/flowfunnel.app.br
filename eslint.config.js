import nextConfig from 'eslint-config-next';

export default [
  ...(Array.isArray(nextConfig) ? nextConfig : [nextConfig]),

  {
    // `artifacts/mockup-sandbox` é um sandbox herdado do Replit (tem o próprio
    // .replit-artifact/artifact.toml e o próprio package.json). Não entra em
    // build, não é importado por nada da aplicação, e ninguém vai corrigir
    // lint dele. Enquanto era varrido, respondia por 4 dos erros e inflava o
    // número que decide se a CI pode virar bloqueante.
    ignores: ['artifacts/**'],
  },

  {
    // `useMultiFileAuthState` vem do Baileys, não do React — e é chamada numa
    // rota de API, no servidor. O plugin de hooks só enxerga o prefixo `use` e
    // acusa rules-of-hooks. É falso positivo, e um falso positivo num arquivo
    // que ninguém pode "consertar" é justamente o que ensina a ignorar o lint.
    files: ['app/api/whatsapp/qr-stream/route.ts'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
];
