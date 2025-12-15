/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LEDGER_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
