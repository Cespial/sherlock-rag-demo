export const TEMAS = [
  "Crédito Digital",
  "Crowdfunding",
  "Factoring",
  "Insurtech",
  "Neobancos",
  "Pagos Digitales",
  "RegTech",
  "WealthTech",
] as const;

export const FILTRO_TIPOS = [
  "Extracto RC&M",
  "Ley",
  "Decreto",
  "Circular",
  "Resolución",
  "Concepto",
  "Sentencia",
] as const;

export const FILTRO_AUTORIDADES = [
  "Congreso",
  "SFC",
  "MinHacienda",
  "MinTIC",
  "URF",
  "Corte Constitucional",
  "Legislador",
] as const;

// Color mapping per Fintech vertical
export const VERTICAL_COLORS: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  "Crédito Digital": {
    bg: "bg-cyan-950/30",
    text: "text-cyan-400",
    border: "border-cyan-700/40",
    dot: "bg-cyan-400",
  },
  Crowdfunding: {
    bg: "bg-violet-950/30",
    text: "text-violet-400",
    border: "border-violet-700/40",
    dot: "bg-violet-400",
  },
  Factoring: {
    bg: "bg-amber-950/30",
    text: "text-amber-400",
    border: "border-amber-700/40",
    dot: "bg-amber-400",
  },
  Insurtech: {
    bg: "bg-emerald-950/30",
    text: "text-emerald-400",
    border: "border-emerald-700/40",
    dot: "bg-emerald-400",
  },
  Neobancos: {
    bg: "bg-rose-950/30",
    text: "text-rose-400",
    border: "border-rose-700/40",
    dot: "bg-rose-400",
  },
  "Pagos Digitales": {
    bg: "bg-blue-950/30",
    text: "text-blue-400",
    border: "border-blue-700/40",
    dot: "bg-blue-400",
  },
  RegTech: {
    bg: "bg-orange-950/30",
    text: "text-orange-400",
    border: "border-orange-700/40",
    dot: "bg-orange-400",
  },
  WealthTech: {
    bg: "bg-lime-950/30",
    text: "text-lime-400",
    border: "border-lime-700/40",
    dot: "bg-lime-400",
  },
};

export const DEFAULT_VERTICAL_COLOR = {
  bg: "bg-slate-800/30",
  text: "text-slate-400",
  border: "border-slate-700/40",
  dot: "bg-slate-400",
};

export interface ExampleQuery {
  text: string;
  filters?: {
    tema?: string;
    tipo?: string;
    autoridad?: string;
    ano?: string;
  };
}

export const EXAMPLE_QUERIES: ExampleQuery[] = [
  {
    text: "¿Qué es crowdfunding en Colombia y cómo está regulado?",
    filters: { tema: "Crowdfunding" },
  },
  {
    text: "¿Cuáles son los requisitos para operar como neobanco?",
    filters: { tema: "Neobancos" },
  },
  {
    text: "¿Qué normas regulan el factoring electrónico?",
    filters: { tema: "Factoring" },
  },
  {
    text: "¿Cómo se protegen los datos en pagos digitales?",
    filters: { tema: "Pagos Digitales" },
  },
  {
    text: "¿Qué obligaciones RegTech tienen las Fintech?",
    filters: { tema: "RegTech" },
  },
];
